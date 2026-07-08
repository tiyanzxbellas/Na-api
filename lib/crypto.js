const crypto = require('crypto');

// Kunci enkripsi statis (32 bytes)
const SECRET = 'x82m#9c!1zLp@q3r5t7v8w9y0u1i2o3p'; 
const ALGORITHM = 'aes-256-cbc';

function encrypt(text) {
    if (!text) return null;
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        // Format: IV:EncryptedData (Hex) agar URL friendly
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
        console.error("Encryption error:", e);
        return null;
    }
}

function decrypt(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        if (textParts.length !== 2) return null;
        
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        // console.error("Decryption error:", e);
        return null;
    }
}

module.exports = { encrypt, decrypt };