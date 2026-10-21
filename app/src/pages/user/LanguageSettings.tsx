import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

interface LanguageOption {
  code: string;
  nativeName: string;
  englishName: string;
  suggested?: boolean;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', suggested: true },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', suggested: true },
  { code: 'zh', nativeName: '中文', englishName: 'Chinese', suggested: true },
  { code: 'fr', nativeName: 'Français', englishName: 'French' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean' },
];

const LanguageSettings = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const [selected, setSelected] = useState<string>(i18n.language?.split('-')[0] || 'en');
  const [isSaving, setIsSaving] = useState(false);

  // Sync from profile preference on load
  useEffect(() => {
    const fetchPref = async () => {
      const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const me = await res.json();
          if (me.preferred_language) {
            const lang = String(me.preferred_language).split('-')[0];
            setSelected(lang);
            if (i18n.language.split('-')[0] !== lang) i18n.changeLanguage(lang);
          }
        }
      } catch { /* keep current */ }
    };
    fetchPref();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  const persistLanguage = async (lang: string) => {
    const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ preferred_language: lang })
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch {
      toast.error(t('kit.language.saveFailed'));
    }
  };

  const handleSelect = async (lang: LanguageOption) => {
    if (lang.code === selected) return;
    const previous = selected;
    setSelected(lang.code);
    setIsSaving(true);
    try {
      await i18n.changeLanguage(lang.code);
      await persistLanguage(lang.code);
    } catch {
      setSelected(previous);
      i18n.changeLanguage(previous);
      toast.error(t('kit.language.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const renderRow = (lang: LanguageOption, index: number) => (
    <motion.button
      key={lang.code}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => handleSelect(lang)}
      className={`w-full flex items-center gap-3 px-4 py-4 min-h-[44px] text-left transition-colors ${selected === lang.code ? 'bg-black/5 dark:bg-[#d3da0c]/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
      role="radio"
      aria-checked={selected === lang.code}
    >
      <span className={`text-sm font-semibold flex-1 ${selected === lang.code ? 'text-[#020b00] dark:text-[#d3da0c]' : 'text-[#020b00] dark:text-white'}`}>
        {lang.nativeName}
        <span className={`block text-[11px] font-normal ${selected === lang.code ? 'text-[#020b00]/70 dark:text-[#d3da0c]/70' : 'text-gray-500 dark:text-gray-400'}`}>{lang.englishName}</span>
      </span>
      {selected === lang.code && (
        <span className="w-6 h-6 rounded-full bg-[#020b00] dark:bg-[#d3da0c] flex items-center justify-center shrink-0 shadow-xs">
          <Check className="w-4 h-4 text-[#d3da0c] dark:text-black" />
        </span>
      )}
    </motion.button>
  );

  const suggested = LANGUAGES.filter(l => l.suggested);
  const all = LANGUAGES.filter(l => !l.suggested);

  return (
    <div className="min-h-screen bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white pb-12 transition-colors">
      <section className="sticky top-0 z-30 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-md border-b border-black/8 dark:border-white/5 transition-colors">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2">
          <button
            onClick={() => navigate('/settings')}
            aria-label={t('kit.common.back')}
            className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-gray-700 dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold font-display text-[#020b00] dark:text-white flex-1">{t('kit.language.title')}</h1>
          {isSaving && <Loader2 className="w-4 h-4 text-[#020b00] dark:text-[#d3da0c] animate-spin" />}
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl overflow-hidden shadow-xs dark:shadow-none"
          role="radiogroup"
          aria-label={t('kit.language.title')}
        >
          <h2 className="px-4 pt-4 pb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('kit.language.suggested')}</h2>
          <div className="divide-y divide-black/5 dark:divide-white/5">{suggested.map(renderRow)}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl overflow-hidden shadow-xs dark:shadow-none"
          role="radiogroup"
          aria-label={t('kit.language.title')}
        >
          <div className="divide-y divide-black/5 dark:divide-white/5">{all.map((lang, i) => renderRow(lang, i + suggested.length))}</div>
        </motion.div>
      </div>
    </div>
  );
};

export default LanguageSettings;
