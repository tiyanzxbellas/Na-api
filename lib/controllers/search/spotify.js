/**
 * @title Spotify Search via Yahoo
 * @summary Mencari track Spotify menggunakan mesin pencari Yahoo.
 * @description Mencari lagu/track Spotify melalui Yahoo Search dengan format `site:spotify.com/intl-id/track`. Mengembalikan judul, track ID, dan URL Spotify. Cocok untuk mencari track yang mungkin tidak muncul di pencarian internal Spotify.
 * @method GET
 * @path /api/search/spotify
 * @response json
 * @param {string} query.q - Kata kunci pencarian (contoh: "DJ ya odna").
 * @param {number} [query.page] - Halaman hasil pencarian (default: 1).
 * @example
 * async function searchSpotify() {
 *   const res = await fetch('/api/search/spotify?q=DJ+ya+odna');
 *   const data = await res.json();
 *   console.log(data);
 * }
 */
const scraper = require('../../yahooSpotify');

const spotifySearchController = async (req) => {
    const { q, page } = req.query;

    if (!q) {
        throw new Error("Parameter 'q' wajib diisi.");
    }

    const offset = page ? parseInt(page) : 1;
    const results = await scraper.search(q, offset);

    return {
        success: true,
        author: 'PuruBoy',
        result: results
    };
};

module.exports = spotifySearchController;
