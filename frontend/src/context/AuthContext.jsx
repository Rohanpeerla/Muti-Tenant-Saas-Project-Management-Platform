import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('sprintsync_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);

  // Check current authentication on initial load
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('sprintsync_access_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const userData = await authService.getMe();
      setUser(userData);
      localStorage.setItem('sprintsync_user', JSON.stringify(userData));
    } catch (err) {
      // If 401 and refresh fails, user will be cleared by axios interceptor
      setUser(null);
      localStorage.removeItem('sprintsync_access_token');
      localStorage.removeItem('sprintsync_refresh_token');
      localStorage.removeItem('sprintsync_user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Listen to global logout event dispatched by interceptor
    const handleGlobalLogout = () => {
      setUser(null);
    };

    window.addEventListener('sprintsync_auth_logout', handleGlobalLogout);
    return () => window.removeEventListener('sprintsync_auth_logout', handleGlobalLogout);
  }, [checkAuth]);

  // Login handler
  const login = async (email, password) => {
    const data = await authService.login({ email, password });
    localStorage.setItem('sprintsync_access_token', data.access);
    localStorage.setItem('sprintsync_refresh_token', data.refresh);
    localStorage.setItem('sprintsync_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  // Register handler
  const register = async (payload) => {
    const data = await authService.register(payload);
    return data;
  };

  // Logout handler
  const logout = async () => {
    const refreshToken = localStorage.getItem('sprintsync_refresh_token');
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch (err) {
      // Proceed with client logout even if blacklist request fails
    } finally {
      localStorage.removeItem('sprintsync_access_token');
      localStorage.removeItem('sprintsync_refresh_token');
      localStorage.removeItem('sprintsync_user');
      setUser(null);
    }
  };

  // Profile update handler
  const updateProfile = async (updates) => {
    const response = await authService.updateProfile(updates);
    const updatedUser = response.user;
    setUser(updatedUser);
    localStorage.setItem('sprintsync_user', JSON.stringify(updatedUser));
    return updatedUser;
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

