/**
 * @title iAsk AI Search
 * @summary Pencarian AI via iAsk.ai dengan jawaban faktual dan sumber terpercaya.
 * @description Melakukan pencarian pertanyaan ke iAsk.ai (iAsk Question AI Answer Engine) dan mengembalikan jawaban beserta sumber referensi. iAsk.ai menggunakan teknologi AI untuk memberikan jawaban akurat dari sumber-sumber otoritatif di web.
 * @method POST
 * @path /api/ai/iask
 * @response stream (SSE)
 * @param {string} body.query - Pertanyaan yang ingin dicari (wajib).
 * @param {string} [body.mode] - Mode pencarian. (opsional, default: "question")
 * @choice question - Question (Informasi umum dari web)
 * @choice academic - Student (Homework help, akademik)
 * @choice thinking - Thinking (Butuh pemikiran mendalam)
 * @choice forums - Forums (Diskusi forum online)
 * @choice wiki - Wiki (Wikipedia & wiki lainnya)
 * @param {string} [body.detail_level] - Tingkat detail jawaban. (opsional, default: "detailed")
 * @choice concise - Concise (Ringkas)
 * @choice detailed - Average (Sedang)
 * @choice comprehensive - Detailed (Detail)
 * @example
 * fetch('https://puruboy-api.vercel.app/api/ai/iask', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *         query: 'Apa itu machine learning?',
 *         mode: 'question',
 *         detail_level: 'detailed'
 *     })
 * }).then(res => {
 *     const reader = res.body.getReader();
 *     const decoder = new TextDecoder();
 *     function read() {
 *         reader.read().then(({ done, value }) => {
 *             if (done) return;
 *             const text = decoder.decode(value);
 *             console.log(text);
 *             read();
 *         });
 *     }
 *     read();
 * }).catch(console.error);
 */
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Parse HTML response dari iAsk.ai
 * @param {string} html - Raw HTML
 * @param {string} query - Original query
 * @returns {object} Hasil parsing
 */
function parseResult(html, query) {
    const $ = cheerio.load(html);
    const result = {
        query: query,
        answer: '',
        sources: [],
        related_questions: [],
        metadata: {}
    };

    const bodyText = $('body').text();

    // --- EKSTRAK ANSWER ---
    let answerText = '';

    // Cari teks setelah "Share" sampai sebelum "Authoritative Sources" atau "Elaborate" atau "Simplify"
    const shareMatch = bodyText.match(/Share\s*\n([\s\S]*?)(?=Authoritative Sources|Elaborate|Simplify|Summarize|Sign up for free)/);
    if (shareMatch && shareMatch[1]) {
        answerText = shareMatch[1].trim();
    } else {
        // Fallback: cari setelah query + Share
        const queryIndex = bodyText.indexOf(query);
        if (queryIndex >= 0) {
            const afterQuery = bodyText.substring(queryIndex + query.length);
            const shareIdx = afterQuery.indexOf('Share');
            if (shareIdx >= 0) {
                const endIdx = afterQuery.indexOf('Authoritative Sources');
                const limit = endIdx >= 0 ? endIdx : afterQuery.length;
                answerText = afterQuery.substring(shareIdx + 5, limit).trim();
            }
        }
    }

    // Bersihkan answer
    if (answerText) {
        answerText = answerText
            .replace(/\[\d+\]/g, '') // Hapus referensi seperti [1], [2]
            .replace(/\s+/g, ' ')
            .replace(/According to www\.iAsk\.Ai - Ask AI:/g, '')
            .trim();
    }
    result.answer = answerText;

    // --- EKSTRAK SOURCES ---
    const sourcesSection = bodyText.match(/Authoritative Sources\s*([\s\S]*?)(?=Elaborate|Simplify|Summarize|Sign up for free|$)/);
    if (sourcesSection && sourcesSection[1]) {
        const sourceLines = sourcesSection[1].split('\n').filter(line => line.trim());
        sourceLines.forEach(line => {
            const cleanLine = line.trim();
            if (cleanLine) {
                const match = cleanLine.match(/^(.+?)\.\s*\[(.+?)\]/);
                if (match) {
                    result.sources.push({
                        title: match[1].trim(),
                        source: match[2].trim()
                    });
                } else {
                    result.sources.push({ title: cleanLine, source: '' });
                }
            }
        });
    }

    // --- EKSTRAK RELATED QUESTIONS ---
    const relatedSection = bodyText.match(/People often ask\s*([\s\S]*?)(?=We use cookies|iAsk has been|$)/);
    if (relatedSection && relatedSection[1]) {
        const questions = relatedSection[1].split('\n').filter(q => q.trim().endsWith('?'));
        result.related_questions = questions.map(q => q.trim()).filter(q => q);
    }

    // --- METADATA ---
    result.metadata = {
        title: $('title').text().trim() || '',
        answer_length: result.answer.length,
        sources_count: result.sources.length,
        related_count: result.related_questions.length
    };

    return result;
}

/**
 * Controller iAsk AI Search
 * @param {object} req - Request object dengan body
 * @returns {Promise<object>} Hasil scraping
 */
const iaskController = async (req) => {
    const { query, mode = 'question', detail_level = 'detailed' } = req.body;

    if (!query) {
        throw new Error("Parameter 'query' wajib diisi.");
    }

    const validModes = ['question', 'academic', 'thinking', 'forums', 'wiki'];
    if (!validModes.includes(mode)) {
        throw new Error(`Mode tidak valid. Pilihan: ${validModes.join(', ')}`);
    }

    const validDetailLevels = ['concise', 'detailed', 'comprehensive'];
    if (!validDetailLevels.includes(detail_level)) {
        throw new Error(`Detail level tidak valid. Pilihan: ${validDetailLevels.join(', ')}`);
    }

    const url = 'https://iask.ai/q';
    const params = {
        q: query,
        mode: mode,
        options__detail_level: detail_level
    };

    const response = await axios.get(url, {
        params,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 30000,
        maxRedirects: 5
    });

    const result = parseResult(response.data, query);

    return {
        success: true,
        author: 'PuruBoy',
        result: result
    };
};

module.exports = iaskController;