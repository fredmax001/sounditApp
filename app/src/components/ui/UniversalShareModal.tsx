import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Share as CapShare } from '@capacitor/share';
import { toast } from 'sonner';
import {
  X,
  Copy,
  Share2,
  Download,
  Sparkles,
  QrCode,
  Calendar,
  MapPin,
  Check,
  Image as ImageIcon
} from 'lucide-react';
import {
  WeChatIcon,
  WhatsAppIcon,
  IMessageIcon,
  XIcon,
  InstagramIcon,
  TikTokIcon,
  RedNoteIcon
} from './SocialMediaIcons';

export interface ShareableItem {
  type: 'event' | 'artist' | 'vendor' | 'business' | 'user';
  id: string | number;
  title: string;
  subtitle?: string;
  image?: string;
  date?: string;
  time?: string;
  location?: string;
  city?: string;
  description?: string;
  price?: string;
  rating?: number;
  verified?: boolean;
  role?: string;
  tags?: string[];
  url?: string;
}

interface UniversalShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ShareableItem;
}

export default function UniversalShareModal({
  isOpen,
  onClose,
  item
}: UniversalShareModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'poster'>('quick');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sounditent.com';
  
  // Resolve image URL cleanly
  const resolveImageUrl = (imgUrl?: string) => {
    if (!imgUrl) return '/logo.png';
    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('data:')) {
      return imgUrl;
    }
    const clean = imgUrl.startsWith('/') ? imgUrl.substring(1) : imgUrl;
    return `${origin}/${clean}`;
  };

  // Construct canonical route URL based on item type
  const getItemPath = () => {
    switch (item.type) {
      case 'event':
        return `/events/${item.id}`;
      case 'artist':
        return `/artists/${item.id}`;
      case 'vendor':
        return `/vendors/${item.id}`;
      case 'business':
      case 'user':
        return `/profiles/${item.id}`;
      default:
        return `/events/${item.id}`;
    }
  };

  const shareUrl = item.url || `${origin}${getItemPath()}`;
  const displayImage = resolveImageUrl(item.image);

  // Formatted share message text
  const getShareText = () => {
    const typeLabel = item.type === 'event' ? '🎉 Event' : item.type === 'artist' ? '🎧 Artist' : item.type === 'vendor' ? '🛍️ Vendor' : '👤 Profile';
    let text = `${typeLabel}: ${item.title}`;
    if (item.subtitle) text += ` (${item.subtitle})`;
    if (item.date) text += `\n📅 Date: ${item.date}`;
    if (item.location) text += `\n📍 Location: ${item.location}`;
    if (item.price) text += `\n🎟️ Price: ${item.price}`;
    text += `\n\nCheck it out on Sound It: ${shareUrl}`;
    return text;
  };

  // Copy Link to Clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success(t('common.linkCopied', 'Link copied to clipboard!'));
    setTimeout(() => setCopied(false), 2500);
  };

  // Native System Share
  const handleNativeShare = async () => {
    try {
      if (CapShare) {
        await CapShare.share({
          title: item.title,
          text: getShareText(),
          url: shareUrl,
          dialogTitle: `Share ${item.title}`
        });
        return;
      }
    } catch {
      // Fallback
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: getShareText(),
          url: shareUrl
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  // Social Intent Helpers
  const shareToWhatsApp = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const shareToSMS = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`sms:?&body=${text}`, '_blank');
  };

  const shareToX = () => {
    const text = encodeURIComponent(`Check out ${item.title} on @SoundItApp!`);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const handlePlatformPosterShare = (platformName: string, instructions: string) => {
    handleDownloadPoster();
    handleCopyLink();
    toast.info(`${platformName}: ${instructions}`, { duration: 5000 });
  };

  // Generate HD PNG Share Poster using HTML5 Canvas
  const handleDownloadPoster = async () => {
    setIsGeneratingPoster(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // 1080 x 1440 Poster Resolution (Standard HD 4:5 Poster)
      canvas.width = 1080;
      canvas.height = 1440;

      // Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1440);
      bgGrad.addColorStop(0, '#0A0A0A');
      bgGrad.addColorStop(0.5, '#121212');
      bgGrad.addColorStop(1, '#050505');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1440);

      // Lime Ambient Glow
      const glowGrad = ctx.createRadialGradient(200, 200, 50, 200, 200, 600);
      glowGrad.addColorStop(0, 'rgba(211, 218, 12, 0.15)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, 1080, 1440);

      // Pink Ambient Glow Bottom
      const pinkGlow = ctx.createRadialGradient(880, 1200, 50, 880, 1200, 600);
      pinkGlow.addColorStop(0, 'rgba(255, 45, 143, 0.15)');
      pinkGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = pinkGlow;
      ctx.fillRect(0, 0, 1080, 1440);

      // Sanitized description for the poster
      const cleanDescription = item.description
        ? item.description.replace(/<[^>]*>/g, '').trim()
        : '';

      // Top Sound It Header Brand Bar
      ctx.fillStyle = '#d3da0c';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('SOUND IT', 80, 100);

      ctx.fillStyle = '#888888';
      ctx.font = '24px sans-serif';
      ctx.fillText('• ENTERTAINMENT PLATFORM', 270, 100);

      // Robust Image Loader (Tries CORS anonymous first, then fallback without crossOrigin)
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => {
            const fallbackImg = new Image();
            fallbackImg.onload = () => resolve(fallbackImg);
            fallbackImg.onerror = () => reject(new Error('Failed to load image'));
            fallbackImg.src = src;
          };
          img.src = src;
        });
      };

      // Draw Main Avatar / Image Section on Poster
      const isProfileType = item.type === 'artist' || item.type === 'user' || item.type === 'vendor' || item.type === 'business';
      let imgLoaded = false;
      const targetImageSrc = resolveImageUrl(item.image);

      if (isProfileType) {
        // --- PROFILE / ARTIST / VENDOR / BUSINESS POSTER LAYOUT ---
        const avatarX = 340, avatarY = 130, avatarW = 400, avatarH = 400, r = 32;

        if (targetImageSrc) {
          try {
            const img = await loadImage(targetImageSrc);
            ctx.save();
            ctx.shadowColor = 'rgba(211, 218, 12, 0.4)';
            ctx.shadowBlur = 30;

            ctx.beginPath();
            ctx.moveTo(avatarX + r, avatarY);
            ctx.arcTo(avatarX + avatarW, avatarY, avatarX + avatarW, avatarY + avatarH, r);
            ctx.arcTo(avatarX + avatarW, avatarY + avatarH, avatarX, avatarY + avatarH, r);
            ctx.arcTo(avatarX, avatarY + avatarH, avatarX, avatarY, r);
            ctx.arcTo(avatarX, avatarY, avatarX + avatarW, avatarY, r);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, avatarX, avatarY, avatarW, avatarH);
            ctx.restore();
            imgLoaded = true;
          } catch {}
        }

        if (!imgLoaded) {
          ctx.fillStyle = '#1A1A1A';
          ctx.beginPath();
          ctx.roundRect(avatarX, avatarY, avatarW, avatarH, 32);
          ctx.fill();
          ctx.fillStyle = '#d3da0c';
          ctx.font = 'bold 72px sans-serif';
          ctx.fillText(item.title.substring(0, 2).toUpperCase(), avatarX + 150, avatarY + 230);
        }

        // 1. Category Pill Badge
        const badgeY = 560;
        ctx.fillStyle = 'rgba(211, 218, 12, 0.2)';
        ctx.beginPath();
        ctx.roundRect(80, badgeY, 200, 44, 22);
        ctx.fill();
        ctx.strokeStyle = 'rgba(211, 218, 12, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#d3da0c';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(item.type.toUpperCase(), 110, badgeY + 29);

        // 2. Main Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 52px sans-serif';
        ctx.fillText(item.title, 80, 660);

        let currentY = 710;

        // 3. Subtitle / Role / Genre
        if (item.subtitle) {
          ctx.fillStyle = '#d3da0c';
          ctx.font = 'bold 26px sans-serif';
          ctx.fillText(item.subtitle, 80, currentY);
          currentY += 45;
        }

        // 4. Location / City
        let locationStr = item.location || item.city || '';
        if (locationStr) {
          if (!locationStr.toLowerCase().includes('china') && !locationStr.includes('中国')) {
            locationStr += ', China';
          }
          ctx.fillStyle = '#CCCCCC';
          ctx.font = '26px sans-serif';
          ctx.fillText(`📍  ${locationStr}`, 80, currentY);
          currentY += 45;
        }

        // 5. Price / Booking Fee (if available)
        if (item.price) {
          ctx.fillStyle = '#FF2D8F';
          ctx.font = 'bold 26px sans-serif';
          ctx.fillText(`🎟️  Fee: ${item.price}`, 80, currentY);
          currentY += 45;
        }

        // 6. Bio / Description Quote Card Box
        if (cleanDescription) {
          currentY += 15;
          const cardX = 80, cardY = currentY, cardW = 920, cardH = 190, cardR = 20;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#DDDDDD';
          ctx.font = 'italic 24px sans-serif';

          let bioWords = cleanDescription.split(' ');
          let bioLine = '"';
          let bioY = cardY + 48;
          let linesCount = 0;

          for (let n = 0; n < bioWords.length; n++) {
            let testLine = bioLine + bioWords[n] + ' ';
            let metrics = ctx.measureText(testLine);
            if (metrics.width > 860 && n > 0) {
              ctx.fillText(bioLine, cardX + 30, bioY);
              bioLine = bioWords[n] + ' ';
              bioY += 38;
              linesCount++;
              if (linesCount >= 3) {
                bioLine += '..."';
                break;
              }
            } else {
              bioLine = testLine;
            }
          }
          if (linesCount < 3) {
            ctx.fillText(bioLine.trim() + '"', cardX + 30, bioY);
          }
        }

      } else {
        // --- EVENT POSTER LAYOUT ---
        const x = 80, y = 140, w = 920, h = 580, r = 32;
        if (targetImageSrc) {
          try {
            const img = await loadImage(targetImageSrc);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, x, y, w, h);
            ctx.restore();
            imgLoaded = true;
          } catch {}
        }

        if (!imgLoaded) {
          ctx.fillStyle = '#1A1A1A';
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 32);
          ctx.fill();
          ctx.fillStyle = '#d3da0c';
          ctx.font = 'bold 72px sans-serif';
          ctx.fillText(item.title.substring(0, 2).toUpperCase(), 480, 450);
        }

        // Category Pill Badge
        const badgeY = 760;
        ctx.fillStyle = 'rgba(211, 218, 12, 0.2)';
        ctx.beginPath();
        ctx.roundRect(80, badgeY, 220, 48, 24);
        ctx.fill();
        ctx.strokeStyle = 'rgba(211, 218, 12, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#d3da0c';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(item.type.toUpperCase(), 110, badgeY + 32);

        // Event Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 56px sans-serif';
        const maxTitleWidth = 920;
        let words = item.title.split(' ');
        let line = '';
        let yPos = badgeY + 110;
        for (let n = 0; n < words.length; n++) {
          let testLine = line + words[n] + ' ';
          let metrics = ctx.measureText(testLine);
          if (metrics.width > maxTitleWidth && n > 0) {
            ctx.fillText(line, 80, yPos);
            line = words[n] + ' ';
            yPos += 70;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, 80, yPos);
        yPos += 50;

        // Date / Location Details
        if (item.date) {
          ctx.fillStyle = '#CCCCCC';
          ctx.font = '28px sans-serif';
          ctx.fillText(`📅  ${item.date}`, 80, yPos);
          yPos += 45;
        }
        if (item.location) {
          ctx.fillStyle = '#CCCCCC';
          ctx.font = '28px sans-serif';
          ctx.fillText(`📍  ${item.location}`, 80, yPos);
          yPos += 45;
        }
      }

      // Bottom Card Divider
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, 1180);
      ctx.lineTo(1000, 1180);
      ctx.stroke();

      // Bottom Footer with QR Code Container
      const qrSvg = document.getElementById('poster-qr-code-svg');
      if (qrSvg) {
        const svgData = new XMLSerializer().serializeToString(qrSvg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const blobURL = window.URL.createObjectURL(svgBlob);

        const qrImg = await loadImage(blobURL);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(80, 1210, 180, 180, 20);
        ctx.fill();
        ctx.drawImage(qrImg, 95, 1225, 150, 150);
      }

      // Scan Call To Action
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('Scan QR Code to View', 290, 1280);

      ctx.fillStyle = '#888888';
      ctx.font = '24px sans-serif';
      ctx.fillText('Available live on sounditent.com', 290, 1330);

      // Export Canvas to PNG Image
      const imageUri = canvas.toDataURL('image/png');
      const mime = 'image/png';
      const bstr = atob(imageUri.split(',')[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const fileName = `soundit-${item.type}-${item.id}-poster.png`;
      const file = new File([blob], fileName, { type: mime });

      // 1. Try Web Share API with File (iOS Safari 15+ & Chrome Mobile)
      // Opens native OS sheet with "Save Image" button to write straight to Photos / Gallery
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Sound It - ${item.title}`,
            text: `Save poster to Photo Gallery`
          });
          toast.success(t('common.posterSavedToGallery', 'Choose "Save Image" to add to your Photo Gallery!'));
          return;
        } catch {
          // User canceled or fallback needed
        }
      }

      // 2. Try Capacitor Native App Share Sheet if available
      try {
        if (CapShare) {
          await CapShare.share({
            title: `Sound It - ${item.title}`,
            text: `Save poster to Photo Gallery`,
            url: imageUri,
            dialogTitle: 'Save Image to Photos / Gallery'
          });
          toast.success(t('common.posterSavedToGallery', 'Choose "Save Image" to add to your Photo Gallery!'));
          return;
        }
      } catch {
        // Fallback
      }

      // 3. Fallback: Blob URL download for desktop / browsers
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.download = fileName;
      downloadLink.href = blobUrl;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      toast.success(t('common.posterSavedToGallery', 'Poster downloaded to your device!'));
    } catch (err) {
      console.error('Poster generation error:', err);
      toast.error('Failed to download poster image.');
    } finally {
      setIsGeneratingPoster(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[#121212] border border-white/10 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#171717]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#d3da0c]" />
              <h3 className="text-base sm:text-lg font-bold text-white truncate max-w-[280px]">
                {t('common.shareItemTitle', { title: item.title, defaultValue: `Share ${item.title}` })}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-white/5 bg-black/30 p-1">
            <button
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'quick' ? 'bg-[#d3da0c] text-black shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>{t('common.quickShare', 'Quick Share & Links')}</span>
            </button>
            <button
              onClick={() => setActiveTab('poster')}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'poster' ? 'bg-[#d3da0c] text-black shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>{t('common.shareCardPoster', 'Share Card & Poster')}</span>
            </button>
          </div>

          {/* Content */}
          <div className="p-5 max-h-[75vh] overflow-y-auto hide-scrollbar space-y-5">
            {/* Quick Share Tab */}
            {activeTab === 'quick' && (
              <div className="space-y-4">
                {/* Item Card Preview */}
                <div className="flex items-center gap-3.5 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/10 shrink-0 border border-white/10">
                    <img
                      src={displayImage}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#d3da0c]/15 text-[#d3da0c] rounded-md uppercase tracking-wider">
                      {item.type}
                    </span>
                    <h4 className="text-sm font-bold text-white truncate mt-1">{item.title}</h4>
                    {item.subtitle && (
                      <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                    )}
                    {item.date && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        <span>{item.date}</span>
                      </p>
                    )}
                    {item.location && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-gray-500 shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Social Share Grid */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                    {t('common.shareToSocials', 'Share to Social Media')}
                  </p>
                  <div className="grid grid-cols-4 gap-2.5">
                    {/* WeChat */}
                    <button
                      onClick={() => setActiveTab('poster')}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-[#07C160]/10 hover:bg-[#07C160]/20 border border-[#07C160]/20 transition-all text-[#07C160]"
                    >
                      <WeChatIcon className="w-6 h-6 text-[#07C160]" />
                      <span className="text-[11px] font-medium text-white">WeChat</span>
                    </button>

                    {/* WhatsApp */}
                    <button
                      onClick={shareToWhatsApp}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/20 transition-all text-[#25D366]"
                    >
                      <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
                      <span className="text-[11px] font-medium text-white">WhatsApp</span>
                    </button>

                    {/* iMessage / SMS */}
                    <button
                      onClick={shareToSMS}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all text-blue-400"
                    >
                      <IMessageIcon className="w-6 h-6 text-blue-400" />
                      <span className="text-[11px] font-medium text-white">iMessage</span>
                    </button>

                    {/* X (Twitter) */}
                    <button
                      onClick={shareToX}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-white"
                    >
                      <XIcon className="w-5 h-5 text-white" />
                      <span className="text-[11px] font-medium text-white">X</span>
                    </button>

                    {/* Instagram */}
                    <button
                      onClick={() => handlePlatformPosterShare('Instagram', 'Poster saved & link copied! Upload to Story or Feed.')}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-gradient-to-br from-purple-500/15 via-pink-500/15 to-orange-500/15 hover:opacity-90 border border-pink-500/30 transition-all text-pink-400"
                    >
                      <InstagramIcon className="w-6 h-6 text-pink-400" />
                      <span className="text-[11px] font-medium text-white">Instagram</span>
                    </button>

                    {/* TikTok / Douyin */}
                    <button
                      onClick={() => handlePlatformPosterShare('TikTok / 抖音', 'Poster saved & link copied! Attach to your video post.')}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-[#00f2fe]/10 hover:bg-[#00f2fe]/20 border border-[#00f2fe]/20 transition-all text-[#00f2fe]"
                    >
                      <TikTokIcon className="w-6 h-6 text-[#ff0050]" />
                      <span className="text-[11px] font-medium text-white">TikTok/抖音</span>
                    </button>

                    {/* RedNote (Xiaohongshu) */}
                    <button
                      onClick={() => handlePlatformPosterShare('RedNote / 小红书', 'Poster saved & link copied! Publish Note on RedNote.')}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-[#ff2442]/10 hover:bg-[#ff2442]/20 border border-[#ff2442]/20 transition-all text-[#ff2442]"
                    >
                      <RedNoteIcon className="w-6 h-6 text-[#ff2442]" />
                      <span className="text-[11px] font-medium text-white">小红书</span>
                    </button>

                    {/* Native Share */}
                    <button
                      onClick={handleNativeShare}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-[#d3da0c]/10 hover:bg-[#d3da0c]/20 border border-[#d3da0c]/20 transition-all text-[#d3da0c]"
                    >
                      <Share2 className="w-6 h-6 text-[#d3da0c]" />
                      <span className="text-[11px] font-medium text-white">More</span>
                    </button>
                  </div>
                </div>

                {/* Copy Link Input Bar */}
                <div className="pt-1">
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-1.5 pl-3">
                    <span className="text-xs text-gray-400 truncate flex-1 font-mono">{shareUrl}</span>
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 bg-[#d3da0c] text-black text-xs font-bold rounded-lg hover:bg-[#bbc10b] transition-colors flex items-center gap-1 shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? t('common.copied', 'Copied!') : t('common.copyLink', 'Copy Link')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Share Card & Poster Tab */}
            {activeTab === 'poster' && (
              <div className="space-y-4">
                {/* Visual Poster Preview Card */}
                <div className="relative bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] border border-white/10 rounded-2xl overflow-hidden p-4 shadow-xl">
                  {/* Poster Header */}
                  <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <img src="/logo.png" alt="Sound It" className="h-5 w-auto" />
                      <span className="text-[11px] font-bold tracking-wider text-[#d3da0c] uppercase">SOUND IT PLATFORM</span>
                    </div>
                    <span className="px-2 py-0.5 bg-white/10 text-gray-300 text-[10px] font-medium rounded-full uppercase">
                      {item.type}
                    </span>
                  </div>

                  {/* Poster Image / Avatar Container */}
                  <div className="relative rounded-xl overflow-hidden mb-3 border border-white/10 bg-black/60 flex items-center justify-center min-h-[180px]">
                    <img
                      src={displayImage}
                      alt={item.title}
                      className={`object-cover ${item.type === 'event' ? 'w-full h-48' : 'w-36 h-36 rounded-2xl my-3 shadow-2xl border-2 border-[#d3da0c]/40'}`}
                      onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
                      <div>
                        <h3 className="text-base font-bold text-white line-clamp-1">{item.title}</h3>
                        {item.subtitle && <p className="text-xs text-gray-300 line-clamp-1">{item.subtitle}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Item Details */}
                  <div className="space-y-1.5 mb-4 text-xs text-gray-300">
                    {item.date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-[#d3da0c]" />
                        <span>{item.date}</span>
                      </div>
                    )}
                    {item.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#d3da0c]" />
                        <span className="truncate">{item.location}</span>
                      </div>
                    )}
                  </div>

                  {/* QR Code Section */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/10 bg-black/40 p-3 rounded-xl">
                    <div>
                      <p className="text-xs font-bold text-white">{t('common.scanQrCode', 'Scan QR Code')}</p>
                      <p className="text-[11px] text-gray-400">{t('common.scanQrToView', 'View live details on Sound It')}</p>
                    </div>

                    <div className="w-16 h-16 bg-white p-1 rounded-lg shrink-0 flex items-center justify-center">
                      <QRCodeSVG
                        id="poster-qr-code-svg"
                        value={shareUrl}
                        size={56}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                  </div>
                </div>

                {/* Poster Download Button */}
                <button
                  onClick={handleDownloadPoster}
                  disabled={isGeneratingPoster}
                  className="w-full py-3 bg-[#d3da0c] text-black font-bold text-sm rounded-xl hover:bg-[#bbc10b] transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isGeneratingPoster ? (t('common.generatingPoster', 'Generating Poster...')) : (t('common.downloadPoster', 'Save Poster to Gallery'))}</span>
                </button>

                {/* WeChat / Social Media Sharing Tip */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start gap-2.5">
                  <ImageIcon className="w-4 h-4 text-[#d3da0c] shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-300 leading-relaxed">
                    <p className="font-semibold text-white mb-0.5">Photo Gallery Access & Sharing:</p>
                    <p className="text-gray-400">
                      {t('common.wechatShareTip', 'Saving the poster stores the image in your Photo Gallery / Downloads. Allow gallery access if prompted by your phone.')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
