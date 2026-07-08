const axios = require('axios');

/**
 * MMS Transcription Service
 * Menggunakan Meta MMS (Massively Multilingual Speech) model
 * @see https://raphaelmerx-mms-transcription.hf.space
 */

const BASE_URL = 'https://raphaelmerx-mms-transcription.hf.space';
const API_PREFIX = '/gradio_api';

// Kumpulan fakta unik untuk ping event (menemani user saat menunggu)
const FUN_FACTS = [
    "🐙 Gurita memiliki 3 jantung dan darah berwarna biru.",
    "🦥 Sloth hanya turun dari pohon 1x seminggu untuk buang air.",
    "🦈 Hiu hidup lebih lama dari pohon — ada hiu Greenland berusia 400+ tahun.",
    "🐝 Lebah madu dapat mengenali wajah manusia.",
    "🐙 Gurita adalah satu-satunya hewan yang bisa merasakan rasa dengan tentakelnya.",
    "🐌 Siput bisa tidur selama 3 tahun tanpa henti.",
    "🐘 Gajah adalah satu-satunya hewan yang tidak bisa melompat.",
    "🦒 Leher jerapah memiliki jumlah tulang yang sama dengan manusia (7).",
    "🦥 Sloth berenang 3x lebih cepat daripada berjalan di darat.",
    "🦈 Hiu adalah satu-satunya ikan yang berkedip.",
    "🐨 Koala tidur 22 jam sehari — lebih lama dari sloth!",
    "🦔 Landak beruang bisa berenang dan memanjat pohon.",
    "🦜 Burung beo dapat memecahkan masalah sama seperti anak umur 5 tahun.",
    "🐙 Gurita memiliki 9 otak — 1 di kepala, 1 di tiap tentakel.",
    "🐬 Lumba-lumba memberi nama satu sama lain dengan suara khusus.",
    "🦅 Elang bisa melihat makanan dari jarak 3 km.",
    "🐦 Burung kolibri adalah satu-satunya burung yang bisa terbang mundur.",
    "🦗 Jangkrik memiliki telinga di lututnya.",
    "🦋 Kupu-kupu merasakan rasa dengan kakinya.",
    "🐱 Kucing tidak bisa merasakan manis.",
    "🦈 Hiu kehilangan gigi setiap minggu — tumbuh kembali dalam 24 jam.",
    "🐢 Kura-kura bisa bernapas lewat kloaka (bawah ekornya).",
    "🦦 Berang-berang berpegangan tangan saat tidur agar tidak terpisah.",
    "🐧 Penguin melamar pasangan dengan batu — yang tercantek dipilih.",
    "🦒 Jerapah hanya butuh 30 menit tidur per hari.",
    "🦭 Anjing laut bisa menahan napas hingga 2 jam.",
    "🐝 Lebah madu menari untuk memberi tahu arah bunga ke lebah lain.",
    "🦈 Hiu tidak memiliki tulang — kerangkanya terbuat dari rawan.",
    "🐙 Saat stres, gurita bisa memakan tentakelnya sendiri.",
    "🐌 Siput memiliki 14.000 gigi — lebih banyak dari hiu.",
    "🦥 Sloth mengubah makanan jadi energi dalam 30 hari.",
    "🐟 Ikan koki bisa melihat lebih banyak warna daripada manusia.",
    "🦜 Burung beo Afrika bisa belajar 1.000+ kata.",
    "🐘 Gajah bisa 'mendengar' dengan kaki mereka — merasakan getaran tanah.",
    "🦒 Jerapah punya lidah hitam sepanjang 50 cm.",
    "🦎 Kadal buntu bisa melepaskan ekornya saat diserang — tumbuh lagi!",
    "🐝 Satu lebah madu menghasilkan 1/12 sendok teh madu seumur hidupnya.",
    "🐙 Gurita bisa melewati celah sebesar mata uang koin.",
    "🦈 Hiu ada sebelum pohon — hiu sudah ada 400 juta tahun, pohon 350 juta.",
    "🦜 Burung gagak bisa menggunakan alat dan mengingat wajah manusia.",
];

/**
 * Ambil fakta unik secara acak
 * @returns {string}
 */
function getRandomFact() {
    return FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
}

// Language mapping untuk kode pendek ke format yang didukung MMS
const LANG_MAP = {
    'ind': 'Indonesian (ind)',
    'eng': 'English (eng)',
    'jpn': 'Japanese (jpn)',
    'ara': 'Arabic (ara)',
    'cmn': 'Chinese, Mandarin (cmn-script_simplified)',
    'spa': 'Spanish (spa)',
    'fra': 'French (fra)',
    'deu': 'German (deu)',
    'por': 'Portuguese (por)',
    'rus': 'Russian (rus)',
    'hin': 'Hindi (hin)',
    'kor': 'Korean (kor)',
    'tha': 'Thai (tha)',
    'vie': 'Vietnamese (vie)',
    'ita': 'Italian (ita)',
    'nld': 'Dutch (nld)',
    'msa': 'Malay (msa)',
    'swe': 'Indonesian (ind)', // sunda dianggap ind dulu
    'sun': 'Indonesian (ind)', // sunda fallback
    'jav': 'Indonesian (ind)', // jawa fallback
};

/**
 * Normalisasi input bahasa ke format MMS
 * @param {string} lang - Input bahasa (bisa "ind", "Indonesian (ind)", "Indonesian")
 * @returns {string} Format lengkap "Indonesian (ind)"
 */
