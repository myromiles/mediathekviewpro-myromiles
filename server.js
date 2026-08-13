const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 7000;

// 1. Strikte CORS-Header & Content-Type Fixes
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// 2. Stremio Manifest Konfiguration
const MANIFEST = {
  id: "org.mediathekviewpro.myromiles",
  version: "2.2.0",
  name: "MediathekViewPro",
  description: "ARD, ZDF, Arte & 3sat Mediathek Addon by MyroMiles.",
  resources: ["catalog", "stream"],
  types: ["movie", "series"],
  idPrefixes: ["mvp:"],
  catalogs: [
    {
      type: "movie",
      id: "mediathek_browse",
      name: "Mediathek (DE)",
      extra: [
        {
          name: "genre",
          options: [
            "Alle",
            "Filme",
            "Krimis",
            "Dokumentationen",
            "Satire",
            "Sport",
            "ARD",
            "ZDF",
            "Arte",
            "3sat"
          ],
          isRequired: false
        },
        {
          name: "skip",
          isRequired: false
        }
      ]
    }
  ]
};

// Response-Helfer für das Manifest
const sendManifest = (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json(MANIFEST);
};

// 3. Routen: Reagiert auf /manifest.json, / UND alle Unterpfade ohne .json
app.get("/", sendManifest);
app.get("/manifest.json", sendManifest);
app.get("/manifest", sendManifest);

// Catch-All für Stremio-Sonderwege
app.use((req, res, next) => {
  if (req.path.endsWith("/manifest.json") || req.path === "/manifest") {
    return sendManifest(req, res);
  }
  next();
});

// 4. Katalog / Suche
app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const extra = req.params.extra ? parseExtraParams(req.params.extra) : {};
    const genre = extra.genre || "Alle";
    const skip = parseInt(extra.skip, 10) || 0;

    let queryPayload = {
      queries: [
        {
          fields: ["title", "topic"],
          query: getSearchQueryForGenre(genre)
        }
      ],
      sortBy: "timestamp",
      sortOrder: "desc",
      future: false,
      offset: skip,
      size: 50
    };

    if (["ARD", "ZDF", "Arte", "3sat"].includes(genre)) {
      queryPayload.queries = [
        {
          fields: ["channel"],
          query: genre
        }
      ];
    }

    const response = await axios.post("https://api.mediathekviewweb.de/api/v1/query", queryPayload, {
      headers: { "Content-Type": "application/json" },
      timeout: 8000
    });

    const items = response.data?.result?.results || [];

    const metas = items.map((item) => {
      const videoUrl = item.url_video || item.title || "https://example.com";
      const uniqueId = `mvp:${Buffer.from(videoUrl).toString("base64")}`;
      const channelName = item.channel ? `[${item.channel}] ` : "";
      
      return {
        id: uniqueId,
        type: "movie",
        name: `${channelName}${item.title}`,
        poster: item.url_video_low || item.url_website || "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=500",
        description: item.description || `Sendung von ${item.channel || "Öffentlich-Rechtlichen"}`,
        genres: [item.channel, genre].filter(Boolean)
      };
    });

    res.json({ metas });
  } catch (err) {
    console.error("Katalog-Fehler:", err.message);
    res.json({ metas: [] });
  }
});

// 5. Streams bereitstellen
app.get("/stream/:type/:id.json", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const rawId = req.params.id.replace("mvp:", "");
    const videoUrl = Buffer.from(rawId, "base64").toString("utf-8");

    if (videoUrl && videoUrl.startsWith("http")) {
      res.json({
        streams: [
          {
            title: "Direct HD Stream (Mediathek)",
            url: videoUrl
          }
        ]
      });
    } else {
      res.json({ streams: [] });
    }
  } catch (err) {
    console.error("Stream-Fehler:", err.message);
    res.json({ streams: [] });
  }
});

function parseExtraParams(extraStr) {
  const params = {};
  if (!extraStr) return params;
  const cleanStr = extraStr.replace(/\.json$/, "");
  cleanStr.split("&").forEach((pair) => {
    const [key, val] = pair.split("=");
    if (key && val) params[key] = decodeURIComponent(val);
  });
  return params;
}

function getSearchQueryForGenre(genre) {
  switch (genre) {
    case "Filme": return "Film Tatort Spielfilm Drama";
    case "Krimis": return "Krimi Tatort Polizeiruf SOKO";
    case "Dokumentationen": return "Doku Dokumentation Reportage";
    case "Satire": return "heute-show Magazin Royal Extra 3";
    case "Sport": return "Sportschau Sportstudio Bundesliga";
    default: return "*";
  }
}

app.listen(PORT, () => {
  console.log(`MediathekViewPro läuft auf Port ${PORT}`);
});