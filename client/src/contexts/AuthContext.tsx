import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api';

interface User {
  id: string;
  email: string;
  name: string;
  points: number;
  subscription: string;
  avatarColor: string;
  anonymousMode?: boolean;
  itemCount?: number;
  foundCount?: number;
  unreadMessages?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('gs_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function refreshUser() {
    try {
      const { data } = await api.get('/api/auth/me');
      setUser(data);
    } catch {
      logout();
    }
  }

  async function login(email: string, password: string) {
    const { data } = await api.post('/api/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('gs_token', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
  }

  async function register(name: string, email: string, password: string) {
    const { data } = await api.post('/api/auth/register', { name, email, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('gs_token', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem('gs_token');
    delete api.defaults.headers.common['Authorization'];
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
