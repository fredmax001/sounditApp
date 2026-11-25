import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Twitter, Youtube, Mail, MapPin, Phone, ExternalLink, Check, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/store/themeStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';

interface FooterProps {
  isMobile?: boolean;
}

const Footer = ({ isMobile = false }: FooterProps) => {
  const { t } = useTranslation();
  const { isDark } = useThemeStore();
  const currentYear = new Date().getFullYear();

  // Newsletter state
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsSubscribing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          source: isMobile ? 'mobile_app_footer' : 'web_footer',
          frequency: 'weekly'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to subscribe');
      }

      setIsSubscribed(true);
      toast.success(data.message || 'Subscribed successfully! Check your inbox.');
      setEmail('');
      setTimeout(() => setIsSubscribed(false), 6000);
    } catch (err: any) {
      toast.error(err.message || 'Subscription failed. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const TikTokIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" />
    </svg>
  );

  const [isMobileScreen, setIsMobileScreen] = useState(false);

  useEffect(() => {
    const update = () => setIsMobileScreen(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Detect mobile viewport or app environment
  const isMobileLayoutOrApp = isMobile || isMobileScreen;
  const instagramHref = isMobileLayoutOrApp
    ? 'https://instagram.com/soundit_app'
    : 'https://instagram.com/soundit_ent';

  const socialLinks = [
    { icon: Instagram, href: instagramHref, label: 'Instagram' },
    { icon: Twitter, href: 'https://twitter.com/soundit_ent', label: 'Twitter' },
    { icon: TikTokIcon, href: 'https://www.tiktok.com/@soundit_ent', label: 'TikTok' },
    { icon: Youtube, href: 'https://www.youtube.com/@soundit_ent', label: 'YouTube' },
  ];

  const linkGroups = [
    {
      title: t('footer.discover.title') || 'Discover',
      links: [
        { label: t('footer.discover.events') || 'Events', path: '/events' },
        { label: t('footer.discover.artists') || 'Artists & DJs', path: '/artists' },
        { label: t('footer.discover.vendors') || 'Vendors', path: '/vendors' },
        { label: t('footer.discover.cityGuide') || 'City Guide', path: '/city-guide' },
        { label: t('footer.discover.food') || 'Food', path: '/food' },
        { label: t('footer.discover.recaps') || 'Recaps', path: '/recaps' },
        { label: t('footer.discover.community') || 'Community', path: '/community' },
      ],
    },
    {
      title: 'Ecosystem',
      links: [
        { label: 'Sound It DJ', path: 'https://sounditdj.cloud/' },
        { label: 'Sound It Tech', path: 'https://www.soundit.tech/#' },
        { label: 'BOA Festival', path: 'https://boa.sounditent.com/' },
        { label: 'RNB & Slow Sessions', path: 'https://rnbnslowsessions.com/' },
        { label: 'Deck Salone', path: 'https://www.decksalone.com/' },
        { label: 'Fred Max Hub', path: 'https://fredmax.sounditent.com/' },
      ],
    },
    {
      title: t('footer.company.title') || 'Company',
      links: [
        { label: t('footer.company.aboutUs') || 'About Us', path: '/about' },
        { label: t('footer.company.getApp') || 'Get the App', path: '/download' },
        { label: t('footer.company.careers') || 'Careers', path: '/careers' },
        { label: t('footer.company.press') || 'Press', path: '/press' },
        { label: t('footer.company.contact') || 'Contact', path: '/contact' },
      ],
    },
    {
      title: t('footer.support.title') || 'Support & Legal',
      links: [
        { label: t('footer.support.helpCenter') || 'Help Center', path: '/help' },
        { label: t('footer.support.terms') || 'Terms of Service', path: '/terms' },
        { label: t('footer.support.privacy') || 'Privacy Policy', path: '/privacy' },
        { label: t('footer.support.refundPolicy') || 'Refund Policy', path: '/refund-policy' },
        { label: t('footer.support.userAgreement') || 'User Agreement', path: '/user-agreement' },
        { label: t('footer.support.organizerAgreement') || 'Organizer Agreement', path: '/organizer-agreement' },
      ],
    },
  ];

  return (
    <footer
      className={`bg-neutral-50 dark:bg-[#020b00] border-t border-black/8 dark:border-white/5 text-[#020b00] dark:text-white transition-colors duration-200 ${
        isMobile
          ? 'pt-6 pb-[calc(var(--bottom-nav-height,4.75rem)+env(safe-area-inset-bottom,0px)+1rem)]'
          : 'pb-14 pt-14'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Full Footer for iPad, Tablet & Web Layout */}
        {!isMobile && (
          <div className="hidden md:block">
            {/* ────────────────── Active Newsletter Section ────────────────── */}
            <div className="mb-12 p-6 sm:p-8 rounded-2xl bg-black/5 dark:bg-[#0b1307] border border-black/10 dark:border-[#d3da0c]/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d3da0c]/10 rounded-full blur-3xl pointer-events-none" />

              <div className="grid lg:grid-cols-12 gap-6 items-center relative z-10">
                <div className="lg:col-span-7">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold tracking-widest text-[#d3da0c] uppercase">
                      Sound It Insider
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-semibold bg-[#d3da0c]/15 text-[#d3da0c] border border-[#d3da0c]/30">
                      Weekly / Bi-Weekly
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-gray-900 dark:text-white">
                    Never Miss a Beat in China's Nightlife
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-xl">
                    Get weekly curated parties, music festivals, top international DJs, secret club drops, and VIP table perks across Shanghai, Beijing, Guangzhou, and Shenzhen.
                  </p>
                </div>

                <div className="lg:col-span-5">
                  <form onSubmit={handleSubscribe} className="space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email..."
                          required
                          className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-white dark:bg-black/60 border border-black/10 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#d3da0c] transition-colors"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubscribing || isSubscribed}
                        className="px-6 py-3 rounded-xl bg-[#d3da0c] hover:bg-[#bbc10b] text-black font-bold text-sm tracking-wide transition-all shadow-[0_0_15px_rgba(211,218,12,0.3)] flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
                      >
                        {isSubscribed ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Subscribed!</span>
                          </>
                        ) : isSubscribing ? (
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>Subscribe</span>
                            <Send className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[0.6875rem] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 pl-1">
                      <span>No spam ever. Sent 1-2x weekly. One-click unsubscribe anytime.</span>
                    </p>
                  </form>
                </div>
              </div>
            </div>

            {/* ────────────────── Main Footer Grid ────────────────── */}
            <div className="grid grid-cols-12 gap-8 lg:gap-12">
              {/* Brand Column */}
              <div className="col-span-12 lg:col-span-4">
                <Link to="/" className="inline-block mb-4">
                  <img
                    src={isDark ? "/logo-dark.png" : "/logo-light.png"}
                    alt="SOUND IT"
                    className="h-9 w-auto object-contain"
                  />
                </Link>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6 max-w-sm">
                  {t('footer.tagline') || 'Your gateway to the best nightlife, events, and culture in China.'}
                </p>

                {/* Contact Info */}
                <div className="space-y-2.5">
                  <a href="mailto:support@sounditent.com" className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400 hover:text-[#d3da0c] transition-colors text-sm">
                    <Mail className="w-4 h-4 shrink-0 text-[#020b00] dark:text-[#d3da0c]" />
                    <span>support@sounditent.com</span>
                  </a>
                  <a href="tel:+8619121317942" className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400 hover:text-[#d3da0c] transition-colors text-sm">
                    <Phone className="w-4 h-4 shrink-0 text-[#020b00] dark:text-[#d3da0c]" />
                    <span>+86 191 2131 7942</span>
                  </a>
                  <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400 text-sm">
                    <MapPin className="w-4 h-4 shrink-0 text-[#020b00] dark:text-[#d3da0c]" />
                    <span>Shanghai & Guangzhou, China</span>
                  </div>
                </div>
              </div>

              {/* Link Columns */}
              {linkGroups.map((group) => (
                <div key={group.title} className="col-span-6 sm:col-span-3 lg:col-span-2">
                  <h3 className="text-[#020b00] dark:text-white font-semibold text-sm mb-4 tracking-wide">{group.title}</h3>
                  <ul className="space-y-2.5">
                    {group.links.map((link) => {
                      const isExternal = link.path.startsWith('http');
                      return (
                        <li key={link.path}>
                          {isExternal ? (
                            <a
                              href={link.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-600 dark:text-gray-400 hover:text-[#d3da0c] dark:hover:text-[#d3da0c] transition-colors text-sm inline-flex items-center gap-1 group/item"
                            >
                              <span>{link.label}</span>
                              <ExternalLink className="w-3 h-3 opacity-50 group-hover/item:opacity-100 transition-opacity" />
                            </a>
                          ) : (
                            <Link
                              to={link.path}
                              className="text-gray-600 dark:text-gray-400 hover:text-[#d3da0c] dark:hover:text-[#d3da0c] transition-colors text-sm"
                            >
                              {link.label}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ────────────────── Bottom Bar (Always on PWA/Mobile & Web/Tablet) ────────────────── */}
        <div
          className={`flex flex-col items-center justify-center gap-4 text-center ${
            isMobile
              ? ''
              : 'md:flex-row md:justify-between md:text-left mt-12 pt-8 border-t border-black/8 dark:border-white/5'
          }`}
        >
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
            © {currentYear} Sound It Entertainment Platform. Sound It. Made for foreigners in China.
          </p>

          <div className="flex items-center justify-center gap-3">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-[#d3da0c] hover:text-black transition-all"
                >
                  <Icon className="w-4 h-4" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
