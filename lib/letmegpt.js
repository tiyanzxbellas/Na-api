const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fungsi untuk mendapatkan jawaban dari LetMeGPT
 * @param {string} query - Pertanyaan yang ingin diajukan
 */
async function askGPT(query) {
    try {
        const url = `https://letmegpt.com/search?q=${encodeURIComponent(query)}`;

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://letmegpt.com/'
            }
        });

        const $ = cheerio.load(response.data);
        const answer = $('#gptans').text().trim();

        if (answer) {
            return {
                query: query,
                answer: answer
            };
        } else {
            throw new Error('Jawaban tidak ditemukan di elemen #gptans.');
        }

    } catch (error) {
        throw new Error(error.message);
    }
}

module.exports = { askGPT };