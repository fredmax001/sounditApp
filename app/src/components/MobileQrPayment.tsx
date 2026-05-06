import { useState, useEffect } from 'react';
import { Smartphone, QrCode, Monitor, Check } from 'lucide-react';
import { WEB_ORIGIN } from '@/lib/appUrl';

interface MobileQrPaymentProps {
  amount?: number | null;
  reference?: string | null;
  wechatQrUrl?: string | null;
  alipayQrUrl?: string | null;
  paymentInstructions?: string | null;
}

const YOOPAY_MOBILE_LINK = 'https://yoopay.cn/tc/603316601';
const YOOPAY_QR_PATH = '/static/yoopay_qr.jpg';

const MobileQrPayment = ({ amount, reference, wechatQrUrl, alipayQrUrl, paymentInstructions }: MobileQrPaymentProps) => {
  const [isMobile, setIsMobile] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'wechat' | 'alipay'>('wechat');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const yoopayQrUrl = `${WEB_ORIGIN}${YOOPAY_QR_PATH}`;
  const hasOrganizerQr = !!wechatQrUrl || !!alipayQrUrl;

  // If organizer has custom QRs, show those
  if (hasOrganizerQr) {
    const currentQrUrl = activeTab === 'wechat' ? wechatQrUrl : alipayQrUrl;
    const hasCurrent = !!currentQrUrl;
    const hasOther = activeTab === 'wechat' ? !!alipayQrUrl : !!wechatQrUrl;
    const otherTab = activeTab === 'wechat' ? 'alipay' : 'wechat';

    return (
      <div className="space-y-4">
        {/* Payment Instructions */}
        {paymentInstructions && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-sm leading-relaxed">{paymentInstructions}</p>
          </div>
        )}

        {/* Tab Switcher */}
        {(wechatQrUrl && alipayQrUrl) && (
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('wechat')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'wechat'
                  ? 'bg-[#d3da0c] text-black'
                  : 'bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              WeChat Pay
            </button>
            <button
              onClick={() => setActiveTab('alipay')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'alipay'
                  ? 'bg-[#d3da0c] text-black'
                  : 'bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              Alipay
            </button>
          </div>
        )}

        {/* QR Display */}
        {hasCurrent ? (
          <div className="flex justify-center">
            <img
              src={currentQrUrl!}
              alt={`${activeTab === 'wechat' ? 'WeChat' : 'Alipay'} QR`}
              className="w-48 h-48 object-contain rounded-lg bg-white p-2"
            />
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm">
              {activeTab === 'wechat' ? 'WeChat QR not uploaded' : 'Alipay QR not uploaded'}
            </p>
            {hasOther && (
              <button
                onClick={() => setActiveTab(otherTab)}
                className="text-[#d3da0c] text-sm mt-2 hover:underline"
              >
                Switch to {otherTab === 'wechat' ? 'WeChat Pay' : 'Alipay'}
              </button>
            )}
          </div>
        )}

        {/* Fallback YOOPAY option */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={YOOPAY_MOBILE_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Smartphone className="w-6 h-6 text-[#d3da0c]" />
            <span className="text-white text-sm font-medium">YOOPAY</span>
          </a>
          <div className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 rounded-xl">
            <QrCode className="w-6 h-6 text-[#d3da0c]" />
            <span className="text-white text-sm font-medium">Scan QR</span>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl p-4 flex items-start gap-3">
          <Monitor className="w-4 h-4 text-[#d3da0c] shrink-0 mt-0.5" />
          <p className="text-gray-400 text-xs leading-relaxed">
            Scan the QR code above with your phone's {activeTab === 'wechat' ? 'WeChat' : 'Alipay'} app to complete payment. After paying, click "I Have Paid" to upload your screenshot.
          </p>
        </div>

        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-1">
          <p className="text-yellow-400 text-xs flex items-start gap-2">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            1. Scan the QR code with your phone
          </p>
          <p className="text-yellow-400 text-xs flex items-start gap-2">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            2. Complete the payment
          </p>
          <p className="text-yellow-400 text-xs flex items-start gap-2">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            3. Click "I Have Paid" and upload screenshot
          </p>
        </div>

        {amount !== undefined && amount !== null && (
          <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
            <span className="text-white/60 text-sm">Amount to Pay</span>
            <span className="text-xl font-bold text-[#d3da0c]">¥{amount}</span>
          </div>
        )}

        {reference && (
          <div className="p-3 bg-white/5 rounded-xl">
            <span className="text-white/60 text-sm block">Payment Reference</span>
            <span className="text-white font-mono text-sm">{reference}</span>
          </div>
        )}
      </div>
    );
  }

  // Fallback: YOOPAY (original behavior when no organizer QR)
  const qrUrl = yoopayQrUrl;

  // Desktop view: large QR code for phone scanning
  if (!isMobile) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <a
            href={YOOPAY_MOBILE_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Smartphone className="w-6 h-6 text-[#d3da0c]" />
            <span className="text-white text-sm font-medium">Mobile Pay</span>
          </a>
          <div className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 rounded-xl">
            <QrCode className="w-6 h-6 text-[#d3da0c]" />
            <span className="text-white text-sm font-medium">Scan QR</span>
          </div>
        </div>

        <div className="flex justify-center">
          <img
            src={qrUrl}
            alt="YOOPAY QR"
            className="w-48 h-48 object-contain rounded-lg bg-white p-2"
          />
        </div>

        <div className="bg-white/5 rounded-xl p-4 flex items-start gap-3">
          <Monitor className="w-4 h-4 text-[#d3da0c] shrink-0 mt-0.5" />
          <p className="text-gray-400 text-xs leading-relaxed">
            On desktop, scan the QR code above with your phone's WeChat or Alipay app to complete payment. After paying, click "I Have Paid" to upload your screenshot.
          </p>
        </div>

        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-1">
          <p className="text-yellow-400 text-xs flex items-start gap-2">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            1. Scan the QR code or click Mobile Pay
          </p>
          <p className="text-yellow-400 text-xs flex items-start gap-2">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            2. Complete the YOOPAY payment
          </p>
          <p className="text-yellow-400 text-xs flex items-start gap-2">
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            3. Upload your payment screenshot for verification
          </p>
        </div>
      </div>
    );
  }

  // Mobile fallback: YOOPAY link only (no QR image)
  return (
    <div className="space-y-4">
      <a
        href={YOOPAY_MOBILE_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-3 p-5 bg-[#d3da0c] rounded-xl hover:bg-[#bbc10b] transition-colors"
      >
        <Smartphone className="w-6 h-6 text-black" />
        <span className="text-black font-semibold">Open YOOPAY to Pay</span>
      </a>

      <div className="bg-white/5 rounded-xl p-4">
        <p className="text-gray-400 text-xs leading-relaxed">
          Tap the button above to open YOOPAY and complete your payment. After paying, click "I Have Paid" to upload your screenshot.
        </p>
      </div>

      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-1">
        <p className="text-yellow-400 text-xs flex items-start gap-2">
          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          1. Tap Open YOOPAY to Pay
        </p>
        <p className="text-yellow-400 text-xs flex items-start gap-2">
          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          2. Complete the YOOPAY payment
        </p>
        <p className="text-yellow-400 text-xs flex items-start gap-2">
          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          3. Click "I Have Paid" and upload screenshot
        </p>
      </div>

      {amount !== undefined && amount !== null && (
        <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
          <span className="text-white/60 text-sm">Amount to Pay</span>
          <span className="text-xl font-bold text-[#d3da0c]">¥{amount}</span>
        </div>
      )}

      {reference && (
        <div className="p-3 bg-white/5 rounded-xl">
          <span className="text-white/60 text-sm block">Payment Reference</span>
          <span className="text-white font-mono text-sm">{reference}</span>
        </div>
      )}
    </div>
  );
};

export default MobileQrPayment;
