import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import api from '../services/api';
import { validateEmail } from '../utils/validators';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim();
    let successToastMessage = "If an account exists for that email, you'll receive a password reset link shortly.";

    if (!trimmedEmail) {
      setError('Email is required');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const response = await api.post('/auth/forgot-password', { email: trimmedEmail }, { timeout: 60000 });
      const data = response?.data ?? {};

      if (data?.success === false) {
        throw new Error(data?.message || 'Request failed');
      }
    } catch (err) {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message ||
        err?.message ||
        (status ? `Request failed with status code ${status}` : 'Request failed');

      const isTimeout = err?.code === 'ECONNABORTED' || /timeout/i.test(String(message));
      if (isTimeout) {
        successToastMessage =
          "Request is taking longer than expected. If an account exists for that email, you'll still receive a reset link shortly.";
        if (import.meta.env.DEV) {
          console.warn('Forgot password request timed out (continuing):', err);
        }
      } else {
      const fallbackMessage = 'Could not request a reset link. Please try again.';
      const displayMessage = import.meta.env.DEV ? (message || fallbackMessage) : fallbackMessage;

      setError(displayMessage);
      toast.error(displayMessage);
      setSubmitting(false);
      return;
      }
    }

    toast.success(successToastMessage);
    setSubmittedEmail(trimmedEmail);
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <AuthLayout title="Forgot password?" subtitle="Enter your email and we'll send a reset link">
      {submitted ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 text-sm">
              If an account exists for <span className="font-semibold">{submittedEmail}</span>, a reset link has been sent.
            </p>
            <p className="text-green-800 text-sm mt-2">
              If you don’t receive it within a few minutes, check your spam/junk folder or try again.
            </p>
          </div>

          <Link to="/login" className="link-primary block text-center">
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email Address"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            error={error}
            required
            disabled={submitting}
          />

          <Button type="submit" variant="primary" fullWidth={true} loading={submitting}>
            Send reset link
          </Button>

          <p className="text-center text-gray-600 text-sm">
            Remember your password?{' '}
            <Link to="/login" className="link-primary">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
