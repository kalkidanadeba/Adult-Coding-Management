// src/components/common/Navbar.jsx
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  FaBars,
  FaBookOpen,
  FaChevronDown,
  FaClipboardList,
  FaListUl,
  FaShieldAlt,
  FaSignOutAlt,
  FaTachometerAlt,
  FaTimes,
  FaTrophy,
  FaUser,
  FaUsers,
  FaVideo,
} from 'react-icons/fa';
import keradionLogo from '../../assets/keradion-logo.png';
import { resolveUserAvatarUrl } from '../../utils/profile';

const ADMIN_ITEMS = [
  { to: '/admin', label: 'Dashboard', Icon: FaTachometerAlt },
  { to: '/admin/courses', label: 'Courses', Icon: FaBookOpen },
  { to: '/admin/lessons', label: 'Lessons', Icon: FaListUl },
  { to: '/admin/quizzes', label: 'Quizzes', Icon: FaClipboardList },
  { to: '/admin/users', label: 'Users', Icon: FaUsers },
];

const INSTRUCTOR_ITEMS = [
  { to: '/admin', label: 'Dashboard', Icon: FaTachometerAlt },
  { to: '/admin/courses', label: 'Courses', Icon: FaBookOpen },
  { to: '/admin/lessons', label: 'Lessons', Icon: FaListUl },
  { to: '/admin/quizzes', label: 'Quizzes', Icon: FaClipboardList },
  { to: '/admin/users', label: 'Users', Icon: FaUsers },
  { to: '/instructor/live-sessions', label: 'Live sessions', Icon: FaVideo },
];

const Navbar = () => {
  const { user, isAuthenticated, isAdmin, isInstructor, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);

  const isOnAdminRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/instructor');
  const isPrivilegedUser = isAdmin || isInstructor;

  const userAvatar = resolveUserAvatarUrl(user);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to={isAuthenticated ? (isPrivilegedUser ? '/admin' : '/dashboard') : '/'} className="flex items-center" aria-label="Keradion home">
              <img
                src={keradionLogo}
                alt="Keradion logo"
                className="h-10 sm:h-12 w-auto max-w-55 object-contain"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  to={isPrivilegedUser ? '/admin' : '/dashboard'}
                  className="text-gray-600 hover:text-primary-600 transition-colors flex items-center gap-2"
                >
                  <FaTachometerAlt />
                  <span>Dashboard</span>
                </Link>
                {!isPrivilegedUser ? (
                  <>
                    <Link
                      to="/courses"
                      className="text-gray-600 hover:text-primary-600 transition-colors flex items-center gap-2"
                    >
                      <FaBookOpen />
                      <span>Courses</span>
                    </Link>
                    <Link
                      to="/live-sessions"
                      className="text-gray-600 hover:text-primary-600 transition-colors flex items-center gap-2"
                    >
                      <FaVideo />
                      <span>Live sessions</span>
                    </Link>
                    <Link
                      to="/results"
                      className="text-gray-600 hover:text-primary-600 transition-colors flex items-center gap-2"
                    >
                      <FaTrophy />
                      <span>Results</span>
                    </Link>
                  </>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAdminDropdownOpen((prev) => !prev)}
                      className={`transition-colors flex items-center gap-2 ${
                        isOnAdminRoute ? 'text-primary-700' : 'text-gray-600 hover:text-primary-600'
                      }`}
                    >
                      <FaShieldAlt />
                      <span>{isAdmin ? 'Admin' : 'Instructor'}</span>
                      <FaChevronDown className={`text-xs transition-transform ${isAdminDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isAdminDropdownOpen ? (
                      <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 bg-white shadow-lg p-2 z-50">
                        {(isAdmin ? ADMIN_ITEMS : INSTRUCTOR_ITEMS).map((item) => {
                          const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={() => setIsAdminDropdownOpen(false)}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                                active ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <item.Icon className={active ? 'text-primary-600' : 'text-gray-400'} />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                )}
                
                <div className="flex items-center space-x-2 ml-4">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-gray-100 transition-colors"
                  >
                    {userAvatar ? (
                      <img
                        src={userAvatar}
                        alt={user?.name || 'User avatar'}
                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <FaUser className="text-primary-600 text-sm" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {user?.name || 'User'}
                    </span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-red-500 hover:text-red-700 transition-colors ml-2"
                    title="Logout"
                  >
                    <FaSignOutAlt />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-primary-600 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-600 hover:text-primary-600"
            >
              {isMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-3">
              {isAuthenticated ? (
                <>
                  <div className="bg-primary-50 p-3 rounded-lg flex items-center gap-3">
                    {userAvatar ? (
                      <img
                        src={userAvatar}
                        alt={user?.name || 'User avatar'}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <FaUser className="text-primary-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-800">{user?.name}</p>
                      <p className="text-sm text-gray-600">{user?.email}</p>
                    </div>
                  </div>
                  <Link
                    to={isPrivilegedUser ? '/admin' : '/dashboard'}
                    className="text-gray-600 hover:text-primary-600 py-2"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <FaTachometerAlt className="inline mr-2" />
                    Dashboard
                  </Link>
                  {!isPrivilegedUser ? (
                  
                    <>
                      <Link
                        to="/courses"
                        className="text-gray-600 hover:text-primary-600 py-2"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <FaBookOpen className="inline mr-2" />
                        Courses
                      </Link>
                      <Link
                        to="/live-sessions"
                        className="text-gray-600 hover:text-primary-600 py-2"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <FaVideo className="inline mr-2" />
                        Live sessions
                      </Link>
                      <Link
                        to="/results"
                        className="text-gray-600 hover:text-primary-600 py-2"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <FaTrophy className="inline mr-2" />
                        Results
                      </Link>
                    </>
                  ) : (
                    <div className="py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{isAdmin ? 'Admin' : 'Instructor'}</p>
                      <div className="space-y-1">
                        {(isAdmin ? ADMIN_ITEMS : INSTRUCTOR_ITEMS).map((item) => (
                          <Link
                            key={item.to}
                            to={item.to}
                            className="block text-gray-600 hover:text-primary-600 py-1.5"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <item.Icon className="inline mr-2" />
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    className="text-left text-red-500 hover:text-red-700 py-2"
                  >
                    <FaSignOutAlt className="inline mr-2" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-600 hover:text-primary-600 py-2"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-primary-500 text-white px-4 py-2 rounded-lg text-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
