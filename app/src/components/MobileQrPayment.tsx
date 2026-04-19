import { useState, useEffect } from 'react';
import { Smartphone, QrCode, Monitor, Check } from 'lucide-react';

interface MobileQrPaymentProps {
  amount?: number | null;
  reference?: string | null;
}

const YOOPAY_MOBILE_LINK = 'https://yoopay.cn/tc/603316601';
const YOOPAY_QR_PATH = '/static/yoopay_qr.jpg';

const MobileQrPayment = ({ amount, reference }: MobileQrPaymentProps) => {
  const [isMobile, setIsMobile] = useState<boolean>(true);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const qrUrl = `${window.location.origin}${YOOPAY_QR_PATH}`;

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

  // Mobile view: app deep link + QR
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
          className="w-40 h-40 object-contain rounded-lg bg-white p-2"
        />
      </div>

      <div className="bg-white/5 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Smartphone className="w-4 h-4 text-[#d3da0c] shrink-0 mt-0.5" />
          <p className="text-gray-400 text-xs leading-relaxed">
            On mobile, tap "Mobile Pay" to open YOOPAY directly, or save the QR code and scan it in WeChat/Alipay.
          </p>
        </div>
      </div>

      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-1">
        <p className="text-yellow-400 text-xs flex items-start gap-2">
          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          1. Tap Mobile Pay or scan the QR code
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
