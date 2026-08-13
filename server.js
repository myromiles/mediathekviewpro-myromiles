const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 7000;

// Exakte Suchbegriffe für die Mediathek-API
const CATEGORY_MAP = {
    "Krimi & Tatort": "Tatort",
    "Dokumentation": "Doku",
    "Talk & Show": "Lanz",
    "Comedy & Satire": "heute-show"
};

const ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiI+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMjAiIGZpbGw9IiMwZjE3MmEiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLCAxMCkiIGZpbGw9IiMyMmM1NWUiPjxwYXRoIGQ9Ik0yNTYsNjAgQzI3MCwxNDAgMzEwLDIxMCAzODAsMjQwIEMzMTAsMjUwIDI4NSwyOTAgMjc1LDM2MCBDMjY1LDMxMCAyNjAsMjkwIDIzNywzNjAgQzIyNywyOTAgMjAyLDI1MCAxMzIsMjQwIEMyMDIsMjEwIDI0MiwxNDAgMjU2LDYwIFoiLz48L2c+PC9zdmc+";

// API-Funktion mit exaktem String-Payload (wie von der API gefordert)
async function fetchItems(genre, channel) {
    let queries = [];

    const searchTerm = (genre && CATEGORY_MAP[genre]) ? CATEGORY_MAP[genre] : "";
    if (searchTerm) {
        queries.push({ fields: ["title", "topic"], query: searchTerm });
    }

    if (channel && channel !== "all") {
        queries.push({ fields: ["channel"], query: channel.toLowerCase() });
    }

    // Fallback falls gar kein Filter aktiv ist
    if (queries.length === 0) {
        queries.push({ fields: ["title"], query: "a" });
    }

    const payload = {
        queries: queries,
        sortBy: "timestamp",
        sortOrder: "desc",
        size: 50
    };

    try {
        // WICHTIG: Wir übergeben JSON.stringify als String und text/plain / application/json Header, 
        // damit die MediathekView-API den Request fehlerfrei parst.
        const res = await axios.post("https://mediathekviewweb.de/api/query", JSON.stringify(payload), {
            headers: { "Content-Type": "text/plain" }
        });
        return res.data?.result?.results || [];
    } catch (e) {
        console.error("API-Fehler:", e.message);
        return [];
    }
}

// Stremio Routen
app.get("/manifest.json", (req, res) => {
    res.json({
        id: "org.mediathek.pro", 
        version: "1.2.0", 
        name: "MediathekView Pro",
        resources: ["catalog", "meta", "stream"], 
        types: ["movie"],
        catalogs: ["ard", "zdf", "arte"].map(ch => ({
            type: "movie", 
            id: `cat_${ch}`, 
            name: `${ch.toUpperCase()} Mediathek`,
            extra: [{ name: "genre", isRequired: false, options: Object.keys(CATEGORY_MAP) }]
        }))
    });
});

app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
    const channel = req.params.id.replace("cat_", "");
    const genre = req.query.genre ? decodeURIComponent(req.query.genre) : "";
    const items = await fetchItems(genre, channel);

    res.json({ 
        metas: items.map(i => ({
            id: Buffer.from(i.url_video_hd || i.url_video || "").toString("base64"),
            type: "movie", 
            name: i.title || "Unbekannter Titel", 
            poster: ICON,
            description: `[${i.channel}] ${i.topic}\n\n${i.description || "Keine Beschreibung verfügbar."}`
        })) 
    });
});

app.get("/meta/:type/:id.json", (req, res) => {
    res.json({ 
        meta: { 
            id: req.params.id, 
            type: "movie", 
            name: "Mediathek Stream", 
            poster: ICON,
            description: "Öffentlicher Stream aus der Mediathek."
        } 
    });
});

app.get("/stream/:type/:id.json", (req, res) => {
    try {
        const url = Buffer.from(req.params.id, "base64").toString("utf-8");
        res.json({ streams: [{ url, title: "Direktstream (HD)" }] });
    } catch (e) {
        res.json({ streams: [] });
    }
});

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));