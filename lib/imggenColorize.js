const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');

const TARGET_URL = 'https://imggen.ai';
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; RMX2185 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.79 Mobile Safari/537.36';

function generateDeviceId() {
    const basePrefix = "06fcc24b20560e47ebd59e7e1b92ada7263deab9"; 
    return basePrefix + crypto.randomBytes(12).toString('hex');
}

const imggenColorize = {
    process: async (imageUrl) => {
        const deviceId = generateDeviceId();
        let cookieJar = [];

        const session = axios.create({
            baseURL: TARGET_URL,
            headers: {
                'user-agent': USER_AGENT,
                'x-device-id': deviceId,
                'x-inertia': 'true',
                'x-inertia-version': '1',
                'x-requested-with': 'mark.via.gp',
                'accept': 'application/json, text/plain, */*'
            }
        });

        session.interceptors.response.use(res => {
            const setCookies = res.headers['set-cookie'];
            if (setCookies) {
                setCookies.forEach(c => {
                    const cookie = c.split(';')[0];
                    const name = cookie.split('=')[0];
                    cookieJar = cookieJar.filter(ex => !ex.startsWith(name + '='));
                    cookieJar.push(cookie);
                });
            }
            return res;
        });

        session.interceptors.request.use(config => {
            if (cookieJar.length > 0) config.headers['cookie'] = cookieJar.join('; ');
            return config;
        });

        try {
            // 1. Inisialisasi Sesi
            await session.get('/tools/colorize-photo', { headers: { 'x-inertia': null } });
            
            const xsrfCookie = cookieJar.find(c => c.startsWith('XSRF-TOKEN='));
            if (!xsrfCookie) throw new Error("Gagal mendapatkan token XSRF.");
            const xsrfToken = decodeURIComponent(xsrfCookie.split('=')[1]);
            session.defaults.headers.common['x-xsrf-token'] = xsrfToken;

            // 2. Download source image
            const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(imgRes.data);

            // 3. Upload ke ImgGen Engine
            const form = new FormData();
            form.append('image', buffer, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            });

            const uploadRes = await session.post('/api/v1/ai/colorize-image', form, {
                headers: { ...form.getHeaders(), 'referer': `${TARGET_URL}/tools/colorize-photo` },
                maxRedirects: 0,
                validateStatus: s => s < 400
            });

            // 4. Ambil Hasil
            const redirectUrl = uploadRes.headers.location;
            if (!redirectUrl || redirectUrl.includes('colorize-photo?')) throw new Error("Server menolak proses atau kuota limit.");

            const resultPage = await session.get(redirectUrl);
            const resultData = resultPage.data.props.data?.result || resultPage.data.props.tool_result;

            if (resultData && resultData.proccessed_image) {
                const finalUrl = resultData.proccessed_image.startsWith('http') 
                    ? resultData.proccessed_image 
                    : TARGET_URL + resultData.proccessed_image;
                
                return {
                    success: true,
                    image: finalUrl
                };
            } else {
                throw new Error("Struktur data hasil tidak ditemukan.");
            }

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
};

module.exports = { imggenColorize };