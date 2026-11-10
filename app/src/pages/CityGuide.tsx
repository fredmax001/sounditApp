import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  MapPin,
  Calendar,
  Music,
  Utensils,
  Navigation,
  Loader2,
  Users,
  Store,
  Building2,
  Star,
  MessageCircle,
  Heart,
  Map as MapIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  X,
  ExternalLink,
} from 'lucide-react';
import { chinaCities } from '@/data/constants';
import { useAuthStore } from '@/store/authStore';
import { useCityGuideStore } from '@/store/cityGuideStore';
import type { GuideItem } from '@/store/cityGuideStore';
import { openDirections } from '@/lib/directions';
import DiscoveryResultCard from '@/components/ui/DiscoveryResultCard';
import DiscoveryFeed from '@/components/DiscoveryFeed';
import { slugify } from '@/lib/slug';

type GMap = {
  setCenter: (center: { lat: number; lng: number }) => void;
  panTo: (center: { lat: number; lng: number }) => void;
};

type GMarker = {
  setMap: (map: unknown) => void;
  getTitle: () => string | undefined;
  addListener: (event: string, callback: () => void) => void;
};

type GInfoWindow = {
  setContent: (content: string) => void;
  open: (map: unknown, anchor?: unknown) => void;
};

interface GoogleMapsMock {
  maps: {
    Map: new (container: HTMLElement, options: Record<string, unknown>) => GMap;
    Marker: new (options: Record<string, unknown>) => GMarker;
    InfoWindow: new () => GInfoWindow;
    Size: new (w: number, h: number) => unknown;
    Point: new (x: number, y: number) => unknown;
  };
}

