export const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const getMediaUrl = (relativePath) => {
  if (!relativePath) return '';
  // Meta header handles are not viewable URLs
  if (/^\d+:/.test(String(relativePath).trim()) && !String(relativePath).includes('/')) {
    return '';
  }
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
  return backendUrl ? `${backendUrl}/${cleanPath}` : `/${cleanPath}`;
};

const isMetaHostedSampleUrl = (value) => {
  try {
    const host = new URL(String(value).trim()).hostname.toLowerCase();
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

/** True only for values Meta can use when sending (not header_handle / WhatsApp CDN samples). */
export const isUsableMediaRef = (value) => {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isMetaHostedSampleUrl(trimmed)) return false;
  if (/^https:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith('/uploads') || trimmed.startsWith('uploads/')) return true;
  return false;
};
