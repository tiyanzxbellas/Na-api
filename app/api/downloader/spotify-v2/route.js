import { NextResponse } from 'next/server';
import spotifyV2Controller from '../../../../lib/controllers/downloader/spotifyV2';
import { reportError } from '../../../../lib/errorLogger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Handler untuk method yang tidak didukung
 */
function methodNotAllowed(method) {
    return NextResponse.json({
        success: false,
        error: `Method ${method} not allowed. Use POST instead.`
    }, { status: 405 });
}

export async function POST(req) {
    try {
        const body = await req.json();

        // Validasi body
        if (!body || !body.url) {
            return NextResponse.json({
                success: false,
                message: "Parameter 'url' Spotify wajib diisi."
            }, { status: 400 });
        }

        // Mock request object for controller
        const mockReq = { body };

        const result = await spotifyV2Controller(mockReq);
        return NextResponse.json(result);
    } catch (error) {
        // Auto-report error ke Telegram
        reportError(error, { endpoint: '/downloader/spotify-v2', method: 'POST' }).catch(() => {});

        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    }
}

export async function GET() {
    return methodNotAllowed('GET');
}

export async function PUT() {
    return methodNotAllowed('PUT');
}

export async function DELETE() {
    return methodNotAllowed('DELETE');
}

export async function PATCH() {
    return methodNotAllowed('PATCH');
}

export async function HEAD() {
    return methodNotAllowed('HEAD');
}
