import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const Alert = ({ type = 'info', title, message, className = '' }) => {
  const styles = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    error: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-300'
  }[type] || 'bg-slate-800 border-slate-700 text-slate-300';

  const icons = {
    success: CheckCircle2,
    warning: AlertTriangle,
    error: AlertCircle,
    info: Info
  }[type] || Info;

  const Icon = icons;

  return (
    <div className={`flex gap-3 p-4 border rounded-xl ${styles} ${className}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="text-xs">
        {title && <h4 className="font-bold mb-0.5">{title}</h4>}
        {message && <p>{message}</p>}
      </div>
    </div>
  );
};

export default Alert;
