import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, RotateCcw, AlertCircle, Clock, Shield, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

const RefundPolicy = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('refundPolicy.pageTitle');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('refundPolicy.metaDescription'));
    }
  }, [t]);

  const sections = [
    {
      id: 'processing',
      title: t('refundPolicy.processingTitle'),
      icon: CreditCard,
      content: t('refundPolicy.processingContent'),
    },
    {
      id: 'pricing',
      title: t('refundPolicy.pricingTitle'),
      icon: RotateCcw,
      content: t('refundPolicy.pricingContent'),
    },
    {
      id: 'refunds',
      title: t('refundPolicy.refundsTitle'),
      icon: Shield,
      content: t('refundPolicy.refundsContent'),
    },
    {
      id: 'time',
      title: t('refundPolicy.timeTitle'),
      icon: Clock,
      content: t('refundPolicy.timeContent'),
    },
    {
      id: 'disputes',
      title: t('refundPolicy.disputesTitle'),
      icon: AlertCircle,
      content: t('refundPolicy.disputesContent'),
    },
    {
      id: 'fraud',
      title: t('refundPolicy.fraudTitle'),
      icon: Shield,
      content: t('refundPolicy.fraudContent'),
    },
    {
      id: 'liability',
      title: t('refundPolicy.liabilityTitle'),
      icon: AlertCircle,
      content: t('refundPolicy.liabilityContent'),
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
              <CreditCard className="w-4 h-4 text-[#d3da0c]" />
              <span className="text-sm text-[#d3da0c] font-medium">{t('refundPolicy.payments')}</span>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-6">
              {t('refundPolicy.paymentAnd')} <span className="text-[#d3da0c]">{t('refundPolicy.refundPolicy')}</span>
            </h1>

            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('refundPolicy.introduction')}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#d3da0c]" />
                <span>{t('refundPolicy.effectiveDate')}</span>
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
              <h2 className="text-lg font-semibold text-white mb-4">{t('refundPolicy.contents')}</h2>
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

      {/* Policy Content */}
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

      {/* Contact Support */}
      <section className="py-16 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="glass">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-8 h-8 text-[#d3da0c]" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-xl font-semibold text-white mb-2">{t('refundPolicy.haveQuestions')}</h3>
                  <p className="text-gray-400 mb-4">{t('refundPolicy.supportSubtitle')}</p>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                    <a href="mailto:support@sounditent.com" className="text-[#d3da0c] hover:underline">
                      support@sounditent.com
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default RefundPolicy;
