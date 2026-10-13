import { useState, useEffect } from 'react';
import { Smartphone, QrCode, Monitor, Check, Download } from 'lucide-react';

interface MobileQrPaymentProps {
  amount?: number | null;
  reference?: string | null;
  wechatQrUrl?: string | null;
  alipayQrUrl?: string | null;
  wechatPayUrl?: string | null;
  alipayPayUrl?: string | null;
  paymentInstructions?: string | null;
  hideYoopay?: boolean;
  /** Fired when the buyer taps a deep-link button to leave for Alipay/WeChat */
  onDeepLinkTap?: (method: 'alipay' | 'wechat') => void;
}

const YOOPAY_MOBILE_LINK = 'https://yoopay.cn/tc/603316601';
const YOOPAY_QR_PATH = '/yoopay_qr.jpg';

const MobileQrPayment = ({ amount, reference, wechatQrUrl, alipayQrUrl, wechatPayUrl, alipayPayUrl, paymentInstructions, hideYoopay = false, onDeepLinkTap }: MobileQrPaymentProps) => {
  const [isMobile, setIsMobile] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'wechat' | 'alipay'>('wechat');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // True when the page is opened inside the WeChat app's built-in browser
  const isWechatWebview = /micromessenger/i.test(navigator.userAgent);

  // Detect which app/environment the link was opened in, so the buyer gets
  // exactly one correct instruction instead of generic text.
  // Order matters: native app first (its UA may contain webview tokens).
  type PayEnv = 'native' | 'wechat' | 'whatsapp' | 'rednote' | 'alipay' | 'pwa' | 'browser';
  const detectPayEnv = (): PayEnv => {
    const w = window as any;
    if (w.Capacitor?.isNativePlatform?.() === true) return 'native';
    const ua = navigator.userAgent;
    if (/micromessenger/i.test(ua)) return 'wechat';
    if (/whatsapp/i.test(ua)) return 'whatsapp';
    if (/xiaohongshu|rednote/i.test(ua)) return 'rednote';
    if (/alipay/i.test(ua)) return 'alipay';
    if (w.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true) return 'pwa';
    return 'browser';
  };
  const payEnv = detectPayEnv();

  // One contextual instruction line, matched to the environment + payment tab
  const contextualHint = (() => {
    const isWeChatTab = activeTab === 'wechat';
    if (isWeChatTab) {
      switch (payEnv) {
        case 'wechat':
          return { zh: '下载二维码付款，完成后重新打开本页确认', en: 'Download the QR to pay, then reopen this page to confirm' };
        case 'whatsapp':
        case 'alipay':
          return { zh: '保存二维码，打开微信「扫一扫」从相册识别付款', en: 'Save the QR, then pay in WeChat: + → Scan → album' };
        case 'rednote':
          return { zh: '长按保存二维码，在微信或支付宝中识别付款', en: 'Long-press to save the QR, then pay in WeChat or Alipay' };
        default: // native app, PWA, plain browser
          return { zh: '打开微信「扫一扫」识别二维码付款，完成后回到本页确认', en: 'Open WeChat → Scan to pay this QR, then come back to confirm' };
      }
    }
    // Alipay tab
    switch (payEnv) {
      case 'alipay':
        return { zh: '保存二维码，用支付宝「扫一扫」从相册识别付款', en: 'Save the QR, then pay in Alipay: Scan → album' };
      case 'wechat':
        // WeChat blocks every jump to Alipay — the fastest path is opening
        // this page in the system browser, where the deep-link button works.
        return { zh: '点右上角「···」→「在浏览器打开」，再点「Open Alipay to Pay」付款', en: 'Tap ⋯ top-right → Open in browser, then tap "Open Alipay to Pay"' };
      case 'whatsapp':
      case 'rednote':
        return { zh: '保存二维码，打开支付宝「扫一扫」从相册识别付款', en: 'Save the QR, open Alipay → Scan → album to pay' };
      default:
        return { zh: '打开支付宝「扫一扫」识别二维码付款，完成后回到本页确认', en: 'Open Alipay → Scan to pay this QR, then come back to confirm' };
    }
  })();

  // Use current origin so QR works in local dev, preview, and production
  const yoopayQrUrl = `${window.location.origin}${YOOPAY_QR_PATH}`;
  const hasOrganizerQr = !!wechatQrUrl || !!alipayQrUrl;

  const handleDownloadQr = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          <div className="space-y-3">
            <div className="flex justify-center">
              <img
                src={currentQrUrl!}
                alt={`${activeTab === 'wechat' ? 'WeChat' : 'Alipay'} QR`}
                className="w-48 h-48 object-contain rounded-lg bg-white p-2"
                decoding="async"
                onClick={() => {
                  // Inside WeChat's webview, embedded images often don't offer
                  // "识别图中二维码" on long-press. Opening WeChat's native image
                  // viewer via WeixinJSBridge makes recognition reliable.
                  if (!isWechatWebview) return;
                  try {
                    const abs = new URL(currentQrUrl!, window.location.origin).href;
                    const bridge = (window as any).WeixinJSBridge;
                    if (bridge && typeof bridge.invoke === 'function') {
                      bridge.invoke('imagePreview', { current: abs, urls: [abs] });
                    } else {
                      window.open(abs, '_blank');
                    }
                  } catch { /* ignore */ }
                }}
              />
            </div>
            <button
              onClick={() => { onDeepLinkTap?.(activeTab); handleDownloadQr(currentQrUrl!, `${activeTab}_qr_code.png`); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Download QR Code to Pay
            </button>
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

        {/* Mobile deep-link: jump straight into the payment app */}
        {isMobile && hasCurrent && (() => {
          const payUrl = activeTab === 'wechat' ? wechatPayUrl : alipayPayUrl;
          if (!payUrl) return null;

          if (activeTab === 'alipay') {
            // Inside WeChat: BOTH the alipayqr:// scheme AND render.alipay.com
            // are blocked by WeChat ("open in browser" error page) — no button
            // can jump to Alipay from here. The single contextual hint below
            // (save QR → Alipay Scan → album) is the only working path.
            if (payEnv === 'wechat') return null;
            const scheme = `alipayqr://platformapi/startapp?saId=10000007&qrcode=${encodeURIComponent(payUrl)}`;
            const renderUrl = `https://render.alipay.com/p/s/i?scheme=${encodeURIComponent(scheme)}`;
            return (
              <div className="space-y-2">
                <a
                  href={scheme}
                  onClick={() => onDeepLinkTap?.('alipay')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#1677FF] text-white rounded-xl hover:bg-[#0e63d8] transition-colors text-sm font-semibold"
                >
                  <Smartphone className="w-4 h-4" />
                  Open Alipay to Pay ¥{amount ?? ''}
                </a>
                <a
                  href={renderUrl}
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors text-sm"
                >
                  Alipay not opening? Tap here
                </a>
              </div>
            );
          }

          // WeChat tab — no auto deep-link from webviews (WeChat blocks it),
          // the contextual hint below explains what to do.
          if (isWechatWebview) return null;

          return (
            <div className="space-y-2">
              <a
                href="weixin://"
                onClick={() => onDeepLinkTap?.('wechat')}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#07C160] text-white rounded-xl hover:bg-[#06a854] transition-colors text-sm font-semibold"
              >
                <Smartphone className="w-4 h-4" />
                Open WeChat to Pay
              </a>
            </div>
          );
        })()}

        {/* ONE contextual instruction, matched to the app the link was opened in */}
        {hasCurrent && (
          <div className={`rounded-xl p-3 text-center border ${
            activeTab === 'wechat'
              ? 'bg-[#07C160]/10 border-[#07C160]/30'
              : 'bg-[#1677FF]/10 border-[#1677FF]/30'
          }`}>
            <p className={`text-xs font-medium ${activeTab === 'wechat' ? 'text-[#07C160]' : 'text-[#4d9bff]'}`}>{contextualHint.zh}</p>
            <p className="text-gray-400 text-[11px] mt-0.5">{contextualHint.en}</p>
          </div>
        )}

        {/* Organizer uploaded custom QR - Yoopay is hidden */}

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

  // When hideYoopay is true and no organizer QR, show a message
  if (hideYoopay) {
    return (
      <div className="space-y-4">
        {paymentInstructions && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-sm leading-relaxed">{paymentInstructions}</p>
          </div>
        )}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-red-400 text-sm">
            The organizer has not uploaded payment QR codes yet. Please contact the organizer directly for payment instructions.
          </p>
        </div>
        {amount !== undefined && amount !== null && (
          <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
            <span className="text-white/60 text-sm">Amount to Pay</span>
            <span className="text-xl font-bold text-[#d3da0c]">¥{amount}</span>
          </div>
        )}
      </div>
    );
  }

  // Fallback: YOOPAY (original behavior when no organizer QR and hideYoopay is false)
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
            loading="lazy"
            decoding="async"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
