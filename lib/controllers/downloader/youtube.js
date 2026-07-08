/**
 * @title YouTube Downloader
 * @summary Download video YouTube menggunakan YoutubeSave.io.
 * @description Mendownload video dan audio dari YouTube menggunakan layanan YoutubeSave.io. Mendukung berbagai resolusi (1080p, 720p, 480p, 360p, MP3 Audio). Mengembalikan metadata lengkap termasuk judul, thumbnail, durasi, dan link download untuk semua format yang tersedia.
 * @method POST
 * @path /api/downloader/youtube
 * @response json
 * @param {string} body.url - URL lengkap video YouTube yang ingin diunduh (wajib).
 * @example
 * async function downloadVideo() {
 *   try {
 *     const res = await fetch('/api/downloader/youtube', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
 *     });
 *     const data = await res.json();
 *     console.log(JSON.stringify(data, null, 2));
 *   } catch (err) {
 *     console.error('Error:', err.message);
 *   }
 * }
 * downloadVideo();
 */
const https = require('https');
const http = require('http');

const BASE_URL = 'https://youtubesave.io';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

/**
 * Make HTTP(S) request with custom options
 */
function makeRequest(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: Object.assign({
        'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
      }, opts.headers || {}),
      rejectUnauthorized: false,
      timeout: opts.timeout || 30000,
    };
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/**
 * Extract cookie value from set-cookie headers
 */
