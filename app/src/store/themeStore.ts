import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

// Check if system prefers dark mode
export const getSystemTheme = (): boolean => {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// Apply theme to document, meta tags, and native UI
export const applyTheme = (isDark: boolean) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
    root.setAttribute('data-theme', 'light');
  }

  // Update meta theme-color for browser tab and PWA chrome
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isDark ? '#020b00' : '#ffffff');
  }

  // Update native Capacitor status bar if running inside app wrapper
  try {
    if ((window as any).__capacitor?.isNativePlatform?.()) {
      StatusBar.setStyle({ style: isDark ? StatusBarStyle.Dark : StatusBarStyle.Light });
      StatusBar.setBackgroundColor({ color: isDark ? '#020b00' : '#ffffff' });
    }
  } catch {
    // Ignore native plugin errors in web environment
  }
};

let systemThemeListenerAttached = false;

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark', // Default to Sound It dark interface (#020B00)
      isDark: true,

      setTheme: (theme: ThemeMode) => {
        const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme());
        applyTheme(isDark);
        set({ theme, isDark });
      },

      toggleTheme: () => {
        const currentTheme = get().theme;
        let nextTheme: ThemeMode;
        if (currentTheme === 'system') {
          nextTheme = get().isDark ? 'light' : 'dark';
        } else if (currentTheme === 'dark') {
          nextTheme = 'light';
        } else {
          nextTheme = 'system';
        }
        get().setTheme(nextTheme);
      },

      initTheme: () => {
        const currentTheme = get().theme === 'system' ? 'dark' : get().theme;
        const isDark = currentTheme === 'dark';
        applyTheme(isDark);
        set({ theme: currentTheme, isDark });

        // Listen for system theme changes dynamically
        if (typeof window !== 'undefined' && !systemThemeListenerAttached) {
          systemThemeListenerAttached = true;
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          
          const handleMediaChange = (e: MediaQueryListEvent) => {
            if (get().theme === 'system') {
              const newIsDark = e.matches;
              applyTheme(newIsDark);
              set({ isDark: newIsDark });
            }
          };

          if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleMediaChange);
          } else if ((mediaQuery as any).addListener) {
            (mediaQuery as any).addListener(handleMediaChange);
          }
        }
      },
    }),
    {
      name: 'theme-storage',
      // Only persist the theme setting mode ('system' | 'light' | 'dark'), not transient runtime states
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
