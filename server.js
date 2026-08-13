const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 7000;

// CORS-Header für Stremio / Streamflix setzen
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  next();
});

// Stremio Manifest Konfiguration
const MANIFEST = {
  id: "org.mediathekviewpro.myromiles",
  version: "2.2.0",
  name: "MediathekViewPro",
  description: "ARD, ZDF, Arte, 3sat & WDR Mediathek Addon mit Smart Categories & Endlos-Scrollen. Developed by MyroMiles.",
  resources: ["catalog", "stream"],
  types: ["tv", "movie"],
  idPrefixes: ["mvp:"],
  catalogs: [
    {
      type: "tv",
      id: "mediathek_browse",
      name: "Mediathek (DE)",
      extra: [
        {
          name: "genre",
          options: [
            "Neueste Beiträge",
            "Spielfilme & Fernsehfilme",
            "Krimis & Thriller",
            "Dokumentationen",
            "Satire & Comedy",
            "Sport & Highlights",
            "ARD Mediathek",
            "ZDF Mediathek",
            "Arte DE",
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

// 1. Hauptpfade (Löst das "Cannot GET"-Problem auf Render.com)
app.get("/", (req, res) => res.json(MANIFEST));
app.get("/manifest.json", (req, res) => res.json(MANIFEST));

// 2. Katalog / Suche
app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
  try {
    const extra = req.params.extra ? parseExtraParams(req.params.extra) : {};
    const genre = extra.genre || "Neueste Beiträge";
    const skip = parseInt(extra.skip) || 0;

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

    // Sender-Filter anwenden
    if (["ARD Mediathek", "ZDF Mediathek", "Arte DE", "3sat"].includes(genre)) {
      const channelMap = {
        "ARD Mediathek": "ARD",
        "ZDF Mediathek": "ZDF",
        "Arte DE": "Arte",
        "3sat": "3sat"
      };
      queryPayload.queries = [
        {
          fields: ["channel"],
          query: channelMap[genre]
        }
      ];
    }

    const response = await axios.post("https://api.mediathekviewweb.de/api/v1/query", queryPayload, {
      headers: { "Content-Type": "application/json" },
      timeout: 8000
    });

    const items = response.data?.result?.results || [];

    const metas = items.map((item) => {
      const uniqueId = `mvp:${Buffer.from(item.url_video || item.title).toString("base64")}`;
      const channelName = item.channel ? `[${item.channel}] ` : "";
      
      return {
        id: uniqueId,
        type: "tv",
        name: `${channelName}${item.title}`,
        poster: item.url_video_low || item.url_website || "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=500",
        description: item.description || `Sendung von ${item.channel || "Öffentlich-Rechtlichen"} (${item.duration ? Math.round(item.duration / 60) + " Min." : ""})`,
        genres: [item.channel, genre].filter(Boolean)
      };
    });

    res.json({ metas });
  } catch (err) {
    console.error("Katalog-Fehler:", err.message);
    res.json({ metas: [] });
  }
});

// 3. Streams bereitstellen
app.get("/stream/:type/:id.json", async (req, res) => {
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

// Hilfsfunktionen
function parseExtraParams(extraStr) {
  const params = {};
  extraStr.split("&").forEach((pair) => {
    const [key, val] = pair.split("=");
    if (key && val) params[key] = decodeURIComponent(val);
  });
  return params;
}

function getSearchQueryForGenre(genre) {
  switch (genre) {
    case "Spielfilme & Fernsehfilme": return "Film Tatort Spielfilm Drama";
    case "Krimis & Thriller": return "Krimi Tatort Polizeiruf SOKO";
    case "Dokumentationen": return "Doku Dokumentation Reportage Geschichte";
    case "Satire & Comedy": return "heute-show Magazin Royal Extra 3 Anstalt Comedy";
    case "Sport & Highlights": return "Sportschau Sportstudio Fußball Bundesliga Highlights";
    default: return "*";
  }
}

// Server starten
app.listen(PORT, () => {
  console.log(`MediathekViewPro v2.2.0 läuft auf Port ${PORT}`);
});