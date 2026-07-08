import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
    const { slug } = params;
    const repo = "purujawa06-bot/pageku";
    const fileName = `PuruPage[${slug}].html`;

    try {
        // Construct raw URL to download the HTML directly from GitHub
        const rawUrl = `https://raw.githubusercontent.com/${repo}/main/page/${encodeURIComponent(fileName)}`;
        
        const ghRes = await fetch(rawUrl, { 
            cache: 'no-store' 
        });

        if (ghRes.ok) {
            const html = await ghRes.text();
            
            // Return HTML with Cache-Control headers to prevent any caching
            return new NextResponse(html, {
                headers: { 
                    'Content-Type': 'text/html',
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'X-Source': 'GitHub-Remote'
                }
            });
        }

        // Fallback 404 UI if file not found on GitHub
        return new NextResponse(`
            <html>
                <head>
                    <title>404 Not Found</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { background: #09090b; color: #a1a1aa; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                        .card { background: #121215; padding: 2rem; border-radius: 1rem; border: 1px solid #27272a; text-align: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); }
                        h1 { color: white; margin: 0 0 0.5rem 0; font-size: 3rem; }
                        p { margin-bottom: 1.5rem; font-size: 0.9rem; }
                        a { color: #ec4899; text-decoration: none; font-weight: bold; padding: 0.5rem 1rem; border: 1px solid #ec4899; border-radius: 0.5rem; transition: all 0.2s; }
                        a:hover { background: #ec4899; color: white; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>404</h1>
                        <p>Halaman "<b>${slug}</b>" tidak ditemukan atau sedang dalam proses sinkronisasi.</p>
                        <a href="/listpage">Lihat Semua Halaman</a>
                    </div>
                </body>
            </html>
        `, { status: 404, headers: { 'Content-Type': 'text/html' } });

    } catch (e) {
        return new NextResponse('Internal Server Error: ' + e.message, { status: 500 });
    }
}