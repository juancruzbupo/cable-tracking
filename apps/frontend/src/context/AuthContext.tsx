import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { message } from 'antd';
import { authApi, setAuthToken, setOnUnauthorized, setOnTokenRefreshed } from '../services/api';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'cable_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    // Call server to clear httpOnly cookie (fire-and-forget)
    authApi.logout().catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    // Try cookie-based auth first (call /auth/me, cookie is sent automatically)
    authApi.me()
      .then((u) => {
        // Cookie auth worked
        const stored = localStorage.getItem(TOKEN_KEY);
        setToken(stored);
        setUser(u);
        if (stored) setAuthToken(stored);
      })
      .catch(() => {
        // Cookie auth failed, try localStorage fallback
        const stored = localStorage.getItem(TOKEN_KEY);
        if (!stored) {
          setLoading(false);
          return;
        }

        setAuthToken(stored);
        authApi.me()
          .then((u) => {
            setToken(stored);
            setUser(u);
          })
          .catch(() => {
            localStorage.removeItem(TOKEN_KEY);
            setAuthToken(null);
          });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      logout();
      message.error('Sesion expirada, volve a iniciar sesion');
    });
  }, [logout]);

  useEffect(() => {
    setOnTokenRefreshed((newToken: string) => {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    // Server sets httpOnly cookie; also store in localStorage for Swagger/debug
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    setAuthToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
  };

  const hasRole = useCallback((...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, token, isAuthenticated: !!user, loading, login, logout, hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
