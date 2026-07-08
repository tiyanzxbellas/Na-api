/**
 * @title Spotify Downloader V2
 * @summary Spotify to MP3 via savevideoraw.
 * @description Mengunduh lagu dari Spotify dan mengubahnya menjadi format MP3 menggunakan API savevideoraw.com. Tanpa login, gratis, cepat.
 * @method POST
 * @path /api/downloader/spotify-v2
 * @response json
 * @param {string} body.url - URL Track Spotify (contoh: https://open.spotify.com/intl-id/track/... atau https://open.spotify.com/track/...).
 * @example
 * async function dlSpotifyV2() {
 *   const res = await fetch('/api/downloader/spotify-v2', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       "url": "https://open.spotify.com/intl-id/track/0d9Odqdel9VeeDEYuPjm6x"
 *     })
 *   });
 *   const data = await res.json();
 *   console.log(data);
 * }
 */

const API_ENDPOINT = 'https://savevideoraw.com/apiall.php';

const spotifyV2Controller = async (req) => {
    const { url } = req.body;

    if (!url) {
        throw new Error("Parameter 'url' Spotify wajib diisi.");
    }

    if (!url.includes('spotify.com')) {
        throw new Error("URL tidak valid. Pastikan menggunakan link Spotify yang benar.");
    }

    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: url,
            platform: 'spotify'
        })
    });

    if (!response.ok) {
        throw new Error(`Gagal menghubungi server: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || 'Gagal mendapatkan data lagu.');
    }

    // Parse title - format "Judul - Artist"
    const title = data.title || 'Unknown Track';
    let trackName = title;
    let artistName = '';
    const dashIdx = title.indexOf(' - ');
    if (dashIdx > -1) {
        trackName = title.substring(0, dashIdx);
        artistName = title.substring(dashIdx + 3);
    }

    const result = {
        title: trackName,
        artist: artistName,
        thumb: data.thumb || null,
        platform: data.platform || 'spotify',
        audios: (data.audios || []).map((a, i) => ({
            index: i,
            url: a.url,
            label: a.label || 'MP3',
            quality: a.quality || 'High'
        }))
    };

    return {
        success: true,
        author: 'PuruBoy',
        result
    };
};

module.exports = spotifyV2Controller;
