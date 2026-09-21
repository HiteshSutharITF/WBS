import React, { forwardRef } from 'react';

/**
 * Standard Input Component complying with MERN SOP:
 * Displays error directly below field, renders red border on invalid state,
 * supports forwarded ref for auto-focus on submit validation failure.
 */
const Input = forwardRef(({ label, error, helperText, className = '', ...props }, ref) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label} {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        ref={ref}
        className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl shadow-xs transition-colors duration-150 outline-none
          ${
            error
              ? 'border-red-500 ring-2 ring-red-100 text-red-900 placeholder-red-300'
              : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900 placeholder-slate-400'
          } ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs font-medium text-red-500 mt-1 animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-xs text-slate-500 mt-1">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
