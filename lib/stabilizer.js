const axios = require('axios');
const FormData = require('form-data');

/**
 * AI Video Stabilizer Service
 * Updated logic based on HAR data: uses URL submission instead of direct buffer upload.
 */
const stabilizer = {
    /**
     * Create a stabilization job on the remote server
     */
    createJob: async (videoUrl) => {
        try {
            const form = new FormData();
            form.append('url', videoUrl);

            const response = await axios.post('https://nirkyy-stabilizer.hf.space/api/stabilize', form, {
                headers: {
                    ...form.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; RMX2185 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.120 Mobile Safari/537.36',
                    'origin': 'https://nirkyy-stabilizer.hf.space',
                    'referer': 'https://nirkyy-stabilizer.hf.space/',
                    'x-requested-with': 'mark.via.gp'
                }
            });

            return response.data; // { job_id: "...", message: "..." }
        } catch (error) {
            throw new Error(`Stabilizer Job Error: ${error.response?.data?.message || error.message}`);
        }
    },

    /**
     * Check status of a specific job
     */
    checkStatus: async (jobId) => {
        try {
            const response = await axios.get(`https://nirkyy-stabilizer.hf.space/api/status/${jobId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; RMX2185 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.120 Mobile Safari/537.36',
                    'x-requested-with': 'mark.via.gp',
                    'referer': 'https://nirkyy-stabilizer.hf.space/'
                }
            });
            return response.data; // { status: "process" } or { status: "success", url: "..." }
        } catch (error) {
            throw new Error(`Stabilizer Status Error: ${error.response?.data?.message || error.message}`);
        }
    }
};

module.exports = stabilizer;