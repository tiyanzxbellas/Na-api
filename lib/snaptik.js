const axios = require('axios');
const FormData = require('form-data');
const cheerio = require('cheerio');

function decodeSnaptik(h, u, n, t, e, r) {
    const _0xc98e = ["", "split", "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/", "slice", "indexOf", "", "", ".", "pow", "reduce", "reverse", "0"];
    function _0xe54c(d, e, f) {
        var g = _0xc98e[2][_0xc98e[1]](_0xc98e[0]);
        var h = g[_0xc98e[3]](0, e);
        var i = g[_0xc98e[3]](0, f);
        var j = d[_0xc98e[1]](_0xc98e[0])[_0xc98e[10]]()[_0xc98e[9]](function(a, b, c) {
            if (h[_0xc98e[4]](b) !== -1) return a += h[_0xc98e[4]](b) * (Math[_0xc98e[8]](e, c));
        }, 0);
        var k = _0xc98e[0];
        while (j > 0) {
            k = i[j % f] + k;
            j = (j - (j % f)) / f;
        }
        return k || _0xc98e[11];
    }
    let res = "";
    for (let i = 0, len = h.length; i < len; i++) {
        let s = "";
        while (h[i] !== n[e]) {
            s += h[i];
            i++;
        }
        for (let j = 0; j < n.length; j++) {
            s = s.replace(new RegExp(n[j], "g"), j);
        }
        res += String.fromCharCode(_0xe54c(s, e, 10) - t);
    }
    return decodeURIComponent(escape(res));
}

async function download(tiktokUrl) {
    try {
        const client = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Referer': 'https://snaptik.app/ID2',
                'Origin': 'https://snaptik.app'
            }
        });

        const responseMain = await client.get('https://snaptik.app/ID2');
        const $main = cheerio.load(responseMain.data);
        const token = $main('input[name="token"]').val();

        if (!token) throw new Error("Token tidak ditemukan.");

        const formData = new FormData();
        formData.append('url', tiktokUrl);
        formData.append('lang', 'ID2');
        formData.append('token', token);

        const responsePost = await client.post('https://snaptik.app/abc2.php', formData, {
            headers: formData.getHeaders()
        });

        const scriptData = responsePost.data;
        const regex = /}\("(.+?)",(\d+),"(.+?)",(\d+),(\d+),(\d+)\)\)/;
        const match = scriptData.match(regex);

        if (!match) throw new Error("Gagal de-obfuscate script.");

        const [_, h, u, n, t, e, r] = match;
        const decodedJs = decodeSnaptik(h, parseInt(u), n, parseInt(t), parseInt(e), parseInt(r));

        const htmlMatch = decodedJs.match(/\.innerHTML\s*=\s*"(.*?)";/);
        if (!htmlMatch) throw new Error("Gagal mengekstrak HTML dari script.");

        const cleanHtml = htmlMatch[1].replace(/\\"/g, '"').replace(/\\\//g, '/');

        const $result = cheerio.load(cleanHtml);
        const downloadLinks = [];

        $result('a.button').each((i, el) => {
            const href = $result(el).attr('href');
            const text = $result(el).text().trim();
            if (href && href.startsWith('http')) {
                downloadLinks.push({ type: text, url: href });
            }
        });

        const hdToken = $result('button.btn-download-hd').attr('data-tokenhd');
        if (hdToken) {
            downloadLinks.push({ type: "Download Video HD (API)", url: hdToken });
        }

        return {
            status: "success",
            video_info: {
                title: $result('.video-title').text().trim(),
                author: $result('.info span').text().trim(),
                thumbnail: $result('#thumbnail').attr('src')
            },
            download_links: downloadLinks
        };

    } catch (error) {
        throw new Error(error.message);
    }
}

module.exports = { download };