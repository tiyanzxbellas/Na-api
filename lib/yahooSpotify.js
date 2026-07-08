const cheerio = require('cheerio');

/**
 * YahooSpotifyScraper
 * Mencari track Spotify melalui Yahoo Search dengan ekstraksi URL dari redirect Yahoo.
 * Menggunakan fetch native (Node 18+) — tidak perlu axios.
 */
class YahooSpotifyScraper {
    constructor() {
        this.baseUrl = 'https://id.search.yahoo.com/search';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
        };
    }

    /**
     * Ekstrak URL asli dari redirect Yahoo (parameter RU)
     * @param {string} yahooUrl - URL redirect Yahoo
     * @returns {string|null} URL asli
     */
    _extractRealUrl(yahooUrl) {
        if (!yahooUrl) return null;
        const match = yahooUrl.match(/RU=([^/&]+)/);
        if (match && match[1]) {
            try {
                const decoded = decodeURIComponent(match[1]);
                return decoded.split('/RK=')[0];
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    /**
     * Ekstrak track ID dari URL Spotify
     * @param {string} spotifyUrl
     * @returns {string|null}
     */
    _extractTrackId(spotifyUrl) {
        if (!spotifyUrl) return null;
        const match = spotifyUrl.match(/\/track\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    }

    /**
     * Bersihkan judul dari breadcrumb Yahoo dan artefak URL
     * @param {string} rawTitle - Raw text dari anchor Yahoo (format: "Spotifyhttps://open.spotify.com › intl-id › trackTITLE - deskripsi | ...")
     * @returns {string} Judul yang sudah dibersihkan
     */
    _cleanTitle(rawTitle) {
        if (!rawTitle) return '';
        let title = rawTitle;

        // Hapus "Spotify" prefix (muncul dari parsing cheerio pada anchor Yahoo)
        title = title.replace(/^Spotify\s*/i, '');

        // Hapus URL + breadcrumb dalam berbagai format:
        // - "https://open.spotify.com › intl-id › trackTITLE"
        // - "https://open.spotify.com/intl-id/trackTITLE"
        // - "open.spotify.com › intl-id › trackTITLE"
        title = title
            .replace(/https?:\/\/open\.spotify\.com\s*[›»]?\s*\/?\s*intl-id\s*[›»]?\s*\/?\s*track\s*\/?/gi, '')
            .replace(/open\.spotify\.com\s*[›»]\s*intl-id\s*[›»]\s*track\s*/gi, '')
            .replace(/open\.spotify\.com\/intl-id\/track\s*/gi, '');

        // Hapus " - lagu dan lirik oleh ..." atau " - lagu oleh ..."
        title = title.replace(/\s*[-–]\s*lagu\s*(dan\s*lirik)?\s*oleh\s+.*$/i, '');

        // Hapus " | Spotify" atau " | ..." di akhir
        title = title.replace(/\s*\|.*$/, '');

        // Bersihkan spasi berlebih
        title = title.replace(/\s+/g, ' ').trim();

        // Jika hasilnya adalah track ID saja (hanya alfanumerik)
        if (/^[a-zA-Z0-9]+$/.test(title)) {
            return `Spotify Track ${title}`;
        }

        // Jika masih mengandung http/URL, ambil kata-kata non-URL saja
        if (title.includes('http') || title.includes('spotify.com')) {
            const parts = title.split(/\s+/);
            const cleanParts = parts.filter(p => !p.includes('http') && !p.includes('spotify.com'));
            if (cleanParts.length > 0) {
                title = cleanParts.join(' ');
            }
        }

        return title.trim();
    }

    /**
     * Cari track Spotify via Yahoo Search
     * @param {string} query - Kata kunci pencarian (contoh: "dj ya odna")
     * @param {number} [offset=1] - Halaman hasil
     * @returns {Promise<Array<{title: string, trackID: string, trackURL: string}>>}
     */
    async search(query, offset = 1) {
        try {
            const params = new URLSearchParams({
                p: `site:spotify.com/intl-id/track ${query}`,
                b: offset,
                ei: 'UTF-8'
            });

            const url = `${this.baseUrl}?${params.toString()}`;
            const response = await fetch(url, { headers: this.headers });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);
            const results = [];
            const seenIds = new Set();

            // Cari semua link Yahoo redirect yang mengandung Spotify track
            $('a[href*="r.search.yahoo.com"]').each((i, el) => {
                const href = $(el).attr('href');
                if (!href || !href.includes('/RU=')) return;

                const realUrl = this._extractRealUrl(href);
                if (!realUrl || !realUrl.includes('open.spotify.com/intl-id/track')) return;

                const trackId = this._extractTrackId(realUrl);
                if (!trackId || seenIds.has(trackId)) return;

                seenIds.add(trackId);

                const title = this._cleanTitle($(el).text());

                results.push({
                    title: title || `Spotify Track ${trackId}`,
                    trackID: trackId,
                    trackURL: realUrl.split('?')[0]
                });
            });

            // Fallback: cari langsung di HTML untuk URL encoded
            if (results.length === 0) {
                const encodedMatches = html.match(/open\.spotify\.com%2fintl-id%2ftrack%2f([a-zA-Z0-9]+)/gi);
                if (encodedMatches) {
                    encodedMatches.forEach(match => {
                        try {
                            const decoded = decodeURIComponent(match);
                            const trackId = decoded.match(/\/track\/([a-zA-Z0-9]+)/);
                            if (trackId && !seenIds.has(trackId[1])) {
                                seenIds.add(trackId[1]);
                                results.push({
                                    title: `Spotify Track ${trackId[1]}`,
                                    trackID: trackId[1],
                                    trackURL: `https://open.spotify.com/intl-id/track/${trackId[1]}`
                                });
                            }
                        } catch (e) {
                            // Skip invalid encoded URLs
                        }
                    });
                }
            }

            return results;
        } catch (error) {
            throw new Error(`Gagal mencari di Yahoo: ${error.message}`);
        }
    }
}

module.exports = new YahooSpotifyScraper();
