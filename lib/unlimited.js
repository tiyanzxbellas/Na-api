const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const TARGET_URL = 'https://app.unlimitedai.chat/';
const ACTION_ID = '40713570958bf1accf30e8d3ddb17e7948e6c379fa'; // ID Fungsi Server
const CHAT_MODEL = 'chat-model-reasoning'; // Model default

function parseNextJsStream(chunk) {
    const lines = chunk.toString().split('\n');
    let cleanText = '';

    for (const line of lines) {
        if (line.includes('"diff":[0,')) {
            try {
                const jsonStartIndex = line.indexOf('{');
                if (jsonStartIndex !== -1) {
                    const jsonStr = line.substring(jsonStartIndex);
                    const data = JSON.parse(jsonStr);

                    if (data.diff && Array.isArray(data.diff) && data.diff[0] === 0) {
                        cleanText += data.diff[1];
                    }
                }
            } catch (e) {
                // Abaikan error parsing
            }
        }
    }
    return cleanText;
}

async function* chatStream(message) {
    const HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'text/plain;charset=UTF-8',
        'Next-Action': ACTION_ID,
        'Next-Router-State-Tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22(chat)%22%2C%7B%22children%22%3A%5B%22page%22%2C%7B%7D%5D%7D%5D%7D%2Cnull%2Cnull%2Ctrue%5D',
        'Origin': 'https://app.unlimitedai.chat',
        'Referer': 'https://app.unlimitedai.chat/',
    };

    const chatId = uuidv4();
    const messageId = uuidv4();
    const now = new Date();

    const messages = [
        {
            id: messageId,
            role: "user",
            content: message,
            parts: [{ type: "text", text: message }],
            createdAt: now
        }
    ];

    const payloadArg = {
        chatId: chatId,
        messages: messages,
        selectedChatModel: CHAT_MODEL,
        selectedCharacter: null,
        selectedStory: null,
        turnstileToken: undefined
    };

    const payload = JSON.stringify([payloadArg]);

    try {
        const response = await axios.post(TARGET_URL, payload, {
            headers: HEADERS,
            responseType: 'stream'
        });

        for await (const chunk of response.data) {
            const text = parseNextJsStream(chunk);
            if (text) yield text;
        }

    } catch (error) {
        throw new Error(error.response?.data ? 'API Unlimited Error' : error.message);
    }
}

module.exports = { chatStream };