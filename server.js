const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 7000;

const CATEGORY_MAP = {
    "Krimi & Tatort": "Tatort",
    "Dokumentation": "Doku",
    "Talk & Show": "Lanz",
    "Comedy & Satire": "heute-show"
};

const ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiI+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMjAiIGZpbGw9IiMwZjE3MmEiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLCAxMCkiIGZpbGw9IiMyMmM1NWUiPjxwYXRoIGQ9Ik0yNTYsNjAgQzI3MCwxNDAgMzEwLDIxMCAzODAsMjQwIEMzMTAsMjUwIDI4NSwyOTAgMjc1LDM2MCBDMjY1LDMxMCAyNjAsMjkwIDIzNywzNjAgQzIyNywyOTAgMjAyLDI1MCAxMzIsMjQwIEMyMDIsMjEwIDI0MiwxNDAgMjU2LDYwIFoiLz48L2c+PC9zdmc+";

// CORS für alle Anfragen erlauben
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") return res.status(200).end();
    next();
});

async function fetchItems(genre, channel) {
    let queries = [];
    const searchTerm = (genre && CATEGORY_MAP[genre]) ? CATEGORY_MAP[genre] : "";
    if (searchTerm) {
        queries.push({ fields: ["title", "topic"], query: searchTerm });
    }
    if (channel && channel !== "all" && channel !== "neueste") {
        queries.push({ fields: ["channel"], query: channel.toLowerCase() });
    }
    if (queries.length === 0) {
        queries.push({ fields: ["title"], query: "a" });
    }

    try {
        const res = await axios.post("https://mediathekviewweb.de/api/query", {
            queries: queries,
            sortBy: "timestamp",
            sortOrder: "desc",
            size: 50
        }, {
            headers: { "Content-Type": "application/json" }
        });
        return res.data?.result?.results || [];
    } catch (e) {
        console.error("Mediathek API Fehler:", e.message);
        return [];
    }
}

// Stremio Manifest
app.get("/manifest.json", (req, res) => {
    res.json({
        id: "org.mediathek.pro",
        version: "1.3.0",
        name: "MediathekView Pro",
        description: "Öffentlich-rechtliche Mediatheken für Stremio",
        resources: ["catalog", "meta", "stream"],
        types: ["movie"],
        catalogs: [
            { type: "movie", id: "mediathek_neueste", name: "Mediathek: Neueste Inhalte", extra: [{ name: "genre", isRequired: false, options: Object.keys(CATEGORY_MAP) }] },
            { type: "movie", id: "mediathek_ard", name: "ARD: Neueste Beiträge", extra: [{ name: "genre", isRequired: false, options: Object.keys(CATEGORY_MAP) }] },
            { type: "movie", id: "mediathek_zdf", name: "ZDF: Neueste Beiträge", extra: [{ name: "genre", isRequired: false, options: Object.keys(CATEGORY_MAP) }] },
            { type: "movie", id: "mediathek_arte", name: "ARTE: Neueste Beiträge", extra: [{ name: "genre", isRequired: false, options: Object.keys(CATEGORY_MAP) }] }
        ]
    });
});

// Katalog Route
app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
    const catalogId = req.params.id;
    let channel = "all";
    if (catalogId.includes("ard")) channel = "ard";
    else if (catalogId.includes("zdf")) channel = "zdf";
    else if (catalogId.includes("arte")) channel = "arte";

    const genre = req.query.genre ? decodeURIComponent(req.query.genre) : "";
    console.lade(`Lade Katalog: ${catalogId} | Genre: ${genre}`);

    const items = await fetchItems(genre, channel);

    res.json({
        metas: items.map(i => ({
            id: "mvw:" + Buffer.from(i.url_video_hd || i.url_video || "").toString("base64url"),
            type: "movie",
            name: i.title || "Unbekannter Titel",
            poster: ICON,
            description: `[${i.channel}] ${i.topic}\n\n${i.description || "Keine Beschreibung verfügbar."}`
        }))
    });
});

app.get("/meta/:type/:id.json", (req, res) => {
    res.json({ meta: { id: req.params.id, type: "movie", name: "Mediathek Stream", poster: ICON } });
});

app.get("/stream/:type/:id.json", (req, res) => {
    try {
        const cleanId = req.params.id.replace("mvw:", "").replace(".json", "");
        const url = Buffer.from(cleanId, "base64url").toString("utf-8");
        res.json({ streams: [{ url, title: "Direktstream (HD)" }] });
    } catch (e) {
        res.json({ streams: [] });
    }
});

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));