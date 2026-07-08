const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');
const qs = require('querystring');

async function getActiveDomain() {
    const gatewayUrl = 'https://samehadaku.care/';
    try {
        const response = await cloudscraper.get(gatewayUrl);
        const redirectMatch = response.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (redirectMatch && redirectMatch[1]) {
            return redirectMatch[1].endsWith('/') ? redirectMatch[1] : redirectMatch[1] + '/';
        }
        
        const $ = cheerio.load(response);
        const link = $('a[href*="samehadaku"]').first().attr('href');
        if (link) {
            return link.endsWith('/') ? link : link + '/';
        }

        return 'https://v1.samehadaku.how/';
    } catch (error) {
        return 'https://v1.samehadaku.how/';
    }
}

const makeProxyLink = (originalUrl, type, apiBaseUrl) => {
    if (!apiBaseUrl || !originalUrl) return originalUrl;
    
    // Perbaikan logika: Deteksi otomatis tipe berdasarkan konten URL
    // Link streaming di Samehadaku umumnya mengandung kata 'episode'
    const isStream = originalUrl.toLowerCase().includes('episode');
    const endpoint = isStream ? 'stream' : 'detail';
    
    return `${apiBaseUrl}/api/anime/samehadaku/${endpoint}?url=${encodeURIComponent(originalUrl)}`;
};

async function getHome(apiBaseUrl) {
    const baseDomain = await getActiveDomain();
    try {
        const response = await cloudscraper.get(baseDomain);
        const $ = cheerio.load(response);
        
        const results = {
            top10Weekly: [],
            latestUpdates: [],
            projectMovies: []
        };

        $('.topten-animesu li').each((i, el) => {
            const originalUrl = $(el).find('a.series').attr('href');
            results.top10Weekly.push({
                rank: $(el).find('.is-topten b:last-child').text().trim(),
                title: $(el).find('.judul').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'detail', apiBaseUrl),
                rating: $(el).find('.rating').text().trim(),
                thumbnail: $(el).find('img').attr('src')
            });
        });

        $('.post-show ul li').each((i, el) => {
            const $el = $(el);
            const originalUrl = $el.find('.entry-title a').attr('href');
            results.latestUpdates.push({
                title: $el.find('.entry-title a').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'stream', apiBaseUrl),
                episode: $el.find('.dtla span:nth-child(2) author').text().trim(),
                posted_by: $el.find('.author author').text().trim(),
                released: $el.find('.dtla span:last-child').text().replace(/Released on:/gi, '').trim(),
                thumbnail: $el.find('.thumb img').attr('src')
            });
        });

        $('#sidebar .widgets').each((i, el) => {
            const widgetTitle = $(el).find('h3').text();
            if (widgetTitle.includes("Project Movie")) {
                $(el).find('.widgetseries ul li').each((j, li) => {
                    const $li = $(li);
                    const originalUrl = $li.find('h2 a').attr('href');
                    results.projectMovies.push({
                        title: $li.find('h2 a').text().trim(),
                        original_url: originalUrl,
                        url: makeProxyLink(originalUrl, 'detail', apiBaseUrl),
                        thumbnail: $li.find('img').attr('src'),
                        genres: $li.find('span:contains("Genres")').text().replace(/Genres:|[\n\t]/gi, '').trim(),
                        release_date: $li.find('span').last().text().trim()
                    });
                });
            }
        });

        return results;
    } catch (error) {
        throw new Error(error.message);
    }
}

