const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 7000;

// 1. CORS-Header & Preflight-Handling
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// 2. Absolut Stremio-konformes Manifest
const MANIFEST = {
  id: "org.mediathekviewpro.myromiles",
  version: "2.2.0",
  name: "MediathekViewPro",
  description: "ARD, ZDF, Arte & 3sat Mediathek Addon by MyroMiles.",
  resources: ["catalog", "stream"],
  types: ["movie"],
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

// Response-Helfer für Manifest
const sendManifest = (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json(MANIFEST);
};

// Landingpage & Manifest-Pfade
app.get("/", (req, res) => {
  const host = req.get("host");
  const stremioUrl = `stremio://${host}/manifest.json`;
  const manifestUrl = `https://${host}/manifest.json`;

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>MediathekViewPro</title>
        <style>
          body { font-family: sans-serif; background: #0f172a; color: #fff; text-align: center; padding: 40px; }
          .card { background: #1e293b; max-width: 480px; margin: 0 auto; padding: 30px; border-radius: 12px; }
          a.btn { display: inline-block; background: #8b5cf6; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 18px; margin-top: 20px; }
          a.btn:hover { background: #7c3aed; }
          input { width: 100%; padding: 10px; margin-top: 15px; box-sizing: border-box; background: #0f172a; border: 1px solid #475569; color: #fff; border-radius: 6px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>MediathekViewPro Addon</h1>
          <p>Öffentlich-Rechtliche Mediatheken in Stremio</p>
          <a class="btn" href="${stremioUrl}">🚀 Addon Installieren</a>
          <p style="margin-top: 25px; font-size: 13px; color: #94a3b8;">Oder kopiere diesen Link manuell in Stremio:</p>
          <input type="text" value="${manifestUrl}" readonly onclick="this.select();">
        </div>
      </body>
    </html>
  `);
});

app.get("/manifest.json", sendManifest);

// 3. Robustes Katalog-Handling (Catch-All für alle Stremio-Formate)
app.get("/catalog/*", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    // Extrahiere Genre & Skip dynamisch aus der URL
    const rawPath = req.path;
    let genre = "Alle";
    let skip = 0;

    if (rawPath.includes("genre=")) {
      const match = rawPath.match(/genre=([^&./]+)/);
      if (match && match[1]) genre = decodeURIComponent(match[1]);
    }

    if (rawPath.includes("skip=")) {
      const match = rawPath.match(/skip=([0-9]+)/);
      if (match && match[1]) skip = parseInt(match[1], 10);
    }

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

// 4. Stream-Handling
app.get("/stream/*", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const rawPath = req.path;
    const match = rawPath.match(/mvp:([^./]+)/);
    
    if (match && match[1]) {
      const videoUrl = Buffer.from(match[1], "base64").toString("utf-8");
      if (videoUrl && videoUrl.startsWith("http")) {
        return res.json({
          streams: [
            {
              title: "Direct HD Stream (Mediathek)",
              url: videoUrl
            }
          ]
        });
      }
    }
    res.json({ streams: [] });
  } catch (err) {
    console.error("Stream-Fehler:", err.message);
    res.json({ streams: [] });
  }
});

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
});app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));