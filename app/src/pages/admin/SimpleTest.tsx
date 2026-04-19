import { useTranslation } from 'react-i18next';

const SimpleTest = () => {
  const { t } = useTranslation();
  // Removed console.log for production
  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-bold mb-4">{t('admin.simpleTest.title')}</h1>
      <p>{t('admin.simpleTest.description')}</p>
      <p className="mt-4 text-gray-400">{t('admin.simpleTest.hint')}</p>
    </div>
  );
};

export default SimpleTest;
