'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, User } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const setUser = useCallback((u: User | null) => setUserState(u), []);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!t) {
      setLoading(false);
      return;
    }
    setToken(t);
    auth
      .me()
      .then(({ user: u }) => {
        setUserState(u);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u, token: t } = await auth.login({ email, password });
    localStorage.setItem('token', t);
    setToken(t);
    setUserState(u);
    router.push('/chats');
  }, [router]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { user: u, token: t } = await auth.register({ email, password, name });
    localStorage.setItem('token', t);
    setToken(t);
    setUserState(u);
    router.push('/chats');
  }, [router]);

  const logout = useCallback(() => {
    disconnectSocket();
    localStorage.removeItem('token');
    setToken(null);
    setUserState(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
