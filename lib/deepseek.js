const axios = require('axios');

// Konfigurasi Target
const API_URL = 'https://api-preview.chatgot.io/api/v1/char-gpt/conversations';

// Headers untuk meniru browser asli
const HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream', 
    'Origin': 'https://deepseekfree.ai',
    'Referer': 'https://deepseekfree.ai/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Fungsi untuk membuat Device ID acak
function generateDeviceId() {
    return "fallback_" + Math.random().toString(36).substr(2, 9);
}

async function* chatDeepSeek(prompt) {
    const deviceId = generateDeviceId();

    // Payload (model_id 1 = R1)
    const payload = {
        device_id: deviceId,
        model_id: 1, 
        include_reasoning: true, 
        messages: [
            {
                role: "user",
                content: prompt
            }
        ]
    };

    try {
        const response = await axios.post(API_URL, payload, {
            headers: HEADERS,
            responseType: 'stream'
        });

        const stream = response.data;
        let buffer = '';

        for await (const chunk of stream) {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop(); 

            for (const line of lines) {
                const trimmedLine = line.trim();

                if (trimmedLine.startsWith('data:')) {
                    const dataStr = trimmedLine.replace('data:', '').trim();
                    if (!dataStr) continue;

                    try {
                        const json = JSON.parse(dataStr);

                        // Kode 202 = Sedang merespon
                        if (json.code === 202) {
                            const reasoning = json.data?.reasoning_content;
                            const content = json.data?.content;

                            if (reasoning) {
                                yield { type: 'reasoning', content: reasoning };
                            }
                            if (content) {
                                yield { type: 'content', content: content };
                            }
                        } 
                        // Kode 203 = Selesai
                        else if (json.code === 203) {
                           // Stream selesai
                        }
                        // Kode 429 = Rate Limit
                        else if (json.code === 429) {
                            throw new Error('Rate limit tercapai. Silakan coba lagi nanti.');
                        }
                    } catch (err) {
                        // ignore parse error
                    }
                }
            }
        }

    } catch (error) {
        throw new Error(error.response?.data ? error.response.status + ' ' + JSON.stringify(error.response.data) : error.message);
    }
}

module.exports = { chatDeepSeek };