async function getDetail(url, apiBaseUrl) {
    const baseDomain = await getActiveDomain();
    const targetUrl = url.startsWith('http') ? url : `${baseDomain}${url.replace(/^\//, '')}`;

    try {
        const response = await cloudscraper.get(targetUrl);
        const $ = cheerio.load(response);
        
        const animeData = {
            title: $('.entry-title').first().text().trim(),
            thumbnail: $('.infoanime .thumb img').attr('src'),
            rating: $('span[itemprop="ratingValue"]').text().trim(),
            synopsis: $('.desc .entry-content').text().trim(),
            genres: [],
            details: {},
            episodeList: [],
            recommendations: []
        };

        $('.genre-info a').each((i, el) => {
            animeData.genres.push($(el).text().trim());
        });

        $('.spe span').each((i, el) => {
            const key = $(el).find('b').text().replace(':', '').trim();
            const value = $(el).contents().not($(el).find('b')).text().trim();
            if (key) animeData.details[key.toLowerCase().replace(/ /g, '_')] = value;
        });

        $('.lstepsiode ul li').each((i, el) => {
            const originalUrl = $(el).find('.epsleft .lchx a').attr('href');
            animeData.episodeList.push({
                episode_number: $(el).find('.epsright .eps a').text().trim() || $(el).find('.epsright').text().trim(),
                title: $(el).find('.epsleft .lchx a').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'stream', apiBaseUrl),
                date: $(el).find('.epsleft .date').text().trim()
            });
        });

        $('.rand-animesu ul li').each((i, el) => {
            const originalUrl = $(el).find('a.series').attr('href');
            animeData.recommendations.push({
                title: $(el).find('.judul').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'detail', apiBaseUrl),
                thumbnail: $(el).find('img').attr('src'),
                rating: $(el).find('.rating').text().trim(),
                latest_eps: $(el).find('.episode').text().trim()
            });
        });

        return animeData;
    } catch (error) {
        throw new Error(error.message);
    }
}

async function getStream(url, apiBaseUrl) {
    const baseDomain = await getActiveDomain();
    const targetUrl = url.startsWith('http') ? url : `${baseDomain}${url.replace(/^\//, '')}`;

    try {
        const response = await cloudscraper.get(targetUrl);
        const $ = cheerio.load(response);

        const seriesOriginalUrl = $('.nvsc a').attr('href');

        const results = {
            title: $('.entry-title').text().trim() || $('.entry-header h1').text().trim(),
            episode: $('.epx .episodeNumber').text().trim(),
            posted: $('.time-post').text().trim(),
            series_url: makeProxyLink(seriesOriginalUrl, 'detail', apiBaseUrl),
            original_series_url: seriesOriginalUrl,
            downloadLinks: [],
            serverOptions: []
        };

        $('.download-eps').each((i, el) => {
            const format = $(el).find('p b').text().trim();
            const list = [];
            $(el).find('ul li').each((j, li) => {
                const quality = $(li).find('strong').text().trim();
                const servers = [];
                $(li).find('span a').each((k, a) => {
                    servers.push({ provider: $(a).text().trim(), url: $(a).attr('href') });
                });
                if (quality) list.push({ quality, servers });
            });
            if (format && list.length > 0) results.downloadLinks.push({ format, list });
        });

        $('.east_player_option').each((i, el) => {
            const post = $(el).attr('data-post');
            const nume = $(el).attr('data-nume');
            const type = $(el).attr('data-type');
            
            let embedUrlProxy = null;
            if (apiBaseUrl) {
                 embedUrlProxy = `${apiBaseUrl}/api/anime/samehadaku/embed?post=${post}&nume=${nume}&type=${type}&url=${encodeURIComponent(targetUrl)}`;
            }

            results.serverOptions.push({
                name: $(el).text().trim(),
                post: post,
                nume: nume,
                type: type,
                embed_proxy: embedUrlProxy
            });
        });

        return results;
    } catch (error) {
        throw new Error(error.message);
    }
}

async function getEmbed(post, nume, type, refererUrl) {
    const baseDomain = await getActiveDomain();
    const ajaxUrl = `${baseDomain}wp-admin/admin-ajax.php`;

    try {
        const payload = qs.stringify({
            action: 'player_ajax',
            post: post,
            nume: nume,
            type: type
        });

        const ajaxResponse = await cloudscraper.post({
            uri: ajaxUrl,
            body: payload,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Referer': refererUrl || baseDomain,
                'Origin': baseDomain.replace(/\/$/, ''),
                'Accept': '*/*'
            }
        });

        if (!ajaxResponse || ajaxResponse === '0') {
             throw new Error("Invalid response from server");
        }

        let embedHtml = ajaxResponse;
        if (!ajaxResponse.includes('<iframe') && ajaxResponse.length > 20) {
            try {
                embedHtml = Buffer.from(ajaxResponse, 'base64').toString('utf-8');
            } catch (e) {}
        }

        const $player = cheerio.load(embedHtml);
        let finalUrl = $player('iframe').attr('src') || $player('article').attr('src') || $player('embed').attr('src');

        if (finalUrl && finalUrl.startsWith('//')) {
            finalUrl = 'https:' + finalUrl;
        }

        return {
            embed_url: finalUrl || null,
            raw_html: finalUrl ? null : embedHtml
        };
    } catch (error) {
        throw new Error(error.message);
    }
}

