import { useTranslation } from 'react-i18next';
import CommunityDashboard from '@/components/dashboard/CommunityDashboard';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

export default function VendorCommunity() {
  const { t } = useTranslation();
  useSubscriptionGuard('community_posts');
  return (
    <div className="min-h-screen pt-20 lg:pt-10 pb-4 px-4 lg:px-10">
      <CommunityDashboard
        authorType="vendor"
        title={t('vendor.community.title')}
        subtitle={t('vendor.community.subtitle')}
      />
    </div>
  );
}
