import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
  PartyPopper,
  Star,
  Heart,
  Map as MapIcon,
  ChevronDown,
  X,
  ExternalLink,
} from 'lucide-react';
import { chinaCities } from '@/data/constants';
import { useCityGuideStore } from '@/store/cityGuideStore';
import type { GuideItem } from '@/store/cityGuideStore';
import { openDirections } from '@/lib/directions';

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
  organizer: '#f97316',
};

type FilterTab = 'all' | 'event' | 'venue' | 'food' | 'artist' | 'vendor' | 'business' | 'organizer';

const TAB_CONFIG: { key: FilterTab; labelKey: string; fallback: string; icon: typeof MapPin }[] = [
  { key: 'all', labelKey: 'cityGuide.all', fallback: 'All', icon: MapPin },
  { key: 'event', labelKey: 'cityGuide.events', fallback: 'Events', icon: Calendar },
  { key: 'venue', labelKey: 'cityGuide.venues', fallback: 'Clubs & Bars', icon: Music },
  { key: 'food', labelKey: 'cityGuide.food', fallback: 'Food', icon: Utensils },
  { key: 'artist', labelKey: 'discovery.artists', fallback: 'Artists', icon: Users },
  { key: 'vendor', labelKey: 'discovery.vendors', fallback: 'Vendors', icon: Store },
  { key: 'business', labelKey: 'discovery.businesses', fallback: 'Businesses', icon: Building2 },
  { key: 'organizer', labelKey: 'discovery.organizers', fallback: 'Organizers', icon: PartyPopper },
];

// Only these types appear on the map
const MAPPABLE_TYPES = new Set<FilterTab>(['event', 'venue', 'food']);

