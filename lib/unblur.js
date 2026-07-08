const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');

/**
 * AI Unblur Processor with Proxy Fallback and Exponential Backoff
 */

function generateRandomSerial() {
    return crypto.randomBytes(16).toString('hex');
}

const CONFIG = {
    PRODUCT_CODE: '067003',
    PROXY_PREFIX: 'https://vercel-api-beta-red.vercel.app/api/fetch?get=',
    TARGET_BASE: 'https://api.unblurimage.ai/api/imgupscaler/v2/image-upscaler-v2'
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Custom request handler with proxy fallback logic and backoff
 */
async function requestWithBackoff(method, path, data = null, headers = {}, retryCount = 0) {
    // Attempt 0 (retryCount 0) uses Proxy, further attempts go direct
    const useProxy = retryCount === 0;
    const url = (useProxy ? CONFIG.PROXY_PREFIX : '') + CONFIG.TARGET_BASE + path;
    
    try {
        const response = await axios({
            method,
            url,
            data,
            headers: {
                ...headers,
                'origin': 'https://unblurimage.ai',
                'referer': 'https://unblurimage.ai/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 40000
        });
        return response.data;
    } catch (error) {
        // Max 3 attempts (1 proxy, 2 direct with backoff)
        if (retryCount < 2) {
            const waitTime = Math.pow(2, retryCount) * 2000; // 2s, 4s
            await sleep(waitTime);
            return requestWithBackoff(method, path, data, headers, retryCount + 1);
        }
        throw error;
    }
}

const unblur = {
    process: async (imageUrl) => {
        try {
            const currentSerial = generateRandomSerial();

            // 1. Download source image
            const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imgBuffer = Buffer.from(imgRes.data);

            // 2. Create Job (Upload)
            const form = new FormData();
            form.append('original_image_file', imgBuffer, { filename: 'input.jpg' });

            const createRes = await requestWithBackoff('POST', '/create-job', form, {
                ...form.getHeaders(),
                'product-serial': currentSerial,
                'product-code': CONFIG.PRODUCT_CODE
            });

            if (createRes.code !== 100000) {
                throw new Error(`Server Error: ${createRes.message?.en || 'Unknown'}`);
            }

            const jobId = createRes.result.job_id;

            // 3. Polling for result
            let isDone = false;
            let resultUrl = null;
            let attempts = 0;

            while (!isDone && attempts < 30) {
                const statusRes = await requestWithBackoff('GET', `/get-job/${jobId}`, null, {
                    'product-serial': currentSerial
                });

                if (statusRes.code === 100000 && statusRes.result.output_url) {
                    resultUrl = statusRes.result.output_url;
                    isDone = true;
                } else if (statusRes.code === 300006) {
                    // Still processing
                    attempts++;
                    await sleep(3000);
                } else {
                    throw new Error(`Polling Error: ${statusRes.message?.en || 'Unknown'}`);
                }
            }

            if (!resultUrl) throw new Error("Processing timeout.");

            // 4. Download result
            const resultRes = await axios.get(resultUrl, { responseType: 'arraybuffer' });
            return Buffer.from(resultRes.data);

        } catch (error) {
            throw error;
        }
    }
};

module.exports = unblur;