async function getSchedule(apiBaseUrl) {
    const baseDomain = await getActiveDomain();
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const weeklySchedule = {};

    for (const day of days) {
        try {
            const apiUrl = `${baseDomain}wp-json/custom/v1/all-schedule?perpage=50&day=${day}`;
            const response = await cloudscraper.get({
                uri: apiUrl,
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': `${baseDomain}jadwal-rilis/`
                }
            });

            const data = JSON.parse(response);
            weeklySchedule[day] = data.map(anime => ({
                title: anime.title,
                original_url: anime.url,
                url: makeProxyLink(anime.url, 'detail', apiBaseUrl),
                type: anime.east_type,
                score: anime.east_score,
                genres: anime.genre,
                time: anime.east_time,
                thumbnail: anime.featured_img_src
            }));

            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            weeklySchedule[day] = [];
        }
    }

    return weeklySchedule;
}

async function search(query, apiBaseUrl) {
    const baseDomain = await getActiveDomain();
    const searchUrl = `${baseDomain}?s=${encodeURIComponent(query)}`;

    try {
        const response = await cloudscraper.get(searchUrl);
        const $ = cheerio.load(response);
        const results = [];

        $('article.animpost').each((i, el) => {
            const $el = $(el);
            const genres = [];
            $el.find('.genres .mta a').each((j, g) => {
                genres.push($(g).text().trim());
            });

            const originalUrl = $el.find('.animposx a').attr('href');

            results.push({
                title: $el.find('.title h2').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'detail', apiBaseUrl),
                thumbnail: $el.find('.content-thumb img').attr('src'),
                type: $el.find('.type').first().text().trim(),
                status: $el.find('.data .type').text().trim(),
                score: $el.find('.score').text().trim(),
                synopsis: $el.find('.ttls').text().replace('Sinopsis anime', '').replace(':', '').trim(),
                genres: genres,
                views: $el.find('.metadata span').last().text().trim()
            });
        });

        return {
            query: query,
            total_results: results.length,
            data: results
        };
    } catch (error) {
        throw new Error(error.message);
    }
}

async function getList(pageNumber = 1, apiBaseUrl) {
    const baseDomain = await getActiveDomain();
    const path = pageNumber > 1 ? `daftar-anime-2/page/${pageNumber}/` : `daftar-anime-2/`;
    const targetUrl = `${baseDomain}${path}`;

    try {
        const response = await cloudscraper.get(targetUrl);
        const $ = cheerio.load(response);
        const results = [];

        $('article.animpost').each((i, el) => {
            const $el = $(el);
            const genres = [];
            $el.find('.genres .mta a').each((j, g) => {
                genres.push($(g).text().trim());
            });

            const originalUrl = $el.find('.animposx a').attr('href');

            results.push({
                title: $el.find('.title h2').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'detail', apiBaseUrl),
                thumbnail: $el.find('.content-thumb img').attr('src'),
                type: $el.find('.type').first().text().trim(),
                status: $el.find('.data .type').text().trim(),
                score: $el.find('.score').text().trim(),
                synopsis: $el.find('.ttls').text().replace(/Sinopsis anime|:/gi, '').trim(),
                genres: genres,
                views: $el.find('.metadata span').last().text().trim()
            });
        });

        const paginationText = $('.pagination span').first().text() || $('.pagination').text();
        const totalPagesMatch = paginationText.match(/of\s+(\d+)/);
        const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1]) : 1;

        return {
            pagination: {
                current_page: pageNumber,
                total_pages: totalPages,
                has_next: pageNumber < totalPages
            },
            data: results
        };
    } catch (error) {
        throw new Error(error.message);
    }
}

module.exports = {
    getActiveDomain,
    getHome,
    getDetail,
    getStream,
    getEmbed,
    getSchedule,
    search,
    getList
};