const axios = require('axios');

// Konfigurasi Endpoint
const TARGET_URL = 'https://lrclib.net/api/search';

// Header khusus
const HEADERS = {
    'User-Agent': 'LRCLIB Web Client (https://github.com/tranxuanthang/lrclib)',
    'X-User-Agent': 'LRCLIB Web Client (https://github.com/tranxuanthang/lrclib)',
    'Lrclib-Client': 'LRCLIB Web Client (https://github.com/tranxuanthang/lrclib)',
    'Accept': 'application/json, text/plain, */*'
};

async function search(keyword) {
    if (!keyword) throw new Error("Keyword pencarian wajib diisi.");

    try {
        const response = await axios.get(TARGET_URL, {
            headers: HEADERS,
            params: {
                q: keyword
            }
        });

        const data = response.data;

        if (Array.isArray(data) && data.length > 0) {
            return data.map(item => ({
                id: item.id,
                track: item.trackName,
                artist: item.artistName,
                album: item.albumName,
                duration: item.duration,
                instrumental: item.instrumental,
                plainLyrics: item.plainLyrics,
                syncedLyrics: item.syncedLyrics
            }));
        } else {
            return [];
        }

    } catch (error) {
        if (error.response) {
            throw new Error(`Lyrics API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`Lyrics Error: ${error.message}`);
    }
}

module.exports = { search };