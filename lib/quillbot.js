const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar, Cookie } = require('tough-cookie');
const { v4: uuidv4 } = require('uuid');

const generateFakeDeviceId = () => uuidv4();
const generateFakeAnonId = () => Math.random().toString(16).substring(2, 18);

async function* chatStream(promptText) {
    const jar = new CookieJar();
    const client = wrapper(axios.create({ 
        jar, 
        withCredentials: true,
        baseURL: 'https://quillbot.com',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'platform-type': 'webapp',
            'webapp-version': '40.75.2',
            'qb-product': 'AI-CHAT'
        }
    }));

    try {
        const deviceId = generateFakeDeviceId();
        const anonId = generateFakeAnonId();

        const commonOptions = { domain: 'quillbot.com', path: '/' };
        await jar.setCookie(new Cookie({ key: 'qbDeviceId', value: deviceId, ...commonOptions }), 'https://quillbot.com');
        await jar.setCookie(new Cookie({ key: 'anonID', value: anonId, ...commonOptions }), 'https://quillbot.com');
        await jar.setCookie(new Cookie({ key: 'ajs_anonymous_id', value: deviceId, ...commonOptions }), 'https://quillbot.com');

        await client.get('/ai-chat');
        const spamCheck = await client.get('/api/auth/spam-check');

        if (spamCheck.data.status !== 200) {
            throw new Error("Spam check rejected by provider.");
        }

        const conversationId = uuidv4();

        const response = await client.post(`/api/ai-chat/chat/conversation/${conversationId}`, {
            message: {
                content: promptText,
                files: []
            },
            context: {},
            tools: {
                web_search_builtin: {}
            },
            origin: {
                name: "ai-chat.chat",
                url: "https://quillbot.com"
            }
        }, {
            responseType: 'stream',
            headers: {
                'Accept': 'text/event-stream',
                'useridtoken': 'empty-token'
            }
        });

        for await (const chunk of response.data) {
            const dataString = chunk.toString();
            const lines = dataString.split('\n');

            for (const line of lines) {
                if (line.trim() && line.startsWith('{')) {
                    try {
                        const json = JSON.parse(line);
                        if (json.type === 'content') {
                            yield json.content;
                        }
                    } catch (e) {
                        // Ignore parse errors for fragments
                    }
                }
            }
        }
    } catch (error) {
        throw new Error(error.message);
    }
}

module.exports = { chatStream };