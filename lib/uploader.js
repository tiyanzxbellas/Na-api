const axios = require('axios');
const FormData = require('form-data');
const https = require('https');
const { encrypt } = require('./crypto');

/**
 * Upload file via raw multipart HTTP request
 */
function rawMultipartUpload(hostname, path, buffer, filename, fieldName = 'file') {
    return new Promise((resolve, reject) => {
        const boundary = '----Boundary' + Math.random().toString(36).slice(2, 16);
        const header = Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
            `Content-Type: application/octet-stream\r\n\r\n`
        );
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        const body = Buffer.concat([header, buffer, footer]);

        const options = {
            hostname,
            path,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length,
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 120000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk.toString());
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data.trim());
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.trim()}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.write(body);
        req.end();
    });
}

async function uploadToCatbox(buffer, filename) {
    const text = await rawMultipartUpload('catbox.moe', '/user/api.php', buffer, filename, 'fileToUpload');
    if (!text.startsWith('http')) throw new Error(`Invalid response: ${text}`);
    return text;
}

async function uploadToLitterbox(buffer, filename) {
    const boundary = '----Boundary' + Math.random().toString(36).slice(2, 16);
    const parts = [
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="time"\r\n\r\n24h\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
        buffer,
        Buffer.from(`\r\n--${boundary}--\r\n`)
    ];
    const body = Buffer.concat(parts);

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'litterbox.catbox.moe',
            path: '/resources/internals/api.php',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length,
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 120000
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk.toString());
            res.on('end', () => {
                const text = data.trim();
                if (text.startsWith('http')) resolve(text);
                else reject(new Error(`HTTP ${res.statusCode}: ${text}`));
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.write(body);
        req.end();
    });
}

async function uploadToTmpfiles(buffer, filename) {
    const form = new FormData();
    form.append('file', buffer, filename);
    const resp = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
        timeout: 60000
    });
    if (resp.data?.status !== 'success') throw new Error('Tmpfiles upload failed');
    return resp.data.data.url.replace(/https?:\/\/(www\.)?tmpfiles\.org\//, 'https://tmpfiles.org/dl/');
}

