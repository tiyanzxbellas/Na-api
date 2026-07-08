const axios = require('axios');
const FormData = require('form-data');
const { uploadToTmp } = require('./uploader');

// --- KONFIGURASI CONSTANTS ---
const TARGET_URL = 'https://cloudinary.com/tools/image-upscale';
const SIGNER_URL = 'https://cloudinary-tools.netlify.app/.netlify/functions/sign-upload-params';

// --- FALLBACK CONFIG ---
const FALLBACK_CONFIG = {
    cloudName: 'dtz0urit6',
    apiKey: '985946268373735',
    uploadPreset: 'cloudinary-tools'
};

const client = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': TARGET_URL
    }
});

/**
 * 1. DYNAMIC CONFIG EXTRACTOR
 */
async function getDynamicConfig() {
    try {
        const htmlParams = await client.get(TARGET_URL);
        const scriptMatch = htmlParams.data.match(/src="([^"]*\/app\.js[^"]*)"/);

        if (!scriptMatch) throw new Error("Path app.js tidak ditemukan.");

        const appJsUrl = new URL(scriptMatch[1], TARGET_URL).href;
        const jsParams = await client.get(appJsUrl);
        const jsContent = jsParams.data;

        const cloudNameMatch = jsContent.match(/cloudName\s*=\s*\(isLocal\)\s*\?\s*'[^']+'\s*:\s*'([^']+)'/);
        const apiKeyMatch = jsContent.match(/api_key\s*=\s*\(isLocal\)\s*\?\s*'[^']+'\s*:\s*'([^']+)'/);
        const presetMatch = jsContent.match(/uploadPreset\s*=\s*\(isLocal\)\s*\?\s*'[^']+'\s*:\s*'([^']+)'/);

        if (cloudNameMatch && apiKeyMatch && presetMatch) {
            return {
                cloudName: cloudNameMatch[1],
                apiKey: apiKeyMatch[1],
                uploadPreset: presetMatch[1]
            };
        }
        throw new Error("Gagal regex config.");
    } catch (error) {
        return FALLBACK_CONFIG;
    }
}

/**
 * 2. SIGNATURE GENERATOR
 */
async function getSignature(config, timestamp) {
    try {
        const payload = {
            paramsToSign: {
                source: 'uw',
                timestamp: timestamp,
                upload_preset: config.uploadPreset
            }
        };

        const response = await client.post(SIGNER_URL, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.data.signature) throw new Error("Signature kosong.");
        return response.data.signature;
    } catch (error) {
        throw new Error(`Gagal get signature: ${error.message}`);
    }
}

/**
 * 3. UPLOADER (Buffer Support)
 */
async function uploadImage(config, signature, timestamp, imageBuffer) {
    const form = new FormData();
    form.append('file', imageBuffer, { filename: 'input.jpg' }); 
    form.append('api_key', config.apiKey);
    form.append('timestamp', timestamp);
    form.append('upload_preset', config.uploadPreset);
    form.append('signature', signature);
    form.append('source', 'uw');

    const uploadUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`;

    try {
        const response = await client.post(uploadUrl, form, {
            headers: { ...form.getHeaders() }
        });
        return response.data;
    } catch (error) {
        throw new Error(`Upload gagal: ${error.response?.data?.error?.message || error.message}`);
    }
}

const upscale = {
    process: async (url) => {
        try {
            // 1. Download source image
            const imgRes = await axios.get(url, { responseType: 'arraybuffer' });
            const imgBuffer = Buffer.from(imgRes.data);

            // 2. Get Config
            const config = await getDynamicConfig();

            // 3. Auth
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = await getSignature(config, timestamp);

            // 4. Upload to Cloudinary
            const uploadResult = await uploadImage(config, signature, timestamp, imgBuffer);

            // 5. Construct URL
            // Parameter Transformasi Cloudinary: e_upscale, q_auto, f_auto
            const transformation = 'e_upscale,q_auto,f_auto';
            const cloudinaryUrl = `https://res.cloudinary.com/${config.cloudName}/image/upload/${transformation}/${uploadResult.public_id}`;

            // 6. Download Result
            const resultRes = await axios.get(cloudinaryUrl, { responseType: 'arraybuffer' });
            const resultBuffer = Buffer.from(resultRes.data);

            // 7. Upload to Public Server (Puruh2o / tmp)
            const publicUrl = await uploadToTmp(resultBuffer, `upscale-${Date.now()}.jpg`);

            return {
                success: true,
                image: publicUrl
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
};

module.exports = { upscale };