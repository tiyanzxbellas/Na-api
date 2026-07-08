/**
 * Error logger utility - reports errors to Telegram
 * 
 * Catches and reports errors from API endpoints.
 * Falls back silently if Telegram reporting fails.
 */

let botToken = null;
let chatId = null;

/**
 * Report error to Telegram channel
 * @param {Error} error - The error object
 * @param {object} context - Context info about where the error occurred
 */
async function reportError(error, context = {}) {
  try {
    const message = [
      '🚨 *Error Report*',
      `*Endpoint:* ${context.endpoint || 'Unknown'}`,
      `*Method:* ${context.method || 'Unknown'}`,
      `*Message:* ${error.message || 'Unknown error'}`,
      `*Stack:* \`\`\`${(error.stack || '').slice(0, 500)}\`\`\``,
      `*Time:* ${new Date().toISOString()}`
    ].join('\n');

    // Try to send to Telegram if configured
    if (botToken && chatId) {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      }).catch(() => {});
    }

    // Also log to console
    console.error(`[ERROR] ${context.endpoint || 'Unknown'}:`, error.message);
  } catch (e) {
    // Silent fallback
    console.error('Error reporter failed:', e.message);
  }
}

/**
 * Configure the error logger
 * @param {string} token - Telegram bot token
 * @param {string|number} id - Telegram chat ID
 */
function configure(token, id) {
  botToken = token;
  chatId = id;
}

module.exports = { reportError, configure };
