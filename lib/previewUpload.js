const crypto = require('crypto');
const https = require('https');

const BASE_URL = 'https://puruboy-preview.freehosting.dev';

/**
 * Mengkonversi hex string ke array angka
 * @param {string} str - Hex string
 * @returns {number[]} Array of bytes
 */
function toNumbers(str) {
    const result = [];
    str.replace(/(..)/g, (hex) => result.push(parseInt(hex, 16)));
    return result;
}

/**
 * Mengkonversi array angka ke hex string
 * @param {number[]} arr - Array of bytes
 * @returns {string} Hex string
 */
function toHex(arr) {
    return arr.map((b) => (16 > b ? '0' : '') + b.toString(16)).join('');
}

/**
 * HTTP request helper
 * @param {string} url - Target URL
 * @param {object} options - Request options
 * @param {string} [options.method] - HTTP method (default GET)
 * @param {object} [options.headers] - Request headers
 * @param {string|Buffer} [options.body] - Request body
 * @returns {Promise<{status: number, headers: object, body: string}>}
 */
function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const mod = parsed.protocol === 'https:' ? https : require('http');
        const reqOptions = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + (parsed.search || ''),
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...(options.headers || {})
            }
        };
        if (options.body) {
            reqOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
        }
        const req = mod.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                body: data
            }));
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

/**
 * Menyelesaikan AES-CBC challenge pada halaman target
 * @param {string} html - HTML response yang mengandung challenge
 * @returns {string|null} Cookie value `__test=...` atau null jika gagal
 */
function solveChallenge(html) {
    const aMatch = html.match(/a=toNumbers\("([^"]+)"\)/);
    const bMatch = html.match(/b=toNumbers\("([^"]+)"\)/);
    const cMatch = html.match(/c=toNumbers\("([^"]+)"\)/);
    
    if (!aMatch || !bMatch || !cMatch) return null;
    
    const a = toNumbers(aMatch[1]);
    const b = toNumbers(bMatch[1]);
    const c = toNumbers(cMatch[1]);
    
    const key = Buffer.from(a);
    const iv = Buffer.from(b);
    const ciphertext = Buffer.from(c);
    
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(false);
    
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return '__test=' + toHex(Array.from(decrypted));
}

/**
 * Upload file HTML ke puruboy-preview.freehosting.dev
 * 
 * @param {Buffer|string} fileContent - Konten file HTML
 * @param {string} [fileName='preview'] - Nama file tanpa ekstensi .html
 * @returns {Promise<{link: string, filename: string, view: string}>}
 */
async function upload(fileContent, fileName = 'preview') {
    try {
        // Step 1: Akses halaman utama untuk mendapatkan challenge
        const resp1 = await request(BASE_URL);
        
        // Step 2: Solve AES-CBC challenge
        const cookie = solveChallenge(resp1.body);
        if (!cookie) throw new Error('Gagal menyelesaikan JavaScript challenge.');
        
        // Step 3: Akses dengan cookie untuk mendapatkan CSRF token dan session
        const resp2 = await request(BASE_URL, {
            headers: { 'Cookie': cookie }
        });
        
        // Ekstrak CSRF token
        const csrfMatch = resp2.body.match(/name="csrf_token" value="([^"]+)"/);
        if (!csrfMatch) throw new Error('Gagal mengekstrak CSRF token.');
        const csrfToken = csrfMatch[1];
        
        // Gabungkan cookie dengan session dari response
        let fullCookie = cookie;
        const setCookie = resp2.headers['set-cookie'];
        if (setCookie) {
            const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
            cookies.forEach(c => {
                const parts = c.split(';')[0];
                if (parts) fullCookie += '; ' + parts;
            });
        }
        
        // Step 4: Siapkan multipart form data
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
        const content = typeof fileContent === 'string' ? fileContent : fileContent.toString('utf-8');
        const safeFilename = fileName.replace(/[^a-zA-Z0-9_-]/g, '-');
        
        let body = '';
        body += '--' + boundary + '\r\n';
        body += 'Content-Disposition: form-data; name="csrf_token"\r\n\r\n';
        body += csrfToken + '\r\n';
        body += '--' + boundary + '\r\n';
        body += 'Content-Disposition: form-data; name="filename"\r\n\r\n';
        body += safeFilename + '\r\n';
        body += '--' + boundary + '\r\n';
        body += 'Content-Disposition: form-data; name="html_file"; filename="' + safeFilename + '.html"\r\n';
        body += 'Content-Type: text/html\r\n\r\n';
        body += content + '\r\n';
        body += '--' + boundary + '--\r\n';
        
        // Step 5: Upload file
        const uploadResp = await request(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=' + boundary,
                'Cookie': fullCookie,
                'Origin': BASE_URL,
                'Referer': BASE_URL + '/'
            },
            body: body
        });
        
        // Step 6: Parse link dari response
        const linkMatch = uploadResp.body.match(/URL:\s*(<a[^>]*>)?(https?:\/\/[^\s<"']+)(<\/a>)?/);
        const urlMatch = uploadResp.body.match(/https:\/\/puruboy-preview\.freehosting\.dev\/index\.php\?view=[a-f0-9]+&amp;filename=[^\s<"']+/);
        
        let link = '';
        if (urlMatch) {
            link = urlMatch[0].replace(/&amp;/g, '&');
        } else if (linkMatch) {
            link = linkMatch[2].replace(/&amp;/g, '&');
        }
        
        // Ekstrak view ID
        let viewId = '';
        const viewMatch = link.match(/view=([a-f0-9]+)/);
        if (viewMatch) viewId = viewMatch[1];
        
        if (!link) throw new Error('Gagal mendapatkan link hasil upload dari response.');
        
        return {
            link: link,
            filename: safeFilename + '.html',
            view: viewId
        };
        
    } catch (error) {
        throw new Error('Preview Upload Error: ' + error.message);
    }
}

module.exports = { upload };
