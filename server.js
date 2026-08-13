const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 7000;

// CORS-Header für Stremio-Kompatibilität
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// 1. ERWEITERTE WISSENSMATRIX (Moderatoren, Shows & Kategorien 2026)
const CATEGORY_TAGS = {
  "Talk & Polit-Shows": [
    "Markus Lanz", "Lanz", "Caren Miosga", "Miosga", "Sandra Maischberger", "Maischberger", 
    "Louis Klamroth", "Hart aber fair", "Maybrit Illner", "Illner", "Kölner Treff", "NDR Talk Show",
    "Mischke", "Gysi", "Prosieben Polit-Talk", "Klar"
  ],
  "Satire & Comedy": [
    "heute-show", "Oliver Welke", "ZDF Magazin Royale", "Jan Böhmermann", 
    "extra 3", "Christian Ehring", "Die Anstalt", "Sebastian Pufpaff", "MaiThink X", "Mai Thi Nguyen-Kim",
    "Kalkofe", "Hazel Brugger", "Browser Ballett", "Kroymann"
  ],
  "Krimi & Tatort": [
    "Tatort", "Polizeiruf 110", "SOKO", "Der Alte", "Ein Fall für zwei", "Kommissar", "Wilsberg",
    "Nord bei Nordwest", "Friesland", "Spurenstoff", "Der Staatsanwalt"
  ],
  "Dokumentation & Wissen": [
    "Doku", "Dokumentation", "Reportage", "Terra X", "Harald Lesch", "Quarks", "Florence Randrianarisoa",
    "Wissen vor acht", "Anja Reschke", "Weltspiegel", "auslandsjournal", "Geschichte", "Planet Wissen",
    "ZDFinfo", "Arte Discovery"
  ],
  "Nachrichten & Magazine": [
    "tagesschau", "tagesthemen", "heute journal", "heute 19 uhr", "hallo deutschland", "Marvin Fischer",
    "brisant", "auslandsjournal", "Maintower", "Lokalzeit", "Morgenmagazin", "Mittagsmagazin"
  ],
  "Sport & Event": [
    "Sportschau", "sportstudio", "Alexander Bommes", "Esther Sedlaczek", "Katrin Müller-Hohenstein",
    "Jochen Breyer", "Fußball", "Bundesliga", "Wintersport", "Formel 1", "Die Finals"
  ],
  "Film & Serie": [
    "Spielfilm", "Drama", "Komödie", "Fernsehfilm", "Babylon Berlin", "Herzkino", "Serienhighlight"
  ],
  "Kinder & Familie": [
    "Sendung mit der Maus", "Löwenzahn", "logo!", "pur+", "Eric Mayer", "KiKa", "Checker Tobi"
  ]
};

const GENRE_LIST = Object.keys(CATEGORY_TAGS);

