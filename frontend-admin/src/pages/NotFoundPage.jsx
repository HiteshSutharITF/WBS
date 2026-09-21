import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Button from '../components/Button';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
      <div className="max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <h2 className="text-lg font-semibold text-slate-200 mb-2">Admin Page Not Found</h2>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          The requested administration endpoint or view does not exist.
        </p>
        <Link to="/">
          <Button variant="primary" icon={ArrowLeft} className="w-full">
            Back to Overview
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
