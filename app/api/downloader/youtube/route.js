import { NextResponse } from 'next/server';
import youtubeController from '../../../../lib/controllers/downloader/youtube';
import { reportError } from '../../../../lib/errorLogger';

export async function POST(req) {
    try {
        const body = await req.json();
        
        // Mock request object for controller
        const mockReq = { body };
        
        const result = await youtubeController(mockReq);
        return NextResponse.json(result);
    } catch (error) {
        // Auto-report error ke Telegram
        reportError(error, { endpoint: '/downloader/youtube', method: 'POST', body: await req.json().catch(() => ({})) }).catch(() => {});

        return NextResponse.json({ 
            success: false, 
            message: error.message 
        }, { status: 400 });
    }
}