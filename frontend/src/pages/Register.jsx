// src/pages/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { validateEmail, validateName, getPasswordStrength } from '../utils/validators';
import { PASSWORD_REQUIREMENTS } from '../utils/constants';
import { FaArrowLeft, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const Register = () => {
  const navigate = useNavigate();
  const { register, loading } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});

  const passwordStrength = getPasswordStrength(formData.password);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    const nameError = validateName(formData.name);
    if (nameError) newErrors.name = nameError;
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    const result = await register(formData);
    if (result.success) {
      navigate('/courses', { replace: true });
    }
  };

  const checkRequirement = (requirement) => {
    switch(requirement) {
      case 'At least 8 characters':
        return formData.password.length >= 8;
      case 'One uppercase letter':
        return /[A-Z]/.test(formData.password);
      case 'One lowercase letter':
        return /[a-z]/.test(formData.password);
      case 'One number':
        return /[0-9]/.test(formData.password);
      default:
        return false;
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Start your coding journey today"
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="your name"
          error={errors.name}
          required
        />

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

        <div>
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
          
          {formData.password && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Strength:</span>
                <span className={`font-medium`} style={{ color: passwordStrength.color.replace('bg-', 'text-') }}>
                  {passwordStrength.label}
                </span>
              </div>
              
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${passwordStrength.color} transition-all duration-300`}
                  style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                ></div>
              </div>
              
              <div className="space-y-1 mt-3">
                {PASSWORD_REQUIREMENTS.map((req) => (
                  <div key={req} className="flex items-center gap-2 text-sm">
                    {checkRequirement(req) ? (
                      <FaCheckCircle className="text-green-500" size={14} />
                    ) : (
                      <FaTimesCircle className="text-gray-300" size={14} />
                    )}
                    <span className={checkRequirement(req) ? 'text-gray-700' : 'text-gray-400'}>
                      {req}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Input
          label="Confirm Password"
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="••••••••"
          error={errors.confirmPassword}
          required
          showPasswordToggle
        />

        <Button 
          type="submit" 
          variant="primary" 
          fullWidth={true}
          loading={loading}
          disabled={loading}
        >
          Create Account
        </Button>

        <p className="text-center text-gray-600 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="link-primary font-medium">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Register;
