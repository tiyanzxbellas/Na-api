const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');

const BASE_URL = 'https://anichin.cafe';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': BASE_URL + '/',
    'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'Upgrade-Insecure-Requests': '1'
};

const makeProxyLink = (originalUrl, type, apiBaseUrl) => {
    if (!apiBaseUrl || !originalUrl) return originalUrl;
    const cleanPath = originalUrl.replace(BASE_URL, '').replace(/^\/+/, '');
    const endpoint = type === 'detail' ? 'detail' : 'stream';
    return `${apiBaseUrl}/api/anime/anichin/${endpoint}?url=/${encodeURIComponent(cleanPath)}`;
};

async function getHome(apiBaseUrl) {
    try {
        const data = await cloudscraper.get({ uri: BASE_URL + '/', headers: HEADERS });
        const $ = cheerio.load(data);
        const results = {
            featuredSlider: [],
            popularToday: [],
            latestReleases: [],
            ongoingSidebar: []
        };

        $('.swiper-wrapper .item').each((i, el) => {
            const style = $(el).find('.backdrop').attr('style') || "";
            const thumb = style.match(/url\('(.*?)'\)/)?.[1] || "";
            const originalUrl = $(el).find('h2 a').attr('href');
            
            results.featuredSlider.push({
                title: $(el).find('h2 a').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'detail', apiBaseUrl),
                thumbnail: thumb,
                description: $(el).find('.info p').text().trim()
            });
        });

        $('.hothome').next('.listupd').find('article.bs').each((i, el) => {
            const originalUrl = $(el).find('a').attr('href');
            results.popularToday.push({
                title: $(el).find('.tt').text().trim(),
                episode: $(el).find('.epx').text().trim(),
                type: $(el).find('.typez').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'stream', apiBaseUrl),
                thumbnail: $(el).find('img').attr('src')
            });
        });

        $('.latesthome').next('.listupd').find('article.bs').each((i, el) => {
             const originalUrl = $(el).find('a').attr('href');
            results.latestReleases.push({
                title: $(el).find('.tt').text().trim(),
                episode: $(el).find('.epx').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'stream', apiBaseUrl),
                thumbnail: $(el).find('img').attr('src'),
                status: $(el).find('.status').text().trim() || "Ongoing"
            });
        });

        $('.ongoingseries ul li').each((i, el) => {
            const originalUrl = $(el).find('a').attr('href');
            results.ongoingSidebar.push({
                title: $(el).find('.l').text().trim(),
                episode: $(el).find('.r').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'stream', apiBaseUrl)
            });
        });

        return results;

    } catch (error) {
        throw new Error(`Anichin Home Error: ${error.message}`);
    }
}

async function getDetail(url, apiBaseUrl) {
    try {
        const targetUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
        const data = await cloudscraper.get({ uri: targetUrl, headers: { ...HEADERS, Referer: BASE_URL + '/' } });
        const $ = cheerio.load(data);
        const detail = {};

        detail.title = $('.entry-title').text().trim();
        detail.alternativeTitle = $('.alter').text().trim();
        detail.thumbnail = $('.thumb img').attr('src');
        detail.rating = $('span[itemprop="ratingValue"]').text().trim() || $('.rating strong').text().replace('Rating ', '').trim();
        detail.synopsis = $('.synp .entry-content').text().trim();

        detail.metadata = {};
        $('.spe span').each((i, el) => {
            const key = $(el).find('b').text().replace(':', '').trim().toLowerCase().replace(/ /g, '_');
            const value = $(el).contents().not($(el).find('b')).text().trim();
            if (key) detail.metadata[key] = value;
        });

        detail.genres = [];
        $('.genxed a').each((i, el) => {
            detail.genres.push($(el).text().trim());
        });

        detail.batchDownloads = [];
        $('.soraddlx').each((i, el) => {
            const batchTitle = $(el).find('.sorattlx h3').text().trim();
            const downloadOptions = [];

            $(el).find('.soraurlx').each((j, qEl) => {
                const quality = $(qEl).find('strong').text().trim();
                const servers = [];

                $(qEl).find('a').each((k, aEl) => {
                    servers.push({
                        name: $(aEl).text().trim(),
                        link: $(aEl).attr('href')
                    });
                });

                downloadOptions.push({
                    quality: quality,
                    links: servers
                });
            });

            detail.batchDownloads.push({
                batch: batchTitle,
                options: downloadOptions
            });
        });

        detail.episodeList = [];
        $('.eplister ul li').each((i, el) => {
            const originalUrl = $(el).find('a').attr('href');
            detail.episodeList.push({
                episode: $(el).find('.epl-num').text().trim(),
                title: $(el).find('.epl-title').text().trim(),
                date: $(el).find('.epl-date').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'stream', apiBaseUrl)
            });
        });

        return detail;
    } catch (error) {
        throw new Error(`Anichin Detail Error: ${error.message}`);
    }
}

