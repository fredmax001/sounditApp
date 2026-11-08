import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/config/api';
import { X } from 'lucide-react';

interface Ad {
  id: number;
  title: string;
  description?: string;
  image_url?: string;
  link_url?: string;
  position?: string;
}

interface AdBannerProps {
  position: 'homepage_hero' | 'homepage_sidebar' | 'events_page' | 'artists_page' | 'mobile_banner';
  className?: string;
}

const AdBanner = ({ position, className = '' }: AdBannerProps) => {
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/ads/public?position=${position}&limit=1`,
          { cache: 'no-cache' }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.ads && data.ads.length > 0) {
            setAd(data.ads[0]);
            // Track impression
            fetch(`${API_BASE_URL}/ads/public/${data.ads[0].id}/impression`, {
              method: 'POST'
            }).catch(() => {});
          }
        }
      } catch {
        // Silently fail - ads are non-critical
      } finally {
        setLoading(false);
      }
    };

    fetchAds();
  }, [position]);

  const handleClick = () => {
    if (!ad?.link_url) return;
    // Track click
    fetch(`${API_BASE_URL}/ads/public/${ad.id}/click`, {
      method: 'POST'
    }).catch(() => {});
    window.open(ad.link_url, '_blank', 'noopener,noreferrer');
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
  };

  if (loading || dismissed || !ad) return null;

  // Hero banner (large, full-width)
  if (position === 'homepage_hero') {
    return (
      <div
        className={`relative w-full rounded-2xl overflow-hidden cursor-pointer group ${className}`}
        onClick={handleClick}
      >
        {ad.image_url ? (
          <div className="relative aspect-[21/9] md:aspect-[3/1]">
            <img
              src={ad.image_url}
              alt={ad.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
              <span className="inline-block px-2 py-0.5 bg-[#d3da0c] text-black text-[10px] font-bold uppercase tracking-wider rounded mb-2">
                Sponsored
              </span>
              <h3 className="text-lg md:text-2xl font-bold text-white">{ad.title}</h3>
              {ad.description && (
                <p className="text-sm text-white/80 mt-1 line-clamp-2">{ad.description}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-[#d3da0c] p-4 md:p-6 rounded-2xl">
            <span className="inline-block px-2 py-0.5 bg-black text-[#d3da0c] text-[10px] font-bold uppercase tracking-wider rounded mb-2">
              Sponsored
            </span>
            <h3 className="text-lg md:text-xl font-bold text-black">{ad.title}</h3>
            {ad.description && <p className="text-sm text-black/70 mt-1">{ad.description}</p>}
          </div>
        )}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/80 rounded-full text-white/70 hover:text-white transition-colors"
          aria-label="Dismiss ad"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Sidebar banner (smaller, card-like)
  if (position === 'homepage_sidebar') {
    return (
      <div
        className={`relative rounded-xl overflow-hidden cursor-pointer group ${className}`}
        onClick={handleClick}
      >
        {ad.image_url ? (
          <div className="relative aspect-[4/3]">
            <img
              src={ad.image_url}
              alt={ad.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <span className="inline-block px-1.5 py-0.5 bg-[#d3da0c] text-black text-[9px] font-bold uppercase tracking-wider rounded">
                Ad
              </span>
              <h3 className="text-sm font-semibold text-white mt-1">{ad.title}</h3>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition-colors">
            <span className="inline-block px-1.5 py-0.5 bg-[#d3da0c] text-black text-[9px] font-bold uppercase tracking-wider rounded mb-2">
              Ad
            </span>
            <h3 className="text-sm font-semibold text-white">{ad.title}</h3>
            {ad.description && <p className="text-xs text-gray-400 mt-1">{ad.description}</p>}
          </div>
        )}
        <button
          onClick={handleDismiss}
          className="absolute top-1.5 right-1.5 p-1 bg-black/50 hover:bg-black/80 rounded-full text-white/70 hover:text-white transition-colors"
          aria-label="Dismiss ad"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Mobile banner (compact, full-width)
  if (position === 'mobile_banner') {
    return (
      <div
        className={`relative w-full rounded-xl overflow-hidden cursor-pointer group ${className}`}
        onClick={handleClick}
      >
        {ad.image_url ? (
          <div className="relative aspect-[5/2]">
            <img
              src={ad.image_url}
              alt={ad.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
            <div className="absolute inset-0 flex items-center p-3">
              <div>
                <span className="inline-block px-1.5 py-0.5 bg-[#d3da0c] text-black text-[9px] font-bold uppercase tracking-wider rounded mb-1">
                  Ad
                </span>
                <h3 className="text-sm font-bold text-white">{ad.title}</h3>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#d3da0c]/10 border border-[#d3da0c]/20 p-3 rounded-xl flex items-center gap-3">
            <span className="px-1.5 py-0.5 bg-[#d3da0c] text-black text-[9px] font-bold uppercase tracking-wider rounded shrink-0">
              Ad
            </span>
            <h3 className="text-sm font-semibold text-white">{ad.title}</h3>
          </div>
        )}
        <button
          onClick={handleDismiss}
          className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/80 rounded-full text-white/70 hover:text-white transition-colors"
          aria-label="Dismiss ad"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Default fallback (events_page, artists_page, etc.)
  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden cursor-pointer group ${className}`}
      onClick={handleClick}
    >
      {ad.image_url ? (
        <div className="relative aspect-[3/1]">
          <img
            src={ad.image_url}
            alt={ad.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <span className="inline-block px-1.5 py-0.5 bg-[#d3da0c] text-black text-[9px] font-bold uppercase tracking-wider rounded mb-1">
              Sponsored
            </span>
            <h3 className="text-sm font-bold text-white">{ad.title}</h3>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
          <span className="inline-block px-1.5 py-0.5 bg-[#d3da0c] text-black text-[9px] font-bold uppercase tracking-wider rounded mb-1">
            Sponsored
          </span>
          <h3 className="text-sm font-semibold text-white">{ad.title}</h3>
        </div>
      )}
    </div>
  );
};

export default AdBanner;
