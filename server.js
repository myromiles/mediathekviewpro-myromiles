const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 7000;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  next();
});

const DEFAULT_CATEGORY_MAPPING = {
  "Talk & Polit-Shows": "Markus Lanz, Caren Miosga, Maischberger, Hart aber fair, maybrit illner",
  "Satire & Comedy": "heute-show, ZDF Magazin Royale, extra 3, Die Anstalt",
  "Krimi & Tatort": "Tatort, Polizeiruf, SOKO, Der Alte, Wilsberg",
  "Dokumentation & Wissen": "Doku, Reportage, Terra X, Quarks, Weltspiegel",
  "Nachrichten & Magazine": "tagesschau, tagesthemen, heute journal, brisant"
};

const ADDON_ICON_BASE64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiI+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMjAiIGZpbGw9IiMwZjE3MmEiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLCAxMCkiIGZpbGw9IiMyMmM1NWUiPjxwYXRoIGQ9Ik0yNTYsNjAgQzI3MCwxNDAgMzEwLDIxMCAzODAsMjQwIEMzMTAsMjUwIDI4NSwyOTAgMjc1LDM2MCBDMjY1LDMxMCAyNjAsMjkwIDIzNywzNjAgQzIyNywyOTAgMjAyLDI1MCAxMzIsMjQwIEMyMDIsMjEwIDI0MiwxNDAgMjU2LDYwIFoiLz48L2c+PC9zdmc+";

function encodeId(url) { return "mvw:" + Buffer.from(url).toString("base64url"); }
function decodeId(id) { return Buffer.from(id.replace("mvw:", "").replace(".json", ""), "base64url").toString("utf-8"); }

function parseConfig(configStr) {
  try {
    return JSON.parse(Buffer.from(configStr, "base64url").toString("utf-8"));
  } catch (e) { return { limit: 50, channels: ["ard", "zdf", "arte", "3sat"], mapping: DEFAULT_CATEGORY_MAPPING }; }
}

// NEUE, PRÄZISE API LOGIK
async function fetchSmartMediathekItems(search, channel, limit) {
  try {
    const payload = {
      queries: [],
      sortBy: "timestamp", sortOrder: "desc", size: limit
    };
    
    // Suche verfeinern
    if (search) {
      payload.queries.push({ fields: ["title", "topic"], query: search });
    }
    // Kanal separat als Bedingung
    if (channel && channel !== "all") {
      payload.queries.push({ fields: ["channel"], query: channel });
    }

    const response = await axios.post("https://mediathekviewweb.de/api/query", payload);
    return response.data?.result?.results || [];
  } catch (e) { return []; }
}

app.get("/:config?/manifest.json", (req, res) => {
  const config = parseConfig(req.params.config || "");
  res.json({
    id: "com.myromiles.mediathekviewpro", version: "5.7.0", name: "MediathekViewPro",
    resources: ["catalog", "meta", "stream"], types: ["movie"],
    catalogs: config.channels.map(ch => ({
      type: "movie", id: `mediathek_${ch}`, name: `${ch.toUpperCase()} Mediathek`,
      extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false, options: Object.keys(config.mapping || DEFAULT_CATEGORY_MAPPING) }]
    }))
  });
});

app.get("/:config?/catalog/:type/:id/:extra?.json", async (req, res) => {
  const config = parseConfig(req.params.config || "");
  const genre = req.query.genre || "";
  const search = req.query.search || "";
  const channel = req.params.id.replace("mediathek_", "");
  
  const searchFor = search || (genre ? (config.mapping || DEFAULT_CATEGORY_MAPPING)[genre] : "");
  
  const items = await fetchSmartMediathekItems(searchFor, channel, config.limit);

  res.json({ metas: items.map(item => ({
    id: encodeId(item.url_video_hd || item.url_video),
    type: "movie", name: item.title, poster: ADDON_ICON_BASE64,
    description: `[${item.channel}] ${item.topic}`
  })) });
});

app.get("/:config?/meta/:type/:id.json", (req, res) => res.json({ meta: { id: req.params.id, type: "movie", name: "Video", poster: ADDON_ICON_BASE64 } }));
app.get("/:config?/stream/:type/:id.json", (req, res) => res.json({ streams: [{ title: "Stream", url: decodeId(req.params.id) }] }));

app.listen(PORT, () => console.log(`Server v5.7 läuft`));