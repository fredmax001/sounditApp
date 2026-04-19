import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, FileCheck, AlertCircle, Scale, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

const Terms = () => {
  const { t } = useTranslation();
  // SEO
  useEffect(() => {
    document.title = t('terms.pageTitle');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('terms.metaDescription'));
    }
  }, [t]);

  const sections = [
    {
      id: 'acceptance',
      title: t('terms.acceptanceOfTermsTitle'),
      content: t('terms.acceptanceOfTermsContent')
    },
    {
      id: 'registration',
      title: t('terms.accountRegistrationTitle'),
      content: t('terms.accountRegistrationContent')
    },
    {
      id: 'services',
      title: t('terms.platformServicesTitle'),
      content: t('terms.platformServicesContent')
    },
    {
      id: 'payments',
      title: t('terms.paymentsAndTicketsTitle'),
      content: t('terms.paymentsAndTicketsContent')
    },
    {
      id: 'conduct',
      title: t('terms.contentAndConductTitle'),
      content: t('terms.contentAndConductContent')
    },
    {
      id: 'ip',
      title: t('terms.intellectualPropertyTitle'),
      content: t('terms.intellectualPropertyContent')
    },
    {
      id: 'termination',
      title: t('terms.terminationTitle'),
      content: t('terms.terminationContent')
    },
    {
      id: 'liability',
      title: t('terms.limitationOfLiabilityTitle'),
      content: t('terms.limitationOfLiabilityContent')
    },
    {
      id: 'changes',
      title: t('terms.changesToTermsTitle'),
      content: t('terms.changesToTermsContent')
    },
    {
      id: 'contact',
      title: t('terms.contactUsTitle'),
      content: t('terms.contactUsContent')
    },
  ];

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#d3da0c]/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#d3da0c]/10 rounded-full blur-[150px]" />
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d3da0c]/10 border border-[#d3da0c]/20 mb-6">
              <ScrollText className="w-4 h-4 text-[#d3da0c]" />
              <span className="text-sm text-[#d3da0c] font-medium">{t('terms.legal')}</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-6">{t('terms.termsOf')}<span className="text-[#d3da0c]">{t('terms.service')}</span>
            </h1>
            
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t('terms.pleaseReadTheseTermsCarefullyBeforeUsingTheSoundItChinaPlatformByUsingOurServicesYouAgreeToBeBoundByTheseTerms')}</p>

            <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#d3da0c]" />
                <span>{t('terms.effectiveDateApril32026')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#d3da0c]" />
                <span>{t('terms.governedByChineseLaw')}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="glass">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#d3da0c]" />{t('terms.tableOfContents')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
                  >
                    <span className="text-[#d3da0c]">{section.title.split('.')[0]}.</span>
                    <span>{section.title.split('. ')[1]}</span>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Terms Content */}
      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {sections.map((section, index) => (
              <motion.div
                key={section.id}
                id={section.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-[#d3da0c]">
                      {section.title.split('.')[0]}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-white">
                    {section.title.split('. ')[1]}
                  </h2>
                </div>
                
                <div 
                  className="pl-11 prose prose-invert prose-gray max-w-none prose-p:text-gray-400 prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-white prose-ul:text-gray-400 prose-ul:space-y-2 prose-li:marker:text-[#d3da0c]"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
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
                <h3 className="text-white font-semibold mb-1">{t('terms.yourAgreementMatters')}</h3>
                <p className="text-gray-400 text-sm">{t('terms.byContinuingToUseSoundItChinaYouAcknowledgeThatYouHaveReadUnderstoodAndAgreeToBeBoundByTheseTermsOfService')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Terms;
