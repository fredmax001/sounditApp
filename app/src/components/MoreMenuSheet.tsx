import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe,
  Building2,
  ShieldCheck,
  HelpCircle,
  FileText,
  Mail,
  Download,
  Briefcase,
  Newspaper,
  Instagram,
  Twitter,
  Youtube,
  Radio,
  Sparkles,
  Music,
  Flame,
  Layers,
  HeartHandshake,
} from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { useHaptic } from '@/hooks/useHaptic';

interface MoreMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" />
  </svg>
);

export const MoreMenuSheet: React.FC<MoreMenuSheetProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { isDark } = useThemeStore();
  const { trigger } = useHaptic();

  // Collapsible state for each group (Ecosystem and Company expanded by default)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    ecosystem: true,
    company: true,
    support: true,
  });

  const toggleSection = (section: string) => {
    trigger('light');
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleInternalNav = (path: string) => {
    trigger('light');
    onClose();
    navigate(path);
  };

  const handleExternalNav = (url: string) => {
    trigger('light');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const ecosystemItems = [
    { label: 'Sound It DJ', url: 'https://sounditdj.cloud/', desc: 'Official DJ streaming & booking platform', icon: Radio },
    { label: 'Sound It Tech', url: 'https://www.soundit.tech/#', desc: 'Software, media & hardware technology', icon: Sparkles },
    { label: 'BOA Festival', url: 'https://boa.sounditent.com/', desc: 'Best of Afrobeats international festival', icon: Flame },
    { label: 'RNB & Slow Sessions', url: 'https://rnbnslowsessions.com/', desc: 'Intimate soulful R&B events & parties', icon: Music },
    { label: 'Deck Salone', url: 'https://www.decksalone.com/', desc: 'Sierra Leone cultural entertainment brand', icon: Layers },
    { label: 'Fred Max Hub', url: 'https://fredmax.sounditent.com/', desc: 'Creative design, innovation & artist agency', icon: Globe },
  ];

  const companyItems = [
    { label: 'About Us', path: '/about', icon: Building2 },
    { label: 'Get the App', path: '/download', icon: Download },
    { label: 'Careers', path: '/careers', icon: Briefcase },
    { label: 'Press', path: '/press', icon: Newspaper },
    { label: 'Contact', path: '/contact', icon: Mail },
  ];

  const supportLegalItems = [
    { label: 'Help Center', path: '/help', icon: HelpCircle },
    { label: 'Terms of Service', path: '/terms', icon: FileText },
    { label: 'Privacy Policy', path: '/privacy', icon: ShieldCheck },
    { label: 'Refund Policy', path: '/refund-policy', icon: FileText },
    { label: 'User Agreement', path: '/user-agreement', icon: HeartHandshake },
    { label: 'Organizer Agreement', path: '/organizer-agreement', icon: FileText },
  ];

  const socialLinks = [
    { label: 'Instagram', url: 'https://instagram.com/soundit_ent', icon: Instagram },
    { label: 'X (Twitter)', url: 'https://twitter.com/soundit_ent', icon: Twitter },
    { label: 'TikTok', url: 'https://www.tiktok.com/@soundit_ent', icon: TikTokIcon },
    { label: 'YouTube', url: 'https://www.youtube.com/@soundit_ent', icon: Youtube },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[110]"
          />

          {/* Bottom Sheet Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-[120] max-h-[85vh] sm:max-w-lg sm:mx-auto rounded-t-3xl bg-[#020b00] border-t border-white/10 shadow-2xl flex flex-col overflow-hidden text-white"
            style={{
              paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/* Grab Handle */}
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <img
                  src="/logo-dark.png"
                  alt="Sound It"
                  className="h-6 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="text-[15px] font-bold tracking-tight text-white">More</span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 divide-y divide-white/[0.08]">
              {/* SECTION A: ECOSYSTEM */}
              <div className="pt-2 first:pt-0">
                <button
                  type="button"
                  onClick={() => toggleSection('ecosystem')}
                  className="w-full flex items-center justify-between py-2 text-left group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#d3da0c]">
                      A. Ecosystem
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#d3da0c]/15 text-[#d3da0c] font-semibold">
                      6 Brands
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 group-hover:text-white transition-transform duration-200 ${
                      openSections.ecosystem ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {openSections.ecosystem && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 gap-1.5 pt-1.5 pb-2">
                        {ecosystemItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => handleExternalNav(item.url)}
                              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-[#d3da0c]/10 border border-white/[0.06] hover:border-[#d3da0c]/30 text-left transition-all group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-[#d3da0c]/15 flex items-center justify-center shrink-0">
                                  <Icon className="w-4 h-4 text-[#d3da0c]" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-white group-hover:text-[#d3da0c] truncate transition-colors">
                                    {item.label}
                                  </p>
                                  <p className="text-[10px] text-gray-400 truncate">
                                    {item.desc}
                                  </p>
                                </div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#d3da0c] shrink-0 ml-2 transition-colors" />
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* SECTION B: COMPANY */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => toggleSection('company')}
                  className="w-full flex items-center justify-between py-2 text-left group"
                >
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#d3da0c]">
                    B. Company
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 group-hover:text-white transition-transform duration-200 ${
                      openSections.company ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {openSections.company && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-1.5 pt-1.5 pb-2">
                        {companyItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => handleInternalNav(item.path)}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-left transition-colors group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Icon className="w-3.5 h-3.5 text-[#d3da0c] shrink-0" />
                                <span className="text-xs font-medium text-gray-200 group-hover:text-white truncate">
                                  {item.label}
                                </span>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* SECTION C: SUPPORT & LEGAL */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => toggleSection('support')}
                  className="w-full flex items-center justify-between py-2 text-left group"
                >
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#d3da0c]">
                    C. Support & Legal
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 group-hover:text-white transition-transform duration-200 ${
                      openSections.support ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {openSections.support && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-1.5 pt-1.5 pb-2">
                        {supportLegalItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => handleInternalNav(item.path)}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-left transition-colors group"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon className="w-3.5 h-3.5 text-[#d3da0c] shrink-0" />
                                <span className="text-[11px] font-medium text-gray-200 group-hover:text-white truncate">
                                  {item.label}
                                </span>
                              </div>
                              <ChevronRight className="w-3 h-3 text-gray-500 group-hover:text-gray-300 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* SECTION D: SOCIAL MEDIA */}
              <div className="pt-3">
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#d3da0c] mb-2">
                  D. Connect With Us
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1 pb-2">
                  {socialLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handleExternalNav(item.url)}
                        className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/[0.04] hover:bg-[#d3da0c]/15 border border-white/[0.08] hover:border-[#d3da0c]/30 transition-all group"
                        title={item.label}
                      >
                        <Icon className="w-4 h-4 text-gray-300 group-hover:text-[#d3da0c] transition-colors" />
                        <span className="text-[10px] font-medium text-gray-400 group-hover:text-white mt-1 truncate">
                          {item.label.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Copyright */}
            <div className="px-5 py-2.5 bg-black/40 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-gray-500 shrink-0">
              <span>© {new Date().getFullYear()} Sound It Entertainment</span>
              <span className="text-[#d3da0c]/80 font-semibold">Gateway to Entertainment</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MoreMenuSheet;
