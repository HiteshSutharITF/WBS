import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, Mail, ArrowLeft } from 'lucide-react';
import { authService } from '../services/authService';
import Input from '../components/Input';
import Button from '../components/Button';
import Alert from '../components/Alert';

const LoginPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: 'superadmin@itfuturz.com', password: 'SuperAdmin@123' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const validate = () => {
    const errs = {};
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      errs.email = 'Valid staff email is required.';
    }
    if (!formData.password) {
      errs.password = 'Staff password is required.';
    }
    setErrors(errs);

    if (errs.email && emailRef.current) emailRef.current.focus();
    else if (errs.password && passwordRef.current) passwordRef.current.focus();

    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await authService.login(formData);
      navigate('/');
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-amber-500 items-center justify-center text-slate-950 font-bold text-2xl shadow-lg shadow-amber-500/20 mb-4">
          SA
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Super Admin Console</h2>
        <p className="mt-1 text-xs text-amber-400 font-mono uppercase tracking-wider">ITFuturz Operations Portal</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-900 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-800">
          {apiError && <Alert type="error" message={apiError} className="mb-6" />}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              ref={emailRef}
              label="Staff Email Address"
              type="email"
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
              label="Staff Password"
              type="password"
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
              isLoading={loading}
            >
              Sign In to Console
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center space-y-3">
            <p className="text-xs text-slate-500">
              Authorized ITFuturz Super Admin & Support personnel only. All access is logged to the tamper-proof audit trail (SA-09).
            </p>
            <div>
              <a
                href="/#/"
                className="text-xs text-slate-400 hover:text-amber-400 transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Client Business Portal</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
