const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 7000;

// 1. CORS-HEADER (Behebt NetworkError & Preflight-Anfragen in Stremio)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// 2. KATEGORIEN & SMART-TAGS (Suche & Dropdowns)
const CATEGORY_TAGS = {
  "Talk & Polit-Shows": ["Markus Lanz", "Caren Miosga", "Maischberger", "Hart aber fair", "maybrit illner"],
  "Satire & Comedy": ["heute-show", "ZDF Magazin Royale", "extra 3", "Die Anstalt"],
  "Krimi & Tatort": ["Tatort", "Polizeiruf", "SOKO", "Der Alte", "Wilsberg"],
  "Dokumentation & Wissen": ["Doku", "Reportage", "Terra X", "Quarks", "Weltspiegel"],
  "Nachrichten & Magazine": ["tagesschau", "tagesthemen", "heute journal", "brisant"],
  "Sport & Event": ["Sportschau", "sportstudio", "Fußball", "Wintersport"],
  "Film & Serie": ["Spielfilm", "Drama", "Komödie", "Fernsehfilm"],
  "Kinder & Familie": ["Sendung mit der Maus", "Löwenzahn", "logo!", "Checker Tobi"]
};

const GENRE_LIST = Object.keys(CATEGORY_TAGS);

// ICON (Clean SVG Base64)
const MYRO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="120" fill="#0f172a"/><g transform="translate(0, 10)" fill="#22c55e"><path d="M256,60 C270,140 310,210 380,240 C310,250 285,290 275,360 C265,310 260,290 237,360 C227,290 202,250 132,240 C202,210 242,140 256,60 Z"/></g></svg>`;
const ADDON_ICON_BASE64 = `data:image/svg+xml;base64,${Buffer.from(MYRO_ICON_SVG).toString("base64")}`;

// 3. STREMIO MANIFEST
const MANIFEST = {
  id: "com.myromiles.mediathekviewpro",
  version: "4.2.0",
  name: "MediathekViewPro",
  description: "Deutsche öffentlich-rechtliche Mediatheken (ARD, ZDF, Arte, 3sat) direkt in Stremio streamen.",
  icon: ADDON_ICON_BASE64,
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],
  idPrefixes: ["mvw:"],
  catalogs: [
    {
      type: "movie",
      id: "mediathek_all",
      name: "Mediathek: Neueste Inhalte",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }]
    },
    {
      type: "movie",
      id: "mediathek_ard",
      name: "ARD: Neueste Beiträge",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }]
    },
    {
      type: "movie",
      id: "mediathek_zdf",
      name: "ZDF: Neueste Beiträge",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }]
    },
    {
      type: "movie",
      id: "mediathek_arte",
      name: "Arte: Neueste Beiträge",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }]
    },
    {
      type: "movie",
      id: "mediathek_3sat",
      name: "3sat: Neueste Beiträge",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }]
    }
  ],
  behaviorHints: {
    configurable: false,
    configurationRequired: false
  }
};

// HELPER FÜR URL-ENCODING
function encodeId(url) {
  return "mvw:" + Buffer.from(url).toString("base64url");
}

function decodeId(id) {
  const clean = id.replace("mvw:", "").replace(".json", "");
  return Buffer.from(clean, "base64url").toString("utf-8");
}

// 4. ROUTEN

// LANDINGPAGE
app.get("/", (req, res) => {
  const host = req.get("host");
  const protocol = req.protocol;
  const manifestUrl = `${protocol}://${host}/manifest.json`;
  const stremioUrl = `stremio://${host}/manifest.json`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <title>MediathekViewPro API</title>
      <style>
        body { background-color: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
        h1 { color: #4ade80; }
        .btn { background-color: #22c55e; color: #0f172a; font-weight: bold; padding: 15px 32px; border-radius: 8px; text-decoration: none; display: inline-block; margin-bottom: 20px; }
        code { background-color: #1e293b; padding: 6px 12px; border-radius: 4px; color: #38bdf8; }
      </style>
    </head>
    <body>
      <h1>MediathekViewPro API v4.2</h1>
      <a class="btn" href="${stremioUrl}">In Stremio Installieren</a>
      <p style="color:#94a3b8;">Manifest URL:</p>
      <p><code>${manifestUrl}</code></p>
    </body>
    </html>
  `);
});

// MANIFEST ENDPOINT
app.get("/manifest.json", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json(MANIFEST);
});

// MEDIATHEK API FETCH LOGIK
async function fetchSmartMediathekItems(genre = "", search = "", channel = "") {
  let queryPayload = {
    queries: [],
    sortBy: "timestamp",
    sortOrder: "desc",
    future: false,
    offset: 0,
    size: 40
  };

  if (search) {
    queryPayload.queries.push({ fields: ["title", "topic"], query: search });
  } else if (genre && CATEGORY_TAGS[genre]) {
    const tags = CATEGORY_TAGS[genre];
    tags.forEach(tag => {
      queryPayload.queries.push({ fields: ["title", "topic"], query: tag });
    });
  } else {
    queryPayload.queries.push({ fields: ["title", "topic"], query: "Tagesschau" });
    queryPayload.queries.push({ fields: ["title", "topic"], query: "Tatort" });
  }

  if (channel) {
    queryPayload.queries.push({ fields: ["channel"], query: channel.toLowerCase() });
  }

  try {
    const response = await axios.post(
      "https://mediathekviewweb.de/api/query",
      JSON.stringify(queryPayload),
      {
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        timeout: 9000
      }
    );

    let raw = response.data?.result?.results || [];
    const unique = new Map();
    raw.forEach(item => {
      const link = item.url_video_hd || item.url_video || item.url_video_low;
      if (link && !unique.has(link)) {
        unique.set(link, item);
      }
    });

    return Array.from(unique.values());
  } catch (err) {
    console.error("Mediathek API Fehler:", err.message);
    return [];
  }
}

// KATALOG ROUTE
app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  
  const { id } = req.params;
  const rawPath = decodeURIComponent(req.path);

  let channel = "";
  if (id.includes("ard")) channel = "ARD";
  if (id.includes("zdf")) channel = "ZDF";
  if (id.includes("arte")) channel = "ARTE";
  if (id.includes("3sat")) channel = "3sat";

  let genre = "";
  let search = "";

  const genreMatch = rawPath.match(/genre=([^/.]+)/);
  if (genreMatch) genre = genreMatch[1];

  const searchMatch = rawPath.match(/search=([^/.]+)/);
  if (searchMatch) search = searchMatch[1];

  const items = await fetchSmartMediathekItems(genre, search, channel);

  const metas = items.map(item => {
    const targetUrl = item.url_video_hd || item.url_video || item.url_video_low;
    return {
      id: encodeId(targetUrl),
      type: "movie",
      name: item.title || "Mediathek Beitrag",
      poster: ADDON_ICON_BASE64,
      posterShape: "landscape",
      genres: [item.channel || "Mediathek", genre].filter(Boolean),
      description: `[${item.channel || "Mediathek"}] Thema: ${item.topic || "Allgemein"}\n\n${item.description || "Keine Beschreibung verfügbar."}`
    };
  });

  res.json({ metas });
});

// META ROUTE (Dynamisch für Detailansicht & Video-Fenster)
app.get("/meta/:type/:id.json", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const { id } = req.params;

  try {
    // Versuche, die Web-URL aus der mvw-ID zu dekodieren
    const originalUrl = decodeId(id);
    
    // Falls eine gültige URL vorhanden ist, nutze sie als Titel/Hinweis
    res.json({
      meta: {
        id: id,
        type: "movie",
        name: "Mediathek Stream",
        poster: ADDON_ICON_BASE64,
        background: ADDON_ICON_BASE64,
        description: `Stream-Link: ${originalUrl}\n\nKlicke unten auf das Addon-Symbol, um das Video zu starten.`,
        genres: ["Mediathek"]
      }
    });
  } catch (e) {
    // Fallback falls ID nicht dekodiert werden kann
    res.json({
      meta: {
        id: id,
        type: "movie",
        name: "Mediathek Beitrag",
        poster: ADDON_ICON_BASE64,
        description: "Beitrag aus der öffentlich-rechtlichen Mediathek."
      }
    });
  }
});