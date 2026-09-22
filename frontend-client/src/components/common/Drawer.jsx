import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Slide-over Drawer Component complying with enterprise UI standards:
 * - Slides in from the right edge with smooth transitions
 * - Fixed Header with title, subtitle, and badge
 * - Fixed Footer for primary form actions
 * - Content scrollable with background styling
 * - Body scroll lock on open
 * - Escape key to close
 * - Responsive sizing up to extra-wide 2xl / 3xl for side-by-side editing & previews
 */
const Drawer = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
  size = '2xl'
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    '3xl': 'max-w-6xl',
    full: 'max-w-full'
  }[size] || 'max-w-5xl';

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Full-screen Backdrop overlay covering topbar and sidebar */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 z-10">
        <div
          className={`w-screen ${sizeClasses} bg-white shadow-2xl flex flex-col h-full overflow-hidden border-l border-slate-200 transform transition-all duration-300 ease-in-out`}
          role="dialog"
          aria-modal="true"
        >
          {/* Fixed Drawer Header */}
          <div className="shrink-0 px-6 py-4.5 border-b border-slate-200 bg-white flex items-center justify-between z-10 shadow-2xs">
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 truncate">{title}</h2>
                {badge}
              </div>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
              title="Close drawer (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 text-slate-700 bg-slate-50/40">
            {children}
          </div>

          {/* Fixed Footer */}
          {footer && (
            <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-white z-10 shadow-2xs">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Drawer;
