const axios = require('axios');
const FormData = require('form-data');

/**
 * AI Auto Clipper Service
 * Berinteraksi dengan Hugging Face Space ricky01anjay-autoclip
 */
const autoclip = {
    /**
     * Membuat job baru dengan mengunggah video dari URL
     */
    createJob: async (videoUrl) => {
        try {
            // 1. Download video dari URL sebagai stream
            const videoRes = await axios.get(videoUrl, { 
                responseType: 'stream',
                timeout: 30000 
            });

            // 2. Siapkan Multipart Form Data
            const form = new FormData();
            form.append('video_file', videoRes.data, { 
                filename: 'video.mp4',
                contentType: 'video/mp4' 
            });

            // 3. POST ke endpoint generate
            const response = await axios.post('https://nirkyy-autoclip.hf.space/generate', form, {
                headers: {
                    ...form.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'origin': 'https://nirkyy-autoclip.hf.space',
                    'referer': 'https://nirkyy-autoclip.hf.space/'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            return response.data; // { job_id: "..." }
        } catch (error) {
            throw new Error(`AutoClip Job Error: ${error.response?.data?.message || error.message}`);
        }
    },

    /**
     * Memeriksa status pengerjaan berdasarkan Job ID
     */
    checkStatus: async (jobId) => {
        try {
            const response = await axios.get(`https://nirkyy-autoclip.hf.space/status/${jobId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'referer': 'https://nirkyy-autoclip.hf.space/'
                }
            });

            const data = response.data;
            
            // Konstruksi URL download jika sudah selesai
            if (data.status === 'completed' && data.result) {
                data.downloadUrl = `https://nirkyy-autoclip.hf.space/download/${data.result}`;
            }

            return data;
        } catch (error) {
            throw new Error(`AutoClip Status Error: ${error.response?.data?.message || error.message}`);
        }
    }
};

module.exports = autoclip;