function extractCookie(headers, name) {
  const cookies = headers['set-cookie'] || [];
  for (const c of cookies) {
    const match = c.match(new RegExp(`${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract download links and metadata from completed template HTML
 * Uses regex parsing (no cheerio dependency needed)
 */
function parseTemplate(html) {
  // --- Title ---
  let title = null;
  const titleMatch = html.match(/<h5[^>]*class="card-title[^"]*"[^>]*>([^<]+)<\/h5>/);
  if (titleMatch) title = titleMatch[1].trim();
  
  // --- Thumbnail ---
  let thumbnail = null;
  const thumbMatch = html.match(/<img[^>]*src="(https:\/\/youtubesave\.io\/static\/downloads\/[^"]+\.jpg)"[^>]*class="[^"]*card-img-top[^"]*"[^>]*>/);
  if (thumbMatch) thumbnail = thumbMatch[1];
  
  // --- Duration ---
  let duration = null;
  const durMatch = html.match(/<small[^>]*class="text-body-secondary"[^>]*>([^<]+)<\/small>/);
  if (durMatch) {
    duration = durMatch[1].replace('Duration:', '').trim();
  }
  
  // --- Download formats ---
  const formats = [];
  
  // Each format is in a list-group-item
  // Pattern: quality in fw-medium span, size in small, download link in a.btn
  const itemRegex = /<li[^>]*class="list-group-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
  let itemMatch;
  
  while ((itemMatch = itemRegex.exec(html)) !== null) {
    const itemHtml = itemMatch[1];
    
    // Quality
    let quality = null;
    const qMatch = itemHtml.match(/title="([^"]+)"[^>]*>\s*[^<]+\s*<\/div>/);
    const qMatch2 = itemHtml.match(/>\s*(\d+p\.\w+|Audio\s*\d+kbps\.\w+)\s*</);
    if (qMatch) {
      quality = qMatch[1];
    } else if (qMatch2) {
      quality = qMatch2[1].trim();
    }
    
    // If title attribute on the quality div
    const qTitleMatch = itemHtml.match(/title="([^"]+\.(mp4|mp3|webm))"/);
    if (qTitleMatch) quality = qTitleMatch[1];
    
    // Size
    let size = null;
    const sizeMatch = itemHtml.match(/<small>([^<]+)<\/small>/);
    if (sizeMatch) size = sizeMatch[1].trim();
    
    // Download URL
    let downloadUrl = null;
    const urlMatch = itemHtml.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*class="[^"]*btn[^"]*"[^>]*>/);
    if (urlMatch) downloadUrl = urlMatch[1];
    
    // Also check for title attribute on the anchor (which might contain the size)
    const sizeTitleMatch = itemHtml.match(/title="([^"]+)"[^>]*class="[^"]*btn/);
    if (sizeTitleMatch && !size) {
      size = sizeTitleMatch[1];
    }
    
    if (downloadUrl) {
      // Better quality extraction
      if (!quality) {
        // Try to get from the fw-medium div text
        const qDivMatch = itemHtml.match(/class="[^"]*fw-medium[^"]*"[^>]*>\s*([^<]+)\s*</);
        if (qDivMatch) quality = qDivMatch[1].trim();
      }
      
      if (!quality) quality = 'unknown';
      
      formats.push({
        quality: quality,
        size: size || 'unknown',
        downloadUrl: downloadUrl,
      });
    }
  }
  
  return { title, thumbnail, duration, formats };
}

/**
 * Poll task status until completed or failed
 */
async function pollStatus(taskId, cookieStr, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    
    const res = await makeRequest(`${BASE_URL}/api/status/?task_id=${taskId}`, {
      headers: { 'Cookie': cookieStr }
    });
    
    if (res.status !== 200) {
      throw new Error(`Status polling failed: HTTP ${res.status}`);
    }
    
    let data;
    try {
      data = JSON.parse(res.body);
    } catch (e) {
      throw new Error(`Failed to parse status response: ${res.body.substring(0, 100)}`);
    }
    
    if (data.status === 'completed') {
      if (!data.template) {
        throw new Error('Completed but no template returned');
      }
      return parseTemplate(data.template);
    }
    
    if (data.status === 'failed') {
      throw new Error(data.error || 'Video processing failed on server');
    }
    
    if (data.status === 'error') {
      throw new Error(data.error || 'Unknown error from server');
    }
    
    // Still pending/processing, continue polling
  }
  
  throw new Error('Timeout: Video processing took too long (max 60s)');
}

/**
 * Main controller: download YouTube video via YoutubeSave.io
 */
const youtubeController = async (req) => {
  const { url } = req.body || req.query || {};
  
  if (!url) {
    throw new Error("Parameter 'url' wajib diisi.");
  }
  
  // Validate URL
  if (!url.includes('youtube.com') && !url.includes('youtu.be') && !url.includes('m.youtube.com')) {
    throw new Error('URL harus berasal dari YouTube (youtube.com, youtu.be, atau m.youtube.com).');
  }
  
  // Step 1: GET homepage → extract CSRF token & cookies
  const homeRes = await makeRequest(BASE_URL + '/');
  
  if (homeRes.status !== 200) {
    throw new Error(`Failed to access ${BASE_URL}: HTTP ${homeRes.status}`);
  }
  
  // Extract CSRF token
  const csrfMatch = homeRes.body.match(/name="csrfmiddlewaretoken" value="([^"]+)"/);
  if (!csrfMatch) {
    throw new Error('Failed to extract CSRF token from homepage');
  }
  const csrfToken = csrfMatch[1];
  
  // Extract cookies
  const csrfCookie = extractCookie(homeRes.headers, 'csrftoken');
  const sessionCookie = extractCookie(homeRes.headers, 'sessionid');
  
  if (!csrfCookie) {
    throw new Error('Failed to extract CSRF cookie');
  }
  
  const cookieStr = `csrftoken=${csrfCookie}${sessionCookie ? '; sessionid=' + sessionCookie : ''}`;
  
  // Step 2: POST URL ke server
  const postBody = `url=${encodeURIComponent(url)}&csrfmiddlewaretoken=${encodeURIComponent(csrfToken)}`;
  
  const postRes = await makeRequest(BASE_URL + '/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postBody),
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': cookieStr,
      'Origin': BASE_URL,
      'Referer': BASE_URL + '/',
    },
    body: postBody,
  });
  
  if (postRes.status !== 200) {
    throw new Error(`POST request failed: HTTP ${postRes.status} - ${postRes.body.substring(0, 200)}`);
  }
  
  let postData;
  try {
    postData = JSON.parse(postRes.body);
  } catch (e) {
    throw new Error(`Failed to parse POST response: ${postRes.body.substring(0, 200)}`);
  }
  
  // Step 3: Handle response
  if (postData.template) {
    // Langsung dapat hasil (tanpa queue)
    return {
      success: true,
      author: 'PuruBoy',
      result: parseTemplate(postData.template),
    };
  }
  
  if (postData.task_id) {
    // Perlu polling task
    const result = await pollStatus(postData.task_id, cookieStr);
    
    return {
      success: true,
      author: 'PuruBoy',
      result,
    };
  }
  
  throw new Error(`Unexpected response: ${JSON.stringify(postData).substring(0, 200)}`);
};

module.exports = youtubeController;
