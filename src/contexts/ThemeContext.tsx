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
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="48" fill="${color}"/><g transform="translate(34.5,14.5)"><path d="M178.327 60.509L178.299 164.407L93.863 216.602L9.965 164.472L10.48 60.58L94.92 9.266L178.327 60.509Z" stroke="white" stroke-width="8" fill="none"/><path d="M93.292 158.344C84.386 158.344 77.159 155.512 71.612 149.848C66.339 144.457 63.702 137.523 63.702 129.047V88.031L93.292 65.18C102.198 65.18 109.425 68.012 114.972 73.676C120.245 79.066 122.882 86 122.882 94.477L111.749 99.75H111.163V94.477C111.163 89.242 109.757 85.004 106.944 81.762C103.468 77.738 98.917 75.727 93.292 75.727C87.628 75.727 83.077 77.738 79.64 81.762C76.827 85.004 75.421 89.242 75.421 94.477V129.047C75.421 134.203 76.827 138.441 79.64 141.762C83.038 145.785 87.589 147.797 93.292 147.797C98.878 147.797 103.429 145.785 106.944 141.762C109.757 138.52 111.163 134.281 111.163 129.047V125.414H89.894V124.828L93.233 117.797H122.882V135.492L93.292 158.344Z" fill="white"/></g></svg>`;
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
