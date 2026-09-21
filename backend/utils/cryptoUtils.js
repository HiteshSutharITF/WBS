const crypto = require('crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Derive 32-byte key from config
function getKey() {
  const key = env.TOKEN_ENCRYPTION_KEY;
  if (Buffer.from(key, 'hex').length === 32) {
    return Buffer.from(key, 'hex');
  }
  return crypto.createHash('sha256').update(String(key)).digest();
}

/**
 * Encrypt a string using AES-256-GCM
 * @param {string} text 
 * @returns {string} iv:authTag:encryptedText (hex format)
 */
function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a string using AES-256-GCM
 * @param {string} encryptedData 
 * @returns {string} plaintext
 */
function decrypt(encryptedData) {
  if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return encryptedData;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[Crypto] Decryption error:', error.message);
    return null;
  }
}

module.exports = {
  encrypt,
  decrypt
};
