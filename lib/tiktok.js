// Memindahkan file dari server/api/lib/tiktok.js ke lib/tiktok.js
const axios = require('axios');

const TIKTOK_API_BASE = 'https://www.tikwm.com';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function download(url) {
    if (!url || typeof url !== 'string') {
        throw new Error('URL TikTok tidak valid.');
    }

    const submitResponse = await axios.post(`${TIKTOK_API_BASE}/api/video/task/submit`, new URLSearchParams({
        url: url,
        web: '1'
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        }
    });

    if (submitResponse.data.code !== 0 || !submitResponse.data.data.task_id) {
        throw new Error(`Gagal memulai tugas unduhan: ${submitResponse.data.msg || 'Respons tidak valid'}`);
    }

    const taskId = submitResponse.data.data.task_id;

    const maxAttempts = 15;
    for (let i = 0; i < maxAttempts; i++) {
        await sleep(1000); 
        const resultResponse = await axios.get(`${TIKTOK_API_BASE}/api/video/task/result`, {
            params: { task_id: taskId }
        });

        const resultData = resultResponse.data;

        if (resultData.code !== 0) {
            continue;
        }

        if (resultData.data && resultData.data.status === 2) {
            return resultData.data;
        }

        if (resultData.data && resultData.data.status > 2) {
            throw new Error(`Proses unduhan gagal dengan status: ${resultData.data.msg || 'Tidak diketahui'}`);
        }
    }

    throw new Error('Gagal mendapatkan hasil unduhan setelah beberapa kali percobaan (timeout).');
}

module.exports = { download };