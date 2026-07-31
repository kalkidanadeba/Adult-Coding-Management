// src/context/AuthContext.jsx
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { AuthContext } from './AuthContextStore';
import { clearLegacyProgressCaches, migrateClientProgressOwnership } from '../utils/clientProgressStorage';
import { extractUserFromPayload, mergeProfileResponseIntoUser, resolveUserAvatarUrl } from '../utils/profile';

const extractAuth = (data) => {
  const token = data?.token ?? data?.accessToken ?? data?.data?.token ?? data?.data?.accessToken ?? null;
  const user = data?.user ?? data?.data?.user ?? null;
  return { token, user };
};

const clearStoredAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  clearLegacyProgressCaches();
};

const getStored = (key) => localStorage.getItem(key) ?? sessionStorage.getItem(key);

const buildFallbackUser = (user, fallback = {}) => {
  if (user && typeof user === 'object') {
    return user;
  }

  const email = typeof fallback?.email === 'string' ? fallback.email.trim() : '';
  const name = typeof fallback?.name === 'string' ? fallback.name.trim() : '';

  if (!email && !name) {
    return null;
  }

  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const persistUser = useCallback((nextUser) => {
    if (!nextUser) {
      return;
    }

    setUser(nextUser);

    if (localStorage.getItem('user')) {
      localStorage.setItem('user', JSON.stringify(nextUser));
    }

    if (sessionStorage.getItem('user')) {
      sessionStorage.setItem('user', JSON.stringify(nextUser));
    }

    migrateClientProgressOwnership({ user: nextUser });
  }, []);

  useEffect(() => {
    const savedToken = getStored('token');
    const savedUser = getStored('user');

    if (savedToken) {
      setToken(savedToken);
    }

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        clearStoredAuth();
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let active = true;

    const refreshCurrentUser = async () => {
      let storedUser = null;
      const rawStoredUser = getStored('user');

      if (rawStoredUser) {
        try {
          storedUser = JSON.parse(rawStoredUser);
        } catch {
          storedUser = null;
        }
      }

      const endpoints = ['/auth/me', '/auth/profile', '/dashboard/me'];

      for (const endpoint of endpoints) {
        try {
          const response = await api.get(endpoint);
          const nextUser = extractUserFromPayload(response?.data ?? response);

          if (nextUser && active) {
            // Ensure role is preserved from stored user if not in the refresh response
            const mergedUser = mergeProfileResponseIntoUser(storedUser, { user: nextUser });
            const finalUser = {
              ...mergedUser,
              role: nextUser?.role || storedUser?.role || mergedUser?.role
            };
            persistUser(finalUser);
            return;
          }
        } catch (err) {
          if (err?.response?.status && err.response.status !== 404 && err.response.status !== 405) {
            return;
          }
        }
      }
    };

    refreshCurrentUser();

    return () => {
      active = false;
    };
  }, [token, persistUser]);

  const login = async (credentials, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', credentials);
      const data = response?.data ?? {};

      if (data?.success === false) {
        throw new Error(data?.message || 'Invalid email or password');
      }

      const { token: nextToken, user: rawUser } = extractAuth(data);
      const nextUser = buildFallbackUser(rawUser, { email: credentials?.email });

      // Preserve the role field from the raw user response
      const finalUser = nextUser ? { ...nextUser, role: rawUser?.role || nextUser?.role } : null;

      if (!nextToken && !finalUser) {
        throw new Error('Login succeeded but no session data was returned by the server.');
      }

      const rememberMe = Boolean(options?.rememberMe);
      const storage = rememberMe ? localStorage : sessionStorage;

      clearStoredAuth();

      if (nextToken) {
        storage.setItem('token', nextToken);
        setToken(nextToken);
      }

      if (finalUser) {
        storage.setItem('user', JSON.stringify(finalUser));
        setUser(finalUser);
      }

      migrateClientProgressOwnership({ user: finalUser, token: nextToken });

      toast.success(data?.message || 'Login successful');
      return { success: true, data };
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Login failed';
      setError(message);
      toast.error(message, {
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      });
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: userData?.name,
        email: userData?.email,
        password: userData?.password,
      };

      const response = await api.post('/auth/register', payload);
      const data = response?.data ?? {};

      if (data?.success === false) {
        throw new Error(data?.message || 'Registration failed');
      }

      // Prefer session returned from the register endpoint; otherwise auto-login.
      let { token: nextToken, user: nextUser } = extractAuth(data);

      if (!nextToken && !nextUser) {
        const loginResponse = await api.post('/auth/login', { email: payload.email, password: payload.password });
        const loginData = loginResponse?.data ?? {};

        if (loginData?.success === false) {
          throw new Error(loginData?.message || 'Auto-login failed after registration');
        }

        const extracted = extractAuth(loginData);
        nextToken = extracted.token;
        nextUser = extracted.user;
      }

      nextUser = buildFallbackUser(nextUser, { email: payload.email, name: payload.name });

      if (!nextToken && !nextUser) {
        throw new Error('Registration succeeded but no session data was returned by the server.');
      }

      clearStoredAuth();
      const storage = sessionStorage;

      if (nextToken) {
        storage.setItem('token', nextToken);
        setToken(nextToken);
      }

      if (nextUser) {
        storage.setItem('user', JSON.stringify(nextUser));
        setUser(nextUser);
      }

      migrateClientProgressOwnership({ user: nextUser, token: nextToken });

      toast.success(data?.message || 'Account created successfully!');
      return { success: true, data };
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Registration failed. Please try again.';
      setError(message);
      toast.error(message, {
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      });
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearStoredAuth();
    setToken(null);
    setUser(null);

    toast.success('Logged out successfully!');
  };

  const updateProfile = async (profileData = {}) => {
    setLoading(true);
    setError(null);

    try {
      const { name, photo } = profileData;
      const formData = new FormData();

      if (name !== undefined) {
        formData.append('name', name);
      }

      if (photo) {
        formData.append('photo', photo);
      }

      const response = await api.put('/auth/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = response?.data ?? {};
      if (data?.success === false) {
        throw new Error(data?.message || 'Profile update failed');
      }

      let nextUser = mergeProfileResponseIntoUser(user, data, { name });

      if (photo && !resolveUserAvatarUrl(nextUser)) {
        const endpoints = ['/auth/me', '/auth/profile', '/dashboard/me'];

        for (const endpoint of endpoints) {
          try {
            const refreshResponse = await api.get(endpoint);
            const refreshedUser = extractUserFromPayload(refreshResponse?.data ?? refreshResponse);

            if (refreshedUser) {
              nextUser = mergeProfileResponseIntoUser(nextUser, { user: refreshedUser });
              break;
            }
          } catch (err) {
            if (err?.response?.status && err.response.status !== 404 && err.response.status !== 405) {
              throw err;
            }
          }
        }
      }

      if (nextUser) {
        persistUser(nextUser);
      }

      toast.success(data?.message || 'Profile updated successfully');
      return { success: true, data };
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Profile update failed';
      setError(message);
      toast.error(message, {
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      });
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (passwordData = {}) => {
    setLoading(true);
    setError(null);

    try {
      const { currentPassword, newPassword } = passwordData;

      const response = await api.put('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      const data = response?.data ?? {};
      if (data?.success === false) {
        throw new Error(data?.message || 'Password change failed');
      }

      toast.success(data?.message || 'Password changed successfully');
      return { success: true, data };
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Password change failed';
      setError(message);
      toast.error(message, {
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      });
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const normalizedRole = String(user?.role ?? '').toLowerCase();
  const isAdmin = normalizedRole === 'admin';
  const isInstructor = normalizedRole === 'instructor';
  const isPrivilegedUser = isAdmin || isInstructor;

  const value = {
    user,
    token,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    isAuthenticated: !!token || !!user,
    isAdmin,
    isInstructor,
    isPrivilegedUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