function EntityBadge({ type }: { type: GuideItem['type'] }) {
  const colors: Record<string, string> = {
    event: 'bg-blue-500/20 text-blue-400',
    venue: 'bg-amber-500/20 text-amber-400',
    food: 'bg-green-500/20 text-green-400',
    artist: 'bg-pink-500/20 text-pink-400',
    vendor: 'bg-violet-500/20 text-violet-400',
    business: 'bg-cyan-500/20 text-cyan-400',
    organizer: 'bg-orange-500/20 text-orange-400',
  };
  const labels: Record<string, string> = {
    event: 'Event',
    venue: 'Club/Bar',
    food: 'Food',
    artist: 'Artist',
    vendor: 'Vendor',
    business: 'Business',
    organizer: 'Organizer',
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

function CityDropdown({
  selectedCity,
  onSelect,
}: {
  selectedCity: string;
  onSelect: (cityId: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const topCities = useMemo(() => ['shanghai', 'beijing', 'guangzhou', 'shenzhen', 'chengdu', 'hangzhou'], []);
  const otherCities = useMemo(
    () => chinaCities.filter((c) => c.id !== 'other' && !topCities.includes(c.id)),
    [topCities]
  );

  const filteredOthers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return otherCities;
    return otherCities.filter((c) => c.name.toLowerCase().includes(q) || c.nameCN.includes(q));
  }, [otherCities, search]);

  const selected = chinaCities.find((c) => c.id === selectedCity) || chinaCities[0];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full md:w-64">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[#111111] border border-white/10 rounded-xl text-white hover:border-[#d3da0c]/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#d3da0c]" />
          <span className="font-medium">{selected.name}</span>
          <span className="text-gray-500 text-sm">{selected.nameCN}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute top-full left-0 right-0 mt-2 bg-[#151515] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="p-3 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('discovery.searchCity') || 'Search city...'}
                  className="w-full pl-9 pr-8 py-2 bg-[#0f0f0f] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {!search && (
                <>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('discovery.topCities') || 'Top Cities'}
                  </div>
                  {topCities.map((id) => {
                    const city = chinaCities.find((c) => c.id === id)!;
                    const isActive = selectedCity === city.id;
                    return (
                      <button
                        key={city.id}
                        onClick={() => {
                          onSelect(city.id);
                          setOpen(false);
                          setSearch('');
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/5 transition-colors ${
                          isActive ? 'bg-[#d3da0c]/10 text-[#d3da0c]' : 'text-white'
                        }`}
                      >
                        <span className="text-sm">
                          {city.name} <span className="text-gray-500">{city.nameCN}</span>
                        </span>
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#d3da0c]" />}
                      </button>
                    );
                  })}

                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t border-white/5">
                    {t('discovery.others') || 'Others'}
                  </div>
                </>
              )}

              {filteredOthers.length === 0 && (
                <div className="px-4 py-4 text-sm text-gray-500 text-center">
                  {t('discovery.noCitiesFound') || 'No cities found'}
                </div>
              )}

              {filteredOthers.map((city) => {
                const isActive = selectedCity === city.id;
                return (
                  <button
                    key={city.id}
                    onClick={() => {
                      onSelect(city.id);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/5 transition-colors ${
                      isActive ? 'bg-[#d3da0c]/10 text-[#d3da0c]' : 'text-white'
                    }`}
                  >
                    <span className="text-sm">
                      {city.name} <span className="text-gray-500">{city.nameCN}</span>
                    </span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#d3da0c]" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CityGuide = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedCity, setSelectedCity] = useState('shanghai');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

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
    const cityToFetch = selectedCity && selectedCity !== 'all' ? selectedCity : 'shanghai';
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

    // Only map events, venues, and food — NOT artists/vendors/businesses/organizers
    const mappable =
      activeTab === 'all'
        ? guideItems.filter((i) => MAPPABLE_TYPES.has(i.type))
        : guideItems.filter((i) => i.type === activeTab && MAPPABLE_TYPES.has(i.type));

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
    let items = activeTab === 'all' ? guideItems : guideItems.filter((i) => i.type === activeTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.address && i.address.toLowerCase().includes(q)) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }
    return items;
  }, [guideItems, activeTab, searchQuery]);

  const featuredItems = useMemo(() => {
    return guideItems.filter((i) => {
      const isVerified = Boolean(i.meta.is_verified);
      const followers = Number(i.meta.followers_count || 0);
      const rating = Number(i.meta.rating || 0);
      const events = Number(i.meta.events_count || 0);
      if (i.type === 'artist') return isVerified || followers > 0;
      if (i.type === 'vendor') return isVerified || rating >= 4;
      if (i.type === 'organizer' || i.type === 'business') return isVerified || events > 0;
      if (i.type === 'venue') return true;
      return false;
    }).slice(0, 6);
  }, [guideItems]);

  const hasMap = mapReady && !mapError && GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'your_maps_key';

  return (
    <div className="min-h-screen pt-16 pb-24 md:pt-20 md:pb-24 bg-[#0A0A0A]">
      {/* Header */}
      <section className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-3 md:px-6 lg:px-8 py-3 md:py-4">
          {/* Title row on desktop */}
          <div className="hidden md:block mb-4">
            <h1 className="text-2xl font-display text-white">
              {t('discovery.title') || 'Discovery'} <span className="text-[#d3da0c]">{t('discovery.hub') || 'Hub'}</span>
            </h1>
            <p className="text-gray-400 text-sm">
              {t('discovery.subtitle') || 'Find artists, vendors, businesses, organizers, clubs, bars, events, and food spots in your city.'}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-3">
            <CityDropdown selectedCity={selectedCity} onSelect={(id) => { setSelectedCity(id); setSelectedItem(null); }} />

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('discovery.searchPlaceholder') || 'Search artists, vendors, venues, events...'}
                className="w-full pl-10 pr-4 py-3 bg-[#111111] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Type Tabs - horizontal scroll on mobile */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedItem(null); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#d3da0c] text-black'
                      : 'bg-[#111111] text-gray-400 border border-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t(tab.labelKey) || tab.fallback}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Section */}
      {activeTab === 'all' && featuredItems.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 md:px-6 lg:px-8 py-4">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-[#d3da0c]" />
            {t('discovery.featured') || 'Featured'}
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {featuredItems.map((item) => (
              <motion.div
                key={`featured-${item.type}-${item.id}`}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (item.type === 'artist') navigate(`/artists/${item.id}`);
                  else if (item.type === 'vendor') navigate(`/vendors/${item.id}`);
                  else if ((item.type === 'business' || item.type === 'organizer') && item.user_id) navigate(`/profiles/${item.user_id}`);
                  else if (item.type === 'event') navigate(`/events/${item.id}`);
                  else {
                    setSelectedItem(item);
                    if (MAPPABLE_TYPES.has(item.type)) setMapCenter(item.lat, item.lng);
                  }
                }}
                className="flex-shrink-0 w-28 cursor-pointer"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-[#1a1a1a] mb-1.5">
                  <img
                    src={item.image || (item.type === 'artist' ? '/default-avatar.jpg' : '/placeholder-club.jpg')}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = item.type === 'artist' ? '/default-avatar.jpg' : '/placeholder-club.jpg'; }}
                  />
                </div>
                <p className="text-xs font-medium text-white truncate">{item.name}</p>
                <EntityBadge type={item.type} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-3 md:px-6 lg:px-8 py-2">
        <div className={`flex ${hasMap ? 'flex-col lg:flex-row' : 'flex-col'} gap-4`}>
          {/* Map - stacked on top for mobile when active tab is mappable */}
          {hasMap && (activeTab === 'all' || MAPPABLE_TYPES.has(activeTab)) && (
            <div className="w-full lg:w-[55%] h-[45vh] lg:h-[calc(100vh-220px)] min-h-[280px] rounded-2xl overflow-hidden border border-white/10 relative bg-[#111111]">
              <div ref={mapRef} className="w-full h-full" />
              {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#111111]">
                  <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* List */}
          <div className={`w-full ${hasMap && (activeTab === 'all' || MAPPABLE_TYPES.has(activeTab)) ? 'lg:w-[45%]' : 'lg:w-full'}`}>
            {isLoading && displayItems.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
              </div>
            )}

            {!isLoading && displayItems.length === 0 && (
              <div className="text-center py-12">
                <MapPin className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">{t('discovery.noItemsFound') || 'No places found for this city.'}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayItems.map((item, index) => (
                <motion.div
                  key={`${item.type}-${item.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.3) }}
                  onClick={() => {
                    if (item.type === 'artist') navigate(`/artists/${item.id}`);
                    else if (item.type === 'vendor') navigate(`/vendors/${item.id}`);
                    else if ((item.type === 'business' || item.type === 'organizer') && item.user_id) navigate(`/profiles/${item.user_id}`);
                    else if (item.type === 'event') navigate(`/events/${item.id}`);
                    else {
                      setSelectedItem(item);
                      if (MAPPABLE_TYPES.has(item.type)) setMapCenter(item.lat, item.lng);
                    }
                  }}
                  className={`group flex gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedItem?.id === item.id && selectedItem?.type === item.type
                      ? 'bg-[#d3da0c]/10 border-[#d3da0c]/40'
                      : 'bg-[#111111] border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="w-20 h-20 md:w-24 md:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-[#1a1a1a]">
                    <img
                      src={item.image || '/placeholder-club.jpg'}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-club.jpg'; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <EntityBadge type={item.type} />

                      {item.type === 'vendor' && item.meta.is_verified && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">Verified</span>
                      )}
                    </div>
                    <h3 className="text-sm md:text-base font-semibold text-white truncate">{item.name}</h3>

                    {/* Event-specific: clickable address + venue info */}
                    {item.type === 'event' ? (
                      <div className="mt-1 space-y-0.5">
                        {item.meta.venue_name && (
                          <p className="text-xs text-gray-400 truncate">{String(item.meta.venue_name)}</p>
                        )}
                        {item.address && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDirections(item.lat, item.lng, item.name);
                            }}
                            className="inline-flex items-center gap-1 text-xs text-[#d3da0c] hover:text-white transition-colors"
                          >
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-[160px] md:max-w-[200px]">{item.address}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                        {item.meta.start_date && (
                          <p className="text-[11px] text-gray-500">
                            {new Date(String(item.meta.start_date)).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{item.address || item.description || ''}</p>
                    )}

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {item.type === 'artist' && (
                        <>
                          <MetricPill icon={Heart} value={`${Number(item.meta.followers_count || 0)}`} />
                          <MetricPill icon={Calendar} value={`${Number(item.meta.events_count || 0)}`} />
                        </>
                      )}
                      {item.type === 'vendor' && (
                        <>
                          <MetricPill icon={Star} value={`${Number(item.meta.rating || 0).toFixed(1)}`} />
                          <MetricPill icon={Users} value={`${Number(item.meta.reviews_count || 0)}`} />
                        </>
                      )}
                      {(item.type === 'business' || item.type === 'organizer') && (
                        <MetricPill icon={Calendar} value={`${Number(item.meta.events_count || 0)}`} />
                      )}

                      {/* Directions button for mappable items (non-events handled here, events have address link above) */}
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
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CityGuide;
