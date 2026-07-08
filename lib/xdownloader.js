const axios = require('axios');
const cheerio = require('cheerio');

/**
 * X/Twitter Video Downloader for xsaver.io
 * @param {string} twitterUrl - URL video dari X (Twitter)
 */
async function getXVideoInfo(twitterUrl) {
    try {
        const baseUrl = 'https://www.xsaver.io/x-downloader/';
        const targetUrl = `${baseUrl}download.php?url=${encodeURIComponent(twitterUrl)}`;

        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.xsaver.io/x-downloader/id/',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const $ = cheerio.load(response.data);
        const results = [];

        // 1. Ambil Judul Video
        const title = $('.video-title').text().trim();

        // 2. Iterasi setiap item media yang ditemukan
        $('.media-item').each((index, element) => {
            const thumb = $(element).find('.media-thumb img').attr('src');
            
            // Mencari link download video (save-url.php)
            const downloadLinkRaw = $(element).find('a[href^="save-url.php"]').attr('href');
            
            if (downloadLinkRaw) {
                // Ekstraksi URL asli dari parameter query 'url'
                const urlParams = new URLSearchParams(downloadLinkRaw.split('?')[1]);
                const directVideoUrl = urlParams.get('url');

                results.push({
                    id: index + 1,
                    type: 'video',
                    thumbnail: thumb,
                    url: directVideoUrl,
                    proxy_link: baseUrl + downloadLinkRaw
                });
            }
        });

        return {
            success: true,
            title: title || 'X Video',
            results: results
        };

    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

module.exports = { getXVideoInfo };