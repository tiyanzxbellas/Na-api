const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Yahoo Search Scraper (Enhanced for Mobile/Modern Layout)
 * @param {string} query - Kata kunci pencarian
 */
async function search(query) {
    if (!query) throw new Error("Query is required.");
    
    // Updated URL with parameters to match the provided context (Mobile/Standard layout)
    const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&fr=yfp-hrmob&fr2=p:fp,m:sb&.tsrc=yfp-hrmob&ei=UTF-8&fp=1&toggle=1&cop=mss`;
    
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
                'Referer': 'https://search.yahoo.com/'
            }
        });

        const $ = cheerio.load(response.data);
        const results = [];

        // Unified selection for both Mobile and Desktop layouts found in Yahoo search results
        $('.algo, .algo-sr, .Sr, .ag-1, .ag-2, .ag-3, .ag-4, .ag-5, .ag-6, .ag-7, .ag-8, .ag-9, .ag-10').each((i, el) => {
            const titleNode = $(el).find('.compTitle h3 a, .compTitle a.s-title, h3 a').first();
            const title = titleNode.text().trim();
            let link = titleNode.attr('href');
            
            // Extract the real URL from Yahoo's redirect link if present
            if (link && link.includes('r.search.yahoo.com')) {
                const match = link.match(/\/RU=([^\/]+)\//);
                if (match && match[1]) {
                    try {
                        link = decodeURIComponent(match[1]);
                    } catch (e) {
                        // Keep original link if decoding fails
                    }
                }
            }

            // Look for description in common mobile/desktop snippet classes
            const snippet = $(el).find('.compText p, .s-desc, .compText, .st').first().text().trim();
            
            if (title && link && link.startsWith('http')) {
                results.push({
                    title,
                    link,
                    snippet: snippet || 'No description available.'
                });
            }
        });

        // Fallback for specific legacy or different regional layouts
        if (results.length === 0) {
            $('.algo-sr').each((i, el) => {
                const titleNode = $(el).find('h3 a');
                const title = titleNode.text().trim();
                const link = titleNode.attr('href');
                const snippet = $(el).find('.compText, .s-desc').text().trim();
                
                if (title && link) {
                    results.push({
                        title,
                        link,
                        snippet: snippet || 'No description available.'
                    });
                }
            });
        }

        return results;
    } catch (error) {
        throw new Error("Gagal mengambil hasil pencarian Yahoo: " + error.message);
    }
}

module.exports = { search };