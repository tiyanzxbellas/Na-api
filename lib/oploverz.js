const axios = require('axios');
const cheerio = require('cheerio');

const getDomain = async () => {
  try {
    const response = await axios.get('https://link.oploverz.ltd/', { timeout: 5000 });
    const $ = cheerio.load(response.data);
    
    // Mencari domain dari atribut onclick pada tombol utama
    let domain = $('#button').attr('onclick')?.match(/'([^']+)'/)?.[1];
    
    // Fallback ke link canonical jika tombol tidak ketemu
    if (!domain) {
        domain = $('link[rel="canonical"]').attr('href');
    }

    // Fallback terakhir ke domain aktif yang diketahui jika scraping gagal
    if (!domain) domain = 'https://anime.oploverz.ac/';
    
    // Ensure domain doesn't end with slash for consistent joining
    return domain.endsWith('/') ? domain : domain + '/';
  } catch (error) {
    // Jika request gagal, gunakan domain fallback agar sistem tidak crash
    return 'https://anime.oploverz.ac/';
  }
}

const getHome = async (baseDom, apiBaseUrl) => {
  try {
    const response = await axios.get(baseDom);
    const $ = cheerio.load(response.data);

    const homeData = {
      carousel: [],
      trending: [],
      latest_releases: [],
      new_additions: []
    };

    const makeProxyLink = (originalUrl, type) => {
        if (!apiBaseUrl) return originalUrl;
        const endpoint = type === 'detail' ? 'detail' : 'stream';
        return `${apiBaseUrl}/api/anime/oploverz/${endpoint}?url=${encodeURIComponent(originalUrl)}`;
    };

    const getType = (url) => {
        return url && url.toLowerCase().includes('episode') ? 'stream' : 'detail';
    };

    $('[data-embla-slide]').each((index, element) => {
      const slide = $(element);
      const title = slide.find('h1 span').text().trim();
      const description = slide.find('p.mt-2').text().trim();
      const image = slide.find('img').attr('src');
      const href = slide.find('a').first().attr('href');
      
      if (title && href) {
        const isRelative = !href.startsWith('http');
        const originalLink = isRelative ? baseDom + href.replace(/^\//, '') : href;
        const linkForProxy = isRelative ? href : originalLink;
        
        homeData.carousel.push({
          title,
          description,
          image,
          originalLink: originalLink,
          link: makeProxyLink(linkForProxy, getType(href))
        });
      }
    });

    $('[data-embla-container]').first().find('[data-embla-slide]').each((index, element) => {
      const item = $(element);
      const title = item.find('p').text().trim();
      const image = item.find('img').attr('src');
      const href = item.find('a').attr('href');
      const episodeInfo = item.find('span').first().text().trim();

      if (title && href) {
        const isRelative = !href.startsWith('http');
        const originalLink = isRelative ? baseDom + href.replace(/^\//, '') : href;
        const linkForProxy = isRelative ? href : originalLink;
        
        homeData.trending.push({
          title,
          image,
          originalLink: originalLink,
          link: makeProxyLink(linkForProxy, getType(href)),
          episode_info: episodeInfo
        });
      }
    });

    $('.bg-card').each((index, element) => {
      const card = $(element);
      const title = card.find('p.text-base').text().trim();
      const image = card.find('img').attr('src');
      const href = card.find('a').first().attr('href');
      const episode = card.find('p:contains("Episode")').text().trim();
      const timeAgo = card.find('p:contains("m"), p:contains("h"), p:contains("d")').text().trim();

      if (title && href) {
        const isRelative = !href.startsWith('http');
        const originalLink = isRelative ? baseDom + href.replace(/^\//, '') : href;
        const linkForProxy = isRelative ? href : originalLink;
        
        homeData.latest_releases.push({
          title,
          image,
          originalLink: originalLink,
          link: makeProxyLink(linkForProxy, getType(href)),
          episode,
          time_ago: timeAgo
        });
      }
    });

    $('[data-embla-container]').last().find('[data-embla-slide]').each((index, element) => {
      const item = $(element);
      const title = item.find('p').text().trim();
      const image = item.find('img').attr('src');
      const href = item.find('a').attr('href');
      const episodeInfo = item.find('span').first().text().trim();

      if (title && href) {
        const isRelative = !href.startsWith('http');
        const originalLink = isRelative ? baseDom + href.replace(/^\//, '') : href;
        const linkForProxy = isRelative ? href : originalLink;

        homeData.new_additions.push({
          title,
          image,
          originalLink: originalLink,
          link: makeProxyLink(linkForProxy, getType(href)),
          episode_info: episodeInfo
        });
      }
    });

    return homeData;
  } catch (error) {
    console.log('Error in getHome:', error);
    throw error;
  }
}

const getDetail = async (baseDom, link, apiBaseUrl) => {
  try {
    const response = await axios.get(link);
    const $ = cheerio.load(response.data);

    const detailData = {
      title: '',
      japanese_title: '',
      description: '',
      poster: '',
      information: {},
      episodes: [],
      breadcrumb: []
    };

    const makeProxyLink = (originalUrl, type) => {
        if (!apiBaseUrl) return originalUrl;
        const endpoint = type === 'detail' ? 'detail' : 'stream';
        return `${apiBaseUrl}/api/anime/oploverz/${endpoint}?url=${encodeURIComponent(originalUrl)}`;
    };

    $('nav[aria-label="breadcrumb"] a, nav[aria-label="breadcrumb"] span').each((index, element) => {
      const text = $(element).text().trim();
      if (text) {
        detailData.breadcrumb.push(text);
      }
    });

    detailData.title = $('p.text-2xl.font-semibold').first().text().trim();
    detailData.japanese_title = $('p.text-2xl.font-semibold').first().next('p').text().trim();
    detailData.description = $('p.text-2xl.font-semibold').first().next('p').next('p').text().trim();
    detailData.poster = $('.aspect-h-1.aspect-w-1 img').attr('src');

    $('ul.grid-cols-1 li').each((index, element) => {
      const text = $(element).text().trim();
      if (text.includes('Type:')) detailData.information.type = text.replace('Type:', '').trim();
      else if (text.includes('Studio:')) detailData.information.studio = text.replace('Studio:', '').trim();
      else if (text.includes('Released Date:')) detailData.information.released_date = text.replace('Released Date:', '').trim();
      else if (text.includes('Status:')) detailData.information.status = text.replace('Status:', '').trim();
      else if (text.includes('Genre:')) detailData.information.genres = text.replace('Genre:', '').trim().split(',').map(g => g.trim());
      else if (text.includes('Score:')) detailData.information.score = text.replace('Score:', '').trim();
      else if (text.includes('Duration:')) detailData.information.duration = text.replace('Duration:', '').trim();
    });

    $('a.flex.w-full.items-center.justify-between').each((index, element) => {
      const href = $(element).attr('href');
      const isRelative = !href.startsWith('http');
      const originalLink = isRelative ? baseDom + href.replace(/^\//, '') : href;
      const linkForProxy = isRelative ? href : originalLink;

      detailData.episodes.push({
        quality: $(element).find('p').first().text().trim(),
        release_date: $(element).find('p').last().text().trim(),
        originalLink: originalLink,
        link: makeProxyLink(linkForProxy, 'stream')
      });
    });

    const watchNowBtn = $('a[href*="/movie/"] button').parent();
    const watchNowHref = watchNowBtn.attr('href');
    if (watchNowHref) {
      const isRelative = !watchNowHref.startsWith('http');
      const originalWatchLink = isRelative ? baseDom + watchNowHref.replace(/^\//, '') : watchNowHref;
      const linkForProxy = isRelative ? watchNowHref : originalWatchLink;
      
      detailData.watch_now_link = makeProxyLink(linkForProxy, 'stream');
      detailData.watch_now_original_link = originalWatchLink;
    }

    return detailData;
  } catch (error) {
    console.log('Error in getDetail:', error);
    throw error;
  }
}

const getStream = async (baseDom, streamLink, apiBaseUrl) => {
  try {
    const response = await axios.get(streamLink);
    const $ = cheerio.load(response.data);

    const streamData = {
      title: '',
      download_links: { mp4: [], mkv: [] },
      stream_links: [],
      episode_info: {},
      navigation: {}
    };

    const makeProxyLink = (originalUrl) => {
        if (!apiBaseUrl) return originalUrl;
        return `${apiBaseUrl}/api/anime/oploverz/stream?url=${encodeURIComponent(originalUrl)}`;
    };

    streamData.title = $('p.text-2xl.font-semibold').first().text().trim() || $('h1').first().text().trim();

    const prevLink = $('a:contains("Sebelumnya")').first();
    const nextLink = $('a:contains("Selanjutnya")').first();

    if (prevLink.length && prevLink.attr('href') && prevLink.attr('href') !== '#') {
        const href = prevLink.attr('href');
        const isRelative = !href.startsWith('http');
        const originalLink = isRelative ? baseDom + href.replace(/^\//, '') : href;
        const linkForProxy = isRelative ? href : originalLink;
        streamData.navigation.prev = { link: makeProxyLink(linkForProxy), originalLink: originalLink };
    }

    if (nextLink.length && nextLink.attr('href') && nextLink.attr('href') !== '#') {
        const href = nextLink.attr('href');
        const isRelative = !href.startsWith('http');
        const originalLink = isRelative ? baseDom + href.replace(/^\//, '') : href;
        const linkForProxy = isRelative ? href : originalLink;
        streamData.navigation.next = { link: makeProxyLink(linkForProxy), originalLink: originalLink };
    }

    let downloadData = null, streamUrls = null, episodeInfoData = null;

    $('script').each((i, el) => {
        const content = $(el).html();
        if (!content) return;
        const extractData = (str, keyword) => {
            const regex = new RegExp(`["']?${keyword}["']?\\s*:\\s*([\\{\\[])`, 'g');
            let match;
            while ((match = regex.exec(str)) !== null) {
                const startChar = match[1];
                const startIndex = match.index + match[0].length - 1;
                let open = 0;
                let closeIndex = -1;
                const openChar = startChar;
                const closeChar = startChar === '[' ? ']' : '}';
                
                for (let j = startIndex; j < str.length; j++) {
                    if (str[j] === openChar) open++;
                    else if (str[j] === closeChar) open--;
                    if (open === 0) { closeIndex = j + 1; break; }
                }
                
                if (closeIndex !== -1) {
                    try {
                        return new Function('return ' + str.substring(startIndex, closeIndex))();
                    } catch (e) {}
                }
            }
            return null;
        };

        if (!downloadData) downloadData = extractData(content, 'downloadUrl');
        if (!streamUrls) streamUrls = extractData(content, 'streamUrl');
        if (!episodeInfoData) episodeInfoData = extractData(content, 'episode');
    });

    if (downloadData && Array.isArray(downloadData)) {
      downloadData.forEach(format => {
        if (format.format === 'mp4' || format.format === 'mkv') {
          format.resolutions.forEach(resolution => {
            streamData.download_links[format.format].push({
              quality: resolution.quality,
              links: resolution.download_links.map(link => ({ host: link.host, url: link.url }))
            });
          });
        }
      });
    }

    if (streamUrls && Array.isArray(streamUrls)) {
      streamData.stream_links = streamUrls.map(stream => ({ source: stream.source, url: stream.url }));
    }

    if (episodeInfoData) {
        streamData.episode_info = {
            id: episodeInfoData.id,
            title: episodeInfoData.title,
            episode_number: episodeInfoData.episodeNumber,
            released_at: episodeInfoData.releasedAt,
            subbed: episodeInfoData.subbed
        };
    }

    if (streamData.download_links.mp4.length === 0 && streamData.download_links.mkv.length === 0) {
      $('a[href*="acefile.co"], a[href*="akirabox.com"], a[href*="buzzheavier.com"], a[href*="filedon.co"]').each((index, element) => {
        const link = $(element);
        const href = link.attr('href');
        const text = link.text().trim();
        if (href && text) {
          const format = text.toLowerCase().includes('mkv') || href.includes('.mkv') ? 'mkv' : 'mp4';
          const quality = (text.match(/(Mini|HD|FHD|SD|720p|1080p)/i) || [])[1] || 'Unknown';
          const host = (href.match(/\/\/([^\/]+)/) || [])[1] || 'Unknown';
          streamData.download_links[format].push({ quality, links: [{ host, url: href }] });
        }
      });
    }

    if (streamData.stream_links.length === 0) {
        $('iframe').each((index, element) => {
          const src = $(element).attr('src');
          if (src && (src.includes('filedon.co') || src.includes('stream'))) {
            streamData.stream_links.push({ source: 'Embedded Player', url: src });
          }
        });
    }

    return streamData;
  } catch (error) {
    console.log('Error in getStream:', error);
    throw error;
  }
}

const searchAnime = async (query, apiBaseUrl) => {
  try {
    const response = await axios.get(`https://backapi.oploverz.ac/api/series?q=${encodeURIComponent(query)}`);
    const data = response.data.data;

    const makeProxyLink = (originalUrl) => {
        if (!apiBaseUrl) return originalUrl;
        return `${apiBaseUrl}/api/anime/oploverz/detail?url=${encodeURIComponent(originalUrl)}`;
    };

    if (!Array.isArray(data)) return [];

    return data.map(item => {
        const relativePath = `/series/${item.slug}`;
        return {
            title: item.title,
            japanese_title: item.japaneseTitle,
            description: item.description,
            poster: item.poster,
            score: item.score,
            status: item.status,
            type: item.releaseType,
            episodes_count: item.totalEpisodes,
            genres: item.genres.map(g => g.name),
            originalLink: relativePath,
            link: makeProxyLink(relativePath)
        };
    });
  } catch (error) {
    console.log('Error in searchAnime:', error);
    throw error;
  }
}

const getAnimeByGenre = async (genre, page = 1, apiBaseUrl) => {
  try {
    // Memastikan genre dalam format lowercase (tidak peka huruf besar/kecil)
    const normalizedGenre = genre.toLowerCase();
    
    // URL API baru dari SvelteKit
    const url = `https://anime.oploverz.ac/series/__data.json?genre=${encodeURIComponent(normalizedGenre)}&page=${page}&x-sveltekit-invalidated=001`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    const json = response.data;
    
    // Periksa struktur data (SvelteKit serialization)
    if (!json.nodes || !json.data) return { data: [], pagination: {} };

    // Data array raw
    const D = json.data;

    // Parsing manual berdasarkan pola umum devalue/sveltekit di response ini:
    // Root object D[0] punya property 'series' -> index
    
    const rootIdx = 0; 
    const rootObj = D[rootIdx];
    
    if (!rootObj || typeof rootObj.series === 'undefined') {
        return { data: [], pagination: {} };
    }

    const seriesContainerIdx = rootObj.series; 
    const seriesContainer = D[seriesContainerIdx]; 
    
    if (!seriesContainer || typeof seriesContainer.data === 'undefined') {
        return { data: [], pagination: {} };
    }

    const listIdx = seriesContainer.data; 
    const listIndices = D[listIdx]; 

    if (!Array.isArray(listIndices)) {
        return { data: [], pagination: {} };
    }

    const makeProxyLink = (originalUrl) => {
        if (!apiBaseUrl) return originalUrl;
        return `${apiBaseUrl}/api/anime/oploverz/detail?url=${encodeURIComponent(originalUrl)}`;
    };

    const mappedData = listIndices.map(idx => {
        const item = D[idx]; // Object referensi
        
        // Helper resolve value: jika integer, ambil dari D. Jika array, map.
        const resolve = (val) => {
            if (typeof val === 'number') return D[val];
            return val;
        };

        const title = resolve(item.title);
        const slug = resolve(item.slug);
        const poster = resolve(item.poster);
        const description = resolve(item.description);
        const score = resolve(item.score);
        const status = resolve(item.status);
        const type = resolve(item.releaseType);
        const episodes_count = resolve(item.totalEpisodes);

        let genres = [];
        if (item.genres) {
            const genresIdx = item.genres;
            const genresListRef = typeof genresIdx === 'number' ? D[genresIdx] : genresIdx;
            if (Array.isArray(genresListRef)) {
                genres = genresListRef.map(gIdx => {
                    // gIdx is index to genre object or genre object
                    const gObj = typeof gIdx === 'number' ? D[gIdx] : gIdx;
                    return gObj && gObj.name ? resolve(gObj.name) : null;
                }).filter(g => g);
            }
        }

        const relativePath = `/series/${slug}`;

        return {
            title,
            japanese_title: resolve(item.japaneseTitle),
            description,
            poster,
            score,
            status,
            type,
            episodes_count,
            genres,
            originalLink: relativePath,
            link: makeProxyLink(relativePath)
        };
    }).filter(i => i);

    // Pagination
    let pagination = {};
    if (seriesContainer.meta) {
        const metaObj = typeof seriesContainer.meta === 'number' ? D[seriesContainer.meta] : seriesContainer.meta;
        if (metaObj) {
            // Helper untuk resolve nested numbers di meta
            const resolveMeta = (val) => typeof val === 'number' ? D[val] : val;
            pagination = {
                currentPage: resolveMeta(metaObj.currentPage),
                lastPage: resolveMeta(metaObj.lastPage),
                total: resolveMeta(metaObj.total)
            };
        }
    }

    return {
        data: mappedData,
        pagination
    };

  } catch (error) {
    console.log('Error in getAnimeByGenre:', error);
    throw error;
  }
}

const getSchedule = async (baseDom) => {
    const URL = `${baseDom}schedule/__data.json`;
    
    try {
        const response = await axios.get(URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': `${baseDom}schedule`
            }
        });

        const nodes = response.data.nodes;
        let dataPool = [];
        let scheduleRaw = null;

        for (const node of nodes) {
            if (node && node.data && Array.isArray(node.data)) {
                const found = node.data.find(item => 
                    item && typeof item === 'object' && 
                    (item.monday !== undefined || item.thursday !== undefined)
                );
                
                if (found) {
                    scheduleRaw = found;
                    dataPool = node.data;
                    break;
                }
            }
        }

        if (!scheduleRaw) throw new Error("Struktur jadwal tidak ditemukan.");

        function resolve(val) {
            if (typeof val === 'number' && dataPool[val] !== undefined) {
                return dataPool[val];
            }
            return val;
        }

        const finalJson = {
            status: "success",
            source: "Oploverz",
            last_updated: new Date().toISOString(),
            schedule: {}
        };

        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

        days.forEach(dayKey => {
            let animeListRaw = resolve(scheduleRaw[dayKey]);
            finalJson.schedule[dayKey] = [];

            if (animeListRaw && Array.isArray(animeListRaw)) {
                animeListRaw.forEach(entryIdx => {
                    const entry = resolve(entryIdx);
                    if (!entry) return;

                    const series = resolve(entry.series);
                    if (!series) return;

                    finalJson.schedule[dayKey].push({
                        title: resolve(series.title) || null,
                        release_time: resolve(entry.time) || null,
                        score: resolve(series.score) || "N/A",
                        thumbnail: resolve(series.poster) || null,
                        url: `${baseDom}series/${resolve(series.slug)}`
                    });
                });
            }
        });

        return finalJson;

    } catch (err) {
        throw new Error(err.message);
    }
}

module.exports = { getDomain, getHome, getDetail, getStream, searchAnime, getAnimeByGenre, getSchedule };