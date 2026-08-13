// 4. SMART API FETCHING (ROBUST & FUNKTIONSFÄHIG)
async function fetchSmartMediathekItems(genre = "", search = "", channel = "") {
  let requestBody = {};

  if (search) {
    // Wenn der Nutzer in Stremio nach etwas sucht
    requestBody = {
      queries: [{ fields: ["title", "topic"], query: search }],
      sortBy: "timestamp",
      sortOrder: "desc",
      size: 40
    };
  } else if (genre && CATEGORY_TAGS[genre]) {
    // Wenn ein Genre/Kategorie gewählt ist
    const tags = CATEGORY_TAGS[genre].slice(0, 3);
    requestBody = {
      queries: tags.map(tag => ({ fields: ["title", "topic"], query: tag })),
      sortBy: "timestamp",
      sortOrder: "desc",
      size: 40
    };
  } else {
    // STANDARD-FALL (Startseite im Katalog):
    // Wir fragen nach aktuellen Beiträgen der letzten Tage ab
    requestBody = {
      queries: [
        { fields: ["channel"], query: channel || "ARD" },
        { fields: ["channel"], query: "ZDF" }
      ],
      sortBy: "timestamp",
      sortOrder: "desc",
      size: 40
    };
  }

  try {
    const response = await axios.post(
      "https://api.mediathekviewweb.de/api/v1/query",
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        timeout: 9000
      }
    );

    let raw = response.data?.result?.results || [];

    // Duplikate entfernen & filtern
    const unique = new Map();
    raw.forEach(item => {
      const link = item.url_video_hd || item.url_video || item.url_video_low;
      if (link && !unique.has(link)) {
        unique.set(link, item);
      }
    });

    return Array.from(unique.values());
  } catch (err) {
    console.error("API Fehler:", err.message);
    return [];
  }
}