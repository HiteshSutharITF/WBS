import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import { MessageSquare, ShieldCheck, RefreshCw, ArrowRight } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ssoToken =
    searchParams.get('sso_token') ||
    new URLSearchParams(window.location.search).get('sso_token') ||
    (window.location.hash.includes('?') ? new URLSearchParams(window.location.hash.split('?')[1]).get('sso_token') : null);

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSsoAuthenticating, setIsSsoAuthenticating] = useState(!!ssoToken);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Single-Sign-On Impersonation handler from Super Admin Console
  useEffect(() => {
    if (ssoToken) {
      setIsSsoAuthenticating(true);
      authService
        .handleSsoToken(ssoToken)
        .then(() => {
          navigate('/', { replace: true });
        })
        .catch((err) => {
          setApiError('Single-Sign-On session invalid or expired: ' + (err.response?.data?.message || err.message));
          setIsSsoAuthenticating(false);
        });
    }
  }, [ssoToken, navigate]);

  const validate = () => {
    const errs = {};
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!formData.password) {
      errs.password = 'Password is required.';
    }
    setErrors(errs);

    if (errs.email && emailRef.current) {
      emailRef.current.focus();
    } else if (errs.password && passwordRef.current) {
      passwordRef.current.focus();
    }

    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validate()) return;

    setIsLoading(true);
    try {
      const response = await authService.login(formData);
      const user = response.data?.user;
      if (user?.role === 'super_admin' || user?.role === 'support') {
        localStorage.setItem('wbs_admin_token', response.data.token);
        localStorage.setItem('wbs_admin_user', JSON.stringify(user));
        window.location.href = '/admin/#/';
        return;
      } else {
        navigate('/');
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = (type) => {
    if (type === 'admin') {
      setFormData({ email: 'admin@acmeretail.com', password: 'Admin@123' });
    } else if (type === 'agent') {
      setFormData({ email: 'agent@acmeretail.com', password: 'Agent@123' });
    } else if (type === 'superadmin') {
      setFormData({ email: 'superadmin@itfuturz.com', password: 'SuperAdmin@123' });
    }
    setErrors({});
  };

  if (isSsoAuthenticating) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center py-12 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30 animate-pulse">
          <RefreshCw className="w-7 h-7 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-white">Authenticating Single-Sign-On Session...</h2>
        <p className="text-sm text-slate-400 mt-1">Connecting to client portal from Super Admin Console.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-emerald-500 items-center justify-center text-white font-bold text-2xl shadow-lg shadow-emerald-500/30 mb-4">
          W
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Sign in to WBS Platform</h2>
        <p className="mt-1 text-sm text-slate-400">Official WhatsApp Business Solution</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
          {apiError && (
            <Alert type="error" message={apiError} className="mb-6" />
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              ref={emailRef}
              label="Email Address"
              type="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              error={errors.email}
              required
            />

            <Input
              ref={passwordRef}
              label="Password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value });
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              error={errors.password}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Logins (Development only) */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
                Quick Demo Accounts (Dev Only)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleFillDemo('admin')}
                  className="px-2 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors truncate"
                >
                  Client Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleFillDemo('agent')}
                  className="px-2 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors truncate"
                >
                  Client Agent
                </button>
                <button
                  type="button"
                  onClick={() => handleFillDemo('superadmin')}
                  className="px-2 py-1.5 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors truncate"
                >
                  Super Admin
                </button>
              </div>
            </div>
          )}

          {/* Registration Notice per user requirement (no direct public register) */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Client accounts are provisioned by ITFuturz Administrator.</span>
            </div>
            <div className="mt-3">
              <a
                href="/admin/#/login"
                className="text-xs text-slate-500 hover:text-emerald-600 transition-colors inline-flex items-center gap-1 font-medium"
              >
                <span>Staff & Administrator Portal</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
