const axios = require('axios');

// --- KONFIGURASI ---
const CONFIG = {
    url: 'https://us-central1-infinite-chain-295909.cloudfunctions.net/gemini-proxy-staging-v1',
    systemPrompt: `You are a helpful AI assistant analyzing media for users. Provide practical, actionable, and useful information that helps users understand and work with their content. Focus on:
- Clear, direct answers to their questions
- Practical insights they can act on
- Content summaries that are easy to understand
- Helpful suggestions relevant to their needs

Avoid technical jargon like 'bounding box analysis' or overly technical descriptions unless specifically asked. Keep responses conversational, friendly, and focused on what the user can do with the information.`,
    model: 'gemini-2.0-flash', 
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

/**
 * Menganalisis gambar dan menjawab pertanyaan menggunakan ScreenApp.io (Gemini Proxy).
 * @param {string} imageUrl - URL gambar yang akan dianalisis.
 * @param {string} question - Pertanyaan pengguna.
 * @returns {Promise<string>} - Jawaban dari AI.
 */
async function chat(imageUrl, question) {
    if (!imageUrl) throw new Error("Image URL is required.");
    if (!question) throw new Error("Question is required.");

    try {
        // 1. Download Gambar dari URL
        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer'
        });
        const base64Image = Buffer.from(imageResponse.data).toString('base64');

        // 2. Konstruksi Payload
        const payload = {
            model: CONFIG.model,
            contents: [{
                parts: [
                    {
                        inlineData: {
                            mimeType: "image/jpeg", 
                            data: base64Image
                        }
                    },
                    {
                        text: `${CONFIG.systemPrompt}\n\nUser question: ${question}`
                    }
                ]
            }]
        };

        // 3. Kirim Request ke Proxy
        const response = await axios.post(CONFIG.url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': CONFIG.userAgent,
                'Origin': 'https://screenapp.io',
                'Referer': 'https://screenapp.io/'
            }
        });

        // 4. Parsing Response
        if (response.data && 
            response.data.candidates && 
            response.data.candidates[0] && 
            response.data.candidates[0].content && 
            response.data.candidates[0].content.parts[0]) {
            
            return response.data.candidates[0].content.parts[0].text;
        } else {
            throw new Error("Invalid response structure from ScreenApp API.");
        }

    } catch (error) {
        if (error.response) {
            throw new Error(`ScreenApp API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(error.message);
    }
}

module.exports = { chat };