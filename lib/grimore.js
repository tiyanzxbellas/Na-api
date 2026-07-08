const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('qs');

async function generateVideo(data) {
    const { bgUrl, humanUrl, brand, title, slogan, promo, wm } = data;
    const url = 'https://nirkyy-grimore.hf.space/generate';
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; RMX2185 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.7559.132 Mobile Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'origin': 'https://nirkyy-grimore.hf.space',
        'referer': 'https://nirkyy-grimore.hf.space/',
        'x-requested-with': 'mark.via.gp'
    };

    const payload = qs.stringify({ bgUrl, humanUrl, brand, title, slogan, promo, wm });

    try {
        const response = await axios.post(url, payload, { headers });
        const $ = cheerio.load(response.data);
        const videoSource = $('source').attr('src');

        if (!videoSource || !videoSource.startsWith('data:video/mp4;base64,')) {
            throw new Error("Gagal mengekstrak video dari respons server.");
        }

        const base64Data = videoSource.replace('data:video/mp4;base64,', '');
        return Buffer.from(base64Data, 'base64');
    } catch (error) {
        throw new Error(error.message);
    }
}

module.exports = { generateVideo };