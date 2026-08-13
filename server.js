const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 7000;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  next();
});

// 1. MODERATOREN- & SENDUNGSDATENBANK (WISSENSMATRIX)
const SHOW_DATABASE = {
  // Talk & Polit-Shows
  "Markus Lanz": { host: "Markus Lanz", category: "Talk & Show", keywords: ["lanz", "markus lanz"] },
  "Caren Miosga": { host: "Caren Miosga", category: "Talk & Show", keywords: ["miosga", "caren miosga"] },
  "Maischberger": { host: "Sandra Maischberger", category: "Talk & Show", keywords: ["maischberger"] },
  "Hart aber fair": { host: "Louis Klamroth", category: "Talk & Show", keywords: ["hart aber fair", "klamroth"] },
  "maybrit illner": { host: "Maybrit Illner", category: "Talk & Show", keywords: ["illner", "maybrit illner"] },
  "Kölner Treff": { host: "Susan Link & Micky Beisenherz", category: "Talk & Show", keywords: ["kölner treff"] },
  "NDR Talk Show": { host: "Barbara Schöneberger & Hubertus Meyer-Burckhardt", category: "Talk & Show", keywords: ["ndr talk show"] },

  // Satire, Comedy & Unterhaltung
  "ZDF Magazin Royale": { host: "Jan Böhmermann", category: "Satire & Comedy", keywords: ["magazin royale", "böhmermann"] },
  "heute-show": { host: "Oliver Welke", category: "Satire & Comedy", keywords: ["heute show", "heute-show", "welke"] },
  "extra 3": { host: "Christian Ehring", category: "Satire & Comedy", keywords: ["extra 3", "extra3", "ehring"] },
  "TV total": { host: "Sebastian Pufpaff", category: "Satire & Comedy", keywords: ["pufpaff"] },
  "Dingsda / Shows": { host: "Kai Pflaume", category: "Talk & Show", keywords: ["kai pflaume", "wer weiß denn sowas"] },

  // Nachrichten & Magazine
  "tagesschau": { host: "Tagesschau-Team", category: "Nachrichten", keywords: ["tagesschau", "tagesthemen"] },
  "heute journal": { host: "ZDF-Heute-Team", category: "Nachrichten", keywords: ["heute journal", "heute-journal", "heute 19 uhr"] },
  "auslandsjournal": { host: "Antje Pieper", category: "Nachrichten", keywords: ["auslandsjournal"] },
  "Weltspiegel": { host: "Weltspiegel-Team", category: "Nachrichten", keywords: ["weltspiegel"] },

  // Sport & Event-Moderatoren
  "Sportschau": { host: "Alexander Bommes / Esther Sedlaczek", category: "Sport", keywords: ["sportschau", "bommes", "sedlaczek"] },
  "das aktuelle sportstudio": { host: "Katrin Müller-Hohenstein / Jochen Breyer", category: "Sport", keywords: ["sportstudio", "müller-hohenstein", "breyer"] },

  // Wissen, Natur & Dokus
  "Quarks": { host: "Florence Randrianarisoa / Ralph Caspers", category: "Wissen", keywords: ["quarks"] },
  "Terra X": { host: "Harald Lesch / Dirk Steffens", category: "Wissen", keywords: ["terra x", "lesch"] },
  "Wissen vor acht": { host: "Anja Reschke / Dennis Wilms", category: "Wissen", keywords: ["wissen vor acht", "reschke"] },
  "pur+": { host: "Eric Mayer", category: "Kinder", keywords: ["pur+", "pur plus"] },
  "logo!": { host: "logo!-Team", category: "Kinder", keywords: ["logo!"] }
};

// 2. KATEGORIEN & INTELLIGENTE KEYWORDS
const CATEGORIES = {
  "Talk & Show": ["talk", "show", "talkshow", "unterhaltung", "lanz", "maischberger", "hart aber fair", "kölner treff"],
  "Satire & Comedy": ["satire", "comedy", "böhmermann", "heute-show", "extra 3", "kabarett"],
  "Sport": ["sport", "fußball", "bundesliga", "olympia", "formel 1", "ski", "tennis", "tour de france", "handball", "sportschau", "sportstudio"],
  "Musik": ["musik", "konzert", "festival", "oper", "pop", "rock", "klassik", "orchester", "schlager", "sing", "band"],
  "Dokumentation": ["doku", "dokumentation", "reportage", "history", "geschichte", "natur", "wildlife", "entdeckung", "planet"],
  "Krimi": ["krimi", "tatort", "polizeiruf", "soko", "mord", "kommissar", "spuren", "kriminal"],
  "Film & Serie": ["film", "spielfilm", "serie", "drama", "komödie", "thriller", "kino"],
  "Nachrichten": ["nachrichten", "tagesschau", "heute", "journal", "aktuell", "briefing", "rundschau", "magazin"],
  "Wissen": ["wissen", "wissenschaft", "technik", "forschung", "quarks", "galileo", "raumfahrt", "medizin", "zukunft", "terra x"],
  "Kinder": ["kinder", "kika", "maus", "löwenzahn", "cartoon", "animation", "sesamstraße", "logo"]
};

