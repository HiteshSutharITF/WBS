import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Slide-over Drawer Component complying with enterprise UI standards:
 * - Slides in smoothly from the right edge with enter/exit transition animations
 * - Portaled to document.body so it covers the entire viewport (topbar, sidebar, main)
 * - Fixed Header with icon, title, subtitle, and Meta badge
 * - Fixed Footer for primary form actions
 * - Content scrollable with clean slate background
 * - Body scroll lock on open
 * - Escape key & click-outside to close
 * - Responsive sizing (sm, md, lg, xl, 2xl, 3xl, full)
 */
const Drawer = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  icon: Icon,
  children,
  footer,
  size = '2xl'
}) => {
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timer;

    if (isOpen) {
      setIsRendered(true);
      // Small timeout ensures initial render with off-screen/transparent classes completes
      // before triggering the smooth slide-in and fade-in transition
      timer = setTimeout(() => {
        setIsVisible(true);
      }, 25);
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      // Wait for exit slide animation (300ms) before unmounting from DOM
      timer = setTimeout(() => {
        setIsRendered(false);
        document.body.style.overflow = '';
      }, 300);
    }

    return () => {
      if (timer) clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isRendered) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    '3xl': 'max-w-6xl',
    '4xl': 'max-w-7xl',
    full: 'max-w-full'
  }[size] || 'max-w-5xl';

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Full-screen Backdrop overlay covering topbar and sidebar */}
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 z-10 pointer-events-none">
        <div
          className={`w-screen ${sizeClasses} bg-white shadow-2xl flex flex-col h-full overflow-hidden border-l border-slate-200 pointer-events-auto transform transition-transform duration-300 ${
            isVisible ? 'translate-x-0 ease-out' : 'translate-x-full ease-in'
          }`}
          role="dialog"
          aria-modal="true"
        >
          {/* Fixed Drawer Header */}
          <div className="shrink-0 px-6 py-4 md:py-5 border-b border-slate-200 bg-white z-20 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              {/* Title, Badge & Subtitle */}
              <div className="flex items-center gap-3.5 min-w-0">
                {Icon && (
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0 shadow-sm">
                    <Icon className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 leading-tight">
                      {title}
                    </h2>
                    {badge && (
                      <div className="shrink-0 inline-flex items-center">
                        {badge}
                      </div>
                    )}
                  </div>
                  {subtitle && (
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-normal">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="group p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  title="Close drawer (Esc)"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 text-slate-700 bg-slate-50/40">
            {children}
          </div>

          {/* Fixed Footer */}
          {footer && (
            <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-white z-20 shadow-sm">
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
