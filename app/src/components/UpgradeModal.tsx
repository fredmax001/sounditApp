import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Crown, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatPlanName } from '@/store/subscriptionStore';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string | null;
  requiredPlan: string;
  featureName?: string;
  customMessage?: string;
}

const getFeatureLabel = (featureName: string | undefined, t: any): string => {
  if (!featureName) return t('upgrade.feature') || 'This feature';
  const map: Record<string, string> = {
    analytics: t('upgrade.analytics') || 'Advanced analytics',
    table_reservations: t('upgrade.tableReservations') || 'Table reservations',
    featured_listing: t('upgrade.featuredListing') || 'Featured listing',
    push_notifications: t('upgrade.pushNotifications') || 'Push notifications',
    promo_codes: t('upgrade.promoCodes') || 'Promo codes',
    event_booths: t('upgrade.eventBooths') || 'Event booths',
    community_posts: t('upgrade.communityPosts') || 'Community posts',
    fan_feed: t('upgrade.fanFeed') || 'Fan feed',
    payouts: t('upgrade.payouts') || 'Payouts',
    earnings: t('upgrade.earnings') || 'Earnings',
    verified_badge: t('upgrade.verifiedBadge') || 'Verified badge',
    homepage_spotlight: t('upgrade.homepageSpotlight') || 'Homepage spotlight',
    priority_support: t('upgrade.prioritySupport') || 'Priority support',
    event_creation: t('upgrade.eventCreation') || 'Unlimited event creation',
    portfolio_limit: t('upgrade.portfolioLimit') || 'Product portfolio',
    media_limit: t('upgrade.mediaLimit') || 'Media uploads',
  };
  return map[featureName] || featureName;
};

const getPresetMessage = (
  featureName: string | undefined,
  currentPlan: string | null,
  requiredPlan: string,
  t: any
): string => {
  if (featureName === 'table_reservations') {
    return t('upgrade.tableReservationsMessage') || `Table reservation packages are only available for Pro and Premium Business plans.`;
  }
  if (featureName === 'featured_listing') {
    return t('upgrade.featuredListingMessage') || `Featured event placement is only available on Pro and Premium plans.`;
  }
  if (featureName === 'event_creation') {
    return t('upgrade.eventLimitMessage') || `You have reached your event limit. Upgrade to Pro for unlimited event creation.`;
  }
  if (featureName === 'analytics') {
    return t('upgrade.analyticsMessage') || `Advanced analytics are only available on Premium plans.`;
  }
  return t('upgrade.defaultMessage', {
    feature: getFeatureLabel(featureName, t),
    currentPlan: formatPlanName(currentPlan),
    requiredPlan: formatPlanName(requiredPlan),
  }) || `You are currently on the ${formatPlanName(currentPlan)} plan. This feature is available on the ${formatPlanName(requiredPlan)} plan and above.`;
};

const UpgradeModal = ({
  isOpen,
  onClose,
  currentPlan,
  requiredPlan,
  featureName,
  customMessage,
}: UpgradeModalProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onClose();
    navigate('/subscriptions');
  };

  const message = customMessage || getPresetMessage(featureName, currentPlan, requiredPlan, t);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[#d3da0c]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-[#d3da0c]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {t('upgrade.title') || 'Upgrade Required'}
              </h2>
              <p className="text-gray-400">{message}</p>
            </div>

            <div className="bg-white/5 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">{t('upgrade.currentPlan') || 'Current Plan'}</span>
                <span className="text-white font-medium">{formatPlanName(currentPlan)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">{t('upgrade.requiredPlan') || 'Required Plan'}</span>
                <span className="text-[#d3da0c] font-semibold flex items-center gap-1">
                  {requiredPlan === 'premium' ? (
                    <Crown className="w-4 h-4" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {formatPlanName(requiredPlan)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors font-medium"
              >
                {t('upgrade.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleUpgrade}
                className="flex-1 py-3 bg-[#d3da0c] text-black rounded-lg hover:bg-[#bbc10b] transition-colors font-bold"
              >
                {t('upgrade.upgradePlan') || 'Upgrade Plan'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default UpgradeModal;