const GENRE_LIST = Object.keys(CATEGORIES);

// CANNBLATT-ICON (Base64 SVG für das Addon-Menü)
const MYRO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="120" fill="#0f172a"/><rect x="10" y="10" width="492" height="492" rx="110" fill="none" stroke="#22c55e" stroke-width="8" opacity="0.4"/><g transform="translate(0, 10)" fill="#22c55e"><path d="M256,60 C270,140 310,210 380,240 C310,250 285,290 275,360 C265,310 260,290 256,280 C252,290 247,310 237,360 C227,290 202,250 132,240 C202,210 242,140 256,60 Z"/><path d="M260,250 C310,210 370,220 420,280 C360,290 330,320 310,380 C290,340 280,310 260,250 Z" opacity="0.9"/><path d="M260,290 C320,280 380,320 410,380 C350,380 320,400 300,430 C285,390 275,350 260,290 Z" opacity="0.85"/><path d="M252,250 C202,210 142,220 92,280 C152,290 182,320 202,380 C222,340 232,310 252,250 Z" opacity="0.9"/><path d="M252,290 C192,280 132,320 102,380 C162,380 192,400 212,430 C227,390 237,350 252,290 Z" opacity="0.85"/><path d="M248,350 L264,350 L260,450 L252,450 Z" fill="#16a34a"/></g><text x="256" y="475" text-anchor="middle" fill="#4ade80" font-family="Arial, sans-serif" font-size="28" font-weight="bold" letter-spacing="4">MYROMILES</text></svg>`;
const ADDON_ICON_BASE64 = `data:image/svg+xml;base64,${Buffer.from(MYRO_ICON_SVG).toString("base64")}`;

// MANIFEST
const MANIFEST = {
  id: "org.mediathekviewweb.streamflix.myromiles",
  version: "2.2.0",
  name: "MediathekViewPro",
  description: "Smart-Kategorien, Moderatoren-Erkennung & Unendlich-Scrollen. Developed by MyroMiles.",
  icon: ADDON_ICON_BASE64,
  background: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Das_Erste_Logo_2015.svg/1200px-Das_Erste_Logo_2015.svg.png",
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "tv"],
  idPrefixes: ["mvw:"],
  catalogs: [
    {
      type: "movie",
      id: "mediathek_all",
      name: "Mediathek: Alle Sender",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }, { name: "skip", isRequired: false }]
    },
    {
      type: "movie",
      id: "mediathek_ard",
      name: "Mediathek: ARD",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }, { name: "skip", isRequired: false }]
    },
    {
      type: "movie",
      id: "mediathek_zdf",
      name: "Mediathek: ZDF",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }, { name: "skip", isRequired: false }]
    },
    {
      type: "movie",
      id: "mediathek_arte",
      name: "Mediathek: Arte",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }, { name: "skip", isRequired: false }]
    },
    {
      type: "movie",
      id: "mediathek_3sat",
      name: "Mediathek: 3sat",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: GENRE_LIST }, { name: "skip", isRequired: false }]
    }
  ]
};

app.get("/manifest.json", (req, res) => res.json(MANIFEST));

// Helper 1: API-Abfrage mit Unendlich-Scrollen (Pagination) & 100 Treffern pro Ladung
async function fetchSmartMediathekItems({ query = "", channel = "", genre = "", skip = 0, limit = 100 }) {
  const queries = [];

  if (query) {
    queries.push({ fields: ["topic"], query: query });
    queries.push({ fields: ["title"], query: query });
  }

  if (channel) {
    queries.push({ fields: ["channel"], query: channel });
  }

  if (genre && CATEGORIES[genre]) {
    const keywords = CATEGORIES[genre];
    keywords.slice(0, 4).forEach((kw) => {
      queries.push({ fields: ["topic"], query: kw });
      queries.push({ fields: ["title"], query: kw });
    });
  }

  const payload = {
    queries: queries,
    sortBy: "timestamp",
    sortOrder: "desc",
    offset: skip, // Lädt dynamisch ab Position X
    size: limit   // Zeigt 100 Stk pro Ladung
  };

  try {
    const response = await axios.post("https://mediathekviewweb.de/api/query", payload, {
      headers: { "User-Agent": "Mozilla/5.0", "Content-Type": "application/json" },
      timeout: 8000
    });
    return response.data?.result?.results || [];
  } catch (err) {
    console.error("API Error:", err.message);
    return [];
  }
}

// Helper 2: Moderatoren- & Kategorie-Analyse
function analyzeItem(item) {
  const fullText = `${item.topic || ""} ${item.title || ""} ${item.description || ""}`.toLowerCase();
  
  let matchedHost = null;
  let detectedCategories = new Set();

  for (const [showName, data] of Object.entries(SHOW_DATABASE)) {
    if (data.keywords.some(kw => fullText.includes(kw))) {
      matchedHost = data.host;
      detectedCategories.add(data.category);
    }
  }

  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(kw => fullText.includes(kw))) {
      detectedCategories.add(category);
    }
  }

  const categoriesArray = Array.from(detectedCategories);
  return {
    host: matchedHost,
    categories: categoriesArray.length > 0 ? categoriesArray : ["Mediathek"]
  };
}

// Helper 3: Poster-Abruf
async function getLivePoster(title, channel) {
  const cleanTitle = (title || "").split("-")[0].split(":")[0].trim();
  const ch = (channel || "").toLowerCase();

  try {
    if (!ch.includes("zdf")) {
      const res = await axios.get(
        `https://api.ardmediathek.de/page-gateway/widgets/ard/search/vod?searchQuery=${encodeURIComponent(cleanTitle)}&pageNumber=0&pageSize=1`,
        { timeout: 3000 }
      );
      const img = res.data?.teasers?.[0]?.images?.aspect16x9?.src;
      if (img) return img.replace("{width}", "640");
    }
  } catch (e) {}

  if (ch.includes("zdf")) return "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/ZDF_2021_logo.svg/500px-ZDF_2021_logo.svg.png";
  if (ch.includes("arte")) return "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Arte_Logo.svg/500px-Arte_Logo.svg.png";
  if (ch.includes("3sat")) return "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/3sat_Logo_2019.svg/500px-3sat_Logo_2019.svg.png";

  return ADDON_ICON_BASE64;
}

