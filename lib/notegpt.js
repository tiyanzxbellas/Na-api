const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/**
 * Ahli Reverse Engineering Web - NoteGPT Automator
 * Fitur: IP Spoofing & Anonymous Session
 */

function generateRandomIP() {
    return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join('.');
}

async function* chatStream(prompt, model = 'gemini-3-flash-preview', chatMode = 'standard') {
    const anonymousId = uuidv4();
    const fakeIP = generateRandomIP();

    const config = {
        method: 'post',
        url: 'https://notegpt.io/api/v2/chat/stream',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Cookie': `anonymous_user_id=${anonymousId}`,
            'Origin': 'https://notegpt.io',
            'Referer': 'https://notegpt.io/chat-deepseek',

            // --- IP Spoofing Headers ---
            'X-Forwarded-For': fakeIP,
            'X-Real-IP': fakeIP,
            'Client-IP': fakeIP,
            'X-Client-IP': fakeIP,
            'X-Originating-IP': fakeIP,
            'X-Remote-IP': fakeIP,
            'X-Remote-Addr': fakeIP,
            'Via': `1.1 ${fakeIP} (NetGPT-Spoofer)`
        },
        data: {
            "message": prompt,
            "language": "auto",
            "model": model,
            "tone": "default",
            "length": "moderate",
            "conversation_id": uuidv4(),
            "image_urls": [],
            "chat_mode": chatMode
        },
        responseType: 'stream'
    };

    try {
        const response = await axios(config);
        const stream = response.data;

        for await (const chunk of stream) {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonStr = line.substring(6).trim();
                        if (jsonStr === '[DONE]') continue;
                        const data = JSON.parse(jsonStr);
                        yield data;
                    } catch (e) {
                        // ignore parse error for fragments
                    }
                }
            }
        }
    } catch (error) {
        throw new Error(error.response?.status === 429 ? "Rate Limit (429)" : error.message);
    }
}

module.exports = { chatStream };