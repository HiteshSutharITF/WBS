import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Super Admin Modal Component complying with MERN SOP:
 * 1. Fixed Header
 * 2. Fixed Footer
 * 3. Only Content scrollable
 * 4. Responsive: Bottom sheet on mobile screens
 * 5. Dark slate theme
 */
const Modal = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size] || 'max-w-xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full ${sizeClasses} bg-slate-950 border border-slate-800 shadow-2xl flex flex-col max-h-[92vh] sm:rounded-2xl overflow-hidden
          max-sm:fixed max-sm:bottom-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:max-h-[85vh]`}
        role="dialog"
      >
        {/* Fixed Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-slate-300">
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
