import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, QrCode, Monitor, Check, Download, Share2, ImageDown } from 'lucide-react';

interface MobileQrPaymentProps {
  amount?: number | null;
  wechatQrUrl?: string | null;
  alipayQrUrl?: string | null;
  paymentInstructions?: string | null;
}

const MobileQrPayment = ({ amount, wechatQrUrl, alipayQrUrl, paymentInstructions }: MobileQrPaymentProps) => {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState<boolean>(true);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const hasWeChat = !!wechatQrUrl;
  const hasAlipay = !!alipayQrUrl;
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open image in new tab
      window.open(url, '_blank');
    }
  };

  const shareQr = async () => {
    if (!canShare) return;
    try {
      await navigator.share({
        title: t('eventDetail.shareEvent'),
        text: paymentInstructions || t('eventDetail.scanToPay'),
        url: window.location.href,
      });
    } catch {
      // User cancelled or share failed
    }
  };

  // Desktop view: large QR codes for phone scanning
  if (!isMobile) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {hasWeChat && (
            <div className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 rounded-xl">
              <QrCode className="w-6 h-6 text-[#d3da0c]" />
              <span className="text-white text-sm font-medium">WeChat Pay</span>
            </div>
          )}
          {hasAlipay && (
            <div className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 rounded-xl">
              <QrCode className="w-6 h-6 text-[#d3da0c]" />
              <span className="text-white text-sm font-medium">Alipay</span>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-4">
          {hasWeChat && (
            <div className="flex flex-col items-center">
              <img
                src={wechatQrUrl}
                alt="WeChat Pay QR"
                className="w-40 h-40 object-contain rounded-lg bg-white p-2"
              />
              <span className="text-white/60 text-xs mt-2">WeChat Pay</span>
            </div>
          )}
          {hasAlipay && (
            <div className="flex flex-col items-center">
              <img
                src={alipayQrUrl}
                alt="Alipay QR"
                className="w-40 h-40 object-contain rounded-lg bg-white p-2"
              />
              <span className="text-white/60 text-xs mt-2">Alipay</span>
            </div>
          )}
        </div>

        <div className="bg-white/5 rounded-xl p-4 flex items-start gap-3">
          <Monitor className="w-4 h-4 text-[#d3da0c] shrink-0 mt-0.5" />
          <p className="text-gray-400 text-xs leading-relaxed">
            {t('eventDetail.desktopPayInstructions')}
          </p>
        </div>

        {paymentInstructions && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <p className="text-yellow-400 text-xs leading-relaxed">{paymentInstructions}</p>
          </div>
        )}

        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-1">
          <p className="text-yellow-400 text-xs flex items-start gap-2">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {t('eventDetail.step1Scan')}
          </p>
          <p className="text-yellow-400 text-xs flex items-start gap-2">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {t('eventDetail.step2Pay')}
          </p>
          <p className="text-yellow-400 text-xs flex items-start gap-2">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {t('eventDetail.step3Confirm')}
          </p>
        </div>
      </div>
    );
  }

  // Mobile view
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {hasWeChat && (
          <div className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 rounded-xl">
            <QrCode className="w-6 h-6 text-[#d3da0c]" />
            <span className="text-white text-sm font-medium">WeChat Pay</span>
          </div>
        )}
        {hasAlipay && (
          <div className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 rounded-xl">
            <QrCode className="w-6 h-6 text-[#d3da0c]" />
            <span className="text-white text-sm font-medium">Alipay</span>
          </div>
        )}
      </div>

      {/* QR Codes with download buttons */}
      <div className="flex justify-center gap-4">
        {hasWeChat && (
          <div className="flex flex-col items-center gap-2">
            <img
              src={wechatQrUrl}
              alt="WeChat Pay QR"
              className="w-36 h-36 object-contain rounded-lg bg-white p-2"
            />
            <button
              onClick={() => wechatQrUrl && downloadImage(wechatQrUrl, 'wechat-pay-qr.png')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d3da0c]/10 border border-[#d3da0c]/20 rounded-lg text-[#d3da0c] text-xs font-medium active:scale-95 transition-transform"
            >
              <Download className="w-3.5 h-3.5" />
              {t('eventDetail.saveQr')}
            </button>
          </div>
        )}
        {hasAlipay && (
          <div className="flex flex-col items-center gap-2">
            <img
              src={alipayQrUrl}
              alt="Alipay QR"
              className="w-36 h-36 object-contain rounded-lg bg-white p-2"
            />
            <button
              onClick={() => alipayQrUrl && downloadImage(alipayQrUrl, 'alipay-qr.png')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d3da0c]/10 border border-[#d3da0c]/20 rounded-lg text-[#d3da0c] text-xs font-medium active:scale-95 transition-transform"
            >
              <Download className="w-3.5 h-3.5" />
              {t('eventDetail.saveQr')}
            </button>
          </div>
        )}
      </div>

      {/* Share button */}
      {canShare && (
        <button
          onClick={shareQr}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium active:bg-white/10 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          {t('eventDetail.shareEvent')}
        </button>
      )}

      {paymentInstructions && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <p className="text-yellow-400 text-xs leading-relaxed">{paymentInstructions}</p>
        </div>
      )}

      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-2">
        <p className="text-yellow-400 text-xs flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-[#d3da0c]/20 flex items-center justify-center text-[#d3da0c] text-[10px] font-bold shrink-0 mt-0.5">1</span>
          {t('eventDetail.mobileStep1')}
        </p>
        <p className="text-yellow-400 text-xs flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-[#d3da0c]/20 flex items-center justify-center text-[#d3da0c] text-[10px] font-bold shrink-0 mt-0.5">2</span>
          {t('eventDetail.mobileStep2')}
        </p>
        <p className="text-yellow-400 text-xs flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-[#d3da0c]/20 flex items-center justify-center text-[#d3da0c] text-[10px] font-bold shrink-0 mt-0.5">3</span>
          {t('eventDetail.mobileStep3')}
        </p>
        <p className="text-yellow-400 text-xs flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-[#d3da0c]/20 flex items-center justify-center text-[#d3da0c] text-[10px] font-bold shrink-0 mt-0.5">4</span>
          {t('eventDetail.mobileStep4')}
        </p>
      </div>

      {amount !== undefined && amount !== null && (
        <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
          <span className="text-white/60 text-sm">{t('eventDetail.amountToPay')}</span>
          <span className="text-xl font-bold text-[#d3da0c]">¥{amount}</span>
        </div>
      )}
    </div>
  );
};

export default MobileQrPayment;
