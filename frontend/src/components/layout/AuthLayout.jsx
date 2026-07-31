import React from 'react';
import SiteFooter from '../common/SiteFooter';

const AuthLayout = ({ children, title, subtitle, showHelpLink = true, showFooter = true }) => {
  return (
    <div className="min-h-screen bg-linear-to-br from-primary-50 via-white to-primary-50 flex flex-col">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="auth-card relative">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
            {subtitle ? <p className="text-gray-600 mt-2">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </div>
      {showFooter ? <SiteFooter showHelpLink={showHelpLink} /> : null}
    </div>
  );
};

export default AuthLayout;
