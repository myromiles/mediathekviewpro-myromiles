const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 7000;

// 1. CORS-HEADER (Pflicht für Stremio)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// 2. KATEGORIEN & SMART-TAGS
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

// CANNBLATT-ICON (Base64 SVG)
const MYRO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="120" fill="#0f172a"/><rect x="10" y="10" width="492" height="492" rx="110" fill="none" stroke="#22c55e" stroke-width="8" opacity="0.4"/><g transform="translate(0, 10)" fill="#22c55e"><path d="M256,60 C270,140 310,210 380,240 C310,250 285,290 275,360 C265,310 260,290 237,360 C227,290 202,250 132,240 C202,210 242,140 256,60 Z"/><path d="M260,250 C310,210 370,220 420,280 C360,290 330,320 310,380 C290,340 280,310 260,250 Z" opacity="0.9"/><path d="M260,290 C320,280 380,320 410,380 C350,380 320,400 300,430 C285,390 275,350 260,290 Z" opacity="0.85"/><path d="M252,250 C202,210 142,220 92,280 C152,290 182,320 202,380 C222,340 232,310 252,250 Z" opacity="0.9"/><path d="M252,290 C192,280 132,320 102,380 C162,380 192,400 212,430 C227,390 237,350 252,290 Z" opacity="0.85"/><path d="M248,350 L264,350 L260,450 L252,450 Z" fill="#16a34a"/></g><text x="256" y="475" text-anchor="middle" fill="#4ade80" font-family="Arial, sans-serif" font-size="28" font-weight="bold" letter-spacing="4">MYROMILES</text></svg>`;
const ADDON_ICON_BASE64 = `data:image/svg+xml;base64,${Buffer.from(MYRO_ICON_SVG).toString("base64")}`;

// STREMIO MANIFEST
const MANIFEST = {
  id: "org.mediathekviewweb.streamflix.myromiles",
  version: "3.7.0",
  name: "MediathekViewPro",
  description: "Erweiterte Mediatheken-Suche für Stremio. Powered by MyroMiles.",
  icon: ADDON_ICON_BASE64,
  resources: ["catalog", "meta", "stream"],
  types: ["movie"],
  idPrefixes: ["mvw:"],
  catalogs: [
    {
      type: "movie",
      id: "mediathek_all",
      name: "Mediathek: Alle Sender",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }]
    },
    {
      type: "movie",
      id: "mediathek_ard",
      name: "Mediathek: ARD",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }]
    },
    {
      type: "movie",
      id: "mediathek_zdf",
      name: "Mediathek: ZDF",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }]
    },
    {
      type: "movie",
      id: "mediathek_arte",
      name: "Mediathek: Arte",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }]
    },
    {
      type: "movie",
      id: "mediathek_3sat",
      name: "Mediathek: 3sat",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }]
    }
  ]
};

// 3. LANDINGPAGE
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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MediathekViewPro API v3.7</title>
      <style>
        body {
          background-color: #0f172a;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          text-align: center;
        }
        h1 { font-size: 2rem; margin-bottom: 20px; color: #4ade80; }
        .btn {
          display: inline-block;
          background-color: #22c55e;
          color: #0f172a;
          font-weight: bold;
          font-size: 1.2rem;
          padding: 15px 32px;
          border-radius: 8px;
          text-decoration: none;
          transition: background-color 0.2s ease, transform 0.1s ease;
          box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);
        }
        .btn:hover { background-color: #16a34a; color: #ffffff; transform: translateY(-2px); }
        .url-box {
          margin-top: 25px;
          font-size: 0.9rem;
          color: #94a3b8;
          word-break: break-all;
          max-width: 80%;
        }
      </style>
    </head>
    <body>
      <h1>MediathekViewPro API v3.7 Online</h1>
      <a class="btn" href="${stremioUrl}">In Stremio Installieren</a>
      <div class="url-box">
        <p>Manifest URL: <code>${manifestUrl}</code></p>
      </div>
    </body>
    </html>
  `);
});

// MANIFEST ENDPOINT
app.get("/manifest.json", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json(MANIFEST);
});

// 4. API FETCHING
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
    const mainTag = CATEGORY_TAGS[genre][0];
    queryPayload.queries.push({ fields: ["title", "topic"], query: mainTag });
  } else {
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

// 5. ROUTING & MIDDLEWARE

// KATALOG
app.use("/catalog", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const path = decodeURIComponent(req.path);

  let channel = "";
  if (path.includes("mediathek_ard")) channel = "ARD";
  if (path.includes("mediathek_zdf")) channel = "ZDF";
  if (path.includes("mediathek_arte")) channel = "ARTE";
  if (path.includes("mediathek_3sat")) channel = "3sat";

  let genre = "";
  const genreMatch = path.match(/genre=([^/.]+)/);
  if (genreMatch) genre = genreMatch[1];

  let search = "";
  const searchMatch = path.match(/search=([^/.]+)/);
  if (searchMatch) search = searchMatch[1];

  const items = await fetchSmartMediathekItems(genre, search, channel);

  const metas = items.map(item => {
    const targetUrl = item.url_video_hd || item.url_video || item.url_video_low || item.title;
    const cleanId = "mvw:" + Buffer.from(targetUrl).toString("hex");

    return {
      id: cleanId,
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

// META (Dynamisch auf Anfrage reagieren)
app.use("/meta", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const path = req.path;
  const match = path.match(/mvw:([^./]+)/);

  let reqId = "mvw:default";
  if (match && match[1]) {
    reqId = "mvw:" + match[1];
  }

  res.json({
    meta: {
      id: reqId,
      type: "movie",
      name: "Mediathek Beitrag",
      poster: ADDON_ICON_BASE64,
      description: "Öffentlich-rechtlicher Mediatheken-Stream."
    }
  });
});

// STREAM (Extrahiert Direct Video Link)
app.use("/stream", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const path = req.path;
  const match = path.match(/mvw:([^./]+)/);

  if (!match || !match[1]) return res.json({ streams: [] });

  let decodedUrl = "";
  try {
    decodedUrl = Buffer.from(match[1], "hex").toString("utf-8");
  } catch (e) {
    console.error("ID-Decoding Fehler:", e);
  }

  if (decodedUrl && decodedUrl.startsWith("http")) {
    return res.json({
      streams: [
        {
          name: "Mediathek",
          title: "Direct MP4 Stream (HD)",
          url: decodedUrl
        }
      ]
    });
  }

  res.json({ streams: [] });
});

app.listen(PORT, () => console.log(`Server v3.7 läuft auf Port ${PORT}`));