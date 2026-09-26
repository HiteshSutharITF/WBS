import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Full-screen WhatsApp-style image preview.
 */
const ImageLightbox = ({ src, alt = '', onClose }) => {
  useEffect(() => {
    if (!src) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [src, onClose]);

  if (!src) return null;

  return createPortal(
    <div className="wa-lightbox" role="dialog" aria-modal="true" aria-label="Image preview">
      <button type="button" className="wa-lightbox-backdrop" onClick={onClose} aria-label="Close preview" />
      <div className="wa-lightbox-top">
        <button type="button" className="wa-lightbox-close" onClick={onClose} aria-label="Close">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="wa-lightbox-stage">
        <img src={src} alt={alt} className="wa-lightbox-img" />
      </div>
    </div>,
    document.body
  );
};

export default ImageLightbox;
