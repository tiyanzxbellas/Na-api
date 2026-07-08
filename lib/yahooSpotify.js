const cheerio = require('cheerio');

/**
 * Spotify Search via Yahoo (Single Engine dengan Retry + Cookie)
 * Mencari track Spotify melalui Yahoo Search.
 * Jika gagal, retry otomatis dengan cookies dari permintaan sebelumnya.
 * Jika gagal 2x, throw error.
 *
 * @class YahooSpotifyScraper
 */
class YahooSpotifyScraper {
    constructor() {
        this.timeout = 15000;
        /** @type {string|null} Cookie jar: menyimpan cookies dari response sebelumnya */
        this._cookies = null;
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
     * Bersihkan judul dari breadcrumb dan artefak URL
     * @param {string} rawTitle
     * @returns {string}
     */
    _cleanTitle(rawTitle) {
        if (!rawTitle) return '';
        let title = rawTitle;

        // Hapus "Spotify" prefix
        title = title.replace(/^Spotify\s*/i, '');

        // Hapus URL + breadcrumb
        title = title
            .replace(/https?:\/\/open\.spotify\.com\s*[›»]?\s*\/?\s*intl-id\s*[›»]?\s*\/?\s*track\s*\/?/gi, '')
            .replace(/open\.spotify\.com\s*[›»]\s*intl-id\s*[›»]\s*track\s*/gi, '')
            .replace(/open\.spotify\.com\/intl-id\/track\s*/gi, '')
            .replace(/https?:\/\/open\.spotify\.com\/track\s*/gi, '');

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

        return title.trim() || `Spotify Track`;
    }

    /**
     * Ekstrak URL asli dari redirect Yahoo (parameter RU)
     * @param {string} yahooUrl
     * @returns {string|null}
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
     * Fetch dengan cookie jar internal
     * @param {string} url
     * @param {object} [customHeaders={}]
     * @returns {Promise<{html: string, headers: Headers}>}
     */
    async _fetch(url, customHeaders = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        try {
            const headers = { ...customHeaders };

            // Sisipkan cookies jika ada
            if (this._cookies) {
                headers['Cookie'] = this._cookies;
            }

            const response = await fetch(url, {
                headers,
                signal: controller.signal,
                redirect: 'follow'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}${response.statusText ? ': ' + response.statusText : ''}`);
            }

            // Simpan cookies dari response untuk retry nanti
            const setCookie = response.headers.get('set-cookie');
            if (setCookie) {
                // Ambil bagian cookie saja (nama=value), buang atribut
                const parsed = setCookie.split(',').map(c => c.split(';')[0].trim()).filter(Boolean);
                if (parsed.length > 0) {
                    this._cookies = parsed.join('; ');
                }
            }

            return {
                html: await response.text(),
                headers: response.headers
            };
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Cari track Spotify via Yahoo Search
     * @param {string} query
     * @param {number} offset
     * @returns {Promise<Array>}
     */
    async _searchYahoo(query, offset) {
        const params = new URLSearchParams({
            p: `site:spotify.com/intl-id/track ${query}`,
            b: offset,
            ei: 'UTF-8'
        });

        const url = `https://id.search.yahoo.com/search?${params.toString()}`;
        const { html } = await this._fetch(url, {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
        });

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
    }

    /**
     * Cari track Spotify via Yahoo Search dengan retry mechanism.
     *
     * Alur:
     *   1. Coba Yahoo Search pertama kali
     *   2. Jika gagal → retry dengan cookies dari sebelumnya (jika ada)
     *   3. Jika gagal 2x → throw error
     *
     * @param {string} query - Kata kunci pencarian
     * @param {number} [offset=1] - Halaman hasil pencarian
     * @returns {Promise<Array<{title: string, trackID: string, trackURL: string}>>}
     *
     * @example
     * const scraper = require('./lib/yahooSpotify');
     * const results = await scraper.search('dj ya odna');
     * // => [{ title: '...', trackID: '...', trackURL: '...' }, ...]
     */
    async search(query, offset = 1) {
        if (!query || typeof query !== 'string') {
            throw new Error("Parameter 'query' wajib diisi.");
        }

        let lastError = null;

        // Percobaan ke-1
        try {
            const results = await this._searchYahoo(query, offset);
            if (results && results.length > 0) {
                return results;
            }
            lastError = new Error('Yahoo tidak mengembalikan hasil');
        } catch (error) {
            lastError = error;
        }

        // Percobaan ke-2 (retry dengan cookies)
        try {
            const results = await this._searchYahoo(query, offset);
            if (results && results.length > 0) {
                return results;
            }
            lastError = new Error('Yahoo tidak mengembalikan hasil (retry)');
        } catch (error) {
            lastError = error;
        }

        // Gagal 2x — throw error
        throw new Error(`Gagal mencari di Yahoo setelah 2 percobaan: ${lastError.message}`);
    }
}

module.exports = new YahooSpotifyScraper();
