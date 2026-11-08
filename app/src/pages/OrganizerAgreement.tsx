import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, FileCheck, Scale, Shield, Globe, CreditCard, Lock, AlertCircle, Mail, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

const OrganizerAgreement = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('organizerAgreement.pageTitle');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('organizerAgreement.metaDescription'));
    }
  }, [t]);

  const sections = [
    { id: 'role', title: t('organizerAgreement.roleTitle'), icon: Globe, content: t('organizerAgreement.roleContent') },
    { id: 'responsibilities', title: t('organizerAgreement.responsibilitiesTitle'), icon: Users, content: t('organizerAgreement.responsibilitiesContent') },
    { id: 'ticketing', title: t('organizerAgreement.ticketingTitle'), icon: Calendar, content: t('organizerAgreement.ticketingContent') },
    { id: 'payments', title: t('organizerAgreement.paymentsTitle'), icon: CreditCard, content: t('organizerAgreement.paymentsContent') },
    { id: 'refunds', title: t('organizerAgreement.refundsTitle'), icon: Shield, content: t('organizerAgreement.refundsContent') },
    { id: 'fees', title: t('organizerAgreement.feesTitle'), icon: CreditCard, content: t('organizerAgreement.feesContent') },
    { id: 'prohibited', title: t('organizerAgreement.prohibitedTitle'), icon: AlertCircle, content: t('organizerAgreement.prohibitedContent') },
    { id: 'ip', title: t('organizerAgreement.ipTitle'), icon: Lock, content: t('organizerAgreement.ipContent') },
    { id: 'data', title: t('organizerAgreement.dataTitle'), icon: Shield, content: t('organizerAgreement.dataContent') },
    { id: 'liability', title: t('organizerAgreement.liabilityTitle'), icon: AlertCircle, content: t('organizerAgreement.liabilityContent') },
    { id: 'platform-rights', title: t('organizerAgreement.platformRightsTitle'), icon: Shield, content: t('organizerAgreement.platformRightsContent') },
    { id: 'risk', title: t('organizerAgreement.riskTitle'), icon: AlertCircle, content: t('organizerAgreement.riskContent') },
    { id: 'termination', title: t('organizerAgreement.terminationTitle'), icon: Shield, content: t('organizerAgreement.terminationContent') },
    { id: 'law', title: t('organizerAgreement.lawTitle'), icon: Scale, content: t('organizerAgreement.lawContent') },
    { id: 'updates', title: t('organizerAgreement.updatesTitle'), icon: FileCheck, content: t('organizerAgreement.updatesContent') },
    { id: 'entire', title: t('organizerAgreement.entireTitle'), icon: FileCheck, content: t('organizerAgreement.entireContent') },
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
              <Calendar className="w-4 h-4 text-[#d3da0c]" />
              <span className="text-sm text-[#d3da0c] font-medium">{t('organizerAgreement.forOrganizers')}</span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-6">
              {t('organizerAgreement.organizer')} <span className="text-[#d3da0c]">{t('organizerAgreement.agreement')}</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t('organizerAgreement.introduction')}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2"><FileCheck className="w-4 h-4 text-[#d3da0c]" /><span>{t('organizerAgreement.effectiveDate')}</span></div>
              <div className="flex items-center gap-2"><Scale className="w-4 h-4 text-[#d3da0c]" /><span>{t('organizerAgreement.governedByChineseLaw')}</span></div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="glass">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">{t('organizerAgreement.contents')}</h2>
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
                <h2 className="text-xl font-semibold text-white mb-2">{t('organizerAgreement.questionsTitle')}</h2>
                <p className="text-gray-400 mb-6">{t('organizerAgreement.questionsSubtitle')}</p>
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

export default OrganizerAgreement;
