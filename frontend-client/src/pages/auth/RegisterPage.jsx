import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    businessName: '',
    name: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const businessNameRef = useRef(null);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const validate = () => {
    const errs = {};
    if (!formData.businessName || formData.businessName.trim().length < 2) {
      errs.businessName = 'Business name must be at least 2 characters.';
    }
    if (!formData.name || formData.name.trim().length < 2) {
      errs.name = 'Full name must be at least 2 characters.';
    }
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      errs.email = 'Please provide a valid business email address.';
    }
    if (!formData.password || formData.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }

    setErrors(errs);

    if (errs.businessName && businessNameRef.current) {
      businessNameRef.current.focus();
    } else if (errs.name && nameRef.current) {
      nameRef.current.focus();
    } else if (errs.email && emailRef.current) {
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
      await authService.register(formData);
      navigate('/');
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-emerald-500 items-center justify-center text-white font-bold text-2xl shadow-lg shadow-emerald-500/30 mb-4">
          W
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Create your Business Account</h2>
        <p className="mt-1 text-sm text-slate-400">Start using WBS on WhatsApp Cloud API v25.0</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
          {apiError && (
            <Alert type="error" message={apiError} className="mb-6" />
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              ref={businessNameRef}
              label="Business Name"
              placeholder="e.g. Apex Enterprises"
              value={formData.businessName}
              onChange={(e) => {
                setFormData({ ...formData, businessName: e.target.value });
                if (errors.businessName) setErrors({ ...errors, businessName: '' });
              }}
              error={errors.businessName}
              required
            />

            <Input
              ref={nameRef}
              label="Your Full Name"
              placeholder="e.g. John Doe"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              error={errors.name}
              required
            />

            <Input
              ref={emailRef}
              label="Business Email"
              type="email"
              placeholder="john@company.com"
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
              placeholder="At least 6 characters"
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
              Register Business
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
