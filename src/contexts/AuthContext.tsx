import React, { createContext, useContext } from 'react';
import type { User as AppUser } from '@/types';

interface AuthContextValue {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  signup: (email: string, password: string, name: string, role: string, otp: string) => Promise<{ error: Error | null }>;
  orgSignup: (payload: any) => Promise<{ error: Error | null }>;
  googleLogin: (credential: string, autoSignup?: boolean) => Promise<{ error: Error | null; isNewUser?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const DEMO_USER: AppUser = {
  id: 'demo-user',
  email: 'demo@example.com',
  name: 'Demo User',
  role: 'org_admin',
  language: 'en',
  xp: 0,
  streak: 0,
  onboardingCompleted: true,
};

const noop = async () => ({ error: null });

const AuthContext = createContext<AuthContextValue>({
  user: DEMO_USER,
  isAuthenticated: true,
  isLoading: false,
  login: noop,
  signup: noop,
  orgSignup: noop,
  googleLogin: async () => ({ error: null, isNewUser: false }),
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: DEMO_USER,
        isAuthenticated: true,
        isLoading: false,
        login: noop,
        signup: noop,
        orgSignup: noop,
        googleLogin: async () => ({ error: null, isNewUser: false }),
        logout: async () => {},
        refreshUser: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
