const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'https://nirkyy-stabilizer.hf.space';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; RMX2185 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.120 Mobile Safari/537.36',
    'origin': BASE_URL,
    'referer': BASE_URL + '/',
    'x-requested-with': 'mark.via.gp'
};

const mediaPro = {
    submitJob: async (endpoint, url, effect = null) => {
        try {
            const form = new FormData();
            form.append('url', url);
            if (effect) form.append('effect', effect);

            const response = await axios.post(`${BASE_URL}/api/${endpoint}`, form, {
                headers: { ...form.getHeaders(), ...HEADERS }
            });
            return response.data; 
        } catch (error) {
            throw new Error(`Media Job Error: ${error.response?.data?.message || error.response?.data?.detail || error.message}`);
        }
    },
    checkStatus: async (jobId) => {
        try {
            const response = await axios.get(`${BASE_URL}/api/status/${jobId}`, {
                headers: HEADERS
            });
            return response.data; 
        } catch (error) {
            throw new Error(`Media Status Error: ${error.response?.data?.message || error.response?.data?.detail || error.message}`);
        }
    }
};

module.exports = mediaPro;