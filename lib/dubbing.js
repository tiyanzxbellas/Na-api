const axios = require('axios');
const FormData = require('form-data');

class DubbingAI {
    constructor(baseUrl = 'https://nirkyy-dubingai.hf.space') {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 60000,
        });
    }

    /**
     * Memulai proses dubbing dengan mengunggah video dari URL
     * @param {string} videoUrl - URL publik file MP4
     * @param {string} targetVoice - Kode bahasa (id-ID, en-US, ja-JP)
     * @param {string} prompt - Prompt tambahan untuk AI
     */
    async createJob(videoUrl, targetVoice = 'id-ID', prompt = '') {
        try {
            // Download video dari URL sebagai stream
            const videoRes = await axios.get(videoUrl, { 
                responseType: 'stream',
                timeout: 30000 
            });

            const form = new FormData();
            form.append('video', videoRes.data, { 
                filename: 'video.mp4',
                contentType: 'video/mp4' 
            });
            form.append('voice', targetVoice);
            form.append('prompt', prompt);

            const response = await this.client.post('/generate', form, {
                headers: { 
                    ...form.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'origin': this.baseUrl,
                    'referer': this.baseUrl + '/'
                }
            });

            return response.data; // { task_id: "..." }
        } catch (error) {
            throw new Error(`Dubbing Job Error: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Memeriksa status pengerjaan berdasarkan Task ID
     * @param {string} taskId 
     */
    async checkStatus(taskId) {
        try {
            const response = await this.client.get(`/status?task_id=${taskId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'referer': this.baseUrl + '/'
                }
            });

            const data = response.data;
            
            // Konstruksi URL download jika sudah selesai
            if (data.status === 'Selesai' && data.result_video) {
                data.downloadUrl = `${this.baseUrl}${data.result_video}`;
            }

            return data;
        } catch (error) {
            throw new Error(`Dubbing Status Error: ${error.response?.data?.message || error.message}`);
        }
    }
}

module.exports = new DubbingAI();