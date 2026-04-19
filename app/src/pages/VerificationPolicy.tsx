import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, UserCheck, AlertCircle, Lock, Mail, FileCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

const VerificationPolicy = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('verificationPolicy.pageTitle');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('verificationPolicy.metaDescription'));
    }
  }, [t]);

  const sections = [
    { id: 'requirements', title: t('verificationPolicy.requirementsTitle'), icon: FileCheck, content: t('verificationPolicy.requirementsContent') },
    { id: 'purpose', title: t('verificationPolicy.purposeTitle'), icon: Shield, content: t('verificationPolicy.purposeContent') },
    { id: 'responsibility', title: t('verificationPolicy.responsibilityTitle'), icon: UserCheck, content: t('verificationPolicy.responsibilityContent') },
    { id: 'consequences', title: t('verificationPolicy.consequencesTitle'), icon: AlertCircle, content: t('verificationPolicy.consequencesContent') },
    { id: 'data', title: t('verificationPolicy.dataTitle'), icon: Lock, content: t('verificationPolicy.dataContent') },
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
              <UserCheck className="w-4 h-4 text-[#d3da0c]" />
              <span className="text-sm text-[#d3da0c] font-medium">{t('verificationPolicy.identity')}</span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-6">
              {t('verificationPolicy.realName')} <span className="text-[#d3da0c]">{t('verificationPolicy.verification')}</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t('verificationPolicy.introduction')}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-[#d3da0c]" /><span>{t('verificationPolicy.effectiveDate')}</span></div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="glass">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">{t('verificationPolicy.contents')}</h2>
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

      {/* Contact Banner */}
      <section className="py-12 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="glass">
            <CardContent className="p-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#d3da0c]/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-[#d3da0c]" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">{t('verificationPolicy.questionsTitle')}</h2>
                <p className="text-gray-400 mb-6">{t('verificationPolicy.questionsSubtitle')}</p>
                <a href="mailto:support@sounditent.com" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#d3da0c]/10 text-[#d3da0c] hover:bg-[#d3da0c]/20 transition-colors">
                  <Mail className="w-4 h-4" />
                  support@sounditent.com
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default VerificationPolicy;
