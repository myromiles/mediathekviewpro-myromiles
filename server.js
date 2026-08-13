const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 7000;

// 1. CORS-HEADER
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// Erweiterte Zuordnung: Kategorie-Name -> Echte Suchbegriffe für die Mediathek-API
const DEFAULT_CATEGORY_MAPPING = {
  "Talk & Polit-Shows": "Markus Lanz, Caren Miosga, Maischberger, Hart aber fair, maybrit illner",
  "Satire & Comedy": "heute-show, ZDF Magazin Royale, extra 3, Die Anstalt, neo royale",
  "Krimi & Tatort": "Tatort, Polizeiruf, SOKO, Der Alte, Wilsberg, Tatort Leipzig",
  "Dokumentation & Wissen": "Doku, Reportage, Terra X, Quarks, Weltspiegel, 30 Minuten",
  "Nachrichten & Magazine": "tagesschau, tagesthemen, heute journal, brisant, aspekte"
};

// ICON
const MYRO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="120" fill="#0f172a"/><g transform="translate(0, 10)" fill="#22c55e"><path d="M256,60 C270,140 310,210 380,240 C310,250 285,290 275,360 C265,310 260,290 237,360 C227,290 202,250 132,240 C202,210 242,140 256,60 Z"/></g></svg>`;
const ADDON_ICON_BASE64 = `data:image/svg+xml;base64,${Buffer.from(MYRO_ICON_SVG).toString("base64")}`;

const CHANNEL_LOGOS = {
  "ard": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/ARD_Logo_2019.svg/500px-ARD_Logo_2019.svg.png",
  "zdf": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/ZDF_Logo_2021.svg/500px-ZDF_Logo_2021.svg.png",
  "arte": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Arte_Logo.svg/500px-Arte_Logo.svg.png",
  "3sat": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/3sat_Logo_2019.svg/500px-3sat_Logo_2019.svg.png"
};

// HELPER FÜR URL-ENCODING
function encodeId(url) {
  return "mvw:" + Buffer.from(url).toString("base64url");
}

function decodeId(id) {
  const clean = id.replace("mvw:", "").replace(".json", "");
  return Buffer.from(clean, "base64url").toString("utf-8");
}

// PARST DIE CONFIG AUS DER URL
function parseConfig(configStr) {
  try {
    if (!configStr || configStr === "manifest.json" || configStr === "catalog") return getDefaultConfig();
    const jsonStr = Buffer.from(configStr, "base64url").toString("utf-8");
    return JSON.parse(jsonStr);
  } catch (e) {
    return getDefaultConfig();
  }
}

function getDefaultConfig() {
  return {
    limit: 50,
    channels: ["ard", "zdf", "arte", "3sat"],
    mapping: DEFAULT_CATEGORY_MAPPING
  };
}

// 2. MANIFEST GENERATOR
function getManifest(configStr = "") {
  const config = parseConfig(configStr);
  const mapping = config.mapping || DEFAULT_CATEGORY_MAPPING;
  const genreList = Object.keys(mapping);

  let catalogs = [];
  if (config.channels.includes("all") || config.channels.length > 1) {
    catalogs.push({
      type: "movie",
      id: "mediathek_all",
      name: "Mediathek: Neueste Inhalte",
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: genreList }]
    });
  }

  config.channels.forEach(ch => {
    if (ch !== "all") {
      catalogs.push({
        type: "movie",
        id: `mediathek_${ch}`,
        name: `${ch.toUpperCase()}: Neueste Beiträge`,
        extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: genreList }]
      });
    }
  });

  return {
    id: "com.myromiles.mediathekviewpro",
    version: "5.5.0",
    name: "MediathekViewPro (Config)",
    description: "Individuell konfigurierbare öffentlich-rechtliche Mediatheken für Stremio.",
    icon: ADDON_ICON_BASE64,
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    idPrefixes: ["mvw:"],
    catalogs: catalogs,
    behaviorHints: {
      configurable: true,
      configurationRequired: false
    }
  };
}

// 3. ROUTEN

// KONFIGURATIONSMASKE
app.get("/configure", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <title>MediathekViewPro Konfiguration</title>
      <style>
        body { background: #0f172a; color: #f8fafc; font-family: sans-serif; padding: 20px; max-width: 650px; margin: auto; }
        h1 { color: #4ade80; text-align: center; }
        label { display: block; margin-top: 15px; font-weight: bold; color: #38bdf8; }
        input, textarea { width: 100%; padding: 10px; margin-top: 5px; background: #1e293b; border: 1px solid #334155; color: white; border-radius: 6px; box-sizing: border-box; }
        .checkbox-group { display: flex; gap: 15px; margin-top: 5px; flex-wrap: wrap; }
        .checkbox-group label { font-weight: normal; color: white; display: flex; align-items: center; gap: 5px; cursor: pointer; }
        button { background: #22c55e; color: #0f172a; font-weight: bold; width: 100%; padding: 15px; border: none; border-radius: 8px; margin-top: 30px; font-size: 16px; cursor: pointer; }
        .hint { font-size: 12px; color: #94a3b8; margin-top: 2px; }
      </style>
    </head>
    <body>
      <h1>MediathekViewPro Konfigurator</h1>
      <form id="configForm">
        <label>Anzahl der Beiträge pro Liste (Limit):</label>
        <input type="number" id="limit" value="50" min="10" max="200">

        <label>Gewünschte Sender:</label>
        <div class="checkbox-group">
          <label><input type="checkbox" name="channel" value="ard" checked> ARD</label>
          <label><input type="checkbox" name="channel" value="zdf" checked> ZDF</label>
          <label><input type="checkbox" name="channel" value="arte" checked> Arte</label>
          <label><input type="checkbox" name="channel" value="3sat" checked> 3sat</label>
        </div>

        <label>Kategorien & Suchbegriffe (Format: Kategorie = Suchwort1, Suchwort2):</label>
        <textarea id="mappingText" rows="6">Talk & Polit-Shows = Markus Lanz, Caren Miosga, Maischberger, Hart aber fair
Satire & Comedy = heute-show, ZDF Magazin Royale, extra 3, Die Anstalt
Krimi & Tatort = Tatort, Polizeiruf, SOKO, Der Alte, Wilsberg
Dokumentation & Wissen = Doku, Reportage, Terra X, Quarks
Nachrichten & Magazine = tagesschau, tagesthemen, heute journal, brisant</textarea>
        <div class="hint">Links der Name in Stremio, rechts die Begriffe, nach denen in der Mediathek gesucht wird (mit Komma getrennt).</div>

        <button type="button" onclick="installAddon()">In Stremio installieren</button>
      </form>

      <script>
        function installAddon() {
          const limit = document.getElementById('limit').value;
          const channels = Array.from(document.querySelectorAll('input[name="channel"]:checked')).map(el => el.value);
          const rawText = document.getElementById('mappingText').value;

          const mapping = {};
          rawText.split('\\n').forEach(line => {
            if (line.includes('=')) {
              const parts = line.split('=');
              mapping[parts[0].trim()] = parts[1].trim();
            }
          });

          const configObj = { limit, channels, mapping };
          const configBase64 = btoa(JSON.stringify(configObj)).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");

          const host = window.location.host;
          const stremioUrl = \`stremio://\${host}/\${configBase64}/manifest.json\`;
          
          window.location.href = stremioUrl;
        }
      </script>
    </body>
    </html>
  `);
});

