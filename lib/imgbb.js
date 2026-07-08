const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'https://imgbb.com';
const API_URL = 'https://imgbb.com/json';

const client = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Origin': BASE_URL,
        'Referer': BASE_URL + '/'
    }
});

async function upload(buffer, filename = 'image.jpg') {
    try {
        // 1. Get Main Page for Cookie & Token
        const pageResponse = await client.get(BASE_URL);
        const cookies = pageResponse.headers['set-cookie'];
        if (!cookies) throw new Error('Gagal mendapatkan Cookie sesi.');
        const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

        const tokenMatch = pageResponse.data.match(/auth_token="([a-f0-9]+)"/);
        if (!tokenMatch || !tokenMatch[1]) {
            throw new Error('Gagal mengekstrak auth_token.');
        }
        const authToken = tokenMatch[1];

        // 2. Prepare FormData
        const form = new FormData();
        form.append('source', buffer, { filename });
        form.append('type', 'file');
        form.append('action', 'upload');
        form.append('timestamp', Date.now());
        form.append('auth_token', authToken);

        // 3. Post to API
        const uploadResponse = await client.post(API_URL, form, {
            headers: {
                ...form.getHeaders(),
                'Cookie': cookieHeader,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (uploadResponse.data && uploadResponse.data.status_code === 200) {
            return {
                url: uploadResponse.data.image.url,
                display_url: uploadResponse.data.image.display_url,
                delete_url: uploadResponse.data.image.delete_url,
                filename: uploadResponse.data.image.filename,
                size: uploadResponse.data.image.size,
                mime: uploadResponse.data.image.mime
            };
        } else {
            throw new Error(uploadResponse.data.error ? uploadResponse.data.error.message : 'Unknown Error');
        }

    } catch (error) {
        if (error.response) {
            throw new Error(`ImgBB Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(error.message);
    }
}

module.exports = { upload };