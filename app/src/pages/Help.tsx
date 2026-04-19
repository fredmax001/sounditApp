import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Ticket,
  CreditCard,
  User,
  Calendar,
  Music,
  ShoppingBag,
  Mail,
  MessageCircle,
  Clock,
  HelpCircle,
  AlertCircle,
  Shield,
  FileText,
  Scale,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 },
  },
};

const Help = () => {
  const { t } = useTranslation();

  const categories = [
    { id: 'all', label: t('help.categories.all'), icon: HelpCircle },
    { id: 'getting-started', label: t('help.categories.gettingStarted'), icon: User },
    { id: 'tickets', label: t('help.categories.ticketsPayments'), icon: Ticket },
    { id: 'account', label: t('help.categories.account'), icon: User },
    { id: 'organizers', label: t('help.categories.organizers'), icon: Calendar },
    { id: 'artists', label: t('help.categories.artists'), icon: Music },
    { id: 'vendors', label: t('help.categories.vendors'), icon: ShoppingBag },
  ];

  const faqs = [
    {
      id: 'gs-1',
      category: 'getting-started',
      question: t('help.faq.gs1Question'),
      answer: t('help.faq.gs1Answer'),
    },
    {
      id: 'gs-2',
      category: 'getting-started',
      question: t('help.faq.gs2Question'),
      answer: t('help.faq.gs2Answer'),
    },
    {
      id: 'gs-3',
      category: 'getting-started',
      question: t('help.faq.gs3Question'),
      answer: t('help.faq.gs3Answer'),
    },
    {
      id: 'tp-1',
      category: 'tickets',
      question: t('help.faq.tp1Question'),
      answer: t('help.faq.tp1Answer'),
    },
    {
      id: 'tp-2',
      category: 'tickets',
      question: t('help.faq.tp2Question'),
      answer: t('help.faq.tp2Answer'),
    },
    {
      id: 'tp-3',
      category: 'tickets',
      question: t('help.faq.tp3Question'),
      answer: t('help.faq.tp3Answer'),
    },
    {
      id: 'tp-4',
      category: 'tickets',
      question: t('help.faq.tp4Question'),
      answer: t('help.faq.tp4Answer'),
    },
    {
      id: 'tp-5',
      category: 'tickets',
      question: t('help.faq.tp5Question'),
      answer: t('help.faq.tp5Answer'),
    },
    {
      id: 'tp-6',
      category: 'tickets',
      question: t('help.faq.tp6Question'),
      answer: t('help.faq.tp6Answer'),
    },
    {
      id: 'ac-1',
      category: 'account',
      question: t('help.faq.ac1Question'),
      answer: t('help.faq.ac1Answer'),
    },
    {
      id: 'ac-2',
      category: 'account',
      question: t('help.faq.ac2Question'),
      answer: t('help.faq.ac2Answer'),
    },
    {
      id: 'ac-3',
      category: 'account',
      question: t('help.faq.ac3Question'),
      answer: t('help.faq.ac3Answer'),
    },
    {
      id: 'ac-4',
      category: 'account',
      question: t('help.faq.ac4Question'),
      answer: t('help.faq.ac4Answer'),
    },
    {
      id: 'or-1',
      category: 'organizers',
      question: t('help.faq.or1Question'),
      answer: t('help.faq.or1Answer'),
    },
    {
      id: 'or-2',
      category: 'organizers',
      question: t('help.faq.or2Question'),
      answer: t('help.faq.or2Answer'),
    },
    {
      id: 'or-3',
      category: 'organizers',
      question: t('help.faq.or3Question'),
      answer: t('help.faq.or3Answer'),
    },
    {
      id: 'or-4',
      category: 'organizers',
      question: t('help.faq.or4Question'),
      answer: t('help.faq.or4Answer'),
    },
    {
      id: 'ar-1',
      category: 'artists',
      question: t('help.faq.ar1Question'),
      answer: t('help.faq.ar1Answer'),
    },
    {
      id: 'ar-2',
      category: 'artists',
      question: t('help.faq.ar2Question'),
      answer: t('help.faq.ar2Answer'),
    },
    {
      id: 'ar-3',
      category: 'artists',
      question: t('help.faq.ar3Question'),
      answer: t('help.faq.ar3Answer'),
    },
    {
      id: 've-1',
      category: 'vendors',
      question: t('help.faq.ve1Question'),
      answer: t('help.faq.ve1Answer'),
    },
    {
      id: 've-2',
      category: 'vendors',
      question: t('help.faq.ve2Question'),
      answer: t('help.faq.ve2Answer'),
    },
    {
      id: 've-3',
      category: 'vendors',
      question: t('help.faq.ve3Question'),
      answer: t('help.faq.ve3Answer'),
    },
  ];

  const quickLinks = [
    { title: t('help.quickLinks.buyTickets'), icon: Ticket, path: '/events' },
    { title: t('help.quickLinks.paymentIssues'), icon: CreditCard, action: 'scroll', target: 'faq' },
    { title: t('help.quickLinks.accountSettings'), icon: User, path: '/settings' },
    { title: t('help.quickLinks.contactSupport'), icon: Mail, action: 'scroll', target: 'contact' },
  ];

  const policySections = [
    { id: 'purpose', title: t('help.policy.purposeTitle'), icon: FileText, content: t('help.policy.purposeContent') },
    { id: 'categories', title: t('help.policy.categoriesTitle'), icon: HelpCircle, content: t('help.policy.categoriesContent') },
    { id: 'support', title: t('help.policy.supportTitle'), icon: Shield, content: t('help.policy.supportContent') },
    { id: 'contact', title: t('help.policy.contactTitle'), icon: Mail, content: t('help.policy.contactContent') },
    { id: 'liability', title: t('help.policy.liabilityTitle'), icon: AlertCircle, content: t('help.policy.liabilityContent') },
    { id: 'modifications', title: t('help.policy.modificationsTitle'), icon: Clock, content: t('help.policy.modificationsContent') },
    { id: 'governing', title: t('help.policy.governingTitle'), icon: Scale, content: t('help.policy.governingContent') },
    { id: 'final', title: t('help.policy.finalTitle'), icon: Lock, content: t('help.policy.finalContent') },
  ];

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = t('help.pageTitle');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t('help.metaDescription'));
    }
  }, [t]);

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchesSearch = searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const scrollToSection = (target: string) => {
    const element = document.getElementById(target);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#d3da0c]/5 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#d3da0c]/10 rounded-full blur-[150px]" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d3da0c]/10 border border-[#d3da0c]/20 mb-6">
              <HelpCircle className="w-4 h-4 text-[#d3da0c]" />
              <span className="text-sm text-[#d3da0c] font-medium">{t('help.helpCenter')}</span>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4">
              {t('help.heroTitle')} <span className="text-[#d3da0c]">{t('help.heroHighlight')}</span>
            </h1>

            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
              {t('help.subtitle')}
            </p>

            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder={t('help.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-6 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-xl text-lg"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickLinks.map((link) => (
              <motion.div key={link.title} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card
                  className="glass cursor-pointer hover:border-[#d3da0c]/30 transition-all"
                  onClick={() => {
                    if (link.action === 'scroll' && link.target) {
                      scrollToSection(link.target);
                    } else if (link.path) {
                      window.location.href = link.path;
                    }
                  }}
                >
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center mb-3">
                      <link.icon className="w-5 h-5 text-[#d3da0c]" />
                    </div>
                    <span className="text-white font-medium text-sm">{link.title}</span>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Policy Sections */}
      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-10">
            {policySections.map((section, index) => (
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

      {/* Category Tabs */}
      <section className="py-8 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${activeCategory === cat.id
                    ? 'bg-[#d3da0c] text-black'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-bold text-white mb-2">{t('help.faqTitle')}</h2>
              <p className="text-gray-400">{t('help.faqSubtitle')}</p>
            </div>
            <Accordion type="single" collapsible className="space-y-4">
              <AnimatePresence mode="wait">
                {filteredFaqs.map((faq) => (
                  <motion.div
                    key={faq.id}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <AccordionItem
                      value={faq.id}
                      className="glass rounded-xl border-0 overflow-hidden"
                    >
                      <AccordionTrigger className="px-6 py-4 text-left text-white hover:text-[#d3da0c] hover:no-underline [&[data-state=open]]:text-[#d3da0c]">
                        <span className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                            <HelpCircle className="w-4 h-4 text-[#d3da0c]" />
                          </span>
                          <span className="font-medium">{faq.question}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-4">
                        <div className="pl-11 text-gray-400 leading-relaxed">
                          {faq.answer}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </motion.div>
                ))}
              </AnimatePresence>
            </Accordion>

            {filteredFaqs.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">{t('help.noResults')}</h3>
                <p className="text-gray-400">{t('help.adjustSearch')}</p>
                <Button
                  variant="outline"
                  className="mt-4 border-[#d3da0c]/30 text-[#d3da0c]"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('all');
                  }}
                >
                  {t('help.clearFilters')}
                </Button>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Contact Support Section */}
      <section id="contact" className="py-16 md:py-24 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
                {t('help.stillNeedHelp')}
              </h2>
              <p className="text-gray-400">{t('help.supportTeam')}</p>
            </div>

            <Card className="glass">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#d3da0c]/10 flex items-center justify-center mb-4">
                      <Mail className="w-6 h-6 text-[#d3da0c]" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">{t('help.emailSupport')}</h3>
                    <a href="mailto:support@sounditent.com" className="text-[#d3da0c] hover:underline">
                      support@sounditent.com
                    </a>
                    <p className="text-gray-500 text-sm mt-2">{t('help.avgResponse')}</p>
                  </div>

                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#d3da0c]/10 flex items-center justify-center mb-4">
                      <MessageCircle className="w-6 h-6 text-[#d3da0c]" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">{t('help.weChatSupport')}</h3>
                    <p className="text-[#d3da0c]">@soundit_events</p>
                    <p className="text-gray-500 text-sm mt-2">{t('help.addOnWeChat')}</p>
                  </div>

                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#d3da0c]/10 flex items-center justify-center mb-4">
                      <Clock className="w-6 h-6 text-[#d3da0c]" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">{t('help.supportHours')}</h3>
                    <p className="text-gray-400">{t('help.supportHoursValue')}</p>
                    <p className="text-gray-500 text-sm mt-2">{t('help.timezone')}</p>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/10 text-center">
                  <p className="text-gray-400 text-sm">{t('help.urgentIssues')}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Help;
