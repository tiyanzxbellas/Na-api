/**
 * @title Preview HTML Uploader
 * @summary Upload konten HTML ke puruboy-preview.freehosting.dev via JSON string.
 * @description Mengupload konten HTML (string) ke server preview dan mendapatkan link akses publik. Melakukan bypass AES-CBC JavaScript challenge, mengambil CSRF token, dan mengirim multipart form secara otomatis.
 * @method POST
 * @path /api/tools/preview-upload
 * @response json
 * @param {string} body.content - (Wajib) Konten HTML yang akan diupload, bisa berupa string HTML biasa
 * @param {string} body.filename - (Opsional) Nama file tanpa ekstensi .html (default: "preview")
 * @example
 * // Contoh penggunaan dengan JSON
 * const res = await fetch('/api/tools/preview-upload', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     content: '<h1>Halo Dunia</h1><p>Ini preview HTML</p>',
 *     filename: 'promo-hari-ini'
 *   })
 * });
 * 
 * const data = await res.json();
 * console.log(data);
 */
const { upload } = require('../../previewUpload');

const previewUploadController = async (req) => {
    const { content, filename } = req;
    
    if (!content) throw new Error('Parameter "content" (string HTML) wajib diisi.');
    
    const result = await upload(content, filename || 'preview');
    
    return {
        success: true,
        author: 'PuruBoy',
        result: {
            link: result.link,
            filename: result.filename,
            view: result.view
        }
    };
};

module.exports = previewUploadController;
