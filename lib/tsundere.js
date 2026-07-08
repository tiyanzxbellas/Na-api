const axios = require('axios');

function generateFakeIP() {
    return Array.from({ length: 4 }, () => Math.floor(Math.random() * 255)).join('.');
}

async function generateTsundereTTS(text) {
    const url = 'https://api.screenapp.io/v2/proxy/google/tts';
    const fakeIP = generateFakeIP();
    
    const payload = {
        "input": text,
        "model": "gemini-2.5-flash-tts",
        "voice": "Kore", 
        "language_code": "id-ID",
        "response_format": "mp3",
        "speaking_rate": 1.1,
        "pitch": 2.5,
        "volume_gain_db": 0
    };

    const headers = {
        'authority': 'api.screenapp.io',
        'accept': '*/*',
        'content-type': 'application/json',
        'origin': 'https://screenapp.io',
        'referer': 'https://screenapp.io/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'x-forwarded-for': fakeIP,
        'client-ip': fakeIP,
        'via': '1.1 google',
    };

    try {
        const response = await axios({
            method: 'post',
            url: url,
            data: payload,
            headers: headers,
            responseType: 'arraybuffer'
        });

        return Buffer.from(response.data);
    } catch (error) {
        throw new Error(error.response?.data ? `TTS Error: ${error.response.status}` : error.message);
    }
}

module.exports = { generateTsundereTTS };
