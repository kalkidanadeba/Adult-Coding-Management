import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { validateEmail } from '../utils/validators';
import { FaArrowLeft } from 'react-icons/fa';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [rememberMe, setRememberMe] = useState(false);

  const from = location.state?.from?.pathname || null;
  const sessionExpired = new URLSearchParams(location.search).get('session') === 'expired';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    const result = await login(formData, { rememberMe });
    if (result.success) {
      // Get role from the response data (not just user object)
      const responseUser = result?.data?.user || result?.data?.data?.user;
      const loggedInRole = String(responseUser?.role || '').toLowerCase();
      
      const target = from || (loggedInRole === 'admin' || loggedInRole === 'instructor' ? '/admin' : '/courses');
      navigate(target, { replace: true });
    }
  };

  return (
    <AuthLayout
      title="Welcome Back!"
      subtitle="Sign in to continue your learning journey"
      showHelpLink={false}
      showFooter={false}
    >
      <Link
        to="/"
        aria-label="Back to home"
        title="Back to home"
        className="absolute top-6 left-6 p-2 rounded-lg text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-colors"
      >
        <FaArrowLeft size={18} aria-hidden="true" />
      </Link>

      {sessionExpired && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded">
          <p className="text-yellow-700">Your session has expired. Please login again.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email Address"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@example.com"
          error={errors.email}
          required
        />

        <Input
          label="Password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="••••••••"
          error={errors.password}
          required
          showPasswordToggle
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-300"
            />
            <span className="text-sm text-gray-600">Remember me</span>
          </label>

          <Link to="/forgot-password" className="link-primary text-sm">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="primary" fullWidth={true} loading={loading}>
          Sign In
        </Button>

        <p className="text-center text-gray-600 text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="link-primary">
            Sign up for free
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Login;
