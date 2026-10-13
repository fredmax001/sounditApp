import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
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
  ChevronRight,
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
  Sparkles,
  Headphones,
  Disc3,
  Store,
} from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import EventCard from '@/components/EventCard';
import CompactEventCard from '@/components/ui/CompactEventCard';
import ArtistCard from '@/components/ArtistCard';
import AdBanner from '@/components/AdBanner';
import WeatherWidget from '@/components/WeatherWidget';
import MobileHeroCarousel from '@/components/ui/MobileHeroCarousel';
import MobileEventCard from '@/components/ui/MobileEventCard';
import MobileListRow from '@/components/ui/MobileListRow';
import MobileSectionHeader from '@/components/ui/MobileSectionHeader';
import MobileFilterPills from '@/components/ui/MobileFilterPills';
import type { DateFilter } from '@/components/ui/MobileFilterPills';

import axios from 'axios';
import type { DJ } from '@/store/eventStore';

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
  const { t } = useTranslation();
  const { featuredEvents, fetchFeaturedEvents, isLoading } = useEventStore();
  const { user, profile, selectedCity } = useAuthStore();
  const [featuredDJs, setFeaturedDJs] = useState<DJ[]>([]);
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
      const city = selectedCity || profile?.city?.name || 'Shanghai';
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
  }, [selectedCity, profile?.city?.name]);

  useEffect(() => {
    fetchFeaturedEvents(selectedCity || undefined);
    fetchDJs();
    fetchPlatformStats();
    fetchCityGuideCounts();
  }, [fetchFeaturedEvents, selectedCity, fetchDJs, fetchPlatformStats, fetchCityGuideCounts]);

  const userCity = selectedCity || profile?.city?.name || 'China';

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Hero background slideshow
  const HERO_SLIDES = ['/hero-slide-1.jpg', '/hero-slide-2.jpg', '/hero-slide-3.jpg', '/hero-slide-4.jpg'];
  const [heroSlide, setHeroSlide] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setHeroSlide((s) => (s + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const quickChips = [
    { icon: Calendar, label: 'Events', path: '/events' },
    { icon: Music, label: 'Talent', path: '/artists' },
    { icon: Utensils, label: 'Vendors', path: '/marketplace' },
  ];

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

  const whatWeDo = [
    { icon: PartyPopper, title: 'Live Events & Festivals', description: 'Curated parties, cultural showcases, nightlife experiences, and premium festival concepts.' },
    { icon: Music, title: 'Music & Cultural Experiences', description: 'Signature event series like RNB & Slow Sessions that celebrate timeless music and culture.' },
    { icon: Mic2, title: 'Artist & DJ Collaborations', description: 'Bookings and collaborations with artists and DJs across Africa, China, and international markets.' },
    { icon: Code, title: 'Technology & Digital Platforms', description: 'The Sound it platform, mobile apps, and digital tools for the entertainment industry.' },
    { icon: Palette, title: 'Creative Services', description: 'Graphic design, branding, and creative production through Sound It Tech.' },
    { icon: Users, title: 'Community & Cultural Initiatives', description: 'Community-focused events and programs that connect and celebrate culture.' },
    { icon: Globe, title: 'Brand Partnerships & International Collaborations', description: 'Partnerships with brands, venues, and international entertainment personalities.' },
  ];

  const ecosystemItems = [
    { icon: PartyPopper, name: 'Sound It Events', description: 'Live experiences: parties, showcases, nightlife, and community events.', status: 'active' },
    { icon: Music, name: 'RNB & Slow Sessions', description: 'Signature R&B and soul event series with curated musical storytelling.', status: 'active' },
    { icon: Radio, name: 'Sound It Platform', description: 'Digital ecosystem for events, artists, vendors, businesses, and fans.', status: 'active' },
    { icon: Code, name: 'Sound It Tech', description: 'Software, mobile apps, design, branding, and IT solutions.', status: 'active' },
    { icon: Sparkles, name: 'BOA Festival', description: 'Premium festival concept bringing together African, Chinese, and international artists.', status: 'development' },
    { icon: Rocket, name: 'Deck Salone', description: 'Sierra Leone-focused DJ and entertainment ecosystem.', status: 'prelaunch' },
    { icon: Headphones, name: 'Sound It DJ', description: 'DJ platform for music organization, mixes, and performance preparation.', status: 'planned' },
    { icon: Disc3, name: 'Sound It Muzik', description: 'Music streaming, distribution, and artist-support platform.', status: 'planned' },
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

  // Filter featured events for mobile based on date/category filter
  const filteredMobileEvents = featuredEvents.filter((event) => {
    const now = new Date();
    const eventDate = new Date(event.start_date);
    let passDate = true;
    if (mobileDateFilter === 'today') {
      passDate = eventDate.toDateString() === now.toDateString();
    } else if (mobileDateFilter === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      passDate = eventDate.toDateString() === tomorrow.toDateString();
    } else if (mobileDateFilter === 'this_week') {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);
      passDate = eventDate >= now && eventDate <= weekEnd;
    } else if (mobileDateFilter === 'this_weekend') {
      const day = eventDate.getDay();
      passDate = day === 0 || day === 6;
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
      <section className="md:hidden pt-16 pb-2">
        {/* Brand intro */}
        <div className="px-4 mb-4">
          <div className="relative rounded-2xl overflow-hidden p-5" style={{ background: 'linear-gradient(135deg, #141400 0%, #0A0A0A 55%, #14000C 100%)' }}>
            <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: 'radial-gradient(circle at 25% 30%, rgba(211,218,12,0.14) 0%, transparent 55%), radial-gradient(circle at 80% 70%, rgba(255,45,143,0.1) 0%, transparent 55%)' }} />
            <div className="relative z-10">
              <span className="inline-block text-[#d3da0c] text-[10px] font-medium tracking-wider uppercase mb-1.5">
                {t('home.brand.heroBadge')}
              </span>
              <h1 className="text-white font-display font-bold text-2xl leading-tight mb-1">
                Sound It <span className="hero-gradient-text">Entertainment</span>
              </h1>
              <p className="text-[#d3da0c] text-xs font-medium mb-2">{t('home.brand.heroTagline')}</p>
              <p className="text-gray-400 text-xs leading-relaxed mb-3.5">{t('home.brand.heroDescription')}</p>
              <div className="flex flex-wrap gap-2">
                <Link to="/events" className="px-4 py-2 bg-[#d3da0c] text-black text-xs font-bold rounded-full active:scale-95 transition-transform">
                  {t('home.brand.exploreEvents')}
                </Link>
                <Link to="/about" className="px-4 py-2 bg-white/10 border border-white/20 text-white text-xs font-semibold rounded-full active:scale-95 transition-transform">
                  {t('home.brand.learnAboutUs')}
                </Link>
                <a href="https://app.sounditent.com" className="inline-flex items-center gap-1 px-4 py-2 border border-white/20 text-white text-xs font-semibold rounded-full active:scale-95 transition-transform">
                  {t('home.brand.enterApp')} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2.5 h-11 px-3.5 bg-[#1A1A1A] border border-white/8 rounded-2xl">
            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search events, artists, venues..."
              readOnly
              onClick={() => window.location.href = '/events'}
              className="flex-1 bg-transparent text-gray-400 placeholder-gray-600 text-sm focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Filter pills (Date only, category row removed per user request) */}
        <div className="mb-4">
          <MobileFilterPills
            activeDate={mobileDateFilter}
            onDateChange={setMobileDateFilter}
            activeCategory={mobileCategoryFilter}
            onCategoryChange={setMobileCategoryFilter}
            showCategoryRow={false}
          />
        </div>

        {/* Recommended - Hero Carousel */}
        {!isLoading && featuredEvents.length > 0 && (
          <div className="mb-6">
            <MobileSectionHeader
              title="Recommended"
              seeAllPath="/events"
              accentColor="#d3da0c"
            />
            <MobileHeroCarousel events={filteredMobileEvents.length > 0 ? filteredMobileEvents : featuredEvents} />
          </div>
        )}

        {/* Loading skeleton for hero */}
        {isLoading && (
          <div className="mb-6 px-4">
            <div className="h-[240px] rounded-2xl shimmer-glass" />
          </div>
        )}

        {/* Popular Events - horizontal scroll cards */}
        {!isLoading && featuredEvents.length > 0 && (
          <div className="mb-6">
            <MobileSectionHeader
              label="Hot this week"
              title="Popular"
              seeAllPath="/events"
              accentColor="#FF2D8F"
            />
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pl-4 pr-4 pb-1">
              {featuredEvents.slice(0, 8).map((event) => (
                <MobileEventCard key={event.id} event={event} variant="standard" />
              ))}
            </div>
          </div>
        )}

        {/* Events list rows */}
        {!isLoading && featuredEvents.length > 0 && (
          <div className="mb-6">
            <MobileSectionHeader
              label="Don't miss out"
              title="Upcoming Events"
              seeAllPath="/events"
              seeAllLabel="View all"
              accentColor="#00E5FF"
            />
            <div className="flex flex-col gap-2 px-4">
              {(filteredMobileEvents.length > 0 ? filteredMobileEvents : featuredEvents).slice(0, 5).map((event, index) => (
                <MobileListRow key={event.id} event={event} index={index} />
              ))}
            </div>
          </div>
        )}

        {/* Featured DJs strip */}
        {featuredDJs.length > 0 && (
          <div className="mb-6">
            <MobileSectionHeader
              label="Top performers"
              title="Featured Artists"
              seeAllPath="/artists"
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

        {/* City Guide mini grid */}
        <div className="mb-6">
          <MobileSectionHeader
            label="Explore"
            title="City Guide"
            seeAllPath="/city-guide"
            accentColor="#d3da0c"
          />
          <div className="grid grid-cols-2 gap-3 px-4">
            {[
              { title: 'Businesses', image: '/party_crowd_bg.jpg', count: `${cityGuideCounts.businesses || 0}`, color: '#d3da0c' },
              { title: 'Vendors', image: '/about-bg.jpg', count: `${cityGuideCounts.vendors || 0}`, color: '#FF2D8F' },
              { title: 'Events', image: '/hero-bg.jpg', count: `${cityGuideCounts.events || 0}`, color: '#00E5FF' },
              { title: 'Artists', image: '/party_crowd_bg.jpg', count: `${cityGuideCounts.artists || 0}`, color: '#C8A000' },
            ].map((item) => (
              <Link
                key={item.title}
                to="/city-guide"
                className="group relative h-28 rounded-2xl overflow-hidden active:scale-[0.97] transition-transform"
              >
                <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <div className="text-white font-semibold text-sm">{item.title}</div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-300 text-[11px]">{item.count}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="px-4 mb-6">
          <div className="grid grid-cols-4 gap-2">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-[#111111] border border-white/5 rounded-2xl p-2.5 text-center">
                  <Icon className="w-4 h-4 text-[#d3da0c] mx-auto mb-1" />
                  <div className="text-white font-bold text-sm">{stat.value}</div>
                  <div className="text-gray-500 text-[9px] leading-tight">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile CTA */}
        {!user && (
          <div className="px-4 mb-6">
            <div className="relative rounded-2xl overflow-hidden p-5 text-center" style={{ background: 'linear-gradient(135deg, #1A1A00 0%, #0A0A0A 50%, #1A0010 100%)' }}>
              <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 30% 50%, rgba(211,218,12,0.15) 0%, transparent 60%), radial-gradient(circle at 70% 50%, rgba(255,45,143,0.1) 0%, transparent 60%)' }} />
              <div className="relative z-10">
                <h3 className="text-white font-bold text-lg mb-1">Find your favorite events.</h3>
                <p className="text-gray-400 text-sm mb-4">Join Sound It to discover events based on your interests.</p>
                <div className="flex gap-2 justify-center">
                  <Link to="/login" className="px-5 py-2.5 bg-[#d3da0c] text-black text-sm font-bold rounded-full active:scale-95 transition-transform">Login</Link>
                  <Link to="/register" className="px-5 py-2.5 bg-white/10 border border-white/20 text-white text-sm font-semibold rounded-full active:scale-95 transition-transform">Sign up</Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ==================== DESKTOP HOME (hidden on mobile) ==================== */}
      <div className="hidden md:block">
        {/* ==================== HERO SECTION ==================== */}
        <section ref={heroRef} className="relative h-screen overflow-hidden">
        {/* Background Slideshow with Ken Burns + Parallax - sharp, no blur */}
        {HERO_SLIDES.map((src, i) => (
          <motion.div
            key={src}
            className="absolute inset-0 bg-cover bg-center"
            style={{
              y: heroY,
              backgroundImage: `url('${src}')`,
            }}
            initial={false}
            animate={{
              opacity: heroSlide === i ? 1 : 0,
              scale: heroSlide === i ? [1.15, 1.25, 1.15] : 1.15,
              x: heroSlide === i ? [0, -8, 0] : 0,
            }}
            transition={{
              opacity: { duration: 1.4, ease: 'easeInOut' },
              scale: { duration: 25, repeat: Infinity, ease: 'easeInOut' },
              x: { duration: 25, repeat: Infinity, ease: 'easeInOut' },
            }}
          />
        ))}

        {/* Slide indicators */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2 pointer-events-none">
          {HERO_SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${heroSlide === i ? 'w-8 bg-[#d3da0c]' : 'w-3 bg-white/40'}`}
            />
          ))}
        </div>

        {/* Black overlay for readability */}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/50" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 200px 80px rgba(0,0,0,0.6)',
          }}
        />

        {/* Light sweep overlay - gives a subtle "video" feel */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2]">
          <div
            className="absolute top-0 left-0 h-full w-1/3 animate-light-sweep"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
            }}
          />
        </div>

        {/* Floating particles */}
        <FloatingNotes />

        {/* Hero Content */}
        <motion.div
          className="relative z-10 h-full flex flex-col justify-center px-5"
          style={{ opacity: heroOpacity }}
        >
          <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl">
            {/* Welcome Pill */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 px-4 py-2 glass-pill-premium text-[#d3da0c] text-sm font-medium mb-5 w-fit"
            >
              <motion.span
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <Zap className="w-4 h-4" />
              </motion.span>
              <span>
                {user ? `Welcome back! Exploring ${userCity}` : t('home.brand.heroBadge')}
              </span>
            </motion.div>

            {/* Headline - Brand introduction for first-time visitors */}
            <div className="mb-5">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                aria-label="Sound It Entertainment"
                className="text-5xl md:text-6xl lg:text-7xl font-display text-white leading-[0.95] tracking-tight hero-headline"
              >
                <span className="block font-bold">Sound It</span>
                <span className="block font-bold hero-gradient-text mt-1" aria-hidden="true">Entertainment</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.6 }}
                className="text-[#d3da0c] text-lg md:text-xl font-display mt-3"
              >
                {t('home.brand.heroTagline')}
              </motion.p>
              <p className="sr-only">
                Sound It Entertainment is an entertainment and technology company connecting African culture,
                international entertainment, and the Chinese market through music, events, technology, and creative collaboration.
              </p>
            </div>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="text-gray-300/80 text-lg mb-6 max-w-md leading-relaxed"
            >
              {t('home.brand.heroDescription')}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="flex flex-col gap-3"
            >
              <Link
                to="/events"
                className="glass-button-primary text-base group w-full sm:w-auto"
              >
                <span className="relative z-10">{t('home.brand.exploreEvents')}</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/about"
                className="glass-button-secondary text-base w-full sm:w-auto"
              >
                <span className="relative z-10">{t('home.brand.learnAboutUs')}</span>
              </Link>
              <a
                href="https://app.sounditent.com"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/20 text-white text-base font-semibold hover:border-[#d3da0c]/60 hover:text-[#d3da0c] transition-colors w-full sm:w-auto"
              >
                <span>{t('home.brand.enterApp')}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </motion.div>

            {/* Quick Chips */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="flex gap-2 mt-5 overflow-x-auto hide-scrollbar pb-1"
            >
              {quickChips.map((chip) => {
                const Icon = chip.icon;
                return (
                  <Link
                    key={chip.label}
                    to={chip.path}
                    className="glass-chip flex items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {chip.label}
                  </Link>
                );
              })}
            </motion.div>
          </div>

          {/* Weather Widget - right side on desktop */}
          <WeatherWidget city={selectedCity || 'Shanghai'} />
        </div>
        </motion.div>
      </section>

      {/* ==================== AD BANNER (DESKTOP HERO) ==================== */}
      <section className="hidden md:block px-5 pt-6 pb-2">
        <AdBanner position="homepage_hero" />
      </section>

      {/* ==================== WHO WE ARE (company introduction) ==================== */}
      <section className="py-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00E5FF]/[0.03] to-transparent pointer-events-none" />
        <div className="px-5 relative">
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionVariants}
            className="max-w-4xl"
          >
            <span className="inline-block text-[#d3da0c] text-xs font-medium tracking-wider uppercase mb-2">
              {t('home.brand.whoKicker')}
            </span>
            <h2 className="text-2xl md:text-4xl font-display text-white mb-4">
              {t('home.brand.whoTitle')}
            </h2>
            <p className="text-gray-300/85 text-sm md:text-lg leading-relaxed max-w-3xl">
              {t('home.brand.whoText')}
            </p>
            <Link
              to="/about"
              className="inline-flex items-center gap-1.5 mt-4 text-[#d3da0c] text-sm font-medium hover:gap-2.5 transition-all"
            >
              {t('home.brand.whoLink')} <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ==================== WHAT WE DO ==================== */}
      <section className="py-8 relative">
        <div className="px-5 relative">
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionVariants}
            className="mb-5"
          >
            <span className="inline-block text-[#00E5FF] text-xs font-medium tracking-wider uppercase mb-1">
              {t('home.brand.whatKicker')}
            </span>
            <h2 className="text-xl font-bold text-white">{t('home.brand.whatTitle')}</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
                  className="glass-card-premium p-4 min-h-[150px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#00E5FF]/10 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-[#00E5FF]" />
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1.5">{item.title}</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">{item.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== PLATFORM FEATURES ==================== */}
      <section className="py-8 relative">
        <div className="px-5 relative">
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionVariants}
            className="flex items-end justify-between mb-5"
          >
            <div>
              <span className="inline-block text-[#FF2D8F] text-xs font-medium tracking-wider uppercase mb-1">
                Platform Features
              </span>
              <h2 className="text-xl font-bold text-white">Everything Sound It Helps You Do</h2>
            </div>
            <Link to="/city-guide" className="hidden sm:flex items-center gap-1 text-[#FF2D8F] text-sm font-medium">
              Explore <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {platformFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  custom={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={sectionVariants}
                >
                  <Link
                    to={feature.path}
                    className="group glass-card-premium min-h-[132px] p-4 flex flex-col justify-between active:scale-[0.98] transition-transform"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${feature.color}18` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: feature.color }} />
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <h3 className="text-white font-semibold text-sm md:text-base leading-tight group-hover:text-[#d3da0c] transition-colors">
                        {feature.title}
                      </h3>
                      <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== FEATURED ECOSYSTEM ==================== */}
      <section className="py-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FF2D8F]/[0.03] to-transparent pointer-events-none" />
        <div className="px-5 relative">
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionVariants}
            className="flex items-end justify-between mb-5"
          >
            <div>
              <span className="inline-block text-[#FF2D8F] text-xs font-medium tracking-wider uppercase mb-1">
                {t('home.brand.ecoKicker')}
              </span>
              <h2 className="text-xl font-bold text-white">{t('home.brand.ecoTitle')}</h2>
            </div>
            <Link to="/about" className="hidden sm:flex items-center gap-1 text-[#FF2D8F] text-sm font-medium">
              {t('home.brand.ecoLink')} <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {ecosystemItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.name}
                  custom={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={sectionVariants}
                  className="glass-card-premium p-4 flex flex-col justify-between min-h-[150px]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#d3da0c]" />
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyles[item.status] || statusStyles.planned}`}>
                      {statusLabels[item.status] || item.status}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm mb-1">{item.name}</h3>
                    <p className="text-gray-400 text-xs leading-relaxed">{item.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <Link to="/about" className="sm:hidden flex items-center justify-center gap-1 mt-4 text-[#FF2D8F] text-sm font-medium">
            {t('home.brand.ecoLink')} <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ==================== TRENDING NOW ==================== */}
      <section className="py-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#d3da0c]/[0.04] to-transparent pointer-events-none" />
        <div className="px-5 relative">
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionVariants}
            className="flex items-end justify-between mb-5"
          >
            <div>
              <span className="inline-block text-[#d3da0c] text-xs font-medium tracking-wider uppercase mb-1">
                Trending Now
              </span>
              <h2 className="text-xl font-bold text-white">Hot This Week</h2>
            </div>
            <Link to="/events" className="flex items-center gap-1 text-[#d3da0c] text-sm font-medium">
              See All <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Mobile: horizontal scroll | Desktop: grid */}
          <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory gap-4 -mx-5 px-5 md:mx-0 md:px-0 hide-scrollbar pb-2">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="w-[280px] md:w-auto h-[360px] shimmer-glass flex-shrink-0 md:flex-shrink snap-start" />
              ))
            ) : featuredEvents.length > 0 ? (
              featuredEvents.slice(0, 5).map((event, index) => (
                <motion.div
                  key={event.id}
                  custom={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={sectionVariants}
                  className="w-[280px] md:w-auto flex-shrink-0 md:flex-shrink snap-start"
                >
                  <EventCard event={event} variant="trending" />
                </motion.div>
              ))
            ) : (
              <div className="w-full py-8 text-center text-gray-500 text-sm">
                No trending events in {userCity}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ==================== UPCOMING EVENTS ==================== */}
      <section className="py-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#d3da0c]/[0.02] to-transparent pointer-events-none" />
        <div className="px-5 relative">
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionVariants}
            className="flex items-end justify-between mb-5"
          >
            <div>
              <span className="inline-block text-[#FF2D8F] text-xs font-medium tracking-wider uppercase mb-1">
                Don't Miss Out
              </span>
              <h2 className="text-xl font-bold text-white">Upcoming Events</h2>
            </div>
            <Link to="/events" className="flex items-center gap-1 text-[#FF2D8F] text-sm font-medium">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
            {featuredEvents.slice(0, 4).map((event, index) => (
              <motion.div
                key={event.id}
                custom={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={sectionVariants}
              >
                <CompactEventCard event={event} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FEATURED DJS ==================== */}
      <section className="py-8 relative">
        <div className="px-5">
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionVariants}
            className="flex items-end justify-between mb-5"
          >
            <div>
              <span className="inline-block text-[#00E5FF] text-xs font-medium tracking-wider uppercase mb-1">
                Top Performers
              </span>
              <h2 className="text-xl font-bold text-white">Featured DJs</h2>
            </div>
            <Link to="/artists" className="flex items-center gap-1 text-[#00E5FF] text-sm font-medium">
              All Artists <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-5 px-5 hide-scrollbar pb-2">
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

      {/* ==================== INTERNATIONAL COLLABORATIONS ==================== */}
      <section className="py-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00E5FF]/[0.03] to-transparent pointer-events-none" />
        <div className="px-5 relative">
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionVariants}
            className="glass-card-premium p-6 md:p-8"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <span className="inline-block text-[#00E5FF] text-xs font-medium tracking-wider uppercase mb-2">
                  {t('home.brand.collabsKicker')}
                </span>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-3">{t('home.brand.collabsTitle')}</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  {t('home.brand.collabsText')}
                </p>
                <p className="text-gray-300 text-xs md:text-sm font-medium">
                  {t('home.brand.collabsNames')}
                </p>
              </div>
              <Link
                to="/about"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/20 text-white text-sm font-semibold hover:border-[#00E5FF]/60 hover:text-[#00E5FF] transition-colors shrink-0"
              >
                {t('home.brand.collabsLink')} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ==================== JOIN & PARTICIPATE ==================== */}
      <section className="py-8 relative">
        <div className="px-5 relative">
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionVariants}
            className="mb-5 text-center"
          >
            <span className="inline-block text-[#d3da0c] text-xs font-medium tracking-wider uppercase mb-1">
              {t('home.brand.joinKicker')}
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-white">{t('home.brand.joinTitle')}</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {joinItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  custom={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={sectionVariants}
                >
                  <Link
                    to={item.path}
                    className="group glass-card-premium p-4 flex flex-col justify-between min-h-[150px] active:scale-[0.98] transition-transform"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#FF2D8F]/10 flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5 text-[#FF2D8F]" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-[#d3da0c] transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-gray-400 text-xs leading-relaxed mb-2.5">{item.description}</p>
                      <span className="inline-flex items-center gap-1 text-[#d3da0c] text-xs font-medium">
                        {item.action} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== SIDEBAR AD (DESKTOP) ==================== */}
      <section className="hidden md:block px-5 py-4">
        <AdBanner position="homepage_sidebar" />
      </section>

      {/* ==================== CITY GUIDE GRID ==================== */}
      <section className="py-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FF2D8F]/[0.02] to-transparent pointer-events-none" />
        <div className="px-5 relative">
          <motion.div
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={sectionVariants}
            className="flex items-end justify-between mb-5"
          >
            <div>
              <span className="inline-block text-[#d3da0c] text-xs font-medium tracking-wider uppercase mb-1">
                Explore
              </span>
              <h2 className="text-xl font-bold text-white">City Guide</h2>
            </div>
            <Link to="/city-guide" className="flex items-center gap-1 text-[#d3da0c] text-sm font-medium">
              Explore <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { title: 'Business', image: '/party_crowd_bg.jpg', count: `${cityGuideCounts.businesses || 0} businesses`, color: '#d3da0c' },
              { title: 'Vendors', image: '/about-bg.jpg', count: `${cityGuideCounts.vendors || 0} vendors`, color: '#FF2D8F' },
              { title: 'Events', image: '/hero-bg.jpg', count: `${cityGuideCounts.events || 0} upcoming`, color: '#00E5FF' },
              { title: 'Artists', image: '/party_crowd_bg.jpg', count: `${cityGuideCounts.artists || 0} DJs`, color: '#C8A000' },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                custom={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={sectionVariants}
              >
                <Link
                  to="/city-guide"
                  className="group block relative h-36 rounded-2xl overflow-hidden active:scale-[0.97] transition-transform"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute inset-0 glass-panel-dark opacity-0 group-hover:opacity-30 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-white font-semibold text-sm">{item.title}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" style={{ color: item.color }} />
                      <span className="text-xs text-gray-300">{item.count}</span>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2">
                    <div className="w-7 h-7 rounded-full glass-pill-premium flex items-center justify-center">
                      <Star className="w-3 h-3 text-white/70" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== STATS ==================== */}
      <section className="py-10 relative">
        <div className="absolute inset-0 mesh-gradient-premium opacity-40 pointer-events-none" />
        <div className="px-5 relative">
          <div className="grid grid-cols-2 gap-3">
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
                  className="glass-card-premium p-4 text-center"
                >
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#d3da0c]/10 mb-2">
                    <Icon className="w-5 h-5 text-[#d3da0c]" />
                  </div>
                  <div className="text-2xl font-display text-white mb-0.5">{stat.value}</div>
                  <div className="text-gray-500 text-xs">{stat.label}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== CTA ==================== */}
      <section className="py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/cta-bg.jpg')" }} />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
        <div className="absolute inset-0 glass-frosted opacity-20" />

        <div className="relative z-10 max-w-lg mx-auto px-5 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-4xl font-display text-white mb-3">
              {t('home.cta.title')}
            </h2>
            <p className="text-gray-400 text-sm md:text-base mb-5 max-w-md mx-auto">
              {t('home.cta.subtitle')}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/register"
                className="glass-button-primary text-sm"
              >
                {t('home.cta.button')}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/events"
                className="glass-button-secondary text-sm"
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
