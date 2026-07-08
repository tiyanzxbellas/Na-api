/***
 *** ᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁
 *** - TikTok Downloader
 *** - Base URL: https://tikdownloader.io
 *** - Note: Jangan lupa install cloudscraper
 ***
 *** - Dev: 𝖸𝖺𝖻𝖾𝗌
 *** - Contact: t.me/Yabes_Desu
 *** - Gmail: yabeskun@gmail.com
 *** ᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁᠁
 ***/

const cloudscraper = require('cloudscraper');

const tiktokDL = async (url, retries = 5) => {
  if (!url?.trim()) return { success: false, result: 'URL kosong' };

  const req = async (opts) => {
    for (let i = 0; i < retries; i++) {
      try {
        const r = await cloudscraper({ ...opts, cloudflareTimeout: 7000, followAllRedirects: true });
        return typeof r === 'string' ? JSON.parse(r) : r;
      } catch (e) {
        if (i === retries - 1) throw e;
        await new Promise(r => setTimeout(r, 2 ** i * 1000));
      }
    }
  };

  try {
    const { status, data, statusCode, msg } = await req({
      uri: 'https://tikdownloader.io/api/ajaxSearch',
      method: 'POST',
      form: { q: url }
    });

    if (statusCode === 326) return { success: false, result: msg || 'Link invalid' };
    if (status !== 'ok' || !data) return { success: false, result: 'Gagal ambil data' };

    const html = data.replace(/&(?:amp|lt|gt|quot|#x27|#39|#x2F|nbsp|#xA0|#160|#(\d+)|#x([0-9a-fA-F]+));/gi, 
      (_, dec, hex) => dec ? String.fromCharCode(dec) : hex ? String.fromCharCode(parseInt(hex, 16)) : 
      { '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#x27;':"'",'&#39;':"'",'&#x2F;':'/','&nbsp;':' ','&#xA0;':' ','&#160;':' ' }[_] || _);

    const $ = s => (html.match(s) || [])[1]?.trim();
    const isPhoto = html.includes('photo-list');
    
    const downloads = isPhoto 
      ? [...html.matchAll(/href="([^"]+)"[^>]*btn-premium[^>]*>[\s\S]*?Download Image/g)].map((m, i) => ({ type: `Image ${i+1}`, url: m[1] }))
          .concat((html.match(/href="([^"]+dl\.snapcdn\.app[^"]+)".*?Download MP3/) || []).slice(1).map(u => ({ type: 'MP3', url: u })))
      : [...html.matchAll(/href="([^"]+)"[^>]*tik-button-dl[^>]*>([\s\S]*?)<\/a>/g)].map(m => ({ 
          type: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), 
          url: m[1] 
        }));

    if (!downloads.length) return { success: false, result: 'Tidak ada link download' };

    return {
      success: true,
      result: {
        type: isPhoto ? 'photo' : 'video',
        title: $(/<h3[^>]*>([^<]+)<\/h3>/),
        thumbnail: $(/<img[^+]+src="([^"]+)"[^>]*(?:class="[^"]*image-tik[^"]*"|)/),
        downloads
      }
    };
  } catch (e) {
    return { success: false, result: e.message };
  }
};

module.exports = { tiktokDL };