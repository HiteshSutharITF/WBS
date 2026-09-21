import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const Alert = ({ type = 'info', title, message, className = '', children }) => {
  const styles = {
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      icon: CheckCircle2,
      iconColor: 'text-emerald-500'
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      icon: AlertTriangle,
      iconColor: 'text-amber-500'
    },
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-900',
      icon: AlertCircle,
      iconColor: 'text-rose-500'
    },
    info: {
      bg: 'bg-blue-50 border-blue-200 text-blue-900',
      icon: Info,
      iconColor: 'text-blue-500'
    }
  }[type] || {
    bg: 'bg-slate-50 border-slate-200 text-slate-900',
    icon: Info,
    iconColor: 'text-slate-500'
  };

  const Icon = styles.icon;

  return (
    <div className={`flex gap-3 p-4 border rounded-xl ${styles.bg} ${className}`}>
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${styles.iconColor}`} />
      <div className="flex-1 text-sm">
        {title && <h4 className="font-semibold mb-0.5">{title}</h4>}
        {message && <p>{message}</p>}
        {children}
      </div>
    </div>
  );
};

export default Alert;
