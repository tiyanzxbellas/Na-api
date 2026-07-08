const axios = require('axios');
const FormData = require('form-data');

// Konfigurasi Header agar terlihat seperti Browser asli
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://www.iloveimg.com',
    'Referer': 'https://www.iloveimg.com/remove-background'
};

const BASE_URL = 'https://www.iloveimg.com/remove-background';

async function getSessionData() {
    try {
        const { data: html } = await axios.get(BASE_URL, { headers: HEADERS });

        // 1. Ambil Config Utama (Token & Server)
        const configMatch = html.match(/var ilovepdfConfig = ({.+});/);
        if (!configMatch) throw new Error('Gagal parsing ilovepdfConfig');
        const config = JSON.parse(configMatch[1]);

        // 2. Ambil Task ID
        const taskMatch = html.match(/ilovepdfConfig\.taskId = '(.+?)';/);
        if (!taskMatch) throw new Error('Gagal parsing Task ID');

        // 3. Pilih server worker random
        const randomServer = config.servers[Math.floor(Math.random() * config.servers.length)];

        return {
            token: config.token,
            taskId: taskMatch[1],
            server: `https://${randomServer}.iloveimg.com`
        };
    } catch (error) {
        throw new Error(`Gagal init session: ${error.message}`);
    }
}

async function uploadFile(session, buffer) {
    try {
        const form = new FormData();
        form.append('task', session.taskId);
        form.append('file', buffer, { filename: 'image.jpg' });

        const url = `${session.server}/v1/upload`;

        const { data } = await axios.post(url, form, {
            headers: {
                ...HEADERS,
                ...form.getHeaders(),
                'Authorization': `Bearer ${session.token}`
            }
        });

        return data.server_filename;
    } catch (error) {
        throw new Error(`Gagal upload (${error.response?.status || 'Unknown'}): ${error.message}`);
    }
}

async function processImage(session, serverFilename) {
    try {
        const form = new FormData();
        form.append('task', session.taskId);
        form.append('server_filename', serverFilename);

        const url = `${session.server}/v1/removebackground`;

        const response = await axios.post(url, form, {
            headers: {
                ...HEADERS,
                ...form.getHeaders(),
                'Authorization': `Bearer ${session.token}`
            },
            responseType: 'arraybuffer'
        });

        return Buffer.from(response.data);
    } catch (error) {
        throw new Error(`Gagal memproses gambar: ${error.message}`);
    }
}

const removeBgV2 = {
    process: async (url) => {
        try {
            // 1. Download image from URL
            const imgRes = await axios.get(url, { responseType: 'arraybuffer' });
            const imgBuffer = Buffer.from(imgRes.data);

            // 2. Get Session Data
            const session = await getSessionData();

            // 3. Upload File to ILoveIMG
            const serverFilename = await uploadFile(session, imgBuffer);

            // 4. Process and Get Result Buffer
            const resultBuffer = await processImage(session, serverFilename);

            return resultBuffer;
        } catch (error) {
            throw error;
        }
    }
};

module.exports = { removeBgV2 };