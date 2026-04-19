import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Instagram, Twitter, Youtube, Mail, MapPin, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    discover: [
      { label: t('footer.discover.events'), path: '/events' },
      { label: t('footer.discover.discovery') || 'Discovery', path: '/discovery' },
      { label: t('footer.discover.community'), path: '/community' },
      { label: t('footer.discover.food'), path: '/food' },
    ],
    company: [
      { label: t('footer.company.aboutUs'), path: '/about' },
      { label: t('footer.company.careers'), path: '/careers' },
      { label: t('footer.company.press'), path: '/press' },
      { label: t('footer.company.contact'), path: '/contact' },
    ],
    support: [
      { label: t('footer.support.helpCenter'), path: '/help' },
      { label: t('footer.support.terms'), path: '/terms' },
      { label: t('footer.support.privacy'), path: '/privacy' },
      { label: t('footer.support.refundPolicy'), path: '/refund-policy' },
      { label: t('footer.support.userAgreement'), path: '/user-agreement' },
      { label: t('footer.support.organizerAgreement'), path: '/organizer-agreement' },
      { label: t('footer.support.verificationPolicy'), path: '/verification-policy' },
    ],
  };

  const TikTokIcon = ({ className }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.394 10.692 6.33 6.33 0 0 0 10.857-4.424V8.687a8.182 8.182 0 0 0 4.773 1.526V6.79a4.831 4.831 0 0 1-1.003-.104z" />
    </svg>
  );

  const socialLinks = [
    { icon: Instagram, href: 'https://instagram.com/soundit_events', label: t('footer.social.instagram') || 'Instagram' },
    { icon: Twitter, href: 'https://twitter.com/soundit_events', label: t('footer.social.twitter') || 'Twitter' },
    { icon: TikTokIcon, href: 'https://www.tiktok.com/@soundit_events', label: t('footer.social.tiktok') || 'TikTok' },
    { icon: Youtube, href: 'https://www.youtube.com/@soundit_events', label: t('footer.social.youtube') || 'YouTube' },
  ];

  return (
    <footer className="relative bg-[#0A0A0A] border-t border-white/5 overflow-hidden hidden md:block">
      {/* Background Giant Text */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <motion.span
          className="text-[20vw] font-display text-white/[0.02] whitespace-nowrap"
          animate={{ x: ['-10%', '0%'] }}
          transition={{ duration: 20, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
        >
          SOUND IT
        </motion.span>
      </div>

      <div className="relative z-10 w-full py-16">
        <div className="max-w-full px-4 sm:px-6 lg:px-8 2xl:px-12">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-8 md:gap-12">
            {/* Brand Column - full width on mobile */}
            <div className="col-span-2 lg:col-span-2">
              <Link to="/" className="inline-block mb-6">
                <img
                  src="/logo.png"
                  alt="SOUND IT"
                  className="h-24 w-auto object-contain"
                />
              </Link>
              <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-sm">
                {t('footer.tagline')}
              </p>

              {/* Contact Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-400 text-sm">
                  <Mail className="w-4 h-4 text-[#d3da0c]" />
                  <a href="mailto:support@sounditent.com" className="hover:text-[#d3da0c] transition-colors">
                    {t('footer.contact.email') || 'support@sounditent.com'}
                  </a>
                </div>
                <div className="flex items-center gap-3 text-gray-400 text-sm">
                  <Phone className="w-4 h-4 text-[#d3da0c]" />
                  <a href="tel:+8619121317942" className="hover:text-[#d3da0c] transition-colors">
                    {t('footer.contact.phone') || '+86 191 21317942'}
                  </a>
                </div>
                <div className="flex items-center gap-3 text-gray-400 text-sm">
                  <MapPin className="w-4 h-4 text-[#d3da0c]" />
                  <span>{t('footer.contact.address') || 'Shanghai, China'}</span>
                </div>
              </div>
            </div>

            {/* Discover */}
            <div>
              <h3 className="text-white font-semibold mb-4">{t('footer.discover.title') || 'Discover'}</h3>
              <ul className="space-y-3">
                {footerLinks.discover.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.path}
                      className="text-gray-400 hover:text-[#d3da0c] transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-white font-semibold mb-4">{t('footer.company.title') || 'Company'}</h3>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.path}
                      className="text-gray-400 hover:text-[#d3da0c] transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support - positioned right on desktop, aligned on mobile */}
            <div className="col-span-2 md:col-span-1 lg:col-span-1 flex flex-col items-start md:items-start lg:items-end">
              <div>
                <h3 className="text-white font-semibold mb-4">{t('footer.support.title') || 'Support'}</h3>
                <ul className="space-y-3">
                  {footerLinks.support.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.path}
                        className="text-gray-400 hover:text-[#d3da0c] transition-colors text-sm"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Copyright */}
            <p className="text-gray-500 text-sm">
              © {currentYear} {t('footer.copyright') || 'Sound It. Made for foreigners in China.'}
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-[#d3da0c] hover:text-black transition-all"
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#d3da0c]/30 to-transparent" />
    </footer>
  );
};

export default Footer;
