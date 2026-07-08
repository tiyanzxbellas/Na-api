const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Search Suggestion / Autocomplete Logic (Based on HAR)
 * @param {string} query - Kata kunci
 */
async function suggest(query) {
    if (!query) throw new Error("Query is required.");
    const url = `https://clients1.google.com/complete/search?hl=id&output=toolbar&q=${encodeURIComponent(query)}`;

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // Load as XML because response is XML based on HAR
        const $ = cheerio.load(response.data, { xmlMode: true });
        const suggestions = [];

        $('suggestion').each((i, el) => {
            const data = $(el).attr('data');
            if (data) suggestions.push(data);
        });

        return suggestions;
    } catch (error) {
        throw new Error("Gagal mengambil saran pencarian: " + error.message);
    }
}

module.exports = { suggest };