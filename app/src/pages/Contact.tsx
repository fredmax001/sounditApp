import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Mail, MapPin, Phone, Send, Loader2, Check, Instagram, Facebook } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

const Contact = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.message) {
      toast.error(t('contact.fillRequiredFields'));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          to_email: 'support@sounditent.com', // Admin email
        }),
      });

      if (response.ok) {
        setIsSent(true);
        toast.success(t('contact.messageSent'));
      } else {
        const errorData = await response.json();
        toast.error(errorData.detail || t('contact.failedToSendMessage'));
      }
    } catch {
      toast.error(t('contact.networkError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const contactInfo = [
    {
      icon: Mail,
      label: t('contact.emailLabel'),
      value: 'support@sounditent.com',
      href: 'mailto:support@sounditent.com',
    },
    {
      icon: Phone,
      label: t('contact.phoneLabel'),
      value: '+86 191 21317942',
      href: 'tel:+8619121317942',
    },
    {
      icon: MapPin,
      label: t('contact.addressLabel'),
      value: '上海市宝山区美罗家园澜景苑 22号104室',
      href: '#',
    },
  ];

  if (isSent) {
    return (
      <div className="min-h-screen pt-20 pb-24 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#d3da0c]/20 flex items-center justify-center">
            <Check className="w-10 h-10 text-[#d3da0c]" />
          </div>
          <h2 className="text-3xl font-display text-white mb-4">{t('contact.messageSentTitle')}</h2>
          <p className="text-gray-400 mb-8">
            {t('contact.thankYouMessage')}
          </p>
          <button
            onClick={() => {
              setIsSent(false);
              setFormData({ name: '', email: '', subject: '', message: '' });
            }}
            className="px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
          >
            {t('contact.sendAnotherMessage')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-24">
      {/* Hero */}
      <section className="relative py-16 bg-[#111111]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <span className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4">
              {t('contact.getInTouch')}
            </span>
            <h1 className="text-4xl md:text-6xl font-display text-white mb-6">
              {t('contact.title')}{' '}
              <span className="text-[#d3da0c]">{t('contact.titleHighlight')}</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('contact.subtitle')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Contact Info */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-semibold text-white mb-6">
                  {t('contact.contactInformation')}
                </h2>

                {contactInfo.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      className="flex items-start gap-4 p-4 glass rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-[#d3da0c]" />
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">{item.label}</p>
                        <p className="text-white">{item.value}</p>
                      </div>
                    </a>
                  );
                })}

                {/* Social Links */}
                <div className="pt-6">
                  <p className="text-gray-400 text-sm mb-4">{t('contact.followUs')}</p>
                  <div className="flex gap-3">
                    <a
                      href="https://instagram.com/soundit_events"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-[#d3da0c] hover:text-black transition-colors"
                      title={t('contact.instagram')}
                    >
                      <Instagram className="w-5 h-5" />
                    </a>
                    <a
                      href="https://x.com/soundit_events"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-[#d3da0c] hover:text-black transition-colors"
                      title={t('contact.xTwitter')}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </a>
                    <a
                      href="https://tiktok.com/@soundit_events"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-[#d3da0c] hover:text-black transition-colors"
                      title={t('contact.tikTok')}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                      </svg>
                    </a>
                    <a
                      href="https://facebook.com/soundit_events"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-[#d3da0c] hover:text-black transition-colors"
                      title={t('contact.facebook')}
                    >
                      <Facebook className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-2"
            >
              <div className="glass rounded-2xl p-8">
                <h2 className="text-2xl font-semibold text-white mb-6">
                  {t('contact.sendUsAMessage')}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">
                        {t('contact.yourName')} <span className="text-[#FF2D8F]">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder={t('contact.namePlaceholder')}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">
                        {t('contact.yourEmail')} <span className="text-[#FF2D8F]">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder={t('contact.emailPlaceholder')}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('contact.subjectLabel')}</label>
                    <select
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none transition-colors appearance-none"
                    >
                      <option value="" className="bg-[#111111]">{t('contact.selectSubject')}</option>
                      <option value="general" className="bg-[#111111]">{t('contact.subjectGeneralInquiry')}</option>
                      <option value="support" className="bg-[#111111]">{t('contact.subjectSupport')}</option>
                      <option value="partnership" className="bg-[#111111]">{t('contact.subjectPartnership')}</option>
                      <option value="press" className="bg-[#111111]">{t('contact.subjectPress')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-2">
                      {t('contact.messageLabel')} <span className="text-[#FF2D8F]">*</span>
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows={5}
                      placeholder={t('contact.messagePlaceholder')}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('contact.sending')}
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {t('contact.sendMessage')}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
