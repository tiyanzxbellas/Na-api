import { NextResponse } from 'next/server';
import iaskController from '../../../../lib/controllers/ai/iask';
import { reportError } from '../../../../lib/errorLogger';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
    try {
        const body = await req.json();
        const { query, mode = 'question', detail_level = 'detailed' } = body;

        // Validasi input
        if (!query) {
            return NextResponse.json({
                success: false,
                message: "Parameter 'query' wajib diisi."
            }, { status: 400 });
        }

        const validModes = ['question', 'academic', 'thinking', 'forums', 'wiki'];
        if (!validModes.includes(mode)) {
            return NextResponse.json({
                success: false,
                message: `Mode tidak valid. Pilihan: ${validModes.join(', ')}`
            }, { status: 400 });
        }

        const validDetailLevels = ['concise', 'detailed', 'comprehensive'];
        if (!validDetailLevels.includes(detail_level)) {
            return NextResponse.json({
                success: false,
                message: `Detail level tidak valid. Pilihan: ${validDetailLevels.join(', ')}`
            }, { status: 400 });
        }

        const encoder = new TextEncoder();
        const customStream = new TransformStream();
        const writer = customStream.writable.getWriter();

        const send = (data) => {
            return writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        (async () => {
            try {
                await send({ type: 'start', query });

                // Panggil controller
                const mockReq = { body: { query, mode, detail_level } };
                const result = await iaskController(mockReq);

                if (!result || !result.success || !result.result) {
                    await send({ type: 'error', content: 'Gagal mendapatkan jawaban dari iAsk.ai' });
                    return;
                }

                const { answer, sources, related_questions, metadata } = result.result;

                // Kirim answer dalam chunk (word by word untuk efek streaming)
                if (answer) {
                    const words = answer.split(' ');
                    let buffer = '';

                    for (let i = 0; i < words.length; i++) {
                        buffer += (i > 0 ? ' ' : '') + words[i];

                        // Kirim setiap 3-5 kata
                        if (i % 4 === 0 || i === words.length - 1) {
                            await send({
                                type: 'answer',
                                content: buffer,
                                done: i === words.length - 1
                            });
                            buffer = '';
                        }
                    }
                }

                // Kirim sources
                if (sources && sources.length > 0) {
                    await send({ type: 'sources', data: sources });
                }

                // Kirim related questions
                if (related_questions && related_questions.length > 0) {
                    await send({ type: 'related', data: related_questions });
                }

                // Kirim metadata
                await send({ type: 'metadata', data: metadata });

                // Selesai
                await send({ type: 'done' });
            } catch (err) {
                // Auto-report error ke Telegram
                reportError(err, { endpoint: '/ai/iask', method: 'POST' }).catch(() => {});

                await send({ type: 'error', content: err.message });
            } finally {
                try { await writer.close(); } catch (e) {
                    reportError(e, { endpoint: '/ai/iask', method: 'UNKNOWN' }).catch(() => {});
                }
            }
        })();

        return new Response(customStream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        // Auto-report error ke Telegram
        reportError(error, { endpoint: '/ai/iask', method: 'UNKNOWN' }).catch(() => {});

        return NextResponse.json({
            success: false,
            message: 'Layanan sedang sibuk. Silakan coba lagi nanti.'
        }, { status: 500 });
    }
}

export async function GET(req) {
    return NextResponse.json({
        name: 'iAsk AI Search',
        description: 'Pencarian AI via iAsk.ai dengan jawaban faktual dan sumber terpercaya.',
        usage: {
            method: 'POST',
            url: '/api/ai/iask',
            body: {
                query: 'string (wajib) - Pertanyaan yang ingin dicari',
                mode: 'string (opsional) - Mode pencarian. Default: question. Pilihan: question, academic, thinking, forums, wiki',
                detail_level: 'string (opsional) - Tingkat detail. Default: detailed. Pilihan: concise, detailed, comprehensive'
            }
        }
    });
}