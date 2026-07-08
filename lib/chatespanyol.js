const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');

class ChatEspanyolBot {
    constructor() {
        this.baseUrl = 'https://chatespanolaigratis.com/en/';
        this.ajaxUrl = 'https://chatespanolaigratis.com/wp-admin/admin-ajax.php';
        
        // State untuk menyimpan konfigurasi
        this.config = {
            nonce: null,
            botId: null,
            postId: null
        };

        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://chatespanolaigratis.com/en/',
            'Origin': 'https://chatespanolaigratis.com',
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };
    }

    async refreshTokens() {
        try {
            const response = await axios.get(this.baseUrl, {
                headers: { 'User-Agent': this.headers['User-Agent'] }
            });

            const html = response.data;
            const $ = cheerio.load(html);
            const container = $('div[id^="aipkit_chat_container_"]');
            
            if (!container.length) throw new Error('Container chat tidak ditemukan.');

            const configString = container.attr('data-config');
            if (!configString) throw new Error('Atribut data-config kosong.');

            const parsedConfig = JSON.parse(configString);

            this.config.nonce = parsedConfig.nonce;
            this.config.botId = parsedConfig.botId;
            this.config.postId = parsedConfig.postId;

            return true;
        } catch (error) {
            console.error('ChatEspanyol Error:', error.message);
            throw error;
        }
    }

    async sendMessage(message, options = {}) {
        let { sessionId, conversationUuid, isRetry } = options;
        
        // Generate IDs jika tidak disediakan
        if (!sessionId) sessionId = uuidv4();
        if (!conversationUuid) conversationUuid = uuidv4();

        // Refresh token jika belum ada
        if (!this.config.nonce) {
            await this.refreshTokens();
        }

        const payload = new URLSearchParams();
        payload.append('action', 'aipkit_frontend_chat_message');
        payload.append('_ajax_nonce', this.config.nonce);
        payload.append('bot_id', this.config.botId);
        payload.append('post_id', this.config.postId);
        payload.append('message', message);
        payload.append('session_id', sessionId);
        payload.append('conversation_uuid', conversationUuid);

        try {
            const response = await axios.post(this.ajaxUrl, payload.toString(), {
                headers: this.headers
            });

            if (response.data === 0 || response.data.success === false) {
                 throw new Error('Invalid Token / WordPress Error');
            }

            const responseData = response.data;
            let rawResponse = '';

            // Perbaikan parsing berdasarkan struktur respons yang diterima:
            // { success: true, data: { reply: "...", message_id: "..." } }
            if (responseData.data && responseData.data.reply) {
                rawResponse = responseData.data.reply;
            } else if (responseData.data && responseData.data.response) {
                rawResponse = responseData.data.response;
            } else {
                // Fallback terakhir: jika string, gunakan langsung. Jika objek lain, stringify.
                rawResponse = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
            }

            const cleanResponse = rawResponse.replace(/<[^>]*>?/gm, '').trim();

            return {
                response: cleanResponse,
                sessionId,
                conversationUuid
            };

        } catch (error) {
            // Auto Retry logic jika token expired
            if (!isRetry) {
                await this.refreshTokens();
                return this.sendMessage(message, { ...options, isRetry: true });
            }
            throw error;
        }
    }
}

const bot = new ChatEspanyolBot();
module.exports = { bot };