async function getStream(url, apiBaseUrl) {
    try {
        const targetUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
        const data = await cloudscraper.get({ uri: targetUrl, headers: { ...HEADERS, Referer: BASE_URL + '/' } });
        const $ = cheerio.load(data);
        const result = {
            title: $('.entry-title').text().trim(),
            series: $('.year a').last().text().trim(),
            original_series_url: $('.year a').last().attr('href'),
            series_url: makeProxyLink($('.year a').last().attr('href'), 'detail', apiBaseUrl),
            streamingLinks: [],
            downloadLinks: [],
            navigation: {}
        };

        $('.mirror option').each((i, el) => {
            const name = $(el).text().trim();
            const value = $(el).attr('value');

            if (value && value !== "") {
                try {
                    const decodedHtml = Buffer.from(value, 'base64').toString('utf8');
                    const iframeSrc = cheerio.load(decodedHtml)('iframe').attr('src');
                    result.streamingLinks.push({
                        server: name,
                        link: iframeSrc
                    });
                } catch (e) {
                    result.streamingLinks.push({
                        server: name,
                        raw_data: value
                    });
                }
            }
        });

        $('.mctnx .soraddlx').first().find('.soraurlx').each((i, el) => {
            const quality = $(el).find('strong').text().trim();
            const links = [];

            $(el).find('a').each((j, aEl) => {
                links.push({
                    host: $(aEl).text().trim(),
                    link: $(aEl).attr('href')
                });
            });

            result.downloadLinks.push({
                quality: quality,
                links: links
            });
        });

        const nav = $('.naveps.bignav');
        const prevUrl = nav.find('.nvs').first().find('a').attr('href') || null;
        const allUrl = nav.find('.nvsc a').attr('href') || null;
        const nextUrl = nav.find('.nvs').last().find('a').attr('href') || null;

        result.navigation = {
            prevEpisode: prevUrl ? makeProxyLink(prevUrl, 'stream', apiBaseUrl) : null,
            allEpisodes: allUrl ? makeProxyLink(allUrl, 'detail', apiBaseUrl) : null,
            nextEpisode: nextUrl ? makeProxyLink(nextUrl, 'stream', apiBaseUrl) : null
        };

        return result;
    } catch (error) {
        throw new Error(`Anichin Stream Error: ${error.message}`);
    }
}

