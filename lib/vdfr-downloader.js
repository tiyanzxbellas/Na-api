const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class VDFRDownloader {
    constructor() {
        this.baseUrl = 'https://vdfr.app';
        this.client = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 15000
        });
    }

    /**
     * Mengambil link download video dari halaman hasil vdfr.app
     * @param {string} instagramUrl - URL reel/post Instagram publik
     * @returns {Promise<string>} - URL unduhan dengan token JWT
     */
    async getDownloadLink(instagramUrl) {
        try {
            // Request halaman download
            const encodedUrl = encodeURIComponent(instagramUrl);
            const response = await this.client.get(`${this.baseUrl}/download/`, {
                params: { url: instagramUrl } // axios otomatis encoding
            });

            const $ = cheerio.load(response.data);

            // Cari link download dengan selector spesifik
            const downloadLink = $('a.download__item__info__actions__button').attr('href');

            if (!downloadLink) {
                // Coba alternatif: mungkin ada beberapa link
                const allLinks = $('a[href*="downloads.acxcdn.com/vdfr/video?token="]');
                if (allLinks.length > 0) {
                    return allLinks.first().attr('href');
                }
                throw new Error('Download link tidak ditemukan. Kemungkinan video tidak tersedia atau Instagram memblokir permintaan.');
            }

            return downloadLink;
        } catch (error) {
            if (error.response) {
                throw new Error(`Server vdfr.app mengembalikan status ${error.response.status}`);
            }
            throw error;
        }
    }

    /**
     * Mengunduh video dari link token langsung ke file
     * @param {string} downloadUrl - URL hasil dari getDownloadLink()
     * @param {string} outputDir - Direktori penyimpanan (default: './downloads')
     * @returns {Promise<string>} - Path file yang berhasil diunduh
     */
    async downloadVideo(downloadUrl, outputDir = './downloads') {
        try {
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const response = await this.client.get(downloadUrl, {
                responseType: 'stream'
            });

            // Ambil nama file dari header Content-Disposition atau gunakan timestamp
            const disposition = response.headers['content-disposition'];
            let filename = `instagram_${Date.now()}.mp4`;
            if (disposition) {
                const match = disposition.match(/filename="(.+)"/);
                if (match) filename = match[1];
            }

            const filePath = path.join(outputDir, filename);
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(filePath));
                writer.on('error', reject);
            });
        } catch (error) {
            throw new Error(`Gagal mengunduh video: ${error.message}`);
        }
    }

    /**
     * Proses lengkap: dapatkan link -> unduh video
     * @param {string} instagramUrl 
     * @param {string} outputDir 
     * @returns {Promise<{downloadLink: string, filePath: string}>}
     */
    async process(instagramUrl, outputDir) {
        console.log(`Mengambil link download untuk: ${instagramUrl}`);
        const downloadLink = await this.getDownloadLink(instagramUrl);
        console.log(`Link didapat: ${downloadLink}`);

        console.log(`Mengunduh video...`);
        const filePath = await this.downloadVideo(downloadLink, outputDir);
        console.log(`Video tersimpan di: ${filePath}`);

        return { downloadLink, filePath };
    }
}

module.exports = VDFRDownloader;
