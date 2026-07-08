const cheerio = require('cheerio');

/**
 * MultiEngineSpotifyScraper
 * Mencari track Spotify melalui beberapa mesin pencari (Yahoo, DuckDuckGo, Bing).
 * Jika engine pertama gagal, otomatis fallback ke engine berikutnya.
 * Menggunakan cheerio untuk parsing HTML dan fetch native (Node 18+).
 *
 * @class MultiEngineSpotifyScraper
 */
class MultiEngineSpotifyScraper {
    constructor() {
        this.timeout = 15000; // 15 detik timeout per request
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
     * Fetch wrapper dengan timeout
     * @param {string} url
     * @param {object} [customHeaders={}]
     * @returns {Promise<string>} HTML body
     */
    async _fetch(url, customHeaders = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                headers: customHeaders,
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}${response.statusText ? ': ' + response.statusText : ''}`);
            }

            return await response.text();
        } finally {
            clearTimeout(timer);
        }
    }

    // ─── Yahoo Search ───────────────────────────────────────────────

    /**
     * Cari via Yahoo Search
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
        const html = await this._fetch(url, {
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

    // ─── DuckDuckGo Search ──────────────────────────────────────────

    /**
     * Cari via DuckDuckGo HTML
     * @param {string} query
     * @param {number} offset
     * @returns {Promise<Array>}
     */
    async _searchDuckDuckGo(query, offset) {
        const params = new URLSearchParams({
            q: `site:open.spotify.com/track ${query}`,
            s: offset > 1 ? ((offset - 1) * 10) : 0
        });

        const url = `https://html.duckduckgo.com/html?${params.toString()}`;
        const html = await this._fetch(url, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        });

        const $ = cheerio.load(html);
        const results = [];
        const seenIds = new Set();

        // Cari link hasil pencarian DuckDuckGo
        $('.result__a, a[href*="open.spotify.com"]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;

            // DuckDuckGo menggunakan redirect: //duckduckgo.com/l/?uddg=...
            let realUrl = href;
            if (href.includes('uddg=')) {
                const uddgMatch = href.match(/uddg=([^&]+)/);
                if (uddgMatch) {
                    try {
                        realUrl = decodeURIComponent(uddgMatch[1]);
                    } catch (e) {
                        return;
                    }
                }
            }

            if (!realUrl.includes('open.spotify.com/track')) return;

            const trackId = this._extractTrackId(realUrl);
            if (!trackId || seenIds.has(trackId)) return;

            seenIds.add(trackId);

            const title = this._cleanTitle($(el).text().trim());

            results.push({
                title: title || `Spotify Track ${trackId}`,
                trackID: trackId,
                trackURL: realUrl.split('?')[0]
            });
        });

        return results;
    }

    // ─── Bing Search ────────────────────────────────────────────────

    /**
     * Cari via Bing Search
     * @param {string} query
     * @param {number} offset
     * @returns {Promise<Array>}
     */
    async _searchBing(query, offset) {
        const params = new URLSearchParams({
            q: `site:open.spotify.com/track ${query}`,
            first: offset
        });

        const url = `https://www.bing.com/search?${params.toString()}`;
        const html = await this._fetch(url, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        });

        const $ = cheerio.load(html);
        const results = [];
        const seenIds = new Set();

        // Cari link hasil pencarian Bing
        $('a[href*="open.spotify.com"]').each((i, el) => {
            const href = $(el).attr('href');
            if (!href) return;

            // Bing redirect URL
            let realUrl = href;
            if (href.includes('bing.com/ck/a')) {
                const encodedMatch = href.match(/[?&]u=([^&]+)/);
                if (encodedMatch) {
                    try {
                        realUrl = decodeURIComponent(encodedMatch[1]);
                    } catch (e) {
                        return;
                    }
                }
            }

            if (!realUrl.includes('open.spotify.com/track')) return;

            const trackId = this._extractTrackId(realUrl);
            if (!trackId || seenIds.has(trackId)) return;

            seenIds.add(trackId);

            // Ambil judul dari elemen <h2> parent
            const titleEl = $(el).closest('li, .b_algo').find('h2').first();
            const title = titleEl.length ? this._cleanTitle(titleEl.text()) : this._cleanTitle($(el).text());

            results.push({
                title: title || `Spotify Track ${trackId}`,
                trackID: trackId,
                trackURL: realUrl.split('?')[0]
            });
        });

        return results;
    }

    // ─── Public API ─────────────────────────────────────────────────

    /**
     * Cari track Spotify via multi-engine search
     * Urutan: Yahoo → DuckDuckGo → Bing
     * Jika engine pertama gagal atau tidak menghasilkan hasil, fallback ke engine berikutnya.
     *
     * @param {string} query - Kata kunci pencarian (contoh: "DJ ya odna")
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

        const engines = [
            { name: 'Yahoo', fn: () => this._searchYahoo(query, offset) },
            { name: 'DuckDuckGo', fn: () => this._searchDuckDuckGo(query, offset) },
            { name: 'Bing', fn: () => this._searchBing(query, offset) }
        ];

        const errors = [];

        for (const engine of engines) {
            try {
                const results = await engine.fn();
                if (results && results.length > 0) {
                    return results;
                }
                // Engine berhasil tapi tidak ada hasil → lanjut engine berikutnya
                errors.push({ engine: engine.name, error: 'Tidak ada hasil' });
            } catch (error) {
                errors.push({ engine: engine.name, error: error.message });
                continue;
            }
        }

        // Jika semua engine gagal, throw error gabungan
        const detail = errors.map(e => `${e.engine}: ${e.error}`).join('; ');
        throw new Error(`Gagal mencari di semua mesin pencari: ${detail}`);
    }
}

module.exports = new MultiEngineSpotifyScraper();
