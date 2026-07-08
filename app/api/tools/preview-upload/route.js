import { NextResponse } from 'next/server';
import previewUploadController from '../../../../lib/controllers/tools/previewUpload';
import { reportError } from '../../../../lib/errorLogger';

export async function POST(req) {
    try {
        const body = await req.json();
        const { content, filename } = body;

        if (!content || typeof content !== 'string') {
            return NextResponse.json({ 
                success: false,
                error: "Parameter 'content' (string HTML) wajib diisi." 
            }, { status: 400 });
        }
        
        // Mock request object for controller
        const mockReq = { 
            content: content,
            filename: filename || 'preview'
        };
        
        const result = await previewUploadController(mockReq);
        return NextResponse.json(result);
    } catch (error) {
        // Auto-report error ke Telegram
        reportError(error, { endpoint: '/tools/preview-upload', method: 'POST' }).catch(() => {});

        return NextResponse.json({ 
            success: false, 
            message: error.message 
        }, { status: 500 });
    }
}
