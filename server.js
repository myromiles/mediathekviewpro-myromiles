const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 7000;

// CORS-Header
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Stremio Manifest
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
          options: ["Alle", "Filme", "Krimis", "Dokumentationen", "Satire", "Sport", "ARD", "ZDF", "Arte", "3sat"],
          isRequired: false
        },
        { name: "skip", isRequired: false }
      ]
    }
  ]
};

const sendManifest = (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json(MANIFEST);
};

// 1. Schöne Landingpage mit echtem Install-Button für den Browser
app.get("/", (req, res) => {
  const host = req.get("host");
  const manifestUrl = `https://${host}/manifest.json`;
  const stremioUrl = `stremio://${host}/manifest.json`;
  
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>MediathekViewPro Stremio Addon</title>
        <style>
          body { font-family: Arial, sans-serif; background: #0b0c10; color: #fff; text-align: center; padding: 50px; }
          .card { background: #1f2833; max-width: 500px; margin: auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
          h1 { color: #66fcf1; }
          .btn { display: inline-block; background: #45a29e; color: #fff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; margin-top: 20px; font-size: 18px; }
          .btn:hover { background: #66fcf1; color: #0b0c10; }
          input { width: 90%; padding: 10px; margin-top: 20px; background: #0b0c10; border: 1px solid #45a29e; color: #fff; border-radius: 4px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>MediathekViewPro Addon</h1>
          <p>Klicke unten, um das Addon direkt in Stremio zu installieren:</p>
          <a class="btn" href="${stremioUrl}">🚀 In Stremio Installieren</a>
          <br><br>
          <p style="font-size: 12px; color: #aaa;">Oder kopiere den Manifest-Link manuell:</p>
          <input type="text" value="${manifestUrl}" readonly onclick="this.select();">
        </div>
      </body>
    </html>
  `);
});

app.get("/manifest.json", sendManifest);

// Katalog-Route
app.get(["/catalog/:type/:id.json", "/catalog/:type/:id/:extra.json"], async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const extraStr = req.params.extra || "";
    const extra = parseExtraParams(extraStr);
    const genre = extra.genre || "Alle";
    const skip = parseInt(extra.skip, 10) || 0;

    let queryPayload = {
      queries: [{ fields: ["title", "topic"], query: getSearchQueryForGenre(genre) }],
      sortBy: "timestamp",
      sortOrder: "desc",
      future: false,
      offset: skip,
      size: 50
    };

    if (["ARD", "ZDF", "Arte", "3sat"].includes(genre)) {
      queryPayload.queries = [{ fields: ["channel"], query: genre }];
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
    res.json({ metas: [] });
  }
});

// Stream-Route
app.get("/stream/:type/:id.json", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const rawId = req.params.id.replace("mvp:", "");
    const videoUrl = Buffer.from(rawId, "base64").toString("utf-8");

    if (videoUrl && videoUrl.startsWith("http")) {
      res.json({ streams: [{ title: "Direct HD Stream (Mediathek)", url: videoUrl }] });
    } else {
      res.json({ streams: [] });
    }
  } catch (err) {
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

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));