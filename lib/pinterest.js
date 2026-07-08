const axios = require('axios');

const BASE_URL = 'https://id.pinterest.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function search(keyword) {
    if (!keyword) throw new Error("Keyword pencarian wajib diisi.");

    try {
        // 1. Initial Request to get session & tokens
        const initResponse = await axios.get(BASE_URL, {
            headers: { 'User-Agent': USER_AGENT }
        });

        const html = initResponse.data;
        const versionMatch = html.match(/"appVersion":"(.*?)"/);
        const appVersion = versionMatch ? versionMatch[1] : '9a7c3b0';
        const unauthMatch = html.match(/"unauth_id":"(.*?)"/);
        const unauthId = unauthMatch ? unauthMatch[1] : '';

        // --- COOKIE JAR ---
        const rawCookies = initResponse.headers['set-cookie'] || [];
        let cookieJar = {};
        let csrfToken = '';

        rawCookies.forEach(c => {
            const parts = c.split(';')[0].split('=');
            cookieJar[parts[0]] = parts.slice(1).join('=');
            if (parts[0] === 'csrftoken') csrfToken = parts.slice(1).join('=');
        });

        if (!csrfToken) {
            csrfToken = '1234567890abcdef1234567890abcdef';
            cookieJar['csrftoken'] = csrfToken;
        }

        if (unauthId) cookieJar['_b'] = `"${unauthId}"`;
        cookieJar['_auth'] = '0';
        cookieJar['_pinterest_sess'] = 'TWc9PQ=='; 

        const cookieString = Object.entries(cookieJar)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');

        // 2. SEARCH REQUEST
        const dataPayload = {
            options: {
                article: null,
                appliedProductFilters: "---",
                query: keyword,
                scope: "pins",
                auto_correction_disabled: false,
                top_pin_id: null,
                filter: "",
                page_size: 25,
                bookmarks: undefined
            },
            context: {}
        };

        const params = new URLSearchParams();
        params.append('source_url', `/search/pins/?q=${encodeURIComponent(keyword)}`);
        params.append('data', JSON.stringify(dataPayload));
        params.append('_', Date.now());

        const endpoint = `${BASE_URL}/resource/BaseSearchResource/get/?${params.toString()}`;

        const apiHeaders = {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
            'X-APP-VERSION': appVersion,
            'X-Pinterest-AppState': 'active',
            'X-Pinterest-PWS-Handler': 'www/index.js',
            'X-CSRFToken': csrfToken,
            'Referer': `${BASE_URL}/`,
            'Cookie': cookieString
        };

        const searchResponse = await axios.get(endpoint, { headers: apiHeaders });

        // 3. RESULT PARSING
        const results = searchResponse.data?.resource_response?.data?.results;

        if (results && results.length > 0) {
            const mappedResults = results
                .filter(pin => pin.type === 'pin')
                .map(pin => {
                    // Ambil Title
                    const title = pin.grid_title || pin.title || pin.description || 'No Title';
                    
                    // Ambil Image (Prioritas: Original > Large > Medium)
                    let imgUrl = null;
                    if (pin.images) {
                        if (pin.images.orig) imgUrl = pin.images.orig.url;
                        else if (pin.images['474x']) imgUrl = pin.images['474x'].url;
                        else if (pin.images['236x']) imgUrl = pin.images['236x'].url;
                    }

                    return {
                        id: pin.id,
                        title: title.trim(),
                        image: imgUrl,
                        pin_url: `https://www.pinterest.com/pin/${pin.id}/`,
                        pinner: pin.pinner ? {
                            username: pin.pinner.username,
                            fullName: pin.pinner.full_name
                        } : null
                    };
                });
            
            return mappedResults;
        } else {
            return [];
        }

    } catch (error) {
        if (error.response) {
            throw new Error(`Pinterest API Error: ${error.response.status}`);
        }
        throw new Error(error.message);
    }
}

module.exports = { search };