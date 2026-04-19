import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, Shield, Mail, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const CrossBorderConsent = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('crossBorderConsent.pageTitle');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('crossBorderConsent.metaDescription'));
    }
  }, [t]);

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* Hero */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#d3da0c]/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#d3da0c]/10 rounded-full blur-[150px]" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d3da0c]/10 border border-[#d3da0c]/20 mb-6">
              <Globe className="w-4 h-4 text-[#d3da0c]" />
              <span className="text-sm text-[#d3da0c] font-medium">{t('crossBorderConsent.dataTransfer')}</span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-6">
              {t('crossBorderConsent.crossBorder')} <span className="text-[#d3da0c]">{t('crossBorderConsent.consent')}</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t('crossBorderConsent.introduction')}</p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <Card className="glass border-[#d3da0c]/20">
              <CardContent className="p-8 md:p-10">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-[#d3da0c]" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">{t('crossBorderConsent.purposeTitle')}</h3>
                      <p className="text-gray-400">{t('crossBorderConsent.purposeContent')}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-[#d3da0c]" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">{t('crossBorderConsent.protectionTitle')}</h3>
                      <p className="text-gray-400">{t('crossBorderConsent.protectionContent')}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-[#d3da0c]" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">{t('crossBorderConsent.acknowledgmentTitle')}</h3>
                      <p className="text-gray-400">{t('crossBorderConsent.acknowledgmentContent')}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-[#d3da0c]" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">{t('crossBorderConsent.withdrawTitle')}</h3>
                      <p className="text-gray-400">{t('crossBorderConsent.withdrawContent')}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/10 text-center">
                  <a href="mailto:support@sounditent.com">
                    <Button className="bg-[#d3da0c] text-black hover:bg-[#d3da0c]/90 px-8">
                      {t('crossBorderConsent.agreeContinue')}
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default CrossBorderConsent;
