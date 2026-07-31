import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import api from '../services/api';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token: tokenFromParams } = useParams();

  const token = useMemo(() => {
    if (tokenFromParams) return tokenFromParams;
    const queryParams = new URLSearchParams(location.search);
    const queryToken =
      queryParams.get('token') ||
      queryParams.get('resetToken') ||
      queryParams.get('t') ||
      '';

    if (queryToken) return queryToken;

    const hash = location.hash?.startsWith('#') ? location.hash.slice(1) : '';
    if (!hash) return '';

    const hashParams = new URLSearchParams(hash);
    return (
      hashParams.get('token') ||
      hashParams.get('resetToken') ||
      hashParams.get('t') ||
      ''
    );
  }, [location.hash, location.search, tokenFromParams]);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    const nextErrors = {};

    if (!token) {
      nextErrors.token = 'Missing reset token. Please use the link from your email.';
    }

    if (!formData.password) {
      nextErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const password = formData.password;

      const routeNotFound = (err) => {
        const status = err?.response?.status;
        const msg = err?.response?.data?.message || '';
        if (status !== 404) return false;
        return /route .* not found/i.test(msg) || /cannot (post|put|patch)/i.test(msg) || msg.includes('/api/');
      };

      const tryRequest = async (config) => {
        const response = await api.request({ timeout: 5000, ...config });
        const data = response?.data ?? {};
        if (data?.success === false) {
          throw new Error(data?.message || 'Failed to reset password');
        }
        return data;
      };

      const attempts = [
        { method: 'post', url: '/auth/reset-password', data: { token, password } },
        { method: 'post', url: `/auth/reset-password/${token}`, data: { password } },
        { method: 'put', url: `/auth/reset-password/${token}`, data: { password } },
        { method: 'patch', url: `/auth/reset-password/${token}`, data: { password } },
      ];

      let data = null;
      let lastErr = null;

      for (const attempt of attempts) {
        try {
          data = await tryRequest(attempt);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (routeNotFound(err)) {
            // Try the next possible endpoint shape
            continue;
          }
          throw err;
        }
      }

      if (!data) {
        const fallback =
          'Password reset endpoint was not found. Ask your backend teammate for the correct route/method.';
        throw new Error(import.meta.env.DEV ? (lastErr?.response?.data?.message || fallback) : fallback);
      }

      toast.success(data?.message || 'Password reset successfully. Please login.');
      navigate('/login', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message ||
        err?.message ||
        (status ? `Request failed with status code ${status}` : 'Failed to reset password');

      toast.error(message, {
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="Choose a new password for your account">
      {errors.token ? (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">{errors.token}</p>
          </div>
          <Link to="/forgot-password" className="link-primary block text-center">
            Request a new reset link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="New Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            error={errors.password}
            required
            disabled={submitting}
            showPasswordToggle
          />

          <Input
            label="Confirm New Password"
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="••••••••"
            error={errors.confirmPassword}
            required
            disabled={submitting}
            showPasswordToggle
          />

          <Button type="submit" variant="primary" fullWidth={true} loading={submitting}>
            Reset password
          </Button>

          <p className="text-center text-gray-600 text-sm">
            <Link to="/login" className="link-primary">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
};

export default ResetPassword;
