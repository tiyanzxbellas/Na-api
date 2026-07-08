/**
 * Kumpulan fakta unik random untuk ditampilkan selama proses SSE.
 * Fakta-fakta ini di-shuffle dan dikirim secara periodik.
 */

const FACTS = [
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
    "Labirin paling rumit di dunia dirancang untuk menguji kecerdasan tikus, bukan manusia.",
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
    "Jalan raya terpanjang di dunia adalah Pan-American Highway yang membentang sepanjang 30.000 km dari Alaska ke Argentina.",
    "Ada lebih banyak pohon di bumi daripada bintang di Bima Sakti. Jumlah pohon diperkirakan 3 triliun.",
    "Pada tahun 1912, seorang penjahit bernama James Dockery menjahit pakaian untuk tikus dan mendapat penghasilan tetap.",
    "Suara yang kita dengar saat menyentuh cangkang ke telinga bukanlah suara laut, melainkan resonansi dari lingkungan sekitar.",
    "Kupu-kupu bisa melihat warna ultraviolet yang tidak bisa dilihat manusia, membantu mereka menemukan nektar.",
    "Leher jerapah memiliki panjang yang sama dengan leher manusia yang ditumpuk 6 kali, tapi hanya memiliki 7 ruas tulang leher.",
    "Air laut berwarna biru karena molekul air menyerap cahaya merah dan memantulkan cahaya biru.",
    "Hampir semua yang kita beli di toko dikirim dengan kapal kargo. Sekitar 90% perdagangan dunia menggunakan kapal.",
    "Di Korea Selatan, ada aturan khusus yang disebut 'Cinderella Law' yang melarang anak di bawah 16 tahun bermain game online setelah tengah malam."
];

/**
 * Mengambil sejumlah fakta secara acak dari koleksi
 * @param {number} [count=1] - Jumlah fakta yang diambil
 * @returns {string[]} Array fakta acak
 */
function getRandomFacts(count = 1) {
    const shuffled = [...FACTS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * Mengacak urutan array fakta
 * @param {string[]} facts - Array fakta yang akan diacak
 * @returns {string[]} Array fakta yang sudah diacak
 */
function shuffleFacts(facts) {
    const arr = [...facts];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

module.exports = { FACTS, getRandomFacts, shuffleFacts };
