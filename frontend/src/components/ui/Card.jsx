import React from 'react';
import { motion as Motion } from 'framer-motion';

const Card = ({ children, className = '', noPadding = false }) => {
  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`auth-card ${noPadding ? '' : 'p-8'} ${className}`}
    >
      {children}
    </Motion.div>
  );
};

export default Card;
