const axios = require('axios');
const { uploadToTmp } = require('./uploader');

/**
 * Generate Brat Image using external API
 * @param {string} text 
 */
async function generateBrat(text) {
    if (!text) throw new Error("Text parameter is required.");

    try {
        const url = `https://nirkyy-image-brat-generator.hf.space/generate?text=${encodeURIComponent(text)}`;
        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (response.status !== 200) {
            throw new Error(`External API Error: ${response.status}`);
        }

        const buffer = Buffer.from(response.data);
        
        // Mengonversi buffer image menjadi URL melalui uploader (tmpfiles + proxy)
        const proxyUrl = await uploadToTmp(buffer, `brat-${Date.now()}.png`);
        
        return proxyUrl;
    } catch (error) {
        throw new Error(`Brat Generator Error: ${error.message}`);
    }
}

module.exports = { generateBrat };