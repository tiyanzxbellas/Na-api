/**
 * @title Audio to Text (MMS) - SSE
 * @summary Transkripsi Audio ke Teks (1000+ Bahasa) via Server-Sent Events.
 * @description Mengonversi file suara/audio menjadi teks menggunakan Meta MMS (Massively Multilingual Speech) model. Mendukung 1000+ bahasa. Response dalam format SSE (Server-Sent Events). Saat menunggu hasil, server mengirim ping event berisi fakta unik.
 * @method POST
 * @path /api/tools/audio2text
 * @response sse
 * @param {string} body.url - URL publik file audio (WAV/MP3/FLAC/OGG, dll).
 * @param {string} [body.lang] - Kode/nama bahasa target. Contoh: 'ind', 'Indonesia', 'Indonesian (ind)'. Default: 'Indonesian (ind)'.
 * @example
 * // Via fetch + ReadableStream (rekomendasi)
 * const res = await fetch('https://puruboy-api.vercel.app/api/tools/audio2text', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     url: 'https://puruboy-api.vercel.app/example.mp3',
 *     lang: 'ind'
 *   })
 * });
 * const reader = res.body.getReader();
 * const decoder = new TextDecoder();
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   const chunk = decoder.decode(value);
 *   // Parse SSE events: start, submit, submitted, processing, ping, result, done
 *   console.log(chunk);
 * }
 *
 * @example
 * // EventSource (browser) — gunakan POST proxy atau library seperti @microsoft/fetch-event-source
 * // Karena EventSource tidak support POST, gunakan fetch + manual parse:
 * const res = await fetch('/api/tools/audio2text', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ url: 'https://puruboy-api.vercel.app/example.mp3', lang: 'ind' })
 * });
 * // Baca stream, setiap event "ping" berisi fakta unik sambil menunggu "result"
 */
const { transcribeStream } = require('../../audio2text');

const audio2textController = async (req, res) => {
    const { url, lang } = req.body;

    if (!url) {
        throw new Error("Parameter 'url' wajib diisi.");
    }

    const encoder = new TextEncoder();
    const customStream = new TransformStream();
    const writer = customStream.writable.getWriter();

    const send = (data) => {
        return writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    // Callback untuk ping event dari transcribeStream
    const pingCallback = (event) => {
        return send(event);
    };

    (async () => {
        try {
            const generator = transcribeStream(url, lang, pingCallback);

            for await (const event of generator) {
                await send(event);
            }

            await send({ type: 'done', success: true });
        } catch (err) {
            await send({ type: 'error', message: err.message });
        } finally {
            try { await writer.close(); } catch (e) { /* ignore */ }
        }
    })();

    return customStream.readable;
};

module.exports = audio2textController;