async function search(query, page = 1, apiBaseUrl) {
    try {
        const targetUrl = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`;
        const data = await cloudscraper.get({ uri: targetUrl, headers: { ...HEADERS, Referer: BASE_URL + '/' } });
        const $ = cheerio.load(data);
        const results = {
            searchQuery: query,
            currentPage: page,
            totalResults: 0,
            hasNextPage: false,
            data: []
        };

        $('.listupd article.bs').each((i, el) => {
            const $el = $(el);
            const originalUrl = $el.find('a').attr('href');
            
            const item = {
                title: $el.find('.tt h2').text().trim() || $el.find('.tt').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'detail', apiBaseUrl),
                thumbnail: $el.find('img').attr('src'),
                type: $el.find('.typez').text().trim(),
                status: $el.find('.status').text().trim() || "Ongoing",
                episode: $el.find('.epx').text().trim(),
                sub: $el.find('.sb').text().trim()
            };

            results.data.push(item);
        });

        results.totalResults = results.data.length;
        const nextHpage = $('.hpage .r').attr('href');
        results.hasNextPage = !!nextHpage;

        return results;
    } catch (error) {
        throw new Error(`Anichin Search Error: ${error.message}`);
    }
}

async function getSchedule(apiBaseUrl) {
    try {
        const data = await cloudscraper.get({ uri: BASE_URL + '/schedule/', headers: { ...HEADERS, Referer: BASE_URL + '/' } });
        const $ = cheerio.load(data);
        const schedule = [];

        $('.schedulepage').each((i, dayBlock) => {
            const dayName = $(dayBlock).find('.releases h3 span').text().trim();
            const donghuas = [];

            $(dayBlock).find('.listupd .bs').each((j, el) => {
                const $el = $(el);
                const originalUrl = $el.find('a').attr('href');
                
                const item = {
                    title: $el.find('.tt').text().trim(),
                    original_url: originalUrl,
                    url: makeProxyLink(originalUrl, 'detail', apiBaseUrl),
                    thumbnail: $el.find('img').attr('src'),
                    releaseTime: $el.find('.epx').text().trim(), 
                    releaseTimestamp: $el.find('.epx').attr('data-rlsdt') || null,
                    nextEpisode: $el.find('.sb').text().trim() 
                };

                donghuas.push(item);
            });

            if (dayName) {
                schedule.push({
                    day: dayName,
                    totalCount: donghuas.length,
                    list: donghuas
                });
            }
        });

        return schedule;
    } catch (error) {
        throw new Error(`Anichin Schedule Error: ${error.message}`);
    }
}

async function getGenres() {
    try {
        const data = await cloudscraper.get({ uri: BASE_URL + '/', headers: HEADERS });
        const $ = cheerio.load(data);
        const genres = [];

        $('.section ul.genre li a').each((i, el) => {
            genres.push({
                name: $(el).text().trim(),
                url: $(el).attr('href'),
                slug: $(el).attr('href').split('/').filter(Boolean).pop()
            });
        });

        return genres;
    } catch (error) {
         throw new Error(`Anichin Genres Error: ${error.message}`);
    }
}

async function getByGenre(genreSlug, page = 1, apiBaseUrl) {
    try {
        const targetUrl = page > 1 ? `${BASE_URL}/genres/${genreSlug}/page/${page}/` : `${BASE_URL}/genres/${genreSlug}/`;
        const data = await cloudscraper.get({ uri: targetUrl, headers: { ...HEADERS, Referer: BASE_URL + '/' } });
        const $ = cheerio.load(data);
        const results = {
            genreName: $('.releases h1 span').text().trim(),
            currentPage: page,
            hasNextPage: false,
            data: []
        };

        $('.listupd article.bs').each((i, el) => {
            const $el = $(el);
            const originalUrl = $el.find('a').attr('href');
            results.data.push({
                title: $el.find('.tt').text().trim(),
                original_url: originalUrl,
                url: makeProxyLink(originalUrl, 'detail', apiBaseUrl),
                thumbnail: $el.find('img').attr('src'),
                type: $el.find('.typez').text().trim(),
                status: $el.find('.status').text().trim() || "Ongoing",
                episode: $el.find('.epx').text().trim(),
                sub: $el.find('.sb').text().trim()
            });
        });

        results.hasNextPage = $('.pagination .next').length > 0;

        return results;
    } catch (error) {
        throw new Error(`Anichin Genre Fetch Error: ${error.message}`);
    }
}

module.exports = {
    getHome,
    getDetail,
    getStream,
    search,
    getSchedule,
    getGenres,
    getByGenre
};