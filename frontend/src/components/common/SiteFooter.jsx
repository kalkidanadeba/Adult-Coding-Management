import React from 'react';
import manual from '../../assets/Keradion_User_Manual.pdf';

const SiteFooter = ({ showHelpLink = true, className = '' }) => {
  const footerClassName = ['mt-auto w-full shrink-0 border-t border-gray-200 bg-white py-10', className]
    .filter(Boolean)
    .join(' ');

  return (
    <footer className={footerClassName}>
      <div
        className={`mx-auto flex max-w-4xl items-center gap-3 px-4 text-center ${
          showHelpLink ? 'flex-col justify-between sm:flex-row sm:text-left' : 'justify-center'
        }`}
      >
        <p className="text-gray-600 text-sm">Copyright {new Date().getFullYear()} Keradion. All rights reserved.</p>
        {showHelpLink ? (
          <a href={manual} className="text-gray-600 transition-colors hover:text-primary-600" target="_blank" rel="noopener noreferrer">
            Help
          </a>
        ) : null}
      </div>
    </footer>
  );
};

export default SiteFooter;
