const fs = require('fs');
const path = require('path');
const env = require('../config/env');

/**
 * Meta template sample handles look like "4:...." — they are NOT public URLs
 * and must never be sent as image/video/document.link when messaging.
 */
const isMetaMediaHandle = (value) => {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (trimmed.startsWith('/uploads') || trimmed.startsWith('uploads/') || trimmed.startsWith('uploads\\')) {
    return false;
  }
  // Resumable upload handles (e.g. "4:abc..." or "2:c2FtcGxl...")
  return /^\d+:/.test(trimmed) || trimmed.startsWith('mock_handle');
};

/**
 * WhatsApp/Meta CDN sample URLs (scontent.whatsapp.net, lookaside.fbsbx.com, etc.)
 * appear after template approval in example.header_handle. Meta may ACCEPT a send
 * that uses them as image.link, then FAIL delivery — orange failed icon in inbox.
 * They must never be used as sendable media links.
 */
const isMetaHostedSampleUrl = (value) => {
  if (!value || typeof value !== 'string') return false;
  try {
    const host = new URL(value.trim()).hostname.toLowerCase();
    return (
      host.includes('whatsapp.net') ||
      host.includes('fbcdn.net') ||
      host.includes('facebook.com') ||
      host.includes('fbsbx.com') ||
      host.includes('cdninstagram.com')
    );
  } catch {
    return false;
  }
};

const isPublicHttpUrl = (value) =>
  typeof value === 'string' && /^https?:\/\//i.test(value.trim());

const isLocalUploadPath = (value) => {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim().replace(/\\/g, '/');
  return trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/');
};

/**
 * Only accept values Meta can fetch (public https URL on YOUR host) or local
 * upload paths we can re-upload as media id. Reject handles + Meta CDN samples.
 */
const sanitizeMediaReference = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || isMetaMediaHandle(trimmed)) return null;
  if (isMetaHostedSampleUrl(trimmed)) return null;
  if (isLocalUploadPath(trimmed)) return trimmed;
  // Only HTTPS for remote links (Meta rejects http / localhost)
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  return null;
};

const toAbsolutePublicUrl = (mediaRef) => {
  if (!mediaRef) return null;
  if (isPublicHttpUrl(mediaRef)) return mediaRef;
  if (isLocalUploadPath(mediaRef)) {
    const cleanPath = mediaRef.startsWith('/') ? mediaRef : `/${mediaRef}`;
    return `${env.LIVE_URL}${cleanPath}`;
  }
  return null;
};

/**
 * If mediaRef is our LIVE_URL pointing at /uploads/..., map back to disk path.
 */
const resolveLocalFilePath = (mediaRef) => {
  if (!mediaRef || typeof mediaRef !== 'string') return null;

  let candidate = mediaRef.trim().replace(/\\/g, '/');

  if (isPublicHttpUrl(candidate) && env.LIVE_URL && candidate.startsWith(env.LIVE_URL)) {
    candidate = candidate.slice(env.LIVE_URL.length) || '';
  }

  if (!isLocalUploadPath(candidate)) return null;

  const relative = candidate.replace(/^\/+/, '');
  const absolute = path.join(__dirname, '..', relative);
  if (!fs.existsSync(absolute)) return null;
  return absolute;
};

const guessMimeType = (filePath, headerFormat = 'IMAGE') => {
  const ext = path.extname(filePath || '').toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.3gp': 'video/3gpp'
  };
  if (map[ext]) return map[ext];
  if (headerFormat === 'DOCUMENT') return 'application/pdf';
  if (headerFormat === 'VIDEO') return 'video/mp4';
  return 'image/jpeg';
};

const countBodyPlaceholders = (bodyText = '') => {
  const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
  if (matches.length === 0) return 0;
  const nums = matches.map((m) => parseInt(m.replace(/\D/g, ''), 10)).filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) : 0;
};

module.exports = {
  isMetaMediaHandle,
  isMetaHostedSampleUrl,
  isPublicHttpUrl,
  isLocalUploadPath,
  sanitizeMediaReference,
  toAbsolutePublicUrl,
  resolveLocalFilePath,
  guessMimeType,
  countBodyPlaceholders
};
