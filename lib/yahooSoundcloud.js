const axios = require('axios');
const cheerio = require('cheerio');

/**
 * YahooSoundCloudScraper V2
 * Output yang lebih bersih dan deteksi tipe konten.
 */
class YahooSoundCloudScraper {
    constructor() {
        this.baseUrl = 'https://id.search.yahoo.com/search';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
        };
    }

    /**
     * Ekstraksi URL asli dari redirector Yahoo menggunakan Regex
     */
    _extractSoundCloudUrl(yahooUrl) {
        if (!yahooUrl) return null;
        // Mencari pola RU=... sampai akhir segment sebelum /RK atau &
        const match = yahooUrl.match(/RU=([^/&]+)/);
        if (match && match[1]) {
            try {
                const decoded = decodeURIComponent(match[1]);
                return decoded.split('/RK=')[0]; // Bersihkan sisa parameter tracking
            } catch (e) {
                return yahooUrl;
            }
        }
        return yahooUrl;
    }

    /**
     * Menentukan apakah konten berupa track atau playlist
     */
    _determineType(url) {
        if (!url) return 'unknown';
        return url.includes('/sets/') ? 'playlist' : 'track';
    }

    /**
     * Membersihkan judul dari breadcrumb Yahoo (seperti 'SoundCloud https://...')
     */
    _cleanTitle(rawTitle) {
        if (!rawTitle) return '';
        // Yahoo sering menggabungkan breadcrumb di awal. 
        // Kita ambil bagian setelah teks "SoundCloud" atau segment URL.
        const parts = rawTitle.split(' - SoundCloud');
        let title = parts[0];

        // Hapus sisa-sisa breadcrumb URL jika masih ada
        if (title.includes('https://')) {
            const cleanParts = title.split(/\s+/);
            // Ambil hanya teks yang bukan bagian dari URL navigasi
            title = cleanParts.filter(p => !p.includes('http') && !p.includes('›') && p.toLowerCase() !== 'soundcloud').join(' ');
        }

        return title.trim();
    }

    async search(query, offset = 1) {
        try {
            const params = {
                p: `site://soundcloud.com ${query}`,
                b: offset,
                ei: 'UTF-8',
                nojs: '1'
            };

            const response = await axios.get(this.baseUrl, { params, headers: this.headers });
            const $ = cheerio.load(response.data);
            const finalData = [];

            $('section.algo-sr').each((i, el) => {
                const anchor = $(el).find('.compTitle a');
                const rawUrl = anchor.attr('href');
                const scUrl = this._extractSoundCloudUrl(rawUrl);

                if (scUrl && scUrl.includes('soundcloud.com')) {
                    finalData.push({
                        title: this._cleanTitle(anchor.text()),
                        url: scUrl,
                        type: this._determineType(scUrl),
                        description: $(el).find('.s-desc').text().replace(/^.*?\d{4}\s·\s/, '').trim()
                    });
                }
            });

            return finalData;

        } catch (error) {
            throw new Error(error.message);
        }
    }
}

module.exports = new YahooSoundCloudScraper();