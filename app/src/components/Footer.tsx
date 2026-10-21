import { Link } from 'react-router-dom';
import { Instagram, Twitter, Youtube, Mail, MapPin, Phone, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/store/themeStore';

const Footer = () => {
  const { t } = useTranslation();
  const { isDark } = useThemeStore();
  const currentYear = new Date().getFullYear();

  const TikTokIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" />
    </svg>
  );

  const socialLinks = [
    { icon: Instagram, href: 'https://instagram.com/soundit_ent', label: 'Instagram' },
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
    <footer className="bg-neutral-50 dark:bg-[#020b00] border-t border-black/8 dark:border-white/5 hidden md:block text-[#020b00] dark:text-white transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-12 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-12 lg:col-span-4">
            <Link to="/" className="inline-block mb-5">
              <img
                src={isDark ? "/logo-dark.png" : "/logo-light.png"}
                alt="SOUND IT"
                className="h-9 w-auto object-contain"
              />
            </Link>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6 max-w-xs">
              {t('footer.tagline') || 'Your gateway to the best nightlife, events, and culture in China.'}
            </p>

            {/* Contact */}
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
                <span>Shanghai, China</span>
              </div>
            </div>
          </div>

          {/* Link Columns */}
          {linkGroups.map((group) => (
            <div key={group.title} className="col-span-6 sm:col-span-3 lg:col-span-2">
              <h3 className="text-[#020b00] dark:text-white font-semibold text-sm mb-4">{group.title}</h3>
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

        {/* Bottom Bar */}
        <div className="mt-14 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-5">
          <p className="text-gray-500 text-sm text-center sm:text-left">
            © {currentYear} Sound It. {t('footer.copyright') || 'Made for foreigners in China.'}
          </p>

          <div className="flex items-center gap-3">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:bg-[#d3da0c] hover:text-black transition-all"
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
