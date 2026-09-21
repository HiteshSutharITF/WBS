import React, { forwardRef } from 'react';

const Input = forwardRef(({ label, error, helperText, className = '', ...props }, ref) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          {label} {props.required && <span className="text-amber-400">*</span>}
        </label>
      )}
      <input
        ref={ref}
        className={`w-full px-3.5 py-2.5 text-sm bg-slate-900 border rounded-xl shadow-xs transition-colors duration-150 outline-none
          ${
            error
              ? 'border-red-500 ring-2 ring-red-500/20 text-red-200 placeholder-red-400/50'
              : 'border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 text-white placeholder-slate-500'
          } ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs font-medium text-red-400 mt-1">
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
