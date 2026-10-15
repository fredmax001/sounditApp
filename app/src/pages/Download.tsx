import { useTranslation } from 'react-i18next';
import { Download, Smartphone, Apple, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type Platform = 'android' | 'ios' | 'desktop';

const detectPlatform = (): Platform => {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  const isIOS = /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  if (isIOS) return 'ios';
  return 'desktop';
};

const DownloadPage = () => {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<Platform>('desktop');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const androidSteps = [
    t('download.android.step1', 'Tap the download button below to get the APK file.'),
    t('download.android.step2', 'If prompted, allow your browser to install unknown apps.'),
    t('download.android.step3', 'Open the downloaded file and tap Install.'),
    t('download.android.step4', 'Sign in with your Sound It account and you are ready.'),
  ];

  const iosSteps = [
    t('download.ios.step1', 'Open sounditent.com in Safari.'),
    t('download.ios.step2', 'Tap the Share button at the bottom of the screen.'),
    t('download.ios.step3', 'Scroll down and tap "Add to Home Screen".'),
    t('download.ios.step4', 'Tap Add. The Sound It app icon now lives on your home screen.'),
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <img src="/logo.png" alt="SOUND IT" className="h-12 w-auto object-contain mx-auto mb-6" />
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {t('download.title', 'Get the Sound It App')}
          </h1>
          <p className="text-gray-400">
            {t('download.subtitle', 'Events, tickets, and nightlife in your pocket.')}
          </p>
        </div>

        {(platform === 'android' || platform === 'desktop') && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/15 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-[#d3da0c]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {t('download.android.title', 'Android App')}
                </h2>
                <p className="text-gray-400 text-sm">
                  {t('download.android.version', 'Version {{v}} ({{size}} MB)', { v: '1.3', size: '18' })}
                </p>
              </div>
            </div>

            <ol className="space-y-2.5 mb-6">
              {androidSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-[#d3da0c] mt-0.5 shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <a
              href="/api/v1/download/android"
              download
              className="inline-flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3.5 rounded-xl bg-[#d3da0c] text-black font-semibold hover:bg-[#c4cf0a] transition-colors"
            >
              <Download className="w-5 h-5" />
              {t('download.android.button', 'Download APK for Android')}
            </a>
          </div>
        )}

        {(platform === 'ios' || platform === 'desktop') && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Apple className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {t('download.ios.title', 'iPhone and iPad (Web App)')}
                </h2>
                <p className="text-gray-400 text-sm">
                  {t('download.ios.hint', 'Install Sound It as a home screen web app. No App Store needed.')}
                </p>
              </div>
            </div>

            <ol className="space-y-2.5">
              {iosSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-[#d3da0c] mt-0.5 shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="text-center text-gray-500 text-sm mt-10">
          {t('download.help', 'Need help installing? Contact support@sounditent.com')}
        </p>
      </div>
    </div>
  );
};

export default DownloadPage;
