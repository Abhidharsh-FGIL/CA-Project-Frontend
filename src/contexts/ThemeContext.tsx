import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ThemeMode, ThemePreset, ThemeConfig } from '@/types';

interface ThemeContextValue {
  theme: ThemeConfig;
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePreset) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_KEY = 'eduverse-theme';

const defaultTheme: ThemeConfig = {
  mode: 'light',
  preset: 'classic',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    const saved = localStorage.getItem(THEME_KEY);
    return saved ? JSON.parse(saved) : defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;

    // Remove all theme classes
    root.classList.remove('dark', 'theme-classic', 'theme-indigo', 'theme-teal', 'theme-sunset', 'theme-emerald');

    // Apply mode
    if (theme.mode === 'dark') {
      root.classList.add('dark');
    }

    // Apply preset (skip classic as it's the default)
    if (theme.preset !== 'classic') {
      root.classList.add(`theme-${theme.preset}`);
    }

    // Save to localStorage
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  }, [theme]);

  const setMode = (mode: ThemeMode) => {
    setTheme((prev) => ({ ...prev, mode }));
  };

  const setPreset = (preset: ThemePreset) => {
    setTheme((prev) => ({ ...prev, preset }));
  };

  const toggleMode = () => {
    setTheme((prev) => ({ ...prev, mode: prev.mode === 'light' ? 'dark' : 'light' }));
  };

  return (
    <ThemeContext.Provider value={{ theme, setMode, setPreset, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
