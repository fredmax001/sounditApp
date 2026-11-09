import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  LayoutGrid,
  Headphones,
  Building2,
  Instagram,
  Twitter,
  Youtube,
} from 'lucide-react';
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

const XTwitterIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const MoreMenuSheet: React.FC<MoreMenuSheetProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { trigger } = useHaptic();

  // Collapsible state matching Image 2 reference: Company & Support open, Ecosystem collapsed
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    ecosystem: false,
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

  // 1. COMPANY (FIRST)
  const companyItems = [
    { label: 'About Us', path: '/about' },
    { label: 'Get the App', path: '/download' },
    { label: 'Careers', path: '/careers' },
    { label: 'Press', path: '/press' },
    { label: 'Contact', path: '/contact' },
  ];

  // 2. SUPPORT & LEGAL (SECOND)
  const supportLegalItems = [
    { label: 'Help Center', path: '/help' },
    { label: 'Terms of Service', path: '/terms' },
    { label: 'Privacy Policy', path: '/privacy' },
    { label: 'Refund Policy', path: '/refund-policy' },
    { label: 'User Agreement', path: '/user-agreement' },
    { label: 'Organizer Agreement', path: '/organizer-agreement' },
  ];

  // 3. ECOSYSTEM (LAST - BELOW THE OTHER TWO)
  const ecosystemItems = [
    { label: 'Sound It DJ', url: 'https://sounditdj.cloud/' },
    { label: 'Sound It Tech', url: 'https://www.soundit.tech/#' },
    { label: 'BOA Festival', url: 'https://boa.sounditent.com/' },
    { label: 'RNB & Slow Sessions', url: 'https://rnbnslowsessions.com/' },
    { label: 'Deck Salone', url: 'https://www.decksalone.com/' },
    { label: 'Fred Max Hub', url: 'https://fredmax.sounditent.com/' },
  ];

  const socialLinks = [
    { label: 'Instagram', url: 'https://instagram.com/soundit_ent', icon: Instagram },
    { label: 'X (Twitter)', url: 'https://x.com/soundit_ent', icon: XTwitterIcon },
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
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[42]"
          />

          {/* Bottom Sheet Drawer matching exact reference visual */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[45] max-h-[88vh] sm:max-w-md sm:mx-auto rounded-t-[28px] bg-[#020b00] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-white"
            style={{
              paddingBottom: 'calc(76px + max(0.5rem, env(safe-area-inset-bottom, 0px)))',
            }}
          >
            {/* Grab Handle */}
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header: [SOUND IT Logo] | More [X] */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <img
                  src="/intro_sound.png"
                  alt="SOUND IT"
                  className="h-5 sm:h-6 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo-dark.png';
                  }}
                />
                <span className="text-white/30 text-lg font-light leading-none">|</span>
                <span className="text-white font-extrabold text-[17px] tracking-tight">More</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 flex items-center justify-center text-gray-300 hover:text-white transition-all"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* SECTION 1: ECOSYSTEM (FIRST, matching Image 2 reference) */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleSection('ecosystem')}
                  className="w-full flex items-center justify-between py-1 text-left group"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#d3da0c] shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-[#d3da0c]">
                      ECOSYSTEM
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[#d3da0c] transition-transform duration-200 ${
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
                      <div className="rounded-2xl bg-[#071205]/90 border border-white/10 overflow-hidden divide-y divide-white/[0.08] shadow-inner">
                        {ecosystemItems.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => handleExternalNav(item.url)}
                            className="w-full px-4 py-3 flex items-center justify-between text-left group hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors"
                          >
                            <span className="text-sm font-medium text-white group-hover:text-[#d3da0c] transition-colors">
                              {item.label}
                            </span>
                            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-[#d3da0c] transition-colors" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* SECTION 2: COMPANY (SECOND, matching Image 2 reference) */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleSection('company')}
                  className="w-full flex items-center justify-between py-1 text-left group"
                >
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-[#d3da0c] shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-[#d3da0c]">
                      COMPANY
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[#d3da0c] transition-transform duration-200 ${
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
                      <div className="rounded-2xl bg-[#071205]/90 border border-white/10 overflow-hidden divide-y divide-white/[0.08] shadow-inner">
                        {companyItems.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => handleInternalNav(item.path)}
                            className="w-full px-4 py-3 flex items-center justify-between text-left group hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors"
                          >
                            <span className="text-sm font-medium text-white group-hover:text-[#d3da0c] transition-colors">
                              {item.label}
                            </span>
                            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* SECTION 3: SUPPORT & LEGAL (THIRD, matching Image 2 reference) */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleSection('support')}
                  className="w-full flex items-center justify-between py-1 text-left group"
                >
                  <div className="flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-[#d3da0c] shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-[#d3da0c]">
                      SUPPORT & LEGAL
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[#d3da0c] transition-transform duration-200 ${
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
                      <div className="rounded-2xl bg-[#071205]/90 border border-white/10 overflow-hidden divide-y divide-white/[0.08] shadow-inner">
                        {supportLegalItems.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => handleInternalNav(item.path)}
                            className="w-full px-4 py-3 flex items-center justify-between text-left group hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors"
                          >
                            <span className="text-sm font-medium text-white group-hover:text-[#d3da0c] transition-colors">
                              {item.label}
                            </span>
                            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* SOCIAL MEDIA FOOTER & COPYRIGHT */}
              <div className="pt-4 pb-2 flex flex-col items-center gap-3">
                <div className="flex items-center justify-center gap-3">
                  {socialLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handleExternalNav(item.url)}
                        className="w-12 h-12 rounded-2xl bg-black/40 border border-[#d3da0c]/40 hover:border-[#d3da0c] active:scale-95 flex items-center justify-center text-[#d3da0c] transition-all shadow-md"
                        aria-label={item.label}
                        title={item.label}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 font-medium text-center">
                  © 2026 Sound It Entertainment
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MoreMenuSheet;
