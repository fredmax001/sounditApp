import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import en from './locales/en.json';
import fr from './locales/fr.json';
import zh from './locales/zh.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  zh: { translation: zh },
  es: { translation: es },
  pt: { translation: pt },
  ru: { translation: ru },
  ar: { translation: ar },
  de: { translation: de },
  ja: { translation: ja },
  ko: { translation: ko },
};

// RTL languages get document.dir = 'rtl' so layout mirrors automatically
const applyDirection = (lng: string) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

applyDirection(i18n.language?.split('-')[0] || 'en');
i18n.on('languageChanged', (lng) => applyDirection(lng?.split('-')[0] || 'en'));

export default i18n;
