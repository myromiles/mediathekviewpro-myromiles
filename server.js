const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 7000;

// 1. CORS & Preflight-Handling (Verhindert Blockaden)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// 2. KATEGORIEN & TAGS
const CATEGORY_TAGS = {
  "Talk & Polit-Shows": ["Lanz", "Miosga", "Maischberger", "Illner", "Hart aber fair"],
  "Satire & Comedy": ["heute-show", "Böhmermann", "extra 3", "Die Anstalt", "Pufpaff"],
  "Krimi & Tatort": ["Tatort", "Polizeiruf", "SOKO", "Krimi", "Wilsberg"],
  "Dokumentation & Wissen": ["Terra X", "Lesch", "Quarks", "Doku", "Wissen vor acht"],
  "Nachrichten & Magazine": ["tagesschau", "heute journal", "tagesthemen", "brisant"],
  "Sport & Event": ["Sportschau", "sportstudio", "Fußball", "Bundesliga"],
  "Film & Serie": ["Spielfilm", "Fernsehfilm", "Drama", "Serie"],
  "Kinder & Familie": ["Maus", "Löwenzahn", "logo!", "pur+"]
};

const GENRE_LIST = Object.keys(CATEGORY_TAGS);

// CANNBLATT-ICON (Base64 SVG)
const MYRO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="120" fill="#0f172a"/><rect x="10" y="10" width="492" height="492" rx="110" fill="none" stroke="#22c55e" stroke-width="8" opacity="0.4"/><g transform="translate(0, 10)" fill="#22c55e"><path d="M256,60 C270,140 310,210 380,240 C310,250 285,290 275,360 C265,310 260,290 256,280 C252,290 247,310 237,360 C227,290 202,250 132,240 C202,210 242,140 256,60 Z"/><path d="M260,250 C310,210 370,220 420,280 C360,290 330,320 310,380 C290,340 280,310 260,250 Z" opacity="0.9"/><path d="M260,290 C320,280 380,320 410,380 C350,380 320,400 300,430 C285,390 275,350 260,290 Z" opacity="0.85"/><path d="M252,250 C202,210 142,220 92,280 C152,290 182,320 202,380 C222,340 232,310 252,250 Z" opacity="0.9"/><path d="M252,290 C192,280 132,320 102,380 C162,380 192,400 212,430 C227,390 237,350 252,290 Z" opacity="0.85"/><path d="M248,350 L264,350 L260,450 L252,450 Z" fill="#16a34a"/></g><text x="256" y="475" text-anchor="middle" fill="#4ade80" font-family="Arial, sans-serif" font-size="28" font-weight="bold" letter-spacing="4">MYROMILES</text></svg>`;
const ADDON_ICON_BASE64 = `data:image/svg+xml;base64,${Buffer.from(MYRO_ICON_SVG).toString("base64")}`;

// MANIFEST
const MANIFEST = {
  id: "org.mediathekviewweb.streamflix.myromiles",
  version: "4.0.0",
  name: "MediathekViewPro",
  description: "Öffentlich-Rechtliche Mediatheken. Developed by MyroMiles.",
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
    }
  ]
};

// HOMEPAGE & MANIFEST
app.get("/", (req, res) => res.send("<h1>MediathekViewPro v4.0 Online!</h1><p>Manifest-URL: /manifest.json</p>"));
app.get("/manifest.json", (req, res) => res.json(MANIFEST));

// SMART API FETCHING
async function fetchSmartMediathekItems(genre = "", search = "", channel = "") {
  let queries = [];

  if (genre && CATEGORY_TAGS[genre]) {
    CATEGORY_TAGS[genre].forEach(tag => {
      queries.push({ fields: ["title", "topic"], query: tag });
    });
  } else if (search) {
    queries.push({ fields: ["title", "topic"], query: search });
  } else {
    queries.push({ fields: ["title"], query: "*" });
  }

  if (channel) {
    queries = queries.map(q => ({
      ...q,
      fields: [...q.fields, "channel"],
      query: `${q.query} ${channel}`
    }));
  }

  try {
    const response = await axios.post("https://api.mediathekviewweb.de/api/v1/query", {
      queries: queries,
      sortBy: "timestamp",
      sortOrder: "desc",
      offset: 0,
      size: 40
    }, { timeout: 6000 });

    let raw = response.data?.result?.results || [];
    const unique = new Map();
    raw.forEach(item => {
      const link = item.url_video_hd || item.url_video || item.title;
      if (link && !unique.has(link)) unique.set(link, item);
    });

    return Array.from(unique.values());
  } catch (err) {
    console.error("API Error:", err.message);
    return [];
  }
}

// 3. UNIVERSAL CATCH-ALL ROUTING (VERHINDERT JEDEN 404-FEHLER)

// Katalog Abfangen
app.use("/catalog", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const path = decodeURIComponent(req.path);

  let channel = "";
  if (path.includes("mediathek_ard")) channel = "ARD";
  if (path.includes("mediathek_zdf")) channel = "ZDF";

  let genre = "";
  const genreMatch = path.match(/genre=([^/.]+)/);
  if (genreMatch) genre = genreMatch[1];

  let search = "";
  const searchMatch = path.match(/search=([^/.]+)/);
  if (searchMatch) search = searchMatch[1];

  const items = await fetchSmartMediathekItems(genre, search, channel);

  const metas = items.map(item => {
    const targetUrl = item.url_video_hd || item.url_video || item.title;
    const cleanId = "mvw:" + Buffer.from(targetUrl).toString("hex");

    return {
      id: cleanId,
      type: "movie",
      name: item.title || "Mediathek Beitrag",
      poster: ADDON_ICON_BASE64,
      posterShape: "landscape",
      genres: [item.channel || "Mediathek", genre].filter(Boolean),
      description: `[${item.channel || "Mediathek"}] ${item.topic || ""}\n\n${item.description || ""}`
    };
  });

  res.json({ metas });
});

// Meta Abfangen
app.use("/meta", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json({
    meta: {
      id: "mvw:default",
      type: "movie",
      name: "Mediathek Beitrag",
      poster: ADDON_ICON_BASE64,
      description: "Beitrag aus den öffentlich-rechtlichen Mediatheken."
    }
  });
});

// Stream Abfangen
app.use("/stream", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const path = req.path;
  const match = path.match(/mvw:([^./]+)/);

  if (!match || !match[1]) return res.json({ streams: [] });

  let decodedUrl = "";
  try {
    decodedUrl = Buffer.from(match[1], "hex").toString("utf-8");
  } catch (e) {}

  if (decodedUrl.startsWith("http")) {
    return res.json({
      streams: [{ name: "MyroMiles Mediathek", title: "Direct Stream (MP4)", url: decodedUrl }]
    });
  }

  res.json({ streams: [] });
});

app.listen(PORT, () => console.log(`Server v4.0 läuft auf Port ${PORT}`));