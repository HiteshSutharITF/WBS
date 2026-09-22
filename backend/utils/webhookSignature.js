const crypto = require('crypto');
const env = require('../config/env');

/**
 * Verify Meta's X-Hub-Signature-256
 * @param {Buffer|string} rawBody 
 * @param {string} signatureHeader e.g. "sha256=abcdef..."
 * @param {string} appSecret 
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signatureHeader, appSecret = env.META_APP_SECRET) {
  try {
    if (!signatureHeader || !appSecret || !rawBody) {
      if (env.ENABLE_MOCK_FALLBACK) return true;
      return false;
    }

    const cleanSecret = String(appSecret).trim();
    const parts = signatureHeader.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      return false;
    }

    const expectedSignature = parts[1];
    const hmac = crypto.createHmac('sha256', cleanSecret);
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const calculatedBuf = Buffer.from(calculatedSignature, 'utf8');

    if (expectedBuf.length !== calculatedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, calculatedBuf);
  } catch (err) {
    console.error('[Webhook] Signature verification error:', err.message);
    return false;
  }
}

module.exports = {
  verifyWebhookSignature
};