async function uploadToGofile(buffer, filename) {
    // Step 1: Create guest account to get token
    let token = null;
    try {
        const guestRes = await axios.post('https://api.gofile.io/accounts', {}, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 30000
        });
        if (guestRes.data?.status === 'ok') {
            token = guestRes.data.data.token;
        }
    } catch (e) {
        // If guest account creation fails, proceed without token
    }

    // Step 2: Upload file
    const form = new FormData();
    form.append('file', buffer, filename);
    const headers = { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const resp = await axios.post('https://store3.gofile.io/uploadFile', form, {
        headers,
        timeout: 120000
    });
    if (resp.data?.status !== 'ok') throw new Error('Gofile upload failed: ' + (resp.data?.status || 'unknown'));
    
    const downloadPage = resp.data.data.downloadPage;
    const contentCode = resp.data.data.code || downloadPage.split('/').pop();
    
    // Step 3: Get direct download URL via content API
    if (token && contentCode) {
        try {
            const contentRes = await axios.get('https://api.gofile.io/contents/' + contentCode, {
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 30000
            });
            if (contentRes.data?.status === 'ok' && contentRes.data.data) {
                const data = contentRes.data.data;
                // If it's a folder with children, get the first file's link
                if (data.children) {
                    const children = Object.values(data.children);
                    if (children.length > 0 && children[0].link) {
                        return children[0].link;
                    }
                }
                // Direct file link
                if (data.link) {
                    return data.link;
                }
            }
        } catch (e) {
            // Fall through to scraping approach
        }
    }

    // Step 4: Scrape download page HTML for direct URL
    try {
        const directUrl = await scrapeGofileDirectUrl(downloadPage, token);
        if (directUrl) return directUrl;
    } catch (e) {
        // Fall through
    }

    // Step 5: If all else fails, try constructing direct URL from known pattern
    // Pattern: https://{server}.gofile.io/download/{contentId}
    try {
        const serverRes = await axios.get('https://api.gofile.io/servers', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        if (serverRes.data?.status === 'ok' && serverRes.data.data?.servers?.length > 0) {
            const server = serverRes.data.data.servers[0].name;
            const directUrl = `https://${server}.gofile.io/download/${contentCode}`;
            return directUrl;
        }
    } catch (e) {
        // If server list fails, use store3 as default
        return `https://store3.gofile.io/download/${contentCode}`;
    }

    // Ultimate fallback: return the download page
    return downloadPage;
}

/**
 * Scrape gofile download page HTML to extract direct download URL
 */
async function scrapeGofileDirectUrl(downloadPage, token) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://gofile.io/',
    };
    if (token) {
        headers['Cookie'] = `accountToken=${token}`;
    }

    const pageRes = await axios.get(downloadPage, {
        headers,
        maxRedirects: 5,
        timeout: 30000
    });

    const html = pageRes.data;
    const contentCode = downloadPage.split('/').pop();

    // Pattern 1: Look for direct download URL in JSON-LD or structured data
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
        try {
            const jsonData = JSON.parse(jsonLdMatch[1]);
            if (jsonData.url) return jsonData.url;
        } catch (e) {}
    }

    // Pattern 2: Look for window.__INITIAL_STATE__ or similar global variables
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/i);
    if (stateMatch) {
        try {
            const stateData = JSON.parse(stateMatch[1]);
            // Navigate state to find download URL
            const directUrl = extractUrlFromState(stateData);
            if (directUrl) return directUrl;
        } catch (e) {}
    }

    // Pattern 3: Look for any gofile.io/download/ URL in the page
    const downloadUrlRegex = /https?:\/\/([a-zA-Z0-9-]+)\.gofile\.io\/download\/[a-zA-Z0-9]+/g;
    const matches = html.matchAll(downloadUrlRegex);
    for (const match of matches) {
        // Verify the URL works
        try {
            const verifyRes = await axios.head(match[0], {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Cookie': headers['Cookie'] || ''
                },
                maxRedirects: 3,
                timeout: 10000
            });
            if (verifyRes.status >= 200 && verifyRes.status < 400) {
                return match[0];
            }
        } catch (e) {
            continue;
        }
    }

    // Pattern 4: Look for meta refresh redirect
    const metaRefresh = html.match(/<meta[^>]*url=([^"'\s>]+)/i);
    if (metaRefresh) {
        return metaRefresh[1];
    }

    // Pattern 5: Look for download button link patterns
    const btnMatch = html.match(/href="([^"]*download[^"]*)"/i);
    if (btnMatch && btnMatch[1].includes('gofile.io')) {
        return btnMatch[1];
    }

    return null;
}

function extractUrlFromState(state) {
    if (!state || typeof state !== 'object') return null;
    
    // Check common paths in state objects
    if (state.downloadUrl) return state.downloadUrl;
    if (state.directUrl) return state.directUrl;
    if (state.link) return state.link;
    if (state.url) return state.url;
    
    // Navigate nested objects
    if (state.data) {
        if (state.data.downloadUrl) return state.data.downloadUrl;
        if (state.data.link) return state.data.link;
        if (state.data.directUrl) return state.data.directUrl;
        if (state.data.url) return state.data.url;
        if (state.data.children) {
            const children = Object.values(state.data.children);
            if (children.length > 0) {
                if (children[0].link) return children[0].link;
                if (children[0].downloadUrl) return children[0].downloadUrl;
            }
        }
    }
    
    if (state.props?.pageProps?.data?.link) return state.props.pageProps.data.link;
    
    return null;
}

async function uploadToTmp(buffer, filename = 'file.mp4') {
    if (!Buffer.isBuffer(buffer)) throw new Error('Input must be a Buffer.');
    const size = buffer.length;
    let rawUrl;
    let lastError = '';

    // Priority 1: Catbox (Direct, 200MB)
    if (size <= 200 * 1024 * 1024) {
        try { rawUrl = await uploadToCatbox(buffer, filename); } catch (e) { lastError = `catbox: ${e.message}`; }
    }

    // Priority 2: Litterbox (Direct, 1GB)
    if (!rawUrl) {
        try { rawUrl = await uploadToLitterbox(buffer, filename); } catch (e) { lastError = `litterbox: ${e.message}`; }
    }

    // Priority 3: Tmpfiles (Direct, 10MB)
    if (!rawUrl && size <= 10 * 1024 * 1024) {
        try { rawUrl = await uploadToTmpfiles(buffer, filename); } catch (e) { lastError = `tmpfiles: ${e.message}`; }
    }

    // Priority 4: Gofile (Direct URL via API/Scraping, Unlimited size)
    if (!rawUrl) {
        try { rawUrl = await uploadToGofile(buffer, filename); } catch (e) { lastError = `gofile: ${e.message}`; }
    }

    if (!rawUrl) throw new Error(`All upload services failed. ${lastError}`);

    const encrypted = encrypt(rawUrl);
    return `/api/media/${encrypted}`;
}

module.exports = { uploadToTmp };