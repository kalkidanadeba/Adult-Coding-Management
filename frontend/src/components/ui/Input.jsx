// src/components/ui/Input.jsx
import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const Input = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false,
  showPasswordToggle = false,
  className = '',
  ...props // This will capture any other valid input props
}) => {
  // Internal state for password visibility
  const [showPassword, setShowPassword] = useState(false);
  
  // Determine the actual input type
  const inputType = showPasswordToggle && showPassword ? 'text' : type;

  // Handle password toggle
  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={name} className="input-label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          id={name}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`input-field ${error ? 'border-red-500 focus:ring-red-200' : ''} ${className}`}
          {...props}
        />
        
        {/* Password toggle button*/}
        {showPasswordToggle && (
          <button
            type="button"
            onClick={togglePassword}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-primary-600 transition-colors focus:outline-none"
            tabIndex="-1"
          >
            {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
          </button>
        )}
      </div>
      {error && <p className="input-error">{error}</p>}
    </div>
  );
};

export default Input;