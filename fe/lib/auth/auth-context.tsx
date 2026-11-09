'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  AuthContextType,
  LoginCredentials,
  User,
} from '@/types/auth';
import { getMeApi, loginApi, logoutApi } from '@/lib/api/auth';
import { getStoredToken, removeStoredToken, setStoredToken } from '@/lib/api/client';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = useCallback(async () => {
    const storedToken = getStoredToken();
    if (!storedToken) {
      setTokenState(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setTokenState(storedToken);
      const res = await getMeApi(storedToken);
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        removeStoredToken();
        setTokenState(null);
        setUser(null);
      }
    } catch {
      removeStoredToken();
      setTokenState(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const res = await loginApi(credentials);
      if (res.success && res.data) {
        const receivedToken = res.data.token;
        setStoredToken(receivedToken);
        setTokenState(receivedToken);
        setUser(res.data.user);
      } else {
        throw new Error(res.message || 'Đăng nhập không thành công.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore network/auth errors during logout
    } finally {
      removeStoredToken();
      setTokenState(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      return;
    }
    try {
      const res = await getMeApi(currentToken);
      if (res.success && res.data) {
        setUser(res.data);
      }
    } catch {
      removeStoredToken();
      setTokenState(null);
      setUser(null);
    }
  }, []);

  const hasRole = useCallback(
    (roleName: string): boolean => {
      if (!user || !user.roles) return false;
      return user.roles.some((r) => r.name === roleName);
    },
    [user]
  );

  const hasPermission = useCallback(
    (permissionKey: string): boolean => {
      if (!user || !user.permissions) return false;
      return user.permissions.includes(permissionKey);
    },
    [user]
  );

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(user && token),
      login,
      logout,
      refreshUser,
      hasRole,
      hasPermission,
    }),
    [user, token, isLoading, login, logout, refreshUser, hasRole, hasPermission]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
