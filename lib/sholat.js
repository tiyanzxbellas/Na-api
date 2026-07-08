const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Algoritma Similarity (Dice's Coefficient)
 * Menangani typo dengan mencari kemiripan string tertinggi.
 */
function getSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().replace(/\s+/g, '');
    const s2 = str2.toLowerCase().replace(/\s+/g, '');
    if (s1 === s2) return 1.0;
    if (s1.length < 2 || s2.length < 2) return 0;

    const bigrams1 = new Map();
    for (let i = 0; i < s1.length - 1; i++) {
        const bigram = s1.substring(i, i + 2);
        bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
    }

    let intersection = 0;
    for (let i = 0; i < s2.length - 1; i++) {
        const bigram = s2.substring(i, i + 2);
        const count = bigrams1.get(bigram) || 0;
        if (count > 0) {
            bigrams1.set(bigram, count - 1);
            intersection++;
        }
    }
    return (2.0 * intersection) / (s1.length + s2.length - 2);
}

async function getPrayerSchedule(userCityInput) {
    const baseUrl = 'https://jadwalsholat.org/jadwal-sholat/monthly.php';

    try {
        const { data: htmlInitial } = await axios.get(baseUrl);
        const $initial = cheerio.load(htmlInitial);

        const cities = [];
        $initial('select[name="kota"] option').each((i, el) => {
            cities.push({
                id: $initial(el).attr('value'),
                name: $initial(el).text().trim()
            });
        });

        let bestMatch = { id: null, name: '', score: -1 };
        cities.forEach(city => {
            const score = getSimilarity(userCityInput, city.name);
            if (score > bestMatch.score) {
                bestMatch = { ...city, score };
            }
        });

        if (bestMatch.score < 0.2) {
            throw new Error(`Kota "${userCityInput}" tidak dikenali.`);
        }

        const now = new Date();
        const m = now.getMonth() + 1;
        const y = now.getFullYear();

        const finalUrl = `${baseUrl}?id=${bestMatch.id}&m=${m}&y=${y}`;
        const { data: htmlFinal } = await axios.get(finalUrl);
        const $ = cheerio.load(htmlFinal);

        const schedule = [];
        $('tr.table_light, tr.table_dark, tr.table_highlight').each((i, el) => {
            const cols = $(el).find('td');
            if (cols.length >= 9) {
                schedule.push({
                    tanggal: $(cols[0]).text().trim(),
                    imsyak: $(cols[1]).text().trim(),
                    shubuh: $(cols[2]).text().trim(),
                    terbit: $(cols[3]).text().trim(),
                    dhuha: $(cols[4]).text().trim(),
                    dzuhur: $(cols[5]).text().trim(),
                    ashr: $(cols[6]).text().trim(),
                    maghrib: $(cols[7]).text().trim(),
                    isya: $(cols[8]).text().trim(),
                });
            }
        });

        return {
            status: "success",
            matchedCity: bestMatch.name,
            query: userCityInput,
            monthYear: `${m}-${y}`,
            data: schedule
        };

    } catch (error) {
        throw new Error(error.message);
    }
}

module.exports = { getPrayerSchedule };