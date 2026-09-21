import React from 'react';
import { Loader2 } from 'lucide-react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  type = 'button',
  icon: Icon,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 outline-none select-none disabled:opacity-60 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs focus:ring-2 focus:ring-blue-500/20 active:bg-blue-800',
    whatsapp: 'bg-[#25D366] text-white hover:bg-[#20bd5a] shadow-xs focus:ring-2 focus:ring-emerald-500/20 active:bg-[#1caa51]',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500/20 active:bg-red-800',
    outline: 'border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100'
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5'
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children}
    </button>
  );
};

export default Button;
