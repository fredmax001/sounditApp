import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, FileCheck, Scale, Shield, Globe, CreditCard, Lock, AlertCircle, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

const UserAgreement = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('userAgreement.pageTitle');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('userAgreement.metaDescription'));
    }
  }, [t]);

  const sections = [
    { id: 'scope', title: t('userAgreement.scopeTitle'), icon: Globe, content: t('userAgreement.scopeContent') },
    { id: 'registration', title: t('userAgreement.registrationTitle'), icon: FileCheck, content: t('userAgreement.registrationContent') },
    { id: 'conduct', title: t('userAgreement.conductTitle'), icon: Shield, content: t('userAgreement.conductContent') },
    { id: 'transactions', title: t('userAgreement.transactionsTitle'), icon: CreditCard, content: t('userAgreement.transactionsContent') },
    { id: 'fees', title: t('userAgreement.feesTitle'), icon: CreditCard, content: t('userAgreement.feesContent') },
    { id: 'ip', title: t('userAgreement.ipTitle'), icon: Lock, content: t('userAgreement.ipContent') },
    { id: 'liability', title: t('userAgreement.liabilityTitle'), icon: AlertCircle, content: t('userAgreement.liabilityContent') },
    { id: 'termination', title: t('userAgreement.terminationTitle'), icon: Shield, content: t('userAgreement.terminationContent') },
    { id: 'law', title: t('userAgreement.lawTitle'), icon: Scale, content: t('userAgreement.lawContent') },
    { id: 'updates', title: t('userAgreement.updatesTitle'), icon: ScrollText, content: t('userAgreement.updatesContent') },
  ];

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* Hero */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#d3da0c]/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#d3da0c]/10 rounded-full blur-[150px]" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d3da0c]/10 border border-[#d3da0c]/20 mb-6">
              <ScrollText className="w-4 h-4 text-[#d3da0c]" />
              <span className="text-sm text-[#d3da0c] font-medium">{t('userAgreement.legal')}</span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-6">
              {t('userAgreement.user')} <span className="text-[#d3da0c]">{t('userAgreement.agreement')}</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t('userAgreement.introduction')}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2"><FileCheck className="w-4 h-4 text-[#d3da0c]" /><span>{t('userAgreement.effectiveDate')}</span></div>
              <div className="flex items-center gap-2"><Scale className="w-4 h-4 text-[#d3da0c]" /><span>{t('userAgreement.governedByChineseLaw')}</span></div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="glass">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">{t('userAgreement.contents')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sections.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm">
                    <s.icon className="w-4 h-4 text-[#d3da0c]" /><span>{s.title}</span>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Content */}
      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {sections.map((s, i) => (
              <motion.div key={s.id} id={s.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.05 }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                    <s.icon className="w-5 h-5 text-[#d3da0c]" />
                  </div>
                  <h2 className="text-xl font-semibold text-white">{s.title}</h2>
                </div>
                <div className="pl-13 prose prose-invert prose-gray max-w-none prose-p:text-gray-400 prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-white prose-ul:text-gray-400 prose-ul:space-y-2 prose-li:marker:text-[#d3da0c]" dangerouslySetInnerHTML={{ __html: s.content }} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Agreement Banner */}
      <section className="py-12 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="glass border-[#d3da0c]/20">
            <CardContent className="p-6 flex flex-col md:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-[#d3da0c]" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-white font-semibold mb-1">{t('userAgreement.agreementBannerTitle')}</h3>
                <p className="text-gray-400 text-sm">{t('userAgreement.agreementBannerContent')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default UserAgreement;
