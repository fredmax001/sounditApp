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
  Utensils
} from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import EventCard from '@/components/EventCard';
import ArtistCard from '@/components/ArtistCard';

import axios from 'axios';
import type { DJ } from '@/store/eventStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

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

  useEffect(() => {
    fetchFeaturedEvents(selectedCity || undefined);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDJs();
    fetchPlatformStats();
  }, [fetchFeaturedEvents, selectedCity, fetchDJs, fetchPlatformStats]);

  const userCity = selectedCity || profile?.city?.name || 'China';

  const heroRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const features = [
    {
      icon: Calendar,
      title: t('home.features.curatedEvents'),
      description: t('home.features.curatedEventsDesc'),
    },
    {
      icon: Music,
      title: t('home.features.artistNetwork'),
      description: t('home.features.artistNetworkDesc'),
    },
    {
      icon: Ticket,
      title: t('home.features.instantTickets'),
      description: t('home.features.instantTicketsDesc'),
    },
    {
      icon: Utensils,
      title: t('home.features.africanFood'),
      description: t('home.features.africanFoodDesc'),
    },
  ];

  const stats = [
    { value: platformStats.total_events > 0 ? `${platformStats.total_events.toLocaleString()}+` : '0', label: t('home.stats.events'), icon: Calendar },
    { value: platformStats.total_artists > 0 ? `${platformStats.total_artists.toLocaleString()}+` : '0', label: t('home.stats.artists'), icon: Music },
    { value: platformStats.total_users > 0 ? `${platformStats.total_users.toLocaleString()}+` : '0', label: t('home.stats.community'), icon: Users },
    { value: platformStats.active_cities > 0 ? `${platformStats.active_cities}` : '0', label: t('home.stats.cities'), icon: MapPin },
  ];

  return (
    <div className="relative">
      {/* Hero Section */}
      <section ref={heroRef} className="relative h-screen overflow-hidden">
        {/* Background Image with Parallax */}
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{ y: heroY, backgroundImage: "url('/hero-bg.jpg')" }}
        >
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/80 to-transparent" />
        </motion.div>

        {/* Hero Content */}
        <motion.div
          className="relative z-10 h-full flex items-center"
          style={{ opacity: heroOpacity }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-2xl">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#d3da0c]/10 border border-[#d3da0c]/30 rounded-full mb-6"
              >
                <Zap className="w-4 h-4 text-[#d3da0c]" />
                <span className="text-[#d3da0c] text-sm font-medium">
                  {user ? t('home.hero.badgeLoggedIn', { city: userCity }) : t('home.hero.badge')}
                </span>
              </motion.div>

              {/* Heading */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display text-white leading-tight mb-6"
              >
                {t('home.hero.title')}
              </motion.h1>

              {/* Subheading */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-gray-400 text-lg mb-8 max-w-lg"
              >
                {t('home.hero.subtitle')}
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex flex-col sm:flex-row flex-wrap gap-4"
              >
                <Link
                  to="/events"
                  className="group inline-flex items-center gap-2 px-8 py-4 btn-custom font-semibold rounded-lg transition-all"
                >
                  {t('home.hero.ctaEvents')}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/city-guide"
                  className="inline-flex items-center gap-2 px-8 py-4 border border-white/20 text-white font-semibold rounded-lg hover:bg-white/5 transition-all"
                >
                  {t('home.hero.ctaCityGuide')}
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2"
          >
            <motion.div className="w-1.5 h-1.5 bg-[#d3da0c] rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* Featured Events Section */}
      <section className="py-12 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
            <div>
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4"
              >
                {user ? t('home.upcomingEvents') : t('home.upcomingEvents')}
              </motion.span>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                viewport={{ once: true }}
                className="text-4xl md:text-5xl font-display text-white"
              >
                {t('home.featuredEvents')}
              </motion.h2>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mt-6 md:mt-0"
            >
              <Link
                to="/events"
                className="group inline-flex items-center gap-2 text-[#d3da0c] font-medium hover:gap-4 transition-all"
              >
                {t('home.viewAllEvents')}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>

          {/* Events Grid */}
          <div className="flex overflow-x-auto snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 -mx-4 px-4 md:mx-0 md:px-0">
            {isLoading ? (
              // Loading Skeletons
              [1, 2, 3].map((i) => (
                <div key={i} className="w-[85vw] md:w-auto h-[320px] md:h-[400px] bg-white/5 rounded-2xl animate-pulse flex-shrink-0 snap-start" />
              ))
            ) : featuredEvents.length > 0 ? (
              featuredEvents.slice(0, 6).map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="w-[85vw] md:w-auto flex-shrink-0 snap-start"
                >
                  <EventCard event={event} />
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-gray-500">
                {t('home.noEvents', { city: userCity })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Featured Artists Section */}
      <section className="py-12 md:py-24 bg-[#111111]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4"
            >
              {t('home.topPerformers')}
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-display text-white"
            >
              {t('home.featuredArtists')}
            </motion.h2>
          </div>

          {/* Artists Grid */}
          <div className="flex overflow-x-auto snap-x snap-mandatory md:grid md:grid-cols-4 gap-4 md:gap-6 -mx-4 px-4 md:mx-0 md:px-0">
            {featuredDJs.length > 0 ? (
              featuredDJs.map((artist, index) => (
                <motion.div
                  key={artist.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="w-[45vw] md:w-auto flex-shrink-0 snap-start"
                >
                  <ArtistCard artist={artist} />
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center">
                <p className="text-gray-400 mb-4">{t('home.noEvents', { city: userCity })}</p>
                <a href="/artists" className="text-[#d3da0c] hover:underline font-medium">
                  {t('common.explore')} →
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section - Ready to Party */}
      <section className="py-24 relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('/cta-bg.jpg')" }}>
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-6xl font-display text-white mb-6">
              {t('home.cta.title')}
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
              {t('home.cta.subtitle')}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-4 btn-custom font-semibold rounded-lg transition-all"
              >
                {t('home.cta.button')}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/events"
                className="inline-flex items-center gap-2 px-8 py-4 border border-white/20 text-white font-semibold rounded-lg hover:bg-white/5 transition-all"
              >
                {t('home.hero.ctaEvents')}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section py-16 bg-[#111111]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="stat-item text-center"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#d3da0c]/10 mb-4">
                    <Icon className="w-6 h-6 text-[#d3da0c]" />
                  </div>
                  <div className="text-3xl md:text-4xl font-display text-white mb-1">
                    {stat.value}
                  </div>
                  <div className="text-gray-500 text-sm">{stat.label}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section ref={aboutRef} className="py-12 md:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden bg-cover bg-center h-[500px] flex items-center justify-center" style={{ backgroundImage: "url('/about-bg.jpg')" }}>
                <div className="absolute inset-0 bg-black/40" />
                <div className="relative z-10 text-center px-8">
                  <div className="w-20 h-20 rounded-full bg-[#d3da0c]/20 flex items-center justify-center mx-auto mb-4">
                    <Music className="w-10 h-10 text-[#d3da0c]" />
                  </div>
                  <p className="text-white font-display text-2xl">Sound It</p>
                  <p className="text-gray-200 mt-2">Your home away from home</p>
                </div>
              </div>

              {/* Floating Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                viewport={{ once: true }}
                className="absolute -bottom-8 -right-8 glass rounded-xl p-6 max-w-xs"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#d3da0c] flex items-center justify-center">
                    <Music className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{t('home.features.curatedEvents')}</p>
                    <p className="text-gray-400 text-sm">{t('home.topPerformers')}</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">
                  {t('home.features.curatedEventsDesc')}
                </p>
              </motion.div>

              {/* Decorative Elements */}
              <div className="absolute -top-4 -left-4 w-24 h-24 border-2 border-[#d3da0c]/30 rounded-lg" />
            </motion.div>

            {/* Content */}
            <div>
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="about-text inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4"
              >
                {t('nav.about')} Sound It
              </motion.span>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                viewport={{ once: true }}
                className="about-text text-4xl md:text-5xl font-display text-white mb-6"
              >
                YOUR HOME AWAY{' '}
                <span className="text-[#d3da0c]">FROM HOME</span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                viewport={{ once: true }}
                className="about-text text-gray-400 text-lg leading-relaxed mb-6"
              >
                Sound It is built for foreigners in China, especially Africans, who want to
                connect with their culture. We bring together the best Afrobeats events,
                African restaurants, and DJs in one place.
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                viewport={{ once: true }}
                className="about-text text-gray-400 leading-relaxed mb-8"
              >
                From Shanghai to Guangzhou, Beijing to Shenzhen - find your community,
                discover where the party is at this weekend, and never miss a beat.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                viewport={{ once: true }}
              >
                <Link
                  to="/about"
                  className="group inline-flex items-center gap-2 text-[#d3da0c] font-medium hover:gap-4 transition-all"
                >
                  {t('common.explore')}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section py-24 bg-[#111111]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4"
            >
              {t('common.discover')}
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-display text-white"
            >
              {t('home.featuredEvents')}
            </motion.h2>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  className="feature-card group glass rounded-2xl p-6 hover:bg-white/10 transition-all duration-300"
                >
                  <div className="w-14 h-14 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center mb-6 group-hover:bg-[#d3da0c]/20 transition-colors">
                    <Icon className="w-7 h-7 text-[#d3da0c]" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
