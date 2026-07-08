const axios = require('axios');

/**
 * Dracin TTS Generator
 * @param {string} text - The text to speak
 * @param {number} speed - Speed of speech (default 1.0)
 * @param {boolean} useBg - Whether to use background music (default true)
 * @param {number} bgVol - Background music volume (default 0.3)
 */
async function generateDracinTTS(text, speed = 1.0, useBg = true, bgVol = 0.3) {
    const url = 'https://nirkyy-suaraind.hf.space/generate';
    try {
        const response = await axios.get(url, {
            params: {
                text: text,
                speed: speed,
                use_bg: useBg,
                bg_vol: bgVol
            },
            responseType: 'arraybuffer'
        });
        return Buffer.from(response.data);
    } catch (error) {
        throw new Error(`Dracin TTS External API Error: ${error.message}`);
    }
}

module.exports = { generateDracinTTS };