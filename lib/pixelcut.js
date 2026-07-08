/**
 * Module untuk berinteraksi dengan API Pixelcut.
 * Menggunakan native fetch dan FormData Node.js.
 */

async function removeBackground(imageBuffer) {
    if (!Buffer.isBuffer(imageBuffer)) {
        throw new Error('Input harus berupa Buffer.');
    }

    const formData = new FormData();
    formData.append("format", "png");
    formData.append("model", "v1");
    
    const blob = new Blob([imageBuffer]);
    formData.append("image", blob);

    const response = await fetch("https://api2.pixelcut.app/image/matte/v1", {
        method: "POST",
        headers: {
            "x-client-version": "web",
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Pixelcut API Error ${response.status} ${response.statusText}: ${await response.text()}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

module.exports = { removeBackground };