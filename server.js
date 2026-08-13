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

// STARTSEITE: ZEIGT NUR DEN GEWÜNSCHTEN TEXT AN
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send("MediathekViewPro API v3.5 Online");
});

// MANIFEST ENDPOINT
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "org.mediathekviewweb.streamflix.myromiles",
    version: "3.5.0",
    name: "MediathekViewPro",
    description: "Powered by MyroMiles.",
    resources: ["catalog", "meta", "stream"],
    types: ["movie"],
    idPrefixes: ["mvw:"],
    catalogs: [
      {
        type: "movie",
        id: "mediathek_all",
        name: "Mediathek: Alle Sender",
        extra: [{ name: "search", isRequired: false }, { name: "genre", isRequired: false }]
      }
    ]
  });
});

// CATCH-ALL FÜR STREMIO KATALOG
app.use("/catalog", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const response = await axios.post("https://api.mediathekviewweb.de/api/v1/query", {
      queries: [{ fields: ["title"], query: "*" }],
      sortBy: "timestamp",
      sortOrder: "desc",
      size: 30
    }, { timeout: 5000 });

    const items = response.data?.result?.results || [];
    const metas = items.map(item => {
      const url = item.url_video_hd || item.url_video || item.title;
      return {
        id: "mvw:" + Buffer.from(url).toString("hex"),
        type: "movie",
        name: item.title || "Beitrag",
        posterShape: "landscape",
        description: item.description || ""
      };
    });
    res.json({ metas });
  } catch (e) {
    res.json({ metas: [] });
  }
});

// CATCH-ALL FÜR STREMIO META & STREAM
app.use("/meta", (req, res) => res.json({ meta: { id: "mvw:default", type: "movie", name: "Mediathek" } }));
app.use("/stream", (req, res) => {
  const match = req.path.match(/mvw:([^./]+)/);
  if (!match) return res.json({ streams: [] });
  const url = Buffer.from(match[1], "hex").toString("utf-8");
  res.json({ streams: [{ name: "MyroMiles", title: "Direct Stream", url }] });
});

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));