// LANDINGPAGE
app.get("/", (req, res) => {
  res.redirect("/configure");
});

// MANIFEST ROUTE
app.get("*", (req, res, next) => {
  if (!req.path.endsWith("/manifest.json")) return next();
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  
  const parts = req.path.split("/").filter(Boolean);
  let configStr = "";
  if (parts.length > 1 && parts[parts.length - 1] === "manifest.json" && parts[0] !== "manifest.json") {
    configStr = parts[0];
  }
  
  res.json(getManifest(configStr));
});

// DYNAMISCHE API FETCH LOGIK (Unterstützt mehrere Suchbegriffe pro Kategorie)
async function fetchSmartMediathekItems(searchQueries = "", channel = "", limit = 50) {
  let queryPayload = {
    queries: [],
    sortBy: "timestamp",
    sortOrder: "desc",
    future: false,
    offset: 0,
    size: parseInt(limit) || 50
  };

  if (searchQueries) {
    // Wenn mehrere Begriffe durch Komma getrennt sind, übergeben wir sie als Array (ODER-Verknüpfung)
    const terms = searchQueries.split(",").map(t => t.trim()).filter(Boolean);
    if (terms.length > 1) {
      // Wir suchen nach Beiträgen, die einen dieser Begriffe im Titel oder Thema enthalten
      queryPayload.queries.push({
        fields: ["title", "topic"],
        query: terms.join(" | ")
      });
    } else if (terms.length === 1) {
      queryPayload.queries.push({ fields: ["title", "topic"], query: terms[0] });
    } else {
      queryPayload.queries.push({ fields: ["title"], query: "a" });
    }
  } else {
    queryPayload.queries.push({ fields: ["title"], query: "a" });
  }

  if (channel) {
    queryPayload.queries.push({ fields: ["channel"], query: channel.toLowerCase() });
  }

  try {
    const response = await axios({
      method: "post",
      url: "https://mediathekviewweb.de/api/query",
      data: JSON.stringify(queryPayload),
      headers: { "Content-Type": "text/plain", "User-Agent": "Mozilla/5.0" },
      timeout: 10000
    });

    let raw = response.data?.result?.results || [];
    const unique = new Map();
    raw.forEach(item => {
      const link = item.url_video_hd || item.url_video || item.url_video_low;
      if (link && !unique.has(link)) unique.set(link, item);
    });
    return Array.from(unique.values());
  } catch (err) {
    return [];
  }
}

