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
  if (!signatureHeader || !appSecret) {
    // In dev or test mock mode without secret, allow bypass if enabled
    if (env.ENABLE_MOCK_FALLBACK) return true;
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedSignature = parts[1];
  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(rawBody);
  const calculatedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'utf8'),
    Buffer.from(calculatedSignature, 'utf8')
  );
}

module.exports = {
  verifyWebhookSignature
};
