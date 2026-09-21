import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Modal Component complying with MERN SOP:
 * 1. Fixed Header
 * 2. Fixed Footer
 * 3. Only Content scrollable
 * 4. Responsive: Bottom sheet on mobile screens
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
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  }[size] || 'max-w-xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full ${sizeClasses} bg-white shadow-2xl flex flex-col max-h-[92vh] md:rounded-2xl overflow-hidden
          max-md:fixed max-md:bottom-0 max-md:rounded-t-2xl max-md:rounded-b-none max-md:max-h-[85vh]`}
        role="dialog"
      >
        {/* Fixed Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-slate-700">
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
