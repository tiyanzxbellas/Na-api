/**
 * @title Unlimited AI
 * @summary Unlimited AI Chat.
 * @description Berinteraksi dengan model AI Unlimited (Reasoning) yang mendukung streaming response. Endpoint ini menggunakan Server-Sent Events (SSE).
 * @method POST
 * @path /api/ai/unlimited
 * @response json
 * @param {string} body.message - Pesan yang ingin dikirim ke AI.
 * @example
 * async function chat() {
 *   const response = await fetch('/api/ai/unlimited', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ 
 *       "message": "Buatkan cerita pendek"
 *     })
 *   });
 * 
 *   const reader = response.body.getReader();
 *   const decoder = new TextDecoder();
 *   
 *   while (true) {
 *     const { done, value } = await reader.read();
 *     if (done) break;
 *     const text = decoder.decode(value);
 *     console.log(text);
 *   }
 * }
 */
const unlimitedController = async (req) => {
    // Dummy controller for documentation generation
    return { status: 'SSE Stream Endpoint' };
};

module.exports = unlimitedController;