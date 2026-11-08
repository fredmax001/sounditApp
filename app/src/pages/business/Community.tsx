import { useTranslation } from 'react-i18next';
import CommunityDashboard from '@/components/dashboard/CommunityDashboard';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

export default function BusinessCommunity() {
  const { t } = useTranslation();
  useSubscriptionGuard('community_posts');
  return (
    <CommunityDashboard
      authorType="business"
      title={t('business.community.title')}
      subtitle={t('business.community.subtitle')}
    />
  );
}