// POSTER HELPER
async function getDynamicPoster(title, channel) {
  const chName = (channel || "").toLowerCase().trim();
  let defaultPoster = ADDON_ICON_BASE64;
  for (const [key, logo] of Object.entries(CHANNEL_LOGOS)) {
    if (chName.includes(key)) { defaultPoster = logo; break; }
  }
  return defaultPoster;
}

// KATALOG ROUTE
app.get("*", async (req, res, next) => {
  if (!req.path.includes("/catalog/")) return next();
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const parts = req.path.split("/").filter(Boolean);
  let configStr = "";
  let catalogIdx = parts.indexOf("catalog");
  if (catalogIdx > 0) {
    configStr = parts[catalogIdx - 1];
  }

  const id = parts[catalogIdx + 2] || "";
  const extraParam = parts[catalogIdx + 3] || "";

  const config = parseConfig(configStr);
  const mapping = config.mapping || DEFAULT_CATEGORY_MAPPING;

  let channel = "";
  if (id.includes("ard")) channel = "ARD";
  else if (id.includes("zdf")) channel = "ZDF";
  else if (id.includes("arte")) channel = "ARTE";
  else if (id.includes("3sat")) channel = "3sat";

  let genre = "";
  let search = "";

  if (req.query.genre) genre = decodeURIComponent(req.query.genre);
  if (req.query.search) search = decodeURIComponent(req.query.search);

  if (!genre && extraParam.includes("genre=")) {
    const match = extraParam.match(/genre=([^/]+)/);
    if (match) genre = decodeURIComponent(match[1]);
  }
  if (!search && extraParam.includes("search=")) {
    const match = extraParam.match(/search=([^/]+)/);
    if (match) search = decodeURIComponent(match[1]);
  }

  // Ermittle die echten Suchbegriffe anhand des Mapping-Werts der Kategorie
  let searchQueriesToUse = search;
  if (!searchQueriesToUse && genre && mapping[genre]) {
    searchQueriesToUse = mapping[genre];
  } else if (!searchQueriesToUse && genre) {
    searchQueriesToUse = genre; // Fallback falls kein Mapping existiert
  }

  const items = await fetchSmartMediathekItems(searchQueriesToUse, channel, config.limit);

  const metas = await Promise.all(items.map(async item => {
    const targetUrl = item.url_video_hd || item.url_video || item.url_video_low;
    const posterUrl = await getDynamicPoster(item.title, item.channel);

    return {
      id: encodeId(targetUrl),
      type: "movie",
      name: item.title || "Mediathek Beitrag",
      poster: posterUrl,
      posterShape: "landscape",
      genres: [item.channel || "Mediathek", genre].filter(Boolean),
      description: `[${item.channel || "Mediathek"}] Thema: ${item.topic || "Allgemein"}\n\n${item.description || "Keine Beschreibung verfügbar."}`
    };
  }));

  res.json({ metas });
});

// META ROUTE
app.get("*", async (req, res, next) => {
  if (!req.path.includes("/meta/")) return next();
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const parts = req.path.split("/").filter(Boolean);
  const idWithExt = parts[parts.length - 1];
  const id = idWithExt.replace(".json", "");

  try {
    const originalUrl = decodeId(id);
    res.json({
      meta: {
        id: id, type: "movie", name: "Mediathek Stream",
        poster: ADDON_ICON_BASE64, background: ADDON_ICON_BASE64,
        description: `Stream-Link: ${originalUrl}\n\nKlicke unten auf den Stream, um das Video zu starten.`,
        genres: ["Mediathek"]
      }
    });
  } catch (e) {
    res.json({ meta: { id: id, type: "movie", name: "Mediathek Beitrag", poster: ADDON_ICON_BASE64, description: "Öffentlicher Stream." } });
  }
});

// STREAM ROUTE
app.get("*", async (req, res) => {
  if (!req.path.includes("/stream/")) return res.status(404).send("Not Found");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const parts = req.path.split("/").filter(Boolean);
  const idWithExt = parts[parts.length - 1];
  const id = idWithExt.replace(".json", "");

  try {
    const streamUrl = decodeId(id);
    if (streamUrl && streamUrl.startsWith("http")) {
      return res.json({ streams: [{ name: "MediathekView", title: "Direktstream (HD)", url: streamUrl }] });
    }
  } catch (e) {}
  res.json({ streams: [] });
});

app.listen(PORT, () => console.log(`Config-Server v5.5 läuft auf Port ${PORT}`));