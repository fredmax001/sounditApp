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
} from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import EventCard from '@/components/EventCard';
import ArtistCard from '@/components/ArtistCard';

import axios from 'axios';
import type { DJ } from '@/store/eventStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

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
  const [platformStats, setPlatformStats] = useState({
    total_events: 0,
    total_artists: 0,
    total_users: 0,
    active_cities: 0,
  });

  const [cityGuideCounts, setCityGuideCounts] = useState({
    venues: 0,
    organizers: 0,
    vendors: 0,
    events: 0,
    artists: 0,
  });

  const fetchDJs = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedCity) params.city = selectedCity;
      const { data } = await axios.get(`${API_URL}/artists/featured`, { params });
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
          organizers: (data.organizers || []).length,
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

  const quickChips = [
    { icon: Music, label: 'DJs', path: '/artists' },
    { icon: Utensils, label: 'Food', path: '/food' },
    { icon: Ticket, label: 'Parties', path: '/events' },
  ];

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

  return (
    <div className="relative">
      {/* ==================== HERO SECTION ==================== */}
      <section ref={heroRef} className="relative h-[85vh] md:h-screen overflow-hidden">
        {/* Background Image with Ken Burns + Parallax */}
        <motion.div
          className="absolute inset-0 bg-cover bg-center animate-ken-burns"
          style={{ y: heroY, backgroundImage: "url('/hero-bg.jpg')" }}
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#0A0A0F]/70 to-[#0A0A0F]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/80 to-transparent" />

        {/* Animated gradient mesh overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#d3da0c]/8 rounded-full blur-[100px] animate-mesh-drift" />
          <div className="absolute bottom-1/3 right-1/4 w-56 h-56 bg-[#FF2D8F]/8 rounded-full blur-[80px] animate-mesh-drift" style={{ animationDelay: '-5s' }} />
          <div className="absolute top-1/2 right-1/3 w-48 h-48 bg-[#00E5FF]/5 rounded-full blur-[90px] animate-mesh-drift" style={{ animationDelay: '-8s' }} />
        </div>

        {/* Floating particles */}
        <FloatingNotes />

        {/* Hero Content */}
        <motion.div
          className="relative z-10 h-full flex flex-col justify-end pb-8 md:justify-center md:pb-0 px-5"
          style={{ opacity: heroOpacity }}
        >
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
                {user ? `Welcome back! Exploring ${userCity}` : t('home.hero.badge')}
              </span>
            </motion.div>

            {/* Headline — Split animation */}
            <div className="mb-5">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display text-white leading-[0.95] tracking-tight hero-headline"
              >
                <span className="block font-normal text-white/90">FEEL THE</span>
                <span className="block font-bold hero-gradient-text mt-1">AFROBEATS IN CHINA</span>
              </motion.h1>
            </div>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="text-gray-300/80 text-base md:text-lg mb-6 max-w-md leading-relaxed"
            >
              Discover the hottest Afrobeats events, African restaurants, and DJs across Shanghai, Beijing, Guangzhou & more. Your home away from home.
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
                <span className="relative z-10">Explore Events</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/city-guide"
                className="glass-button-secondary text-base w-full sm:w-auto"
              >
                <span className="relative z-10">City Guide</span>
              </Link>
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
        </motion.div>
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

          <div className="space-y-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0">
            {featuredEvents.slice(0, 4).map((event, index) => (
              <motion.div
                key={event.id}
                custom={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={sectionVariants}
              >
                <Link
                  to={`/events/${event.id}`}
                  className="group flex gap-4 glass-card-premium p-3 active:scale-[0.98] transition-transform"
                >
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0">
                    <img
                      src={event.flyer_image || '/placeholder_event.jpg'}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute top-1.5 left-1.5 glass-pill-premium px-2 py-0.5">
                      <span className="text-[10px] font-bold text-[#d3da0c]">
                        {new Date(event.start_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <h3 className="text-white font-semibold text-sm mb-1 line-clamp-1 group-hover:text-[#d3da0c] transition-colors">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-3 text-gray-400 text-xs mb-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.venue?.name || event.city}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#d3da0c] font-bold text-sm">
                        {event.ticket_tiers?.[0]?.price
                          ? `${event.ticket_tiers[0].currency} ${event.ticket_tiers[0].price}`
                          : 'Free'}
                      </span>
                      <button className="w-7 h-7 rounded-full glass-pill-premium flex items-center justify-center text-gray-400 hover:text-[#FF2D8F] transition-colors">
                        <Heart className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </Link>
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
              { title: 'Venues/Organizers', image: '/party_crowd_bg.jpg', count: `${(cityGuideCounts.venues || 0) + (cityGuideCounts.organizers || 0)} venues`, color: '#d3da0c' },
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
  );
};

export default Home;
