/**
 * @title SoundCloud Play
 * @summary Play SoundCloud Audio.
 * @description Mencari lagu di SoundCloud, memfilter durasi (1-10 menit), dan mengambil URL download langsung. Menggabungkan fungsi pencarian dan pengunduhan dalam satu request untuk mendapatkan audio yang bisa diputar/diunduh.
 * @method GET
 * @path /api/play/soundcloud
 * @response json
 * @param {string} query.q - Judul lagu atau kata kunci pencarian.
 * @example
 * async function play() {
 *   const res = await fetch('/api/play/soundcloud?q=dj+ya+odna');
 *   const data = await res.json();
 *   console.log(data);
 * }
 */
const { searchSoundCloud } = require('../../soundcloudSearch');
const { scdl } = require('../../scdl');

const playSoundCloudController = async (req) => {
    const { q } = req.query;

    if (!q) {
        throw new Error("Parameter 'q' wajib diisi.");
    }

    // 1. Search Tracks (Limit 15 untuk mendapatkan kandidat yang cukup)
    const searchResults = await searchSoundCloud(q, 15);

    if (!searchResults || searchResults.length === 0) {
        throw new Error("Lagu tidak ditemukan.");
    }

    // 2. Filter Durasi (Di atas 1 menit dan di bawah 10 menit)
    // Format duration dari lib biasanya "MM:SS" (contoh: "5:19") atau "H:MM:SS"
    const validTrack = searchResults.find(track => {
        if (!track.duration) return false;
        
        const parts = track.duration.split(':').map(Number);
        let seconds = 0;

        if (parts.length === 2) {
            seconds = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else {
            // Format tidak dikenali atau hanya detik (jarang terjadi di lib ini)
            return false;
        }

        // 1 menit = 60 detik, 10 menit = 600 detik
        return seconds > 60 && seconds < 600;
    });

    if (!validTrack) {
        throw new Error("Tidak ditemukan lagu dengan durasi yang sesuai (1 - 10 menit) di hasil teratas.");
    }

    // 3. Get Download URL
    // Menggunakan URL dari hasil search untuk mendapatkan link download asli
    const downloadData = await scdl(validTrack.url);

    // 4. Return Data
    return {
        title: validTrack.title,
        duration: validTrack.duration,
        url: downloadData.url
    };
};

module.exports = playSoundCloudController;