const axios = require('axios');
const cheerio = require('cheerio');
const qs = require('qs');

/**
 * Ahli Reverse Engineering Web - PizzoShop MLBB Checker
 */
async function checkMLBBRegion(userId, zoneId) {
    const url = 'https://pizzoshop.com/mlchecker/check';

    // Data payload dalam format x-www-form-urlencoded
    const data = qs.stringify({
        'user_id': userId,
        'zone_id': zoneId
    });

    const config = {
        method: 'post',
        url: url,
        headers: { 
            'authority': 'pizzoshop.com', 
            'content-type': 'application/x-www-form-urlencoded', 
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', 
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'origin': 'https://pizzoshop.com',
            'referer': 'https://pizzoshop.com/mlchecker'
        },
        data: data
    };

    try {
        const response = await axios(config);
        const $ = cheerio.load(response.data);

        // Mencari tabel hasil berdasarkan class .table-modern
        const table = $('.table-modern');

        if (table.length === 0) {
            // Cek jika ada pesan error dari alert
            const errorMsg = $('.alert-danger').text().trim();
            throw new Error(errorMsg || "Data tidak ditemukan atau User ID salah.");
        }

        const result = {};
        table.find('tr').each((i, el) => {
            const key = $(el).find('th').text().replace(/\s+/g, ' ').trim();
            let value = $(el).find('td').text().trim();

            // Pembersihan key untuk mapping object
            if (key.includes('Nickname')) result.nickname = value;
            if (key.includes('Region ID')) result.region = value;
            if (key.includes('Last Login')) result.lastLogin = value;
            if (key.includes('Created data')) result.createdAt = value;
        });

        return result;

    } catch (error) {
        throw new Error(error.message);
    }
}

module.exports = { checkMLBBRegion };