// CANNBLATT-ICON (Base64 SVG)
const MYRO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="120" fill="#0f172a"/><rect x="10" y="10" width="492" height="492" rx="110" fill="none" stroke="#22c55e" stroke-width="8" opacity="0.4"/><g transform="translate(0, 10)" fill="#22c55e"><path d="M256,60 C270,140 310,210 380,240 C310,250 285,290 275,360 C265,310 260,290 256,280 C252,290 247,310 237,360 C227,290 202,250 132,240 C202,210 242,140 256,60 Z"/><path d="M260,250 C310,210 370,220 420,280 C360,290 330,320 310,380 C290,340 280,310 260,250 Z" opacity="0.9"/><path d="M260,290 C320,280 380,320 410,380 C350,380 320,400 300,430 C285,390 275,350 260,290 Z" opacity="0.85"/><path d="M252,250 C202,210 142,220 92,280 C152,290 182,320 202,380 C222,340 232,310 252,250 Z" opacity="0.9"/><path d="M252,290 C192,280 132,320 102,380 C162,380 192,400 212,430 C227,390 237,350 252,290 Z" opacity="0.85"/><path d="M248,350 L264,350 L260,450 L252,450 Z" fill="#16a34a"/></g><text x="256" y="475" text-anchor="middle" fill="#4ade80" font-family="Arial, sans-serif" font-size="28" font-weight="bold" letter-spacing="4">MYROMILES</text></svg>`;
const ADDON_ICON_BASE64 = `data:image/svg+xml;base64,${Buffer.from(MYRO_ICON_SVG).toString("base64")}`;

// MANIFEST DEFINITION
const MANIFEST = {
  id: "org.mediathekviewweb.streamflix.myromiles",
  version: "3.5.0",
  name: "MediathekViewPro",
  description: "Erweiterte Wissenssuche für Sendungen & Moderatoren. Powered by MyroMiles.",
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

app.get("/", (req, res) => res.send("<h1>MediathekViewPro API v3.5 Online</h1>"));
app.get("/manifest.json", (req, res) => res.json(MANIFEST));

// ERWEITERTE SUCHE MIT SCHICHTWEISER KATEGORISIEREUNG
async function fetchSmartMediathekItems({ query = "", channel = "", genre = "", limit = 100 }) {
  let queries = [];

  // Suchfelder: 'title', 'topic' UND NEU 'description' (für ungefilterte Moderatorensuche)
  const targetFields = ["title", "topic", "description"];

  if (genre && CATEGORY_TAGS[genre]) {
    const tags = CATEGORY_TAGS[genre];
    tags.forEach(tag => {
      queries.push({ fields: targetFields, query: tag });
    });
  } else if (query) {
    queries.push({ fields: targetFields, query: query });
  } else {
    queries.push({ fields: ["title"], query: "*" });
  }

  // Senderfilter falls ausgewählt
  if (channel) {
    queries = queries.map(q => ({
      ...q,
      fields: [...q.fields, "channel"],
      query: `${q.query} ${channel}`
    }));
  }

  const payload = {
    queries: queries,
    sortBy: "timestamp",
    sortOrder: "desc",
    offset: 0,
    size: limit
  };

  try {
    const response = await axios.post("https://api.mediathekviewweb.de/api/v1/query", payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 12000
    });

    let rawResults = response.data?.result?.results || [];

    // Duplikate aussortieren
    const uniqueMap = new Map();
    rawResults.forEach(item => {
      const link = item.url_video_hd || item.url_video || item.title;
      if (link && !uniqueMap.has(link)) {
        uniqueMap.set(link, item);
      }
    });

    return Array.from(uniqueMap.values());
  } catch (err) {
    console.error("API-Fetch-Fehler:", err.message);
    return [];
  }
}

// KATALOG ENDPOINT
app.get("/catalog/*", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const rawPath = req.path;
  let targetChannel = "";
  let searchQuery = "";
  let selectedGenre = "";

  if (rawPath.includes("mediathek_ard")) targetChannel = "ARD";
  else if (rawPath.includes("mediathek_zdf")) targetChannel = "ZDF";
  else if (rawPath.includes("mediathek_arte")) targetChannel = "ARTE";
  else if (rawPath.includes("mediathek_3sat")) targetChannel = "3sat";

  if (rawPath.includes("search=")) {
    const match = rawPath.match(/search=([^&./]+)/);
    if (match && match[1]) searchQuery = decodeURIComponent(match[1]);
  }

  if (rawPath.includes("genre=")) {
    const match = rawPath.match(/genre=([^&./]+)/);
    if (match && match[1]) selectedGenre = decodeURIComponent(match[1]);
  }

  const items = await fetchSmartMediathekItems({
    query: searchQuery,
    channel: targetChannel,
    genre: selectedGenre,
    limit: 100
  });

  const metas = items.map((item) => {
    const targetUrl = item.url_video_hd || item.url_video || item.url_video_low || item.title;
    const cleanId = "mvw:" + Buffer.from(targetUrl).toString("hex");

    return {
      id: cleanId,
      type: "movie",
      name: item.title || "Mediathek Beitrag",
      poster: ADDON_ICON_BASE64,
      posterShape: "landscape",
      genres: [item.channel || "Mediathek", selectedGenre].filter(Boolean),
      description: `[${item.channel || "Mediathek"}] Thema: ${item.topic || "Allgemein"}\n\n${item.description || "Keine Beschreibung verfügbar."}\n\nProvider: MyroMiles`,
      releaseInfo: item.timestamp ? new Date(item.timestamp * 1000).getFullYear().toString() : "2026"
    };
  });

  res.json({ metas });
});

// STREAM ENDPOINT
app.get("/stream/*", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const rawPath = req.path;
  const match = rawPath.match(/mvw:([^./]+)/);

  if (!match || !match[1]) return res.json({ streams: [] });

  let decodedUrl = "";
  try {
    decodedUrl = Buffer.from(match[1], "hex").toString("utf-8");
  } catch (e) {
    console.error("ID-Decoding Fehler:", e);
  }

  const streams = [];
  if (decodedUrl.startsWith("http")) {
    streams.push({
      name: "MyroMiles Mediathek",
      title: "Direct HD Video (MP4)",
      url: decodedUrl
    });
  }

  res.json({ streams });
});

app.listen(PORT, () => console.log(`MediathekViewPro v3.5.0 aktiv auf Port ${PORT}`));