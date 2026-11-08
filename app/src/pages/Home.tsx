import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  MapPin,
  Music,
  Ticket,
  Users,
  Zap,
  Utensils,
  Heart,
  Star,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Camera,
  Handshake,
  Mic2,
  ExternalLink,
  Rocket,
  Globe,
  Code,
  Palette,
  PartyPopper,
  Radio,
  Headphones,
  Disc3,
  Store,
  Play,
  Plus,
  MoreHorizontal,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import { getEntitySlug } from '@/lib/slug';
import { chinaCities } from '@/data/constants';
import EventCard from '@/components/EventCard';
import ArtistCard from '@/components/ArtistCard';
import AdBanner from '@/components/AdBanner';
import MobileEventCard from '@/components/ui/MobileEventCard';
import MobileListRow from '@/components/ui/MobileListRow';
import MobileSectionHeader from '@/components/ui/MobileSectionHeader';
import MobileFilterPills from '@/components/ui/MobileFilterPills';
import type { DateFilter } from '@/components/ui/MobileFilterPills';

import axios from 'axios';
import type { DJ, EventWithDetails } from '@/store/eventStore';

const API_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

/* Floating music note particles for hero background */
const FloatingNotes = () => {
  const notes = [
    { icon: '♪', left: '10%', top: '20%', delay: 0, duration: 7 },
    { icon: '♫', left: '75%', top: '15%', delay: 1.5, duration: 9 },
    { icon: '♩', left: '25%', top: '60%', delay: 3, duration: 8 },
    { icon: '♬', left: '85%', top: '50%', delay: 0.5, duration: 10 },
    { icon: '♭', left: '50%', top: '35%', delay: 2, duration: 6 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
      {notes.map((n, i) => (
        <motion.span
          key={i}
          className="absolute text-white/5 text-2xl font-serif"
          style={{ left: n.left, top: n.top }}
          animate={{
            y: [0, -30, 0],
            x: [0, 10, -10, 0],
            rotate: [0, 10, -5, 0],
            opacity: [0.03, 0.08, 0.03],
          }}
          transition={{
            duration: n.duration,
            repeat: Infinity,
            delay: n.delay,
            ease: 'easeInOut',
          }}
        >
          {n.icon}
        </motion.span>
      ))}
    </div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { featuredEvents, fetchFeaturedEvents, isLoading } = useEventStore();
  const { user, profile, selectedCity } = useAuthStore();
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'home.greetingMorning' : hour < 18 ? 'home.greetingAfternoon' : 'home.greetingEvening';
  const [featuredDJs, setFeaturedDJs] = useState<DJ[]>([]);
  const [pastEvents, setPastEvents] = useState<EventWithDetails[]>([]);
  const [pastEventsLoading, setPastEventsLoading] = useState(false);
  const [mobileDateFilter, setMobileDateFilter] = useState<DateFilter>('all');
  const [mobileCategoryFilter, setMobileCategoryFilter] = useState('');
  const [platformStats, setPlatformStats] = useState({
    total_events: 0,
    total_artists: 0,
    total_users: 0,
    active_cities: 0,
  });

  const [cityGuideCounts, setCityGuideCounts] = useState({
    venues: 0,
    businesses: 0,
    vendors: 0,
    events: 0,
    artists: 0,
  });

  const [trendingReels, setTrendingReels] = useState<Array<{
    id: number;
    title?: string;
    caption?: string;
    thumbnail_url?: string;
    video_url?: string;
    likes_count?: number;
    author?: { name?: string; username?: string; avatar_url?: string };
  }>>([]);
  const [activeStoryPreview, setActiveStoryPreview] = useState<{
    title: string;
    image: string;
    subtitle: string;
    ctaPath: string;
    ctaLabel: string;
  } | null>(null);

  const fetchTrendingReels = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/reels`, { params: { limit: 8 } });
      if (Array.isArray(data) && data.length > 0) {
        setTrendingReels(data);
      }
    } catch {
      // Fallback handled in render
    }
  }, []);

  const fetchDJs = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/artists/featured`);
      if (data) {
        const formattedDJs = data.map((artist: { id: number; stage_name?: string; avatar_url?: string; genres?: string[] }) => ({
          id: String(artist.id),
          stage_name: artist.stage_name || 'Artist',
          avatar_url: artist.avatar_url,
          genres: artist.genres || [],
        }));
        setFeaturedDJs(formattedDJs);
      }
    } catch (e) {
      console.error('Failed to fetch DJs:', e);
    }
  }, [selectedCity]);

  const fetchPlatformStats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/dashboard/platform-stats`);
      if (data) setPlatformStats(data);
    } catch (e) {
      console.error('Failed to fetch platform stats:', e);
    }
  }, []);

  const fetchCityGuideCounts = useCallback(async () => {
    try {
      const city = selectedCity && selectedCity !== 'all' ? selectedCity : 'all';
      const { data } = await axios.get(`${API_URL}/cities/${encodeURIComponent(city)}/guide`);
      if (data) {
        setCityGuideCounts({
          venues: (data.venues || []).length,
          businesses: (data.businesses || []).length,
          vendors: (data.vendors || []).length,
          events: (data.events || []).length,
          artists: (data.artists || []).length,
        });
      }
    } catch (e) {
      console.error('Failed to fetch city guide counts:', e);
    }
  }, [selectedCity]);

  useEffect(() => {
    fetchFeaturedEvents(selectedCity && selectedCity !== 'all' ? selectedCity : undefined);
    fetchDJs();
    fetchPlatformStats();
    fetchCityGuideCounts();
    fetchTrendingReels();
  }, [fetchFeaturedEvents, selectedCity, fetchDJs, fetchPlatformStats, fetchCityGuideCounts, fetchTrendingReels]);

  useEffect(() => {
    let cancelled = false;
    const loadPastEvents = async () => {
      setPastEventsLoading(true);
      try {
        const { data } = await axios.get(`${API_URL}/events/past`, {
          params: selectedCity && selectedCity !== 'all' ? { city: selectedCity } : undefined,
        });
        if (!cancelled) setPastEvents(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch past events:', error);
        if (!cancelled) setPastEvents([]);
      } finally {
        if (!cancelled) setPastEventsLoading(false);
      }
    };
    loadPastEvents();
    return () => { cancelled = true; };
  }, [selectedCity]);

  const userCity = selectedCity && selectedCity !== 'all' ? (chinaCities.find(c => c.id === selectedCity)?.name || selectedCity) : 'China';

  const heroRef = useRef<HTMLDivElement>(null);
  const upcomingScrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  // Hero background slideshow using the curated WEB HERO photography
  const HERO_SLIDES = [
    '/web-hero/C48A0758.jpg',
    '/web-hero/C48A0916.jpg',
    '/web-hero/C48A0775.jpg',
    '/web-hero/C48A0889.jpg',
    '/web-hero/C48A0779.jpg',
  ];
  const [heroSlide, setHeroSlide] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setHeroSlide((s) => (s + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(timer);
  }, [HERO_SLIDES.length]);

  const platformFeatures = [
    { icon: Calendar, title: 'Discover Events', path: '/events', color: '#d3da0c' },
    { icon: Ticket, title: 'Buy Tickets', path: '/events', color: '#FF2D8F' },
    { icon: Music, title: 'Book DJs', path: '/artists', color: '#00E5FF' },
    { icon: Mic2, title: 'Find Artists', path: '/artists', color: '#C8A000' },
    { icon: Utensils, title: 'Find Vendors', path: '/marketplace', color: '#d3da0c' },
    { icon: Handshake, title: 'Connect with Businesses', path: '/city-guide', color: '#FF2D8F' },
    { icon: Camera, title: 'Hire Photographers', path: '/artists', color: '#00E5FF' },
    { icon: Star, title: 'Discover Dancers', path: '/artists', color: '#C8A000' },
  ];

  // 6 photo-backed cards matching the reference design (informational only — no external links)
  const whatWeDo = [
    {
      icon: Calendar,
      iconColor: '#00E5FF',
      title: 'Live Events & Festivals',
      description: 'Curated parties, cultural showcases, nightlife experiences, and premium festival concepts.',
      image: '/web-hero/C48A0775.jpg',
    },
    {
      icon: Music,
      iconColor: '#FF2D8F',
      title: 'Music & Cultural Experiences',
      description: 'Signature event series like RNB & Slow Sessions that celebrate timeless music and culture.',
      image: '/web-hero/C48A0758.jpg',
    },
    {
      icon: Users,
      iconColor: '#d3da0c',
      title: 'Artist & DJ Collaborations',
      description: 'Bookings and collaborations with artists and DJs across Africa, China, and international markets.',
      image: '/web-hero/C48A0916.jpg',
    },
    {
      icon: Palette,
      iconColor: '#a855f7',
      title: 'Creative Services',
      description: 'Graphic design, branding, and creative production through Sound It Tech.',
      image: '/web-hero/C48A0903.jpg',
    },
    {
      icon: Users,
      iconColor: '#00E5FF',
      title: 'Community & Cultural Initiatives',
      description: 'Community-focused events and programs that connect and celebrate culture.',
      image: '/web-hero/C48A0779.jpg',
    },
    {
      icon: Globe,
      iconColor: '#a855f7',
      title: 'Brand Partnerships & International Collaborations',
      description: 'Partnerships with brands, venues, and international entertainment personalities.',
      image: '/web-hero/C48A0811.jpg',
    },
  ];

  // Single section for our 6 live ecosystem websites with their actual landing page previews
  const liveEcosystemSites = [
    {
      name: 'Beatz of Afrika (BOA)',
      tagline: "Shanghai's Premier African Music & Culture Festival",
      description: 'Two days of Afrobeats, Amapiano, food, fashion, VIP hosting, and international headliners in Shanghai.',
      url: 'https://boa.sounditent.com/',
      domain: 'boa.sounditent.com',
      screenshot: '/web-hero/site-boa.png',
      fallbackPhoto: '/web-hero/C48A0775.jpg',
      accent: '#d3da0c',
      badge: 'Festival Platform',
    },
    {
      name: 'RNB & Slow Sessions',
      tagline: 'Signature R&B & Soul Experience Series',
      description: 'Curated musical storytelling celebrating timeless R&B, soul, slow jams, and intimate community vibes.',
      url: 'https://rnbnslowsessions.com/',
      domain: 'rnbnslowsessions.com',
      screenshot: '/web-hero/site-rnb.png',
      fallbackPhoto: '/web-hero/C48A0779.jpg',
      accent: '#FF2D8F',
      badge: 'Signature Series',
    },
    {
      name: 'Sound It DJ',
      tagline: 'Professional DJ Library & Mix Intelligence',
      description: 'Import, analyze, and export your music across all DJ platforms. Mix analysis, visualizer creation, and USB export for CDJs.',
      url: 'https://sounditdj.cloud/',
      domain: 'sounditdj.cloud',
      screenshot: '/web-hero/site-sounditdj.png',
      fallbackPhoto: '/web-hero/C48A0903.jpg',
      accent: '#EDC61E',
      badge: 'DJ Intelligence & Cloud',
    },
    {
      name: 'Sound It Tech',
      tagline: 'Building the Future of Technology & Innovation',
      description: 'Full-stack software engineering, mobile & web applications, WeChat mini programs, computer sales & repair, and enterprise IT solutions.',
      url: 'https://www.soundit.tech/#',
      domain: 'www.soundit.tech',
      screenshot: '/web-hero/site-soundittech.png',
      fallbackPhoto: '/web-hero/C48A0811.jpg',
      accent: '#00E5FF',
      badge: 'Tech & IT Solutions',
    },
    {
      name: 'Deck Salone',
      tagline: "Sierra Leone's Official DJ & Entertainment Ecosystem",
      description: 'Discover top DJs, stream exclusive Sierra Leonean mixes, book talent for events, and experience live DJ battles.',
      url: 'https://www.decksalone.com/',
      domain: 'www.decksalone.com',
      screenshot: '/web-hero/site-decksalone.png',
      fallbackPhoto: '/web-hero/C48A0916.jpg',
      accent: '#22c55e',
      badge: 'DJ Ecosystem',
    },
    {
      name: 'Fred Max Official',
      tagline: 'Founder & CEO · DJ · Producer · Software Developer',
      description: 'Bridging Africa, China, and the global stage through music, technology, creative production, and cultural innovation.',
      url: 'https://fredmax.sounditent.com/',
      domain: 'fredmax.sounditent.com',
      screenshot: '/web-hero/site-fredmax.png',
      fallbackPhoto: '/web-hero/C48A0758.jpg',
      accent: '#a855f7',
      badge: 'Founder & Artist Hub',
    },
  ];

  const joinItems = [
    { icon: Heart, title: 'Join Sound it', description: 'Create a free account and become part of the community.', action: 'Join Now', path: '/register' },
    { icon: Mic2, title: 'Become an Artist', description: 'Showcase your talent, get booked, and grow your audience.', action: 'Get Started', path: '/register' },
    { icon: Calendar, title: 'Become an Organizer', description: 'Host events, sell tickets, and manage your events with our tools.', action: 'Get Started', path: '/register' },
    { icon: Store, title: 'Join as a Vendor', description: 'Sell products and services to the Sound It community.', action: 'Get Started', path: '/register' },
    { icon: Handshake, title: 'Partner With Us', description: 'Collaborate with Sound It Events and our brands.', action: 'Contact Us', path: '/contact' },
    { icon: Code, title: 'Work With Sound It Tech', description: 'Software, apps, design, and IT solutions for your business.', action: 'Contact Us', path: '/contact' },
    { icon: Ticket, title: 'Attend an Event', description: 'Discover upcoming events and get your tickets.', action: 'Explore Events', path: '/events' },
  ];

  const statusLabels: Record<string, string> = {
    active: t('home.brand.statusActive') || 'Active',
    development: t('home.brand.statusDevelopment') || 'In Development',
    planned: t('home.brand.statusPlanned') || 'Planned',
    prelaunch: t('home.brand.statusPrelaunch') || 'Pre-launch',
    partner: t('home.brand.statusPartner') || 'Partner Project',
  };

  const statusStyles: Record<string, string> = {
    active: 'bg-[#d3da0c]/10 text-[#d3da0c]',
    development: 'bg-purple-500/10 text-purple-400',
    prelaunch: 'bg-blue-500/10 text-blue-400',
    planned: 'bg-white/5 text-gray-400',
    partner: 'bg-blue-500/10 text-blue-400',
  };

  const stats = [
    { value: `${(platformStats.total_events || 0).toLocaleString()}+`, label: t('home.stats.events') || 'Events', icon: Calendar },
    { value: `${(platformStats.total_artists || 0).toLocaleString()}+`, label: t('home.stats.artists') || 'Artists', icon: Music },
    { value: `${(platformStats.total_users || 0).toLocaleString()}+`, label: t('home.stats.community') || 'Community', icon: Users },
    { value: `${platformStats.active_cities || 0}`, label: t('home.stats.cities') || 'Cities', icon: MapPin },
  ];

  const sectionVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
    }),
  };

  // Use the archive endpoint for past events; featured events are upcoming-only.
  const timelineSource = mobileDateFilter === 'past' ? pastEvents : featuredEvents;
  const filteredMobileEvents = timelineSource.filter((event) => {
    const now = new Date();
    const eventDate = new Date(event.start_date);
    const eventEnd = event.end_date ? new Date(event.end_date) : new Date(eventDate.getTime() + 4 * 60 * 60 * 1000);
    const isCompleted = event.status === 'completed' || (eventEnd < now && event.status !== 'live');

    let passDate = true;
    if (mobileDateFilter === 'current') {
      const isToday = eventDate.toDateString() === now.toDateString();
      const isLiveNow = eventDate <= now && eventEnd >= now;
      passDate = (isToday || isLiveNow || event.status === 'live') && !isCompleted;
    } else if (mobileDateFilter === 'upcoming') {
      const isToday = eventDate.toDateString() === now.toDateString();
      passDate = eventDate > now && !isToday && !isCompleted;
    } else if (mobileDateFilter === 'past') {
      passDate = isCompleted;
    } else {
      // 'all' shows active events
      passDate = !isCompleted;
    }

    let passCat = true;
    if (mobileCategoryFilter && event.category) {
      passCat = event.category.toLowerCase().includes(mobileCategoryFilter.toLowerCase());
    }
    return passDate && passCat;
  });

  return (
    <div className="relative">

      {/* ==================== MOBILE HOME (hidden on desktop) ==================== */}
      <section className="md:hidden pt-1 pb-4">
        {/* Headline matching reference visual */}
        <div className="px-4 mb-3">
          {profile?.first_name && (
            <p className="text-gray-600 dark:text-gray-400 text-xs font-medium mb-0.5">
              {t(greetingKey)}, {profile.first_name}
            </p>
          )}
          <h1 className="text-[#020b00] dark:text-white font-display font-extrabold text-[22px] tracking-tight leading-tight uppercase">
            {t('home.headlineFind', 'FIND YOUR NEXT')}{' '}
            <span className="text-[#9fa505] dark:text-[#d3da0c]">{t('home.headlineExperience', 'EXPERIENCE')}</span>
          </h1>
        </div>

        {/* Search bar + Location Filter */}
        <div className="px-4 mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/events')}
            className="flex-1 min-w-0 flex items-center gap-2.5 h-11 px-3.5 bg-neutral-100 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 rounded-xl shadow-xs text-left active:scale-[0.99] transition-transform"
          >
            <Search className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
            <span className="flex-1 text-gray-500 dark:text-gray-400 text-sm truncate">
              {t('home.searchPlaceholder', 'Search events, artists, venues...')}
            </span>
          </button>

          {/* Location / City Filter (moved from top-left header) */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-city-picker'))}
            aria-label="Filter by location"
            className="flex items-center gap-1.5 h-11 px-3 rounded-xl bg-neutral-100 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 text-xs font-bold text-[#020b00] dark:text-white shrink-0 active:scale-95 transition-transform shadow-xs cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5 text-[#d3da0c] shrink-0" />
            <span className="max-w-[75px] truncate">
              {(chinaCities.find((c) => c.id === selectedCity) || chinaCities[0]).name.split(' ')[0]}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
          </button>
        </div>

        {/* Stories & Quick Discovery Circles Row */}
        <div className="px-4 mb-5">
          <div className="flex items-center justify-between gap-2 overflow-x-auto hide-scrollbar pb-1">
            {/* Your Story */}
            <button
              type="button"
              onClick={() =>
                setActiveStoryPreview({
                  title: profile?.first_name ? `${profile.first_name}'s Story` : 'Sound It Stories',
                  image: featuredEvents[0]?.banner_url || featuredEvents[0]?.cover_image || '/web-hero/C48A0758.jpg',
                  subtitle: 'Share your nightlife moments & event recaps with the Sound It community.',
                  ctaPath: '/reels',
                  ctaLabel: 'Post a Reel or Story',
                })
              }
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
            >
              <div className="relative w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-[#d3da0c] to-[#65a30d]">
                <div className="w-full h-full rounded-full overflow-hidden bg-[#0a1207] border-2 border-white dark:border-[#020b00]">
                  <img
                    src={profile?.avatar_url || '/web-hero/C48A0758.jpg'}
                    alt="Your Story"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#d3da0c] text-black flex items-center justify-center border border-white dark:border-[#020b00]">
                  <Plus className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              </div>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Your Story</span>
            </button>

            {/* Events Story Circle */}
            <button
              type="button"
              onClick={() => navigate('/events')}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-[#d3da0c] via-[#a3e635] to-[#d3da0c]">
                <div className="w-full h-full rounded-full overflow-hidden bg-[#0a1207] border-2 border-white dark:border-[#020b00]">
                  <img
                    src={featuredEvents[0]?.banner_url || featuredEvents[0]?.cover_image || '/web-hero/C48A0775.jpg'}
                    alt="Events"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Events</span>
            </button>

            {/* Artists Story Circle */}
            <button
              type="button"
              onClick={() => navigate('/discovery?tab=artists')}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-[#d3da0c] via-[#a3e635] to-[#d3da0c]">
                <div className="w-full h-full rounded-full overflow-hidden bg-[#0a1207] border-2 border-white dark:border-[#020b00]">
                  <img
                    src={featuredDJs[0]?.avatar_url || '/web-hero/C48A0916.jpg'}
                    alt="Artists"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Artists</span>
            </button>

            {/* Venues Story Circle */}
            <button
              type="button"
              onClick={() => navigate('/discovery?tab=venues')}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-[#d3da0c] via-[#a3e635] to-[#d3da0c]">
                <div className="w-full h-full rounded-full overflow-hidden bg-[#0a1207] border-2 border-white dark:border-[#020b00]">
                  <img
                    src="/web-hero/C48A0889.jpg"
                    alt="Venues"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Venues</span>
            </button>

            {/* More Circle */}
            <button
              type="button"
              onClick={() => navigate('/discovery')}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className="w-14 h-14 rounded-full p-[1.5px] bg-black/15 dark:bg-white/20">
                <div className="w-full h-full rounded-full bg-neutral-100 dark:bg-[#0d140a] border-2 border-white dark:border-[#020b00] flex items-center justify-center text-[#020b00] dark:text-white">
                  <MoreHorizontal className="w-5 h-5" />
                </div>
              </div>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">More</span>
            </button>
          </div>
        </div>

        {/* Primary Featured Event Hero Card (Matches Reference Visual) */}
        {!isLoading && (
          <div className="px-4 mb-5">
            {(() => {
              const heroEvent = filteredMobileEvents[0] || featuredEvents[0];
              if (heroEvent) {
                const heroSlug = getEntitySlug(heroEvent);
                const eventDateStr = heroEvent.start_date
                  ? new Date(heroEvent.start_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Upcoming';
                const heroVenue = heroEvent.venue_name || heroEvent.city_name || userCity;
                const heroImage =
                  heroEvent.banner_url ||
                  heroEvent.cover_image ||
                  '/web-hero/C48A0775.jpg';

                return (
                  <div
                    onClick={() => navigate(`/events/${heroSlug}`)}
                    className="relative h-[205px] rounded-2xl overflow-hidden border border-white/10 shadow-xl cursor-pointer group active:scale-[0.99] transition-transform"
                  >
                    <img
                      src={heroImage}
                      alt={heroEvent.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-white font-display font-extrabold text-xl leading-tight truncate mb-1">
                          {heroEvent.title}
                        </h2>
                        <div className="flex items-center gap-1.5 text-gray-300 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-[#d3da0c] flex-shrink-0" />
                          <span className="truncate">
                            {eventDateStr} • {heroVenue}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/events/${heroSlug}`);
                        }}
                        className="flex-shrink-0 px-4 py-2 rounded-full bg-[#d3da0c] text-black font-extrabold text-xs shadow-lg active:scale-95 transition-transform"
                      >
                        Get Tickets
                      </button>
                    </div>
                  </div>
                );
              }
              const latestRecap = pastEvents[0];
              if (latestRecap) {
                const recapSlug = getEntitySlug(latestRecap);
                return (
                  <div
                    onClick={() => navigate(`/events/${recapSlug}`)}
                    className="relative h-[205px] rounded-2xl overflow-hidden border border-white/10 shadow-xl cursor-pointer group active:scale-[0.99] transition-transform"
                  >
                    <img
                      src={latestRecap.cover_image || latestRecap.banner_url || '/web-hero/C48A0775.jpg'}
                      alt={latestRecap.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-[#d3da0c]/20 text-[#d3da0c] text-[10px] font-extrabold uppercase mb-1">
                          Featured Event
                        </span>
                        <h2 className="text-white font-display font-extrabold text-xl leading-tight truncate mb-1">
                          {latestRecap.title}
                        </h2>
                        <div className="flex items-center gap-1.5 text-gray-300 text-xs">
                          <Camera className="w-3.5 h-3.5 text-[#d3da0c] flex-shrink-0" />
                          <span className="truncate">View Photos & Highlights</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/events/${recapSlug}`);
                        }}
                        className="flex-shrink-0 px-4 py-2 rounded-full bg-[#d3da0c] text-black font-extrabold text-xs shadow-lg active:scale-95 transition-transform"
                      >
                        View Event
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  onClick={() => navigate('/events')}
                  className="relative h-[160px] rounded-2xl overflow-hidden border border-white/10 shadow-xl cursor-pointer flex flex-col justify-end p-5 bg-gradient-to-tr from-[#0a1207] via-[#111c0c] to-[#0a1207]"
                >
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-white font-display font-extrabold text-lg leading-tight truncate mb-1">
                        Discover Events & Nightlife
                      </h2>
                      <p className="text-gray-400 text-xs">
                        Stay tuned for upcoming parties, club nights and live performances.
                      </p>
                    </div>
                    <span className="flex-shrink-0 px-3.5 py-1.5 rounded-full bg-[#d3da0c] text-black font-extrabold text-xs shadow-lg">
                      Explore
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Loading skeleton for hero */}
        {isLoading && (
          <div className="mb-5 px-4">
            <div className="h-[205px] rounded-2xl shimmer-glass" />
          </div>
        )}

        {/* Trending Reels Section (Only shown when reels exist) */}
        {trendingReels.length > 0 && (
          <div className="mb-6">
            <div className="px-4 mb-2.5 flex items-center justify-between">
              <h2 className="text-[#020b00] dark:text-white font-bold text-base tracking-tight">Trending Reels</h2>
              <button
                type="button"
                onClick={() => navigate('/reels')}
                className="text-gray-500 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-[#d3da0c] p-1 transition-colors"
                aria-label="View all reels"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar px-4 pb-1">
              {trendingReels.slice(0, 6).map((reel) => (
                <button
                  key={reel.id}
                  type="button"
                  onClick={() => navigate(`/reels?id=${reel.id}`)}
                  className="relative w-28 h-40 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10 group active:scale-95 transition-transform text-left"
                >
                  <img
                    src={reel.thumbnail_url || '/web-hero/C48A0758.jpg'}
                    alt={reel.title || 'Reel'}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/15">
                    <Play className="w-3 h-3 text-[#d3da0c] fill-[#d3da0c] ml-0.5" />
                  </div>
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-[10px] font-bold text-[#d3da0c] truncate">
                      @{reel.author?.username || 'soundit'}
                    </p>
                    <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2">
                      {reel.title || reel.caption || 'Watch Reel'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date Filter Pills */}
        <div className="mb-4">
          <MobileFilterPills
            activeDate={mobileDateFilter}
            onDateChange={setMobileDateFilter}
            activeCategory={mobileCategoryFilter}
            onCategoryChange={setMobileCategoryFilter}
            showCategoryRow={false}
          />
        </div>

        {/* Popular Events - horizontal scroll cards */}
        {!isLoading && mobileDateFilter === 'all' && featuredEvents.length > 0 && (
          <div className="mb-6">
            <MobileSectionHeader
              label="Hot this week"
              title="Popular Events"
              seeAllPath="/events"
              accentColor="#d3da0c"
            />
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pl-4 pr-4 pb-1">
              {featuredEvents.slice(0, 8).map((event) => (
                <MobileEventCard key={event.id} event={event} variant="standard" />
              ))}
            </div>
          </div>
        )}

        {/* Events list rows */}
        {!(mobileDateFilter === 'past' ? pastEventsLoading : isLoading) && (
          <div className="mb-6">
            <MobileSectionHeader
              title={mobileDateFilter === 'past' ? 'Past Event Recaps' : 'Upcoming Events'}
              seeAllPath="/events"
              seeAllLabel="View all"
              accentColor="#d3da0c"
            />
            {filteredMobileEvents.length > 0 ? (
              <div className="flex flex-col gap-2 px-4">
                {filteredMobileEvents.slice(0, 5).map((event, index) => (
                  <MobileListRow key={event.id} event={event} index={index} />
                ))}
              </div>
            ) : (
              <p className="px-4 text-sm text-gray-400">
                {mobileDateFilter === 'past' ? 'No past events found in this city.' : 'No events match this filter.'}
              </p>
            )}
          </div>
        )}

        {/* Featured DJs strip */}
        {featuredDJs.length > 0 && (
          <div className="mb-6">
            <MobileSectionHeader
              label="Top performers"
              title="Featured Artists"
              seeAllPath="/discovery?tab=artists"
              accentColor="#d3da0c"
            />
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pl-4 pr-4 pb-1">
              {featuredDJs.slice(0, 8).map((artist) => (
                <ArtistCard key={artist.id} artist={artist} variant="featured" />
              ))}
            </div>
          </div>
        )}

        {/* Mobile Ad banner */}
        <div className="px-4 mb-6">
          <AdBanner position="mobile_banner" />
        </div>

        {/* Discover Categories mini grid */}
        <div className="mb-6">
          <MobileSectionHeader
            label="Explore"
            title="Discover Ecosystem"
            seeAllPath="/discovery"
            accentColor="#d3da0c"
          />
          <div className="grid grid-cols-2 gap-3 px-4">
            {[
              { title: 'Artists', image: '/web-hero/C48A0916.jpg', count: `${cityGuideCounts.artists || 0}`, path: '/discovery?tab=artists' },
              { title: 'Businesses', image: '/party_crowd_bg.jpg', count: `${cityGuideCounts.businesses || 0}`, path: '/discovery?tab=businesses' },
              { title: 'Venues', image: '/web-hero/C48A0889.jpg', count: `${cityGuideCounts.venues || 0}`, path: '/discovery?tab=venues' },
              { title: 'Vendors', image: '/about-bg.jpg', count: `${cityGuideCounts.vendors || 0}`, path: '/discovery?tab=vendors' },
            ].map((item) => (
              <Link
                key={item.title}
                to={item.path}
                className="group relative h-28 rounded-2xl overflow-hidden border border-white/10 active:scale-[0.97] transition-transform"
              >
                <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
                  <div>
                    <div className="text-white font-bold text-sm">{item.title}</div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#d3da0c]" />
                      <span className="text-gray-300 text-[11px]">{item.count} listed</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#d3da0c]" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Story Preview Modal */}
        {activeStoryPreview && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="relative w-full max-w-sm rounded-3xl overflow-hidden border border-white/15 bg-[#091206] shadow-2xl">
              <div className="relative h-80">
                <img
                  src={activeStoryPreview.image}
                  alt={activeStoryPreview.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#091206] via-black/30 to-black/40" />
                <button
                  type="button"
                  onClick={() => setActiveStoryPreview(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center border border-white/15"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-4 left-4 right-4">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#d3da0c] text-black text-[10px] font-extrabold uppercase tracking-wider mb-2">
                    <Sparkles className="w-3 h-3" /> Sound It Story
                  </span>
                  <h3 className="text-white font-bold text-xl">{activeStoryPreview.title}</h3>
                  <p className="text-gray-300 text-xs mt-1">{activeStoryPreview.subtitle}</p>
                </div>
              </div>
              <div className="p-4 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const target = activeStoryPreview.ctaPath;
                    setActiveStoryPreview(null);
                    navigate(target);
                  }}
                  className="flex-1 py-3 rounded-full bg-[#d3da0c] text-black font-extrabold text-xs uppercase tracking-wider"
                >
                  {activeStoryPreview.ctaLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStoryPreview(null)}
                  className="px-4 py-3 rounded-full bg-white/10 text-white font-semibold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ==================== DESKTOP HOME (hidden on mobile) ==================== */}
      <div className="hidden md:block bg-[#060608]">
        {/* ==================== 1. HERO SECTION ==================== */}
        <section ref={heroRef} className="relative min-h-[88vh] flex items-center overflow-hidden bg-[#050507]">
          {/* Right-weighted DJ & Crowd Photography Slideshow */}
          {HERO_SLIDES.map((src, i) => (
            <motion.div
              key={src}
              className="absolute inset-0 bg-cover bg-[center_top] lg:bg-[right_center]"
              style={{
                y: heroY,
                backgroundImage: `url('${src}')`,
              }}
              initial={false}
              animate={{
                opacity: heroSlide === i ? 1 : 0,
                scale: heroSlide === i ? [1.04, 1.1, 1.04] : 1.04,
              }}
              transition={{
                opacity: { duration: 1.2, ease: 'easeInOut' },
                scale: { duration: 22, repeat: Infinity, ease: 'easeInOut' },
              }}
            />
          ))}

          {/* Multi-layer directional dark gradients matching reference image */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#050507] via-[#050507]/85 to-black/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060608] via-transparent to-[#050507]/70" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 75% 45%, rgba(211,218,12,0.12) 0%, rgba(0,0,0,0) 55%)',
            }}
          />

          <FloatingNotes />

          {/* Slide indicators */}
          <div className="absolute bottom-7 right-10 z-20 flex items-center gap-2">
            {HERO_SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setHeroSlide(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  heroSlide === i ? 'w-8 bg-[#d3da0c]' : 'w-2.5 bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>

          {/* Hero Content */}
          <motion.div
            className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 pt-24 pb-16"
            style={{ opacity: heroOpacity }}
          >
            <div className="max-w-2xl">
              {/* Welcome Pill */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-2 px-4 py-2 glass-pill-premium text-[#d3da0c] text-sm font-medium mb-5 w-fit"
              >
                <Zap className="w-4 h-4" />
                <span>
                  {user ? `Welcome back! Exploring ${userCity}` : t('home.brand.heroBadge')}
                </span>
              </motion.div>

              {/* Headline — Previous Hero Text */}
              <div className="mb-5">
                <motion.h1
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                  aria-label="Sound It Entertainment"
                  className="text-5xl md:text-6xl lg:text-7xl font-display text-white leading-[0.98] tracking-tight hero-headline"
                >
                  <span className="block font-bold drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
                    Sound It
                  </span>
                  <span
                    className="block font-bold hero-gradient-text mt-1 drop-shadow-[0_4px_28px_rgba(211,218,12,0.22)]"
                    aria-hidden="true"
                  >
                    Entertainment
                  </span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.6 }}
                  className="text-[#d3da0c] text-lg md:text-xl font-display mt-3"
                >
                  {t('home.brand.heroTagline')}
                </motion.p>
              </div>

              {/* Subtext */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.6 }}
                className="text-gray-200/90 text-lg leading-relaxed max-w-xl mb-9"
              >
                {t('home.brand.heroDescription')}
              </motion.p>

              {/* Horizontal Pill CTAs: Explore Events -> + Learn More */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.6 }}
                className="flex flex-wrap items-center gap-4"
              >
                <Link
                  to="/events"
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-[#d3da0c] text-black font-bold text-base hover:bg-[#dfe619] transition-all shadow-[0_0_32px_rgba(211,218,12,0.35)] group"
                >
                  <span>{t('home.brand.exploreEvents') || 'Explore Events'}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center justify-center px-8 py-4 rounded-full border border-[#d3da0c]/45 bg-black/55 backdrop-blur-md text-white font-semibold text-base hover:border-[#d3da0c] hover:text-[#d3da0c] transition-all"
                >
                  {t('home.brand.learnAboutUs') || 'Learn More'}
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* ==================== AD BANNER (DESKTOP HERO) ==================== */}
        <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-4">
          <AdBanner position="homepage_hero" />
        </section>

        {/* ==================== 2. WHAT WE DO (Reference 6-Card Photo Grid — Informational Only) ==================== */}
        <section className="py-16 lg:py-20 relative border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            {/* Section Header Row matching Reference Image */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12">
              <motion.div
                custom={0}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                variants={sectionVariants}
                className="max-w-xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[#38bdf8] text-xs font-bold tracking-[0.25em] uppercase">
                    WHAT WE DO
                  </span>
                  <span className="h-[1.5px] w-10 bg-[#38bdf8]/60 rounded-full" />
                </div>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-[#020b00] dark:text-white tracking-tight mb-2.5">
                  One company, many ways to create
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-base">
                  Connecting people through music, culture and unforgettable experiences.
                </p>
              </motion.div>

              {/* Right Accent Brush + Brand Statement */}
              <motion.div
                custom={1}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                variants={sectionVariants}
                className="flex items-center gap-5 max-w-lg"
              >
                {/* Decorative Neon Yellow Brush Stroke SVG */}
                <svg
                  viewBox="0 0 140 42"
                  className="w-28 h-9 shrink-0 text-[#d3da0c]"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M6 22C38 11 88 6 134 8"
                    stroke="currentColor"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M14 30C48 19 92 15 130 16"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                  <path
                    d="M28 36C62 28 96 24 124 25"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                </svg>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  Sound It is an entertainment platform and creative brand that brings the community
                  together through events, culture and technology.
                </p>
              </motion.div>
            </div>

            {/* 6 Photo-Backed Cards Grid — Clean informational cards without external links */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {whatWeDo.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    custom={index}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={sectionVariants}
                    className="group relative rounded-2xl bg-[#0d0f14] border border-white/10 hover:border-white/20 overflow-hidden min-h-[245px] p-6 flex flex-col justify-between transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
                  >
                    {/* Right/Top Background Photo from /web-hero/ */}
                    <div className="absolute top-0 right-0 w-[78%] h-[78%] overflow-hidden pointer-events-none">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 opacity-85"
                        loading="lazy"
                      />
                      {/* Smooth blend into card background */}
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0d0f14] via-[#0d0f14]/45 to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f14] via-[#0d0f14]/35 to-transparent" />
                    </div>

                    {/* Top Row: Icon Badge Only */}
                    <div className="relative z-10 flex items-start justify-between gap-3">
                      <div
                        className="w-12 h-12 rounded-xl bg-[#131722]/90 border border-white/10 flex items-center justify-center shadow-lg"
                        style={{ boxShadow: `0 0 20px ${item.iconColor}20` }}
                      >
                        <Icon className="w-6 h-6" style={{ color: item.iconColor }} />
                      </div>
                    </div>

                    {/* Bottom Row: Title + Description */}
                    <div className="relative z-10 mt-14">
                      <h3 className="text-white font-bold text-lg mb-1.5">
                        {item.title}
                      </h3>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ==================== 3. THE APP — Sound It App Showcase (Reference Match) ==================== */}
        <section className="py-16 lg:py-24 relative overflow-hidden border-y border-white/10 bg-gradient-to-r from-[#121308] via-[#0b0c10] to-[#07080c]">
          {/* Subtle stage/gold radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 20% 50%, rgba(211,218,12,0.14) 0%, transparent 55%), radial-gradient(circle at 75% 50%, rgba(211,218,12,0.18) 0%, transparent 50%)',
            }}
          />

          <div className="max-w-7xl mx-auto px-6 lg:px-10 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Left Column: App Info & Google Play Testing Badge */}
              <motion.div
                custom={0}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={sectionVariants}
                className="lg:col-span-6"
              >
                <span className="inline-block text-[#d3da0c] text-xs font-bold tracking-[0.28em] uppercase mb-3">
                  THE APP
                </span>
                <h2 className="text-4xl lg:text-6xl font-extrabold text-white tracking-tight mb-2">
                  Sound It App
                </h2>
                <p className="text-xl lg:text-2xl font-bold text-white/95 mb-4">
                  Events. DJs. Vendors. Venues. Spots.
                </p>
                <p className="text-gray-300/85 text-base lg:text-lg leading-relaxed max-w-md mb-8">
                  Discover what&apos;s happening around you, connect with the community, and never
                  miss a vibe.
                </p>

                {/* Google Play Testing Button matching reference image */}
                <div className="mb-5">
                  <Link
                    to="/download"
                    className="inline-flex items-center gap-5 px-6 py-3.5 rounded-2xl bg-black/85 border border-[#d3da0c]/65 hover:border-[#d3da0c] hover:bg-black transition-all shadow-[0_0_32px_rgba(211,218,12,0.15)] group"
                  >
                    {/* Google Play Multi-color Triangle Icon */}
                    <svg
                      viewBox="0 0 24 24"
                      className="w-9 h-9 shrink-0"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill="#00E5FF"
                        d="M3.61 1.814L13.793 12 3.61 22.186a1.75 1.75 0 0 1-.61-1.33V3.144c0-.522.226-.996.61-1.33z"
                      />
                      <path
                        fill="#00E676"
                        d="M17.218 8.575L5.255 1.66a1.72 1.72 0 0 0-1.645.154L13.793 12l3.425-3.425z"
                      />
                      <path
                        fill="#FFEA00"
                        d="M20.665 10.566l-3.447-1.99L13.793 12l3.425 3.425 3.447-1.991c.98-.566.98-2.302 0-2.868z"
                      />
                      <path
                        fill="#FF3D00"
                        d="M3.61 22.186a1.72 1.72 0 0 0 1.645.154l11.963-6.915L13.793 12 3.61 22.186z"
                      />
                    </svg>

                    <div className="text-left pr-2">
                      <span className="block text-[10px] font-bold tracking-[0.2em] uppercase text-gray-300">
                        GET IT ON
                      </span>
                      <span className="block text-xl lg:text-2xl font-bold text-white leading-tight">
                        Google Play
                      </span>
                    </div>

                    {/* Testing Version Pill inside Button */}
                    <span className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-gray-100 inline-flex items-center gap-1.5 group-hover:border-[#d3da0c]/60 group-hover:text-[#d3da0c] transition-colors">
                      Testing Version
                    </span>
                  </Link>
                </div>

                <p className="text-gray-400 text-sm max-w-sm leading-relaxed mb-5">
                  Android users: Join our testing community and be one of the first to try the app!
                </p>

                <Link
                  to="/download"
                  className="inline-flex items-center gap-2 text-[#d3da0c] text-sm font-bold hover:gap-3 transition-all"
                >
                  <span>Learn More About the App</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>

              {/* Right Column: Two Angled Phone Mockups (/web-hero/sds.png & /web-hero/wew.png) */}
              <motion.div
                custom={1}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={sectionVariants}
                className="lg:col-span-6 relative flex items-center justify-center min-h-[460px]"
              >
                {/* Neon Yellow Backlight Glow */}
                <div className="absolute w-80 h-80 rounded-full bg-[#d3da0c]/20 blur-[90px] pointer-events-none" />

                {/* Left / Foreground Phone (sds.png) */}
                <Link
                  to="/download"
                  className="relative z-20 w-[260px] xl:w-[295px] -rotate-6 hover:rotate-0 hover:scale-105 transition-all duration-500 drop-shadow-[0_25px_50px_rgba(0,0,0,0.85)]"
                >
                  <img
                    src="/web-hero/sds.png"
                    alt="Sound It App Home Screen"
                    className="w-full h-auto object-contain"
                  />
                </Link>

                {/* Right / Secondary Phone (wew.png) */}
                <Link
                  to="/download"
                  className="relative z-10 w-[245px] xl:w-[275px] -ml-14 mt-10 rotate-6 hover:rotate-0 hover:scale-105 transition-all duration-500 drop-shadow-[0_25px_50px_rgba(0,0,0,0.85)]"
                >
                  <img
                    src="/web-hero/wew.png"
                    alt="Sound It App Discovery Hub"
                    className="w-full h-auto object-contain"
                  />
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ==================== 4. UPCOMING EVENTS — Events You Don't Want to Miss (Only Live Platform Events) ==================== */}
        <section className="py-16 lg:py-20 relative">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 relative">
            {/* Header Row */}
            <div className="flex items-end justify-between mb-10">
              <div>
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-[#d3da0c] text-xs font-bold tracking-[0.25em] uppercase">
                    UPCOMING EVENTS
                  </span>
                  <span className="h-[1.5px] w-10 bg-[#d3da0c]/70 rounded-full" />
                </div>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-[#020b00] dark:text-white tracking-tight">
                  Events You Don&apos;t Want to Miss
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  to="/recaps"
                  className="hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white hover:border-[#d3da0c]/50 transition-all"
                >
                  <Camera className="w-3.5 h-3.5 text-[#d3da0c]" />
                  <span>Past Events Recaps</span>
                </Link>
                <Link
                  to="/events"
                  className="inline-flex items-center gap-2 text-[#d3da0c] text-sm font-bold hover:gap-3 transition-all"
                >
                  <span>View All Events</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {featuredEvents.length > 0 ? (
              <div className="relative group/carousel">
                {featuredEvents.length > 4 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous events"
                      onClick={() =>
                        upcomingScrollRef.current?.scrollBy({ left: -340, behavior: 'smooth' })
                      }
                      className="hidden lg:flex absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#141720]/90 border border-white/15 text-white items-center justify-center hover:border-[#d3da0c] hover:text-[#d3da0c] transition-all shadow-xl"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      aria-label="Next events"
                      onClick={() =>
                        upcomingScrollRef.current?.scrollBy({ left: 340, behavior: 'smooth' })
                      }
                      className="hidden lg:flex absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#141720]/90 border border-white/15 text-white items-center justify-center hover:border-[#d3da0c] hover:text-[#d3da0c] transition-all shadow-xl"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                <div
                  ref={upcomingScrollRef}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 overflow-x-auto hide-scrollbar"
                >
                  {featuredEvents.map((ev, idx) => {
                    const badgeColors = [
                      { bg: '#d3da0c', text: '#000000' },
                      { bg: '#FF2D8F', text: '#000000' },
                      { bg: '#00E5FF', text: '#000000' },
                      { bg: '#a855f7', text: '#ffffff' },
                    ];
                    const badge = badgeColors[idx % badgeColors.length];
                    const d = ev.start_date ? new Date(ev.start_date) : new Date();
                    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                    const day = String(d.getDate()).padStart(2, '0');
                    const city = ev.city || (selectedCity && selectedCity !== 'all' ? selectedCity : 'China');

                    return (
                      <Link key={ev.id} to={`/events/${ev.id}`}>
                        <div className="group relative h-[280px] rounded-2xl overflow-hidden bg-[#101218] border border-white/10 hover:border-[#d3da0c]/60 transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
                          <img
                            src={ev.flyer_image || '/web-hero/C48A0889.jpg'}
                            alt={ev.title}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />

                          {/* Top-left Date Badge matching Reference */}
                          <div
                            className="absolute top-4 left-4 w-13 h-14 px-3 py-1.5 rounded-xl flex flex-col items-center justify-center shadow-lg"
                            style={{ backgroundColor: badge.bg, color: badge.text }}
                          >
                            <span className="text-[10px] font-extrabold tracking-wider uppercase leading-none">
                              {month}
                            </span>
                            <span className="text-xl font-black leading-tight mt-0.5">{day}</span>
                          </div>

                          {/* Bottom Event Title & Location */}
                          <div className="absolute bottom-0 left-0 right-0 p-5">
                            <h3 className="text-white font-extrabold text-lg uppercase tracking-wide line-clamp-1 group-hover:text-[#d3da0c] transition-colors">
                              {ev.title}
                            </h3>
                            <div className="flex items-center gap-1.5 text-gray-300 text-xs mt-1">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="capitalize">{city}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#0d0f14] border border-white/10 p-10 text-center text-gray-400">
                No upcoming live events at the moment. Check back soon!
              </div>
            )}
          </div>
        </section>

        {/* ==================== 5. FEATURED DJS ==================== */}
        <section className="py-12 relative border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <motion.div
              custom={0}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              variants={sectionVariants}
              className="flex items-end justify-between mb-6"
            >
              <div>
                <span className="inline-block text-[#00E5FF] text-xs font-bold tracking-[0.22em] uppercase mb-1">
                  Top Performers
                </span>
                <h2 className="text-2xl lg:text-3xl font-extrabold text-[#020b00] dark:text-white">Featured DJs &amp; Artists</h2>
              </div>
              <Link to="/artists" className="flex items-center gap-1 text-[#00E5FF] text-sm font-semibold">
                All Artists <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 hide-scrollbar pb-2">
              {featuredDJs.length > 0 ? (
                featuredDJs.map((artist, index) => (
                  <motion.div
                    key={artist.id}
                    custom={index}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={sectionVariants}
                    className="flex-shrink-0 snap-start"
                  >
                    <ArtistCard artist={artist} variant="featured" />
                  </motion.div>
                ))
              ) : (
                <div className="w-full py-8 text-center text-gray-500 text-sm">
                  No featured DJs in {userCity}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ==================== 6. OUR PLATFORMS & WEBSITES (Single Section with the 4 External Links) ==================== */}
        <section className="py-16 relative border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 relative">
            <motion.div
              custom={0}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              variants={sectionVariants}
              className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
            >
              <div>
                <span className="inline-block text-[#d3da0c] text-xs font-bold tracking-[0.22em] uppercase mb-1.5">
                  {t('home.brand.ecoKicker') || 'THE SOUND IT ECOSYSTEM'}
                </span>
                <h2 className="text-2xl lg:text-4xl font-extrabold text-[#020b00] dark:text-white">
                  {t('home.brand.ecoTitle') || 'One brand, many platforms'}
                </h2>
              </div>
              <Link to="/about" className="hidden sm:flex items-center gap-1 text-[#d3da0c] text-sm font-semibold">
                {t('home.brand.ecoLink') || 'Explore the full ecosystem'} <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {liveEcosystemSites.map((site, idx) => (
                <motion.a
                  key={site.url}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  custom={idx}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={sectionVariants}
                  className="group rounded-2xl bg-[#0d0f14] border border-white/10 hover:border-[#d3da0c]/70 overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
                >
                  {/* Browser Chrome Header */}
                  <div className="px-3.5 py-2.5 bg-[#141720] border-b border-white/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                    </div>
                    <div className="flex-1 mx-2 px-2.5 py-0.5 rounded-md bg-black/50 border border-white/10 text-[11px] text-gray-300 truncate font-mono text-center">
                      {site.domain}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#d3da0c] transition-colors shrink-0" />
                  </div>

                  {/* Actual Website Landing Page Preview */}
                  <div className="relative h-44 w-full bg-black overflow-hidden">
                    <img
                      src={site.screenshot}
                      alt={`${site.name} Landing Page`}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = site.fallbackPhoto;
                      }}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
                    />
                    <iframe
                      src={site.url}
                      title={site.name}
                      loading="lazy"
                      sandbox="allow-scripts allow-same-origin"
                      className="absolute top-0 left-0 w-[1440px] h-[900px] origin-top-left scale-[0.22] pointer-events-none opacity-95 border-0"
                      tabIndex={-1}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f14] via-transparent to-transparent" />
                    <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/80 backdrop-blur-md border border-white/15"
                        style={{ color: site.accent }}
                      >
                        {site.badge}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-[#d3da0c] text-black text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-lg">
                        Visit Site <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>

                  {/* Site Info Footer */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-white font-bold text-base group-hover:text-[#d3da0c] transition-colors mb-1">
                        {site.name}
                      </h4>
                      <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                        {site.description}
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-[#d3da0c]">
                      <span>{site.domain}</span>
                      <span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Explore <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== 7. PLATFORM FEATURES & CITY GUIDE ==================== */}
        <section className="py-12 relative border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    custom={index}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={sectionVariants}
                    className="rounded-2xl bg-[#0d0f14] border border-white/10 p-5 text-center"
                  >
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#d3da0c]/10 mb-2">
                      <Icon className="w-5 h-5 text-[#d3da0c]" />
                    </div>
                    <div className="text-2xl lg:text-3xl font-display text-white mb-0.5">{stat.value}</div>
                    <div className="text-gray-400 text-xs">{stat.label}</div>
                  </motion.div>
                );
              })}
            </div>

            <AdBanner position="homepage_sidebar" />
          </div>
        </section>

        {/* ==================== 8. CTA ==================== */}
        <section className="py-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/web-hero/C48A0779.jpg')" }} />
          <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" />

          <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
                {t('home.cta.title')}
              </h2>
              <p className="text-gray-300 text-base mb-7 max-w-lg mx-auto">
                {t('home.cta.subtitle')}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#d3da0c] text-black font-bold text-sm hover:bg-[#dfe619] transition-all"
                >
                  {t('home.cta.button')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/events"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/25 bg-black/50 text-white font-semibold text-sm hover:border-[#d3da0c] hover:text-[#d3da0c] transition-all"
                >
                  Browse Events
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