// KATALOG ENDPOINT
app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
  const catalogId = req.params.id;
  const extraStr = req.params.extra || "";

  let searchQuery = "";
  let selectedGenre = "";
  let targetChannel = "";
  let skipCount = 0;

  if (catalogId === "mediathek_ard") targetChannel = "ARD";
  else if (catalogId === "mediathek_zdf") targetChannel = "ZDF";
  else if (catalogId === "mediathek_arte") targetChannel = "ARTE";
  else if (catalogId === "mediathek_3sat") targetChannel = "3sat";

  if (extraStr) {
    const searchMatch = extraStr.match(/search=([^&]+)/);
    if (searchMatch && searchMatch[1]) searchQuery = decodeURIComponent(searchMatch[1].replace(".json", ""));

    const genreMatch = extraStr.match(/genre=([^&]+)/);
    if (genreMatch && genreMatch[1]) selectedGenre = decodeURIComponent(genreMatch[1].replace(".json", ""));

    const skipMatch = extraStr.match(/skip=(\d+)/);
    if (skipMatch && skipMatch[1]) skipCount = parseInt(skipMatch[1], 10);
  }

  const items = await fetchSmartMediathekItems({
    query: searchQuery,
    channel: targetChannel,
    genre: selectedGenre,
    skip: skipCount,
    limit: 100
  });

  const metas = await Promise.all(
    items.map(async (item) => {
      const targetUrl = item.url_video_hd || item.url_video || item.url_video_low || item.title;
      const cleanId = "mvw:" + Buffer.from(targetUrl).toString("hex");
      const posterUrl = await getLivePoster(item.title, item.channel);
      
      const { host, categories } = analyzeItem(item);

      const durationMinutes = item.duration ? Math.round(item.duration / 60) : null;
      const durationStr = durationMinutes ? `\n\nDauer: ${durationMinutes} Min.` : "";
      const hostStr = host ? `\n🎙️ Moderation: ${host}` : "";

      return {
        id: cleanId,
        type: "movie",
        name: item.title || "Mediathek Beitrag",
        poster: posterUrl,
        posterShape: "landscape",
        background: posterUrl,
        banner: posterUrl,
        genres: [item.channel || "Mediathek", ...categories],
        description: `[${item.channel || "Mediathek"}] ${item.topic || ""}${hostStr}${durationStr}\n\n${item.description || "Keine Beschreibung verfügbar."}\n\nProvider: MyroMiles`,
        releaseInfo: item.timestamp ? new Date(item.timestamp * 1000).getFullYear().toString() : "2026"
      };
    })
  );

  res.json({ metas });
});

// META DETAILS
app.get("/meta/:type/:id.json", async (req, res) => {
  const cleanId = req.params.id.replace(".json", "");
  res.json({
    meta: {
      id: cleanId,
      type: "movie",
      name: "Mediathek Beitrag",
      poster: ADDON_ICON_BASE64,
      description: "Beitrag aus den öffentlich-rechtlichen Mediatheken. Developed by MyroMiles."
    }
  });
});

// STREAM ENDPOINT
app.get("/stream/:type/:id.json", async (req, res) => {
  let id = req.params.id.replace(".json", "");
  if (!id.startsWith("mvw:")) return res.json({ streams: [] });

  const hexData = id.replace("mvw:", "");
  let decodedUrl = "";

  try {
    decodedUrl = Buffer.from(hexData, "hex").toString("utf-8");
  } catch (e) {
    console.error("ID-Error:", e);
  }

  const streams = [];
  if (decodedUrl.startsWith("http")) {
    streams.push({
      name: "MyroMiles Mediathek",
      title: "Direct Stream (HD/SD MP4)",
      url: decodedUrl
    });
  }

  res.json({ streams });
});

app.listen(PORT, () => console.log(`MediathekViewPro v2.2.0 (Endlos-Scrollen & Matrix) läuft auf Port ${PORT}`));