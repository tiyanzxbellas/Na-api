/**
 * @title Dracin TTS (SSE)
 * @summary AI Voice gaya Drama China (Dracin) dengan SSE fakta unik.
 * @description Mengubah teks menjadi suara dengan nada ala narator drama China. Menggunakan SSE (Server-Sent Events) untuk mengirim fakta unik random selama proses generating audio.
 * @method POST
 * @path /api/ai/dracin
 * @response stream
 * @param {string} body.text - Teks yang akan diubah menjadi suara.
 * @param {boolean} [body.music] - Menggunakan musik latar? Default: true.
 * @param {number} [body.speed] - Kecepatan bicara (0.5 - 2.0). Default: 1.0.
 * @param {number} [body.volume] - Volume musik latar (0.1 - 1.0). Default: 0.3.
 * @example
 * // Contoh request
 * const res = await fetch('/api/ai/dracin', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     "text": "Halo, selamat datang di dunia drama China.",
 *     "music": true,
 *     "speed": 1.0,
 *     "volume": 0.3
 *   })
 * });
 * // Response berupa SSE Stream:
 * // event: status  { "message": "Memproses teks menjadi suara..." }
 * // event: fact    { "fact": "Kumis kucing..." }
 * // event: status  { "message": "Mengupload audio..." }
 * // event: result  { "success": true, "result": { "text": "...", "audio": "..." } }
 */

import { reportError } from '../../../../lib/errorLogger';
import dracinController from '../../../../lib/controllers/ai/dracin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
    try {
        const body = await req.json();
        const origin = new URL(req.url).origin;

        // Validasi parameter wajib
        if (!body.text) {
            return new Response(
                `event: error\ndata: ${JSON.stringify({ message: "Parameter 'text' wajib diisi." })}\n\n`,
                {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                }
            );
        }

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(ctrl) {
                try {
                    const sendEvent = (event, data) => {
                        try {
                            ctrl.enqueue(
                                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                            );
                        } catch (e) {
                            // Stream mungkin sudah ditutup, abaikan
                        }
                    };

                    const mockReq = { body, origin };
                    await dracinController(mockReq, sendEvent);

                    // Kirim event selesai
                    sendEvent('done', { message: 'Proses selesai.' });

                    ctrl.close();
                } catch (error) {
                    try {
                        ctrl.enqueue(
                            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`)
                        );
                    } catch (e) {
                        // Stream sudah ditutup
                    }
                    ctrl.close();
                }
            },
            cancel() {
                // Client menutup koneksi, cleanup opsional
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no', // Nonaktifkan buffering nginx
            },
        });
    } catch (error) {
        // Auto-report error ke Telegram
        reportError(error, { endpoint: '/ai/dracin', method: 'POST' }).catch(() => {});

        return new Response(
            `event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`,
            {
                status: 200,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            }
        );
    }
}
