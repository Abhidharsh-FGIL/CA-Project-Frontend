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

    // Update favicon to match current primary color
    requestAnimationFrame(() => {
      const primaryHsl = getComputedStyle(root).getPropertyValue('--primary').trim();
      if (primaryHsl) {
        const color = `hsl(${primaryHsl})`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="48" fill="${color}"/><path d="M128 72 L214 110 L128 148 L42 110 Z" fill="white"/><path d="M92 132 L92 165 C92 181 108 191 128 191 C148 191 164 181 164 165 L164 132 L128 150 Z" fill="white" fill-opacity="0.9"/><path d="M205 113 L205 158" stroke="white" stroke-width="6" stroke-linecap="round"/><circle cx="205" cy="167" r="9" fill="white"/></svg>`;
        const encoded = `data:image/svg+xml,${encodeURIComponent(svg)}`;
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
        if (link) {
          link.href = encoded;
        } else {
          link = document.createElement('link');
          link.rel = 'icon';
          link.type = 'image/svg+xml';
          link.href = encoded;
          document.head.appendChild(link);
        }
      }
    });
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
