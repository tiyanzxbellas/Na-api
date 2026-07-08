const axios = require('axios');
const { uploadToTmp } = require('./uploader');

const API_URL = 'https://ghibli-proxy.netlify.app/.netlify/functions/ghibli-proxy';
const DEFAULT_PROMPT = 'Transform this image into beautiful Studio Ghibli anime art style with soft colors, dreamy atmosphere, and hand-painted aesthetic';

const HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://overchat.ai',
    'Referer': 'https://overchat.ai/image/ghibli'
};

const ghibli = {
    /**
     * Mengubah gambar menjadi gaya Ghibli via Proxy.
     * @param {string} url - URL Gambar.
     * @param {string} [customPrompt] - Prompt kustom (opsional).
     * @returns {Promise<{success: boolean, image?: string, error?: string}>}
     */
    process: async (url, customPrompt) => {
        try {
            // 1. Download image from URL
            const imageRes = await axios.get(url, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(imageRes.data);
            const contentType = imageRes.headers['content-type'] || 'image/jpeg';
            const base64Image = `data:${contentType};base64,${buffer.toString('base64')}`;

            // 2. Prepare Payload
            const prompt = customPrompt || DEFAULT_PROMPT;
            const payload = {
                image: base64Image,
                prompt: prompt,
                model: 'gpt-image-1',
                n: 1,
                size: '1024x1024',
                quality: 'low'
            };

            // 3. Send to Ghibli Proxy
            const response = await axios.post(API_URL, payload, { headers: HEADERS });

            if (response.data && response.data.success) {
                const resultData = response.data.data[0];
                let resultBuffer;

                if (resultData.b64_json) {
                    resultBuffer = Buffer.from(resultData.b64_json, 'base64');
                } else if (resultData.url) {
                     const imgRes = await axios.get(resultData.url, { responseType: 'arraybuffer' });
                     resultBuffer = Buffer.from(imgRes.data);
                } else {
                    throw new Error("API success but no image data returned.");
                }

                // 4. Upload Result to Tmp
                const publicUrl = await uploadToTmp(resultBuffer, `ghibli-${Date.now()}.png`);

                return {
                    success: true,
                    image: publicUrl
                };
            } else {
                throw new Error("Ghibli API responded with failure.");
            }

        } catch (error) {
             const msg = error.response ? 
                `API Error ${error.response.status}: ${JSON.stringify(error.response.data)}` : 
                error.message;
                
             return {
                success: false,
                error: msg
            };
        }
    }
};

module.exports = { ghibli };