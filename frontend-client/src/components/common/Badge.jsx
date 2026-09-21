import React from 'react';

const Badge = ({ children, variant = 'gray', size = 'sm', className = '' }) => {
  const variants = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    yellow: 'bg-amber-50 text-amber-700 border-amber-200/60',
    red: 'bg-rose-50 text-rose-700 border-rose-200/60',
    blue: 'bg-blue-50 text-blue-700 border-blue-200/60',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/60',
    gray: 'bg-slate-100 text-slate-700 border-slate-200/60',
  };

  const sizes = {
    xs: 'text-[11px] px-1.5 py-0.5',
    sm: 'text-xs px-2.5 py-0.5',
    md: 'text-sm px-3 py-1'
  };

  return (
    <span className={`inline-flex items-center font-medium border rounded-full ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
