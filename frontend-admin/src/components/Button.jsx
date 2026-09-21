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
    primary: 'bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 active:bg-amber-600',
    secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700 active:bg-slate-600',
    danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
    outline: 'border border-slate-700 text-slate-300 bg-slate-900 hover:bg-slate-800'
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
