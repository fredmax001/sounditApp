import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

// Check if system prefers dark mode
const getSystemTheme = () => {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// Apply theme to document
const applyTheme = (isDark: boolean) => {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  if (isDark) {
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      isDark: true,
      
      setTheme: (theme) => {
        const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme());
        applyTheme(isDark);
        set({ theme, isDark });
      },
      
      toggleTheme: () => {
        const newIsDark = !get().isDark;
        applyTheme(newIsDark);
        set({ theme: newIsDark ? 'dark' : 'light', isDark: newIsDark });
      },
      
      initTheme: () => {
        const { theme } = get();
        const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme());
        applyTheme(isDark);
        set({ isDark });
        
        // Listen for system theme changes
        if (typeof window !== 'undefined') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          mediaQuery.addEventListener('change', (e) => {
            if (get().theme === 'system') {
              const newIsDark = e.matches;
              applyTheme(newIsDark);
              set({ isDark: newIsDark });
            }
          });
        }
      },
    }),
    {
      name: 'theme-storage',
    }
  )
);
