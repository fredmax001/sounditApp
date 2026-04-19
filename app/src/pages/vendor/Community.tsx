import { useTranslation } from 'react-i18next';
import CommunityDashboard from '@/components/dashboard/CommunityDashboard';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

export default function VendorCommunity() {
  const { t } = useTranslation();
  useSubscriptionGuard('community_posts');
  return (
    <CommunityDashboard
      authorType="vendor"
      title={t('vendor.community.title')}
      subtitle={t('vendor.community.subtitle')}
    />
  );
}
