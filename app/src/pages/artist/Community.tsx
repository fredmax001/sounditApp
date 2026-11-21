import { useTranslation } from 'react-i18next';
import CommunityDashboard from '@/components/dashboard/CommunityDashboard';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

export default function ArtistCommunity() {
  const { t } = useTranslation();
  useSubscriptionGuard('fan_feed');
  return (
    <div className="min-h-dvh w-full max-w-4xl min-w-0 overflow-x-hidden bg-[#020b00] text-white pb-[calc(6rem+env(safe-area-inset-bottom,24px))] pt-2 px-4 sm:px-6 lg:px-8 mx-auto">
      <CommunityDashboard
        authorType="artist"
        title={t('artist.community.title')}
        subtitle={t('artist.community.subtitle')}
      />
    </div>
  );
}
