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
const { generateDracinTTS } = require('../../dracin');
const { uploadToTmp } = require('../../uploader');
const { shuffleFacts } = require('../../facts');

const FACTS_POOL = [
    "Kumis kucing bukan hanya hiasan, tapi berfungsi sebagai radar untuk mengukur jarak dan mendeteksi gerakan mangsa.",
    "Gajah adalah satu-satunya mamalia yang tidak bisa melompat. Kakinya tidak dirancang untuk mendorong tubuh ke atas.",
    "Siput bisa tidur selama 3 tahun tanpa makan dan minum sama sekali.",
    "Madu tidak pernah basi. Madu berusia ribuan tahun yang ditemukan di makam Mesir masih bisa dimakan.",
    "Cumi-cumi punya tiga jantung. Dua jantung memompa darah ke insang, satu lagi ke seluruh tubuh.",
    "Bintang laut bisa meregenerasi lengan yang putus, dan jika lengannya masih memiliki sebagian pusat saraf, lengan itu bisa tumbuh menjadi bintang laut baru.",
    "Hiu sudah ada di bumi sebelum pohon ada. Fosil hiu ditemukan dari 400 juta tahun yang lalu.",
    "Semut tidak punya paru-paru. Mereka bernapas melalui lubang-lubang kecil di tubuh yang disebut spirakel.",
    "Planet Venus berputar sangat lambat sehingga satu hari di Venus lebih panjang dari satu tahun di Venus.",
    "Keyboard QWERTY dirancang untuk memperlambat kecepatan mengetik agar mesin ketik tidak macet.",
    "Telinga dan hidung manusia terus tumbuh sepanjang hidup, meskipun pertumbuhannya sangat lambat.",
    "Sekitar 70% dari seluruh spesies hewan di bumi adalah serangga.",
    "Seekor kecoa bisa hidup tanpa kepala selama seminggu karena sistem sarafnya terdesentralisasi.",
    "Pelangi sebenarnya berbentuk lingkaran penuh, bukan setengah lingkaran seperti yang kita lihat dari tanah.",
    "Suhu inti bumi diperkirakan mencapai 5.500°C, sama panasnya dengan permukaan matahari.",
    "Flamingo tidak dilahirkan berwarna merah muda. Warna merah muda mereka berasal dari makanan yang mereka makan.",
    "Pohon tertua di dunia berusia lebih dari 5.000 tahun, bernama 'Methuselah' di California, AS.",
    "Otak manusia terdiri dari sekitar 75% air. Dehidrasi 2% saja sudah bisa memengaruhi fungsi kognitif.",
    "Lidah manusia memiliki sekitar 10.000 pengecap rasa, dan mereka diganti setiap dua minggu sekali.",
    "Jantung paus biru sangat besar sehingga seorang manusia bisa berenang di arteri utamanya.",
    "Bambu adalah rumput tercepat di dunia, bisa tumbuh hingga 91 cm per hari.",
    "Katak tidak perlu minum air karena mereka menyerap air melalui kulit mereka.",
    "Kuku tangan tumbuh sekitar 3,5 mm per bulan, dua kali lebih cepat dari kuku kaki.",
    "Saat tersipu malu, lapisan lambung Anda juga ikut memerah. Organ dalam ikut bereaksi secara fisik.",
    "Cahaya dari bintang yang kita lihat di langit malam sebenarnya adalah cahaya dari masa lalu, karena butuh waktu bertahun-tahun untuk sampai ke mata kita.",
    "Kanguru tidak bisa berjalan mundur. Ekor dan kaki belakangnya dirancang untuk bergerak maju dan melompat.",
    "Di Jepang, ada sebuah toko yang hanya menjual satu jenis produk: pisang yang dipotong dan dikupas dengan sempurna.",
    "Bayi tidak memiliki tempurung lutut saat lahir. Tempurung lutut mulai tumbuh saat bayi berusia 2-6 tahun.",
    "Satu sendok teh bintang neutron memiliki berat sekitar 10 juta ton, sama seperti satu gunung.",
    "Awan bukanlah benda ringan. Awan kumulonimbus bisa memiliki berat hingga 1 miliar ton.",
    "Lobster bisa hidup sangat lama dan tidak menunjukkan tanda-tanda penuaan. Mereka bisa hidup hingga 100 tahun lebih.",
    "Singa tidak tinggal di hutan. Mereka tinggal di padang rumput dan sabana di Afrika.",
    "Hanya 10-15% populasi dunia yang kidal. Namun, persentase ini lebih tinggi pada pria daripada wanita.",
    "Menara Eiffel bisa bertambah tinggi hingga 15 cm di musim panas karena pemuaian termal logam.",
    "Koin yang dilempar dari gedung tertinggi tidak akan membunuh orang di bawah. Hambatan udara memperlambatnya.",
    "Jumlah bakteri di dalam mulut manusia lebih banyak dari jumlah seluruh manusia yang pernah hidup di bumi.",
    "Seekor cacing tanah memiliki 5 pasang jantung. Mereka terletak di sepanjang tubuh cacing.",
    "Warna asli es adalah biru pucat, bukan putih. Es terlihat putih karena memantulkan semua cahaya.",
    "Beberapa spesies pohon di hutan hujan Amazon saling berkomunikasi melalui jaringan akar dan jamur bawah tanah.",
    "Ada lebih banyak pohon di bumi daripada bintang di Bima Sakti. Jumlah pohon diperkirakan 3 triliun.",
    "Suara yang kita dengar saat menyentuh cangkang ke telinga bukanlah suara laut, melainkan resonansi dari lingkungan sekitar.",
    "Kupu-kupu bisa melihat warna ultraviolet yang tidak bisa dilihat manusia, membantu mereka menemukan nektar.",
    "Leher jerapah memiliki panjang yang sama dengan leher manusia yang ditumpuk 6 kali, tapi hanya memiliki 7 ruas tulang leher.",
    "Air laut berwarna biru karena molekul air menyerap cahaya merah dan memantulkan cahaya biru.",
    "Hampir semua yang kita beli di toko dikirim dengan kapal kargo. Sekitar 90% perdagangan dunia menggunakan kapal."
];

