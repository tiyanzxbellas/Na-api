import { reportError } from '../../../../lib/errorLogger';
import audio2textController from '../../../../lib/controllers/tools/audio2text';

// Pemrosesan transkripsi AI bisa memakan waktu
export const maxDuration = 120; 

export async function POST(req) {
    try {
        const body = await req.json();
        const mockReq = { body };
        
        const readable = await audio2textController(mockReq);
        
        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        // Auto-report error ke Telegram
        reportError(error, { endpoint: '/tools/audio2text', method: 'POST' }).catch(() => {});

        // Fallback: kirim error sebagai event SSE
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', success: false })}\n\n`));
                controller.close();
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
            },
        });
    }
}