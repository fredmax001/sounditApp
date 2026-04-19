import { useTranslation } from 'react-i18next';
import CommunityDashboard from '@/components/dashboard/CommunityDashboard';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

export default function ArtistCommunity() {
  const { t } = useTranslation();
  useSubscriptionGuard('fan_feed');
  return (
    <CommunityDashboard
      authorType="artist"
      title={t('artist.community.title')}
      subtitle={t('artist.community.subtitle')}
    />
  );
}
