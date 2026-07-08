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
 * Bersihkan teks dari footnote reference seperti [1], [2], dll.
 * @param {string} text
 * @returns {string}
 */
function cleanFootnoteRefs(text) {
  return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * Parse HTML response dari iAsk.ai menggunakan cheerio selector.
 * Target utama adalah <div id="text"> yang berisi jawaban dan sumber.
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

  // =============================================
  // EKSTRAK ANSWER dari <div id="text">
  // =============================================
  const textDiv = $('#text');
  let answerText = '';

  if (textDiv.length > 0) {
    // Clone div#text lalu hapus .footnotes (sumber) dari clone
    const clone = textDiv.clone();
    clone.find('.footnotes').remove();
    clone.find('hr').remove();

    // Ambil teks dari setiap <p> dan gabungkan
    clone.find('p').each((i, el) => {
      const pText = $(el).text().trim();
      if (pText) {
        answerText += pText + '\n\n';
      }
    });

    // Fallback: jika tidak ada <p>, ambil teks langsung dari clone
    if (!answerText.trim()) {
      answerText = clone.text().trim();
    }
  }

  // Bersihkan answer
  if (answerText) {
    answerText = cleanFootnoteRefs(answerText);
    answerText = answerText
      .replace(/\s*\n{3,}/g, '\n\n') // Normalize multiple newlines
      .replace(/According to www\.iAsk\.Ai - Ask AI:\s*/g, '')
      .replace(/\s*\[?\s*According to www\.iAsk\.Ai\s*-?\s*Ask AI:?\s*\]?\s*/g, '')
      .trim();
  }

  result.answer = answerText;

  // =============================================
  // EKSTRAK SOURCES dari .footnotes ol li
  // =============================================
  const footnotes = textDiv.find('.footnotes');
  if (footnotes.length > 0) {
    footnotes.find('ol li').each((i, el) => {
      const fullText = $(el).text().trim();
      // Cari link pertama dalam li (biasanya sumber)
      const link = $(el).find('a').first();
      const sourceName = link.text().trim();
      const sourceUrl = link.attr('href') || '';

      // Title adalah teks sebelum link
      let title = fullText;
      if (sourceName) {
        title = fullText.replace(sourceName, '').replace(/\[\s*\]/, '').replace(/↩$/, '').trim();
        // Hapus remaining bracket jika ada
        title = title.replace(/\[.*?\]/, '').trim();
      }

      if (title || sourceName) {
        result.sources.push({
          title: title || fullText,
          source: sourceName,
          url: sourceUrl
        });
      }
    });
  }

  // =============================================
  // EKSTRAK RELATED QUESTIONS
  // =============================================
  const bodyText = $('body').text();
  const relatedSection = bodyText.match(/People often ask\s*([\s\S]*?)(?=We use cookies|iAsk has been|$)/);
  if (relatedSection && relatedSection[1]) {
    const questions = relatedSection[1].split('\n').filter(q => q.trim().endsWith('?'));
    result.related_questions = questions.map(q => q.trim()).filter(q => q);
  }

  // =============================================
  // METADATA
  // =============================================
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
