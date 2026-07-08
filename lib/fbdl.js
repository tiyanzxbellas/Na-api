const axios = require('axios');
const FormData = require('form-data');
const vm = require('vm');

async function fbdl(url) {
    try {
        const form = new FormData();
        form.append('url', url);

        const headers = {
            ...form.getHeaders(),
            'authority': 'fsave.io',
            'accept': '*/*',
            'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'origin': 'https://fsave.io',
            'referer': 'https://fsave.io/id',
            'sec-ch-ua': '"Chromium";v="142", "Android WebView";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': 'Mozilla/5.0 (Linux; Android 10; RMX2185 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.171 Mobile Safari/537.36',
            'x-requested-with': 'mark.via.gp'
        };

        const response = await axios.post('https://fsave.io/action.php?lang=id', form, { headers });
        const data = response.data;

        const context = vm.createContext({
            eval: (code) => code,
            window: { location: { hostname: 'fsave.io' } },
            document: { getElementById: () => ({ innerHTML: '' }) },
            location: { hostname: 'fsave.io' }
        });

        const decoded = vm.runInContext(data, context);

        const cleanHtml = decoded.replace(/\\"/g, '"').replace(/\\/g, '');

        const result = {
            thumbnail: null,
            video_sd: null,
            video_hd: null
        };

        const thumbMatch = cleanHtml.match(/<img src="([^"]+)"/);
        if (thumbMatch) {
            result.thumbnail = thumbMatch[1];
        }

        const hdMatch = cleanHtml.match(/<a href="([^"]+)"[^>]+title="Download HD"/i);
        if (hdMatch) {
            result.video_hd = hdMatch[1];
        } else {
            const hdMatchAlt = cleanHtml.match(/<a href="([^"]+)"[^>]+>.*?Download HD.*?<\/a>/i);
            if(hdMatchAlt) result.video_hd = hdMatchAlt[1];
        }

        const sdMatch = cleanHtml.match(/<a href="([^"]+)"[^>]+title="Download SD"/i);
        if (sdMatch) {
            result.video_sd = sdMatch[1];
        } else {
            const sdMatchAlt = cleanHtml.match(/<a href="([^"]+)"[^>]+>.*?Download SD.*?<\/a>/i);
            if(sdMatchAlt) result.video_sd = sdMatchAlt[1];
        }

        if (!result.video_sd && !result.video_hd) {
             const anyLink = cleanHtml.match(/<a href="(https:\/\/d\.rapidcdn\.app\/[^"]+)"/);
             if (anyLink) {
                 result.video_sd = anyLink[1];
             }
        }

        return result;

    } catch (error) {
        return {
            error: true,
            message: error.message
        };
    }
}

module.exports = { fbdl };