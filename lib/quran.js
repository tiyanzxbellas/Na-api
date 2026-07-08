const axios = require('axios');

class QuranKemenagAPI {
    constructor() {
        this.baseURL = 'https://web-api.qurankemenag.net';
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://quran.kemenag.go.id',
                'Referer': 'https://quran.kemenag.go.id/'
            }
        });
    }

    async getSurahInfo(id) {
        try {
            const response = await this.client.get('/quran-surah');
            return response.data.data.find(s => s.id == id);
        } catch (error) {
            throw new Error('Gagal mengambil info surah: ' + error.message);
        }
    }

    async fetchAyahs(surahId, totalAyah, requestedAyahs = "all") {
        let allData = [];
        let start = 0;
        const limit = 50;
        
        let targetAyahs = null;
        if (requestedAyahs !== "all") {
            targetAyahs = requestedAyahs.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        }

        const maxAyahToFetch = (!targetAyahs) 
            ? totalAyah 
            : Math.max(...targetAyahs);

        while (start < maxAyahToFetch) {
            try {
                const response = await this.client.get('/quran-ayah', {
                    params: {
                        start: start,
                        limit: limit,
                        surah: surahId
                    }
                });

                if (response.data && response.data.data) {
                    allData = allData.concat(response.data.data);
                }
                start += limit;
            } catch (error) {
                break;
            }
        }

        if (targetAyahs) {
            return allData.filter(item => targetAyahs.includes(item.ayah));
        }

        return allData;
    }
}

module.exports = new QuranKemenagAPI();