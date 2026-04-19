import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye, UserCheck, Server, Globe, FileText, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

const Privacy = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('privacy.pageTitle');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('privacy.metaDescription'));
    }
  }, [t]);

  const sections = [
    {
      id: 'intro',
      title: t('privacy.introTitle'),
      icon: FileText,
      content: t('privacy.introContent'),
    },
    {
      id: 'collect',
      title: t('privacy.collectTitle'),
      icon: Eye,
      content: t('privacy.collectContent'),
    },
    {
      id: 'use',
      title: t('privacy.useTitle'),
      icon: FileText,
      content: t('privacy.useContent'),
    },
    {
      id: 'legal',
      title: t('privacy.legalTitle'),
      icon: Shield,
      content: t('privacy.legalContent'),
    },
    {
      id: 'storage',
      title: t('privacy.storageTitle'),
      icon: Server,
      content: t('privacy.storageContent'),
    },
    {
      id: 'share',
      title: t('privacy.shareTitle'),
      icon: Globe,
      content: t('privacy.shareContent'),
    },
    {
      id: 'sensitive',
      title: t('privacy.sensitiveTitle'),
      icon: Lock,
      content: t('privacy.sensitiveContent'),
    },
    {
      id: 'retention',
      title: t('privacy.retentionTitle'),
      icon: Server,
      content: t('privacy.retentionContent'),
    },
    {
      id: 'rights',
      title: t('privacy.rightsTitle'),
      icon: UserCheck,
      content: t('privacy.rightsContent'),
    },
    {
      id: 'security',
      title: t('privacy.securityTitle'),
      icon: Lock,
      content: t('privacy.securityContent'),
    },
    {
      id: 'thirdparty',
      title: t('privacy.thirdPartyTitle'),
      icon: Globe,
      content: t('privacy.thirdPartyContent'),
    },
    {
      id: 'minors',
      title: t('privacy.minorsTitle'),
      icon: UserCheck,
      content: t('privacy.minorsContent'),
    },
    {
      id: 'changes',
      title: t('privacy.changesTitle'),
      icon: FileText,
      content: t('privacy.changesContent'),
    },
    {
      id: 'contact',
      title: t('privacy.contactTitle'),
      icon: Mail,
      content: t('privacy.contactContent'),
    },
    {
      id: 'dispute',
      title: t('privacy.disputeTitle'),
      icon: Shield,
      content: t('privacy.disputeContent'),
    },
  ];

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#d3da0c]/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#d3da0c]/10 rounded-full blur-[150px]" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d3da0c]/10 border border-[#d3da0c]/20 mb-6">
              <Shield className="w-4 h-4 text-[#d3da0c]" />
              <span className="text-sm text-[#d3da0c] font-medium">{t('privacy.pipliCompliant')}</span>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-6">
              {t('privacy.privacy')} <span className="text-[#d3da0c]">{t('privacy.policy')}</span>
            </h1>

            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('privacy.introduction')}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#d3da0c]" />
                <span>{t('privacy.effectiveDate')}</span>
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
              <h2 className="text-lg font-semibold text-white mb-4">{t('privacy.contents')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
                  >
                    <section.icon className="w-4 h-4 text-[#d3da0c]" />
                    <span>{section.title}</span>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Privacy Content */}
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
                  <div className="w-10 h-10 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                    <section.icon className="w-5 h-5 text-[#d3da0c]" />
                  </div>
                  <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                </div>

                <div
                  className="pl-13 prose prose-invert prose-gray max-w-none prose-p:text-gray-400 prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-white prose-ul:text-gray-400 prose-ul:space-y-2 prose-li:marker:text-[#d3da0c]"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
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
                <h2 className="text-xl font-semibold text-white mb-2">{t('privacy.questionsTitle')}</h2>
                <p className="text-gray-400 mb-6">{t('privacy.questionsSubtitle')}</p>
                <a
                  href="mailto:support@sounditent.com"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#d3da0c]/10 text-[#d3da0c] hover:bg-[#d3da0c]/20 transition-colors"
                >
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

export default Privacy;
