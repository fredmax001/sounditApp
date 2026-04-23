import { useTranslation } from 'react-i18next';
import CommunityDashboard from '@/components/dashboard/CommunityDashboard';

export default function BusinessCommunity() {
  const { t } = useTranslation();
  return (
    <CommunityDashboard
      authorType="business"
      title={t('business.community.title')}
      subtitle={t('business.community.subtitle')}
    />
  );
}