/**
 * Dracin Controller with SSE support
 * @param {object} req - Request object { body, origin }
 * @param {function} sendEvent - Callback untuk mengirim SSE event (eventName, data)
 * @returns {Promise<object>} Result object
 */
const dracinController = async (req, sendEvent) => {
    const { text, music, speed, volume } = req.body;
    const origin = req.origin || '';

    if (!text) {
        throw new Error("Parameter 'text' wajib diisi.");
    }

    const useBg = music !== undefined ? music : true;
    const voiceSpeed = speed || 1.0;
    const bgVol = volume || 0.3;

    // Kirim status awal
    if (sendEvent) {
        sendEvent('status', { message: 'Memproses teks menjadi suara...' });
    }

    // Siapkan fakta unik yang sudah diacak
    const shuffledFacts = shuffleFacts(FACTS_POOL);
    let factIndex = 0;

    // Mulai proses audio secara paralel
    const audioPromise = generateDracinTTS(text, voiceSpeed, useBg, bgVol);

    // Kirim fakta unik setiap 2.5 detik selama menunggu
    let factInterval = null;
    if (sendEvent) {
        factInterval = setInterval(() => {
            if (factIndex < shuffledFacts.length) {
                sendEvent('fact', { fact: shuffledFacts[factIndex] });
                factIndex++;
            }
        }, 2500);
    }

    try {
        const audioBuffer = await audioPromise;

        // Hentikan pengiriman fakta
        if (factInterval) {
            clearInterval(factInterval);
        }

        if (sendEvent) {
            sendEvent('status', { message: 'Mengupload audio...' });
        }

        const audioUrl = await uploadToTmp(audioBuffer, `dracin-${Date.now()}.mp3`);

        const result = {
            success: true,
            author: 'PuruBoy',
            result: {
                text: text,
                audio: origin + audioUrl
            }
        };

        if (sendEvent) {
            sendEvent('result', result);
        }

        return result;
    } catch (error) {
        if (factInterval) {
            clearInterval(factInterval);
        }
        throw error;
    }
};

module.exports = dracinController;
