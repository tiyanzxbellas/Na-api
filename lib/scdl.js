const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const jar = new CookieJar();
const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://soundcloud.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    }
}));

async function scdl(url) {
    if (!url) throw new Error("URL wajib diisi.");

    try {
        const { data: html } = await client.get(url);

        // --- STEP 1: EKSTRAK DATA HYDRATION ---
        const hydrationMatch = html.match(/window\.__sc_hydration\s*=\s*(\[.*?\]);/s);
        
        if (!hydrationMatch) {
            if (html.includes("Datadome") || html.includes("verify")) {
                throw new Error("Terdeteksi proteksi anti-bot/Captcha. Coba lagi nanti.");
            }
            throw new Error("Gagal menemukan struktur data (window.__sc_hydration).");
        }

        const hydrationData = JSON.parse(hydrationMatch[1]);

        // --- STEP 2: AMBIL CLIENT ID ---
        const apiClientEntry = hydrationData.find(item => item.hydratable === "apiClient");
        
        if (!apiClientEntry || !apiClientEntry.data || !apiClientEntry.data.id) {
            throw new Error("Client ID tidak ditemukan dalam data JSON.");
        }

        const clientId = apiClientEntry.data.id;

        // --- STEP 3: AMBIL DATA LAGU ---
        const soundDataEntry = hydrationData.find(item => item.hydratable === "sound");
        
        if (!soundDataEntry || !soundDataEntry.data) {
            throw new Error("Data lagu tidak ditemukan.");
        }

        const trackData = soundDataEntry.data;

        // --- STEP 4: PILIH STREAM ---
        const transcodings = trackData.media.transcodings;
        let selected = transcodings.find(t => t.format.protocol === 'progressive');
        if (!selected) selected = transcodings.find(t => t.format.protocol === 'hls');

        if (!selected) throw new Error("Stream tidak tersedia.");

        // --- STEP 5: FINAL REQUEST ---
        const resolveUrl = `${selected.url}?client_id=${clientId}&track_authorization=${trackData.track_authorization}`;
        
        const { data: streamInfo } = await client.get(resolveUrl, {
            headers: { 'Accept': 'application/json, text/javascript, */*; q=0.01' }
        });

        if (!streamInfo.url) throw new Error("API tidak mengembalikan URL stream.");

        // Format Image URL ke resolusi lebih tinggi jika ada
        const artwork = trackData.artwork_url ? trackData.artwork_url.replace('large', 't500x500') : null;

        return {
            title: trackData.title,
            thumbnail: artwork,
            duration: trackData.duration, // dalam ms
            author: trackData.user?.username,
            url: streamInfo.url,
            quality: selected.quality
        };

    } catch (error) {
        if (error.response) {
            throw new Error(`SCDL Error: ${error.response.status} ${error.response.statusText}`);
        }
        throw new Error(`SCDL Error: ${error.message}`);
    }
}

module.exports = { scdl };