function normalizeLanguage(lang) {
    if (!lang) return 'Indonesian (ind)';
    
    const trimmed = lang.trim();
    
    // Cek apakah sudah dalam format lengkap "Nama (kode)"
    if (/\([a-z]{3}\)/.test(trimmed)) {
        return trimmed;
    }
    
    // Cek apakah hanya kode 3 huruf
    if (/^[a-z]{3}$/.test(trimmed)) {
        return LANG_MAP[trimmed] || trimmed;
    }
    
    // Coba cocokkan nama bahasa
    const lower = trimmed.toLowerCase();
    for (const [code, full] of Object.entries(LANG_MAP)) {
        if (full.toLowerCase().startsWith(lower) || full.toLowerCase().includes(lower)) {
            return full;
        }
    }
    
    // Fallback: gunakan apa yang dikirim user
    return trimmed;
}

/**
 * Ekstrak nama file dari URL
 * @param {string} url
 * @returns {string}
 */
function getFilename(url) {
    const segments = url.split('/');
    const last = segments[segments.length - 1] || 'audio';
    return last.split('?')[0] || 'audio';
}

/**
 * Transkripsi audio ke teks menggunakan MMS Model (async generator)
 * @param {string} audioUrl - URL publik file audio
 * @param {string} [language='Indonesian (ind)'] - Bahasa target (format: "Nama (kode)")
 * @param {function} [pingCallback] - Callback opsional untuk ping event { type, message, fact }
 * @yields {object} Event { type, message, ... }
 */
async function* transcribeStream(audioUrl, language, pingCallback) {
    if (!audioUrl) throw new Error("Parameter 'url' wajib diisi.");

    const targetLang = normalizeLanguage(language);
    const filename = getFilename(audioUrl);

    yield { type: 'start', message: 'Memulai transkripsi audio...' };

    // 1. Submit job ke Gradio API
    const submitPayload = {
        data: [
            {
                path: audioUrl,
                meta: { _type: 'gradio.FileData' },
                orig_name: filename,
                url: audioUrl
            },
            targetLang
        ]
    };

    let eventId;
    try {
        yield { type: 'submit', message: 'Mengirim audio ke MMS Model...' };

        const submitResponse = await axios.post(
            `${BASE_URL}${API_PREFIX}/call/predict`,
            submitPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 30000
            }
        );

        eventId = submitResponse.data?.event_id;
        if (!eventId) {
            throw new Error('Gagal mendapatkan event_id dari API.');
        }

        yield { type: 'submitted', message: 'Audio terkirim, menunggu hasil...', event_id: eventId };
    } catch (error) {
        if (error.response) {
            throw new Error(`Gagal submit transkripsi: HTTP ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`Gagal submit transkripsi: ${error.message}`);
    }

    // 2. Poll SSE endpoint untuk hasil
    const sseUrl = `${BASE_URL}${API_PREFIX}/call/predict/${eventId}`;
    
    try {
        yield { type: 'processing', message: 'Model MMS sedang memproses audio...' };

        // Mulai ping interval — kirim fakta unik setiap 5 detik sambil menunggu
        let pingCount = 0;
        const pingInterval = setInterval(() => {
            pingCount++;
            // Ping ditulis ke writer eksternal via callback
            if (pingCallback) {
                pingCallback({
                    type: 'ping',
                    message: `⏳ Menunggu hasil... (${pingCount})`,
                    fact: getRandomFact()
                });
            }
        }, 5000);

        const sseResponse = await axios.get(sseUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/event-stream'
            },
            responseType: 'text',
            timeout: 120000,
            transformResponse: [(data) => data]
        });

        // Hentikan ping setelah hasil diterima
        clearInterval(pingInterval);

        const rawData = sseResponse.data;
        
        // Parse SSE response - cari event complete
        const lines = rawData.split('\n');
        let transcriptText = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === 'event: complete') {
                if (i + 1 < lines.length) {
                    const dataLine = lines[i + 1].trim();
                    if (dataLine.startsWith('data: ')) {
                        const jsonStr = dataLine.substring(6);
                        try {
                            const parsed = JSON.parse(jsonStr);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                transcriptText = parsed[0];
                            } else if (typeof parsed === 'string') {
                                transcriptText = parsed;
                            }
                        } catch {
                            transcriptText = jsonStr;
                        }
                    }
                }
                break;
            }
        }

        // Fallback: coba cari data: [...] di baris terakhir
        if (!transcriptText) {
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].trim();
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    try {
                        const parsed = JSON.parse(jsonStr);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            transcriptText = parsed[0];
                        } else if (typeof parsed === 'string') {
                            transcriptText = parsed;
                        }
                    } catch {
                        transcriptText = jsonStr;
                    }
                    break;
                }
            }
        }

        if (!transcriptText) {
            yield { type: 'raw', message: 'Tidak bisa parse hasil, mengirim data mentah', raw: rawData.substring(0, 500) };
            return;
        }

        yield { type: 'result', text: transcriptText, language: targetLang };
    } catch (error) {
        // Pastikan interval dihentikan saat error
        if (typeof pingInterval !== 'undefined') clearInterval(pingInterval);
        if (error.response) {
            throw new Error(`Gagal mendapatkan hasil transkripsi: HTTP ${error.response.status} - ${error.response.data}`);
        }
        throw new Error(`Gagal mendapatkan hasil transkripsi: ${error.message}`);
    }
}

module.exports = { transcribeStream, normalizeLanguage, getRandomFact };