declare global {
  interface Window {
    google?: GoogleMapsMock;
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const PIN_SVG = (color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="36" height="36"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>`
  )}`;

const PIN_COLORS: Record<string, string> = {
  event: '#3b82f6',
  venue: '#f59e0b',
  food: '#22c55e',
  artist: '#ec4899',
  vendor: '#8b5cf6',
  business: '#06b6d4',
};

type FilterTab = 'all' | 'event' | 'venue' | 'food' | 'artist' | 'vendor' | 'business';

const TAB_CONFIG: { key: FilterTab; labelKey: string; fallback: string; icon: typeof MapPin }[] = [
  { key: 'all', labelKey: 'cityGuide.all', fallback: 'All', icon: MapPin },
  { key: 'artist', labelKey: 'discovery.artists', fallback: 'Artists', icon: Users },
  { key: 'vendor', labelKey: 'discovery.vendors', fallback: 'Vendors', icon: Store },
  { key: 'business', labelKey: 'discovery.businesses', fallback: 'Business', icon: Building2 },
  { key: 'venue', labelKey: 'cityGuide.venues', fallback: 'Venues', icon: Music },
  { key: 'event', labelKey: 'cityGuide.events', fallback: 'Events', icon: Calendar },
  { key: 'food', labelKey: 'cityGuide.food', fallback: 'Food', icon: Utensils },
];

// Only these types appear on the map
const MAPPABLE_TYPES = new Set<FilterTab>(['event', 'venue', 'food']);

function EntityBadge({ type }: { type: GuideItem['type'] }) {
  const colors: Record<string, string> = {
    event: 'bg-[#d3da0c]/15 text-[#d3da0c]',
    venue: 'bg-amber-500/20 text-amber-400',
    food: 'bg-emerald-500/20 text-emerald-400',
    artist: 'bg-[#d3da0c]/15 text-[#d3da0c]',
    vendor: 'bg-[#d3da0c]/15 text-[#d3da0c]',
    business: 'bg-white/10 text-gray-300',
  };
  const labels: Record<string, string> = {
    event: 'Event',
    venue: 'Venue',
    food: 'Food',
    artist: 'Artist',
    vendor: 'Vendor',
    business: 'Business',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[type] || 'bg-gray-500/20 text-gray-400'}`}>
      {labels[type] || type}
    </span>
  );
}

function MetricPill({ icon: Icon, value }: { icon: typeof Star; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
      <Icon className="w-3 h-3" />
      {value}
    </span>
  );
}



const CityGuide = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const validTabs: FilterTab[] = ['all', 'event', 'venue', 'food', 'artist', 'vendor', 'business'];
  const normalizeTab = (raw: string | null): FilterTab => {
    if (!raw) return 'all';
    if (raw === 'events') return 'event';
    if (raw === 'businesses') return 'business';
    if (raw === 'artists') return 'artist';
    if (raw === 'vendors') return 'vendor';
    if (raw === 'club' || raw === 'clubs' || raw === 'venues') return 'venue';
    return validTabs.includes(raw as FilterTab) ? (raw as FilterTab) : 'all';
  };
  const initialTab: FilterTab = normalizeTab(tabParam);
  const { selectedCity, setSelectedCity } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>(initialTab);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    const nextTab = normalizeTab(tabParam);
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [tabParam]);

  const handleTabClick = (tabKey: FilterTab) => {
    setActiveTab(tabKey);
    setSelectedItem(null);
    const newParams = new URLSearchParams(searchParams);
    if (tabKey === 'all') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tabKey);
    }
    setSearchParams(newParams, { replace: true });
  };

  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<GMap | null>(null);
  const markersRef = useRef<GMarker[]>([]);
  const infoWindowRef = useRef<GInfoWindow | null>(null);
  const scriptLoadedRef = useRef(false);

  const { guideItems, selectedItem, mapCenter, isLoading, fetchCityGuide, setSelectedItem, setMapCenter } =
    useCityGuideStore();

  // Load Google Maps script dynamically
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    if (window.google?.maps) {
      setMapReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapReady(true);
    script.onerror = () => setMapError(true);
    document.head.appendChild(script);
  }, []);

  // Fetch city guide when city changes
  useEffect(() => {
    const cityToFetch = selectedCity && selectedCity !== 'all' ? selectedCity : 'all';
    fetchCityGuide(cityToFetch);
  }, [selectedCity, fetchCityGuide]);

  // Initialize / update map
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;

    if (!googleMapRef.current) {
      try {
        googleMapRef.current = new window.google.maps.Map(mapRef.current, {
          center: { lat: mapCenter.lat, lng: mapCenter.lng },
          zoom: 12,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
            {
              featureType: 'administrative.locality',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#d59563' }],
            },
            {
              featureType: 'poi',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#d59563' }],
            },
            {
              featureType: 'poi.park',
              elementType: 'geometry',
              stylers: [{ color: '#263c3f' }],
            },
            {
              featureType: 'poi.park',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#6b9a76' }],
            },
            {
              featureType: 'road',
              elementType: 'geometry',
              stylers: [{ color: '#38414e' }],
            },
            {
              featureType: 'road',
              elementType: 'geometry.stroke',
              stylers: [{ color: '#212a37' }],
            },
            {
              featureType: 'road',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#9ca5b3' }],
            },
            {
              featureType: 'road.highway',
              elementType: 'geometry',
              stylers: [{ color: '#746855' }],
            },
            {
              featureType: 'road.highway',
              elementType: 'geometry.stroke',
              stylers: [{ color: '#1f2835' }],
            },
            {
              featureType: 'road.highway',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#f3d19c' }],
            },
            {
              featureType: 'transit',
              elementType: 'geometry',
              stylers: [{ color: '#2f3948' }],
            },
            {
              featureType: 'transit.station',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#d59563' }],
            },
            {
              featureType: 'water',
              elementType: 'geometry',
              stylers: [{ color: '#17263c' }],
            },
            {
              featureType: 'water',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#515c6d' }],
            },
            {
              featureType: 'water',
              elementType: 'labels.text.stroke',
              stylers: [{ color: '#17263c' }],
            },
          ],
        });

        infoWindowRef.current = new window.google.maps.InfoWindow();
      } catch {
        setMapError(true);
        return;
      }
    } else {
      googleMapRef.current.setCenter({ lat: mapCenter.lat, lng: mapCenter.lng });
    }

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const map = googleMapRef.current;
    const infoWindow = infoWindowRef.current;
    if (!map || !infoWindow) return;

    // Only map events, venues, and food - NOT artists/vendors/businesses
    const list = Array.isArray(guideItems) ? guideItems : [];
    const mappable =
      activeTab === 'all'
        ? list.filter((i) => i && i.lat && i.lng && MAPPABLE_TYPES.has(i.type))
        : list.filter((i) => i && i.lat && i.lng && i.type === activeTab && MAPPABLE_TYPES.has(i.type));

    mappable.forEach((item) => {
      const marker = new window.google.maps.Marker({
        position: { lat: item.lat, lng: item.lng },
        map,
        icon: {
          url: PIN_SVG(PIN_COLORS[item.type] || '#9ca3af'),
          scaledSize: new window.google.maps.Size(36, 36),
          anchor: new window.google.maps.Point(18, 36),
        },
        title: item.name,
      });

      marker.addListener('click', () => {
        setSelectedItem(item);
        const content = `
          <div style="color:#111;min-width:180px;">
            <div style="font-weight:700;margin-bottom:4px;">${item.name}</div>
            ${item.address ? `<div style="font-size:12px;color:#555;margin-bottom:8px;">${item.address}</div>` : ''}
            <button id="gw-dir-${item.type}-${item.id}" style="background:#d3da0c;border:none;padding:6px 12px;border-radius:6px;font-weight:600;cursor:pointer;">${t('cityGuide.getDirections') || 'Get Directions'}</button>
          </div>
        `;
        infoWindow.setContent(content);
        infoWindow.open(map, marker);
        window.setTimeout(() => {
          const btn = document.getElementById(`gw-dir-${item.type}-${item.id}`);
          if (btn) {
            btn.addEventListener('click', () => openDirections(item.lat, item.lng, item.name));
          }
        }, 50);
      });

      markersRef.current.push(marker);
    });

    if (selectedItem && MAPPABLE_TYPES.has(selectedItem.type)) {
      map.panTo({ lat: selectedItem.lat, lng: selectedItem.lng });
      const marker = markersRef.current.find((m) => m.getTitle() === selectedItem.name);
      if (marker) {
        const content = `
          <div style="color:#111;min-width:180px;">
            <div style="font-weight:700;margin-bottom:4px;">${selectedItem.name}</div>
            ${selectedItem.address ? `<div style="font-size:12px;color:#555;margin-bottom:8px;">${selectedItem.address}</div>` : ''}
            <button id="gw-dir-${selectedItem.type}-${selectedItem.id}" style="background:#d3da0c;border:none;padding:6px 12px;border-radius:6px;font-weight:600;cursor:pointer;">${t('cityGuide.getDirections') || 'Get Directions'}</button>
          </div>
        `;
        infoWindow.setContent(content);
        infoWindow.open(map, marker);
        window.setTimeout(() => {
          const btn = document.getElementById(`gw-dir-${selectedItem.type}-${selectedItem.id}`);
          if (btn) {
            btn.addEventListener('click', () => openDirections(selectedItem.lat, selectedItem.lng, selectedItem.name));
          }
        }, 50);
      }
    }
  }, [mapReady, guideItems, activeTab, selectedItem, mapCenter, t, setSelectedItem]);

  const displayItems = useMemo(() => {
    const list = Array.isArray(guideItems) ? guideItems : [];
    let items = activeTab === 'all' ? list : list.filter((i) => i && i.type === activeTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i &&
          ((i.name && i.name.toLowerCase().includes(q)) ||
            (i.address && i.address.toLowerCase().includes(q)) ||
            (i.description && i.description.toLowerCase().includes(q)))
      );
    }
    return items;
  }, [guideItems, activeTab, searchQuery]);

  const featuredItems = useMemo(() => {
    const list = Array.isArray(guideItems) ? guideItems : [];
    return list.filter((i) => {
      if (!i) return false;
      const meta = i.meta || {};
      const isVerified = Boolean(meta.is_verified);
      const followers = Number(meta.followers_count || 0);
      const rating = Number(meta.rating || 0);
      const events = Number(meta.events_count || 0);
      if (i.type === 'artist') return isVerified || followers > 0;
      if (i.type === 'vendor') return isVerified || rating >= 4;
      if (i.type === 'business') return isVerified || events > 0;
      if (i.type === 'venue') return true;
      return false;
    }).slice(0, 6);
  }, [guideItems]);

  const hasMap = mapReady && !mapError && GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'your_maps_key';
  const currentCityName =
    selectedCity && selectedCity !== 'all'
      ? chinaCities.find((c) => c.id === selectedCity)?.name || selectedCity
      : 'Shanghai';

  const categoryCards: Array<{
    key: FilterTab;
    title: string;
    image: string;
  }> = [
    {
      key: 'artist',
      title: 'Artists',
      image:
        (Array.isArray(guideItems) ? guideItems : []).find((i) => i && i.type === 'artist' && i.image)?.image ||
        '/web-hero/C48A0916.jpg',
    },
    {
      key: 'business',
      title: 'Businesses',
      image:
        (Array.isArray(guideItems) ? guideItems : []).find((i) => i && i.type === 'business' && i.image)?.image ||
        '/web-hero/C48A0889.jpg',
    },
    {
      key: 'venue',
      title: 'Venues',
      image:
        (Array.isArray(guideItems) ? guideItems : []).find((i) => i && i.type === 'venue' && i.image)?.image ||
        '/web-hero/C48A0775.jpg',
    },
    {
      key: 'vendor',
      title: 'Vendors',
      image:
        (Array.isArray(guideItems) ? guideItems : []).find((i) => i && i.type === 'vendor' && i.image)?.image ||
        '/about-bg.jpg',
    },
  ];

  return (
    <div className="min-h-screen pt-0 pb-28 md:pt-6 md:pb-24 bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white transition-colors duration-200">
      {/* Filter Pills & Search Controls */}
      <section className="sticky top-0 z-30 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-md border-b border-black/5 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-2.5 md:py-4">
          {/* Desktop Title row */}
          <div className="hidden md:flex items-center gap-2 mb-3">
            <button
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
              aria-label="Go back"
              className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-[#020b00] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-display text-[#020b00] dark:text-white">
                {t('discovery.title') || 'Discover'}{' '}
                <span className="text-[#9fa505] dark:text-[#d3da0c] font-bold">{t('discovery.hub') || 'Hub'}</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">
                {t('discovery.subtitle') ||
                  'Find artists, vendors, businesses, clubs, bars, events, and food spots in your city.'}
              </p>
            </div>
          </div>

          {/* Search bar (Collapsible on mobile, visible on desktop) */}
          <div className={`flex flex-col md:flex-row gap-3 mb-2.5 ${isSearchExpanded ? 'block' : 'hidden md:flex'}`}>
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('discovery.searchPlaceholder') || 'Search artists, vendors, venues, events...'}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 rounded-xl text-sm text-[#020b00] dark:text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
              />
            </div>
            <div className="relative shrink-0">
              <select
                value={selectedCity || 'all'}
                onChange={(e) => setSelectedCity(e.target.value)}
                aria-label="Filter discovery by city"
                className="w-full md:w-auto bg-neutral-100 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-[#020b00] dark:text-white text-sm font-medium focus:outline-none focus:border-[#d3da0c] cursor-pointer"
              >
                {chinaCities.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-[#0d140a] text-[#020b00] dark:text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Pills Row matching Reference Visual: All | Artists | Vendors | Business | Venues | Events */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {TAB_CONFIG.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabClick(tab.key)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-[#d3da0c] text-black shadow-sm'
                      : 'bg-neutral-100 dark:bg-[#0d140a] text-gray-700 dark:text-gray-300 border border-black/10 dark:border-white/10 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {t(tab.labelKey) || tab.fallback}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setIsSearchExpanded(!isSearchExpanded)}
              aria-label="Toggle search"
              className="md:hidden ml-auto flex-shrink-0 w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-gray-300"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 2x2 Visual Category Grid (Matches Reference Visual when on "All" tab) */}
      {activeTab === 'all' && !searchQuery.trim() && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-3 pb-2">
          <div className="grid grid-cols-2 gap-3">
            {categoryCards.map((card) => (
              <motion.button
                key={card.key}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => handleTabClick(card.key)}
                className="group relative h-36 sm:h-44 rounded-2xl overflow-hidden border border-white/10 text-left shadow-lg"
              >
                <img
                  src={card.image}
                  alt={card.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/web-hero/C48A0758.jpg';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between">
                  <span className="text-white font-display font-bold text-base tracking-tight">
                    {card.title}
                  </span>
                  <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {/* Featured in <City> Section (Matches Reference Visual) */}
      {activeTab === 'all' && !searchQuery.trim() && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[#020b00] dark:text-white tracking-tight">
              Featured in {currentCityName}
            </h2>
            <button
              type="button"
              onClick={() => handleTabClick('business')}
              className="inline-flex items-center gap-0.5 text-xs font-bold text-[#9fa505] dark:text-[#d3da0c] hover:underline"
            >
              See all
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(featuredItems.length > 0
              ? featuredItems.slice(0, 4)
              : guideItems.slice(0, 4)
            ).map((item) => {
              const targetSlug = (item as any).slug || slugify(item.name) || item.id;
              return (
                <motion.div
                  key={`featured-${item.type}-${item.id}`}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (item.type === 'artist') navigate(`/artists/${targetSlug}`);
                    else if (item.type === 'vendor') navigate(`/vendors/${targetSlug}`);
                    else if (item.type === 'business') navigate(`/profiles/${targetSlug}`);
                    else if (item.type === 'event') navigate(`/events/${targetSlug}`);
                    else {
                      setSelectedItem(item);
                      if (MAPPABLE_TYPES.has(item.type)) setMapCenter(item.lat, item.lng);
                    }
                  }}
                  className="group relative h-32 rounded-2xl overflow-hidden border border-white/10 bg-[#0d140a] cursor-pointer shadow-md"
                >
                  <img
                    src={
                      item.image ||
                      (item.type === 'artist' ? '/web-hero/C48A0916.jpg' : '/web-hero/C48A0889.jpg')
                    }
                    alt={item.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/web-hero/C48A0889.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <div className="absolute top-2 left-2">
                    <EntityBadge type={item.type} />
                  </div>
                  <div className="absolute bottom-2.5 left-3 right-3">
                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                    {item.address && (
                      <p className="text-[10px] text-gray-300 truncate">{item.address}</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* Curated Discovery Feed (only on "all" tab) */}
      {activeTab === 'all' && !searchQuery.trim() && (
        <div className="pt-1">
          <DiscoveryFeed />
        </div>
      )}

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-2">
        <div className={`flex ${hasMap ? 'flex-col lg:flex-row' : 'flex-col'} gap-4`}>
          {/* Map - stacked on top when active tab is mappable */}
          {hasMap && MAPPABLE_TYPES.has(activeTab) && (
            <div className="w-full lg:w-[55%] h-[38vh] lg:h-[calc(100vh-220px)] min-h-[240px] rounded-2xl overflow-hidden border border-white/10 relative bg-[#0d140a]">
              <div ref={mapRef} className="w-full h-full" />
              {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0d140a]">
                  <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* List */}
          <div className={`w-full ${hasMap && MAPPABLE_TYPES.has(activeTab) ? 'lg:w-[45%]' : 'lg:w-full'}`}>
            {isLoading && displayItems.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
              </div>
            )}

            {!isLoading && displayItems.length === 0 && (
              <div className="text-center py-12">
                <MapPin className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  {t('discovery.noItemsFound') || 'No places found for this filter.'}
                </p>
              </div>
            )}

            <div className="flex flex-col md:grid md:grid-cols-2 gap-2.5 md:gap-3">
              {displayItems.map((item, index) => {
                if (item.type === 'artist' || item.type === 'vendor' || item.type === 'business') {
                  const meta = item.meta || {};
                  const subtitle =
                    item.type === 'artist'
                      ? Number(meta.followers_count) > 0
                        ? t('discovery.followersCount', { count: meta.followers_count }) ||
                          `${meta.followers_count} followers`
                        : undefined
                      : item.type === 'business'
                      ? Number(meta.events_count) > 0
                        ? t('discovery.eventsCount', { count: meta.events_count }) ||
                          `${meta.events_count} events`
                        : undefined
                      : Number(meta.rating) > 0
                      ? `Rating ${meta.rating}`
                      : undefined;
                  const targetSlug = (item as any).slug || slugify(item.name) || item.id;
                  const targetPath =
                    item.type === 'artist'
                      ? `/artists/${targetSlug}`
                      : item.type === 'vendor'
                      ? `/vendors/${targetSlug}`
                      : `/profiles/${targetSlug}`;

                  const cardUser = {
                    id: Number(item.id),
                    user_id: item.user_id ? Number(item.user_id) : undefined,
                    artist_id: item.type === 'artist' ? Number(item.id) : undefined,
                    vendor_id: item.type === 'vendor' ? Number(item.id) : undefined,
                    role: item.type,
                    first_name: item.name,
                    name: item.name,
                    avatar_url: item.image,
                    is_verified: item.meta?.is_verified,
                  };
                  return (
                    <motion.div
                      key={`${item.type}-${item.id}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.3) }}
                    >
                      <DiscoveryResultCard user={cardUser as any} subtitle={subtitle} linkPath={targetPath} />
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={`${item.type}-${item.id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.3) }}
                    onClick={() => {
                      if (item.type === 'event') navigate(`/events/${item.id}`);
                      else {
                        setSelectedItem(item);
                        if (MAPPABLE_TYPES.has(item.type)) setMapCenter(item.lat, item.lng);
                      }
                    }}
                    className={`group flex items-center gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer ${
                      selectedItem?.id === item.id && selectedItem?.type === item.type
                        ? 'bg-[#d3da0c]/15 border-[#d3da0c]'
                        : 'bg-neutral-50 dark:bg-[#0d140a] border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded-xl overflow-hidden bg-neutral-200 dark:bg-[#151c12]">
                      <img
                        src={item.image || '/placeholder-club.jpg'}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-club.jpg';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <EntityBadge type={item.type} />
                      </div>
                      <h3 className="text-sm md:text-base font-bold text-[#020b00] dark:text-white truncate">{item.name}</h3>

                      {item.type === 'event' ? (
                        <div className="mt-1 space-y-0.5">
                          {item.meta?.venue_name && (
                            <p className="text-xs text-gray-400 truncate">{String(item.meta.venue_name)}</p>
                          )}
                          {item.address && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDirections(item.lat, item.lng, item.name);
                              }}
                              className="inline-flex items-center gap-1 text-xs text-[#d3da0c] hover:text-white transition-colors font-medium"
                            >
                              <MapPin className="w-3 h-3" />
                              <span className="truncate max-w-[160px] md:max-w-[200px]">{item.address}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {item.meta?.start_date && (
                            <p className="text-[11px] text-gray-400">
                              {(() => {
                                const d = new Date(String(item.meta.start_date));
                                return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                });
                              })()}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {item.address || item.description || ''}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {item.type !== 'event' && MAPPABLE_TYPES.has(item.type) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDirections(item.lat, item.lng, item.name);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#d3da0c] hover:text-white transition-colors"
                          >
                            <Navigation className="w-3 h-3" />
                            {t('cityGuide.getDirections') || 'Directions'}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CityGuide;
