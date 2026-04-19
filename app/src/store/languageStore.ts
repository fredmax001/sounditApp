import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LanguageState {
    language: 'en' | 'es' | 'fr' | 'de' | 'zh';
    setLanguage: (language: LanguageState['language']) => void;
    t: (key: string) => string;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            language: 'en',
            setLanguage: (language) => set({ language }),
            t: (key: string) => {
                const translations: Record<string, string> = {
                    'nav.events': 'Events',
                    'nav.artists': 'Artists',
                    'nav.cityGuide': 'City Guide',
                    // Add other keys as needed
                };
                return translations[key] || key;
            },
        }),
        {
            name: 'language-storage',
        }
    )
);
