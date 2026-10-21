import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Users,
  Globe,
  Award,
  Zap,
  Music,
  Ticket,
  BarChart3,
  Headphones,
  PartyPopper,
  Heart,
  Code2,
  X,
  Calendar,
  MapPin,
  Eye,
  ExternalLink,
} from 'lucide-react';

interface Collaborator {
  name: string;
  badge: string;
  headline?: boolean;
  image: string;
  roleTitle: string;
  description: string;
  event: {
    title: string;
    dateLocation: string;
  };
  tags: string[];
}

const About = () => {
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);

  useEffect(() => {
    if (selectedCollaborator) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedCollaborator]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCollaborator(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const values = [
    {
      icon: Music,
      title: 'Culture',
      description: 'We celebrate authentic culture and create experiences rooted in real stories, music, and heritage.',
    },
    {
      icon: Users,
      title: 'Community',
      description: 'We bring together artists, businesses, organizers, and audiences to grow stronger together.',
    },
    {
      icon: Sparkles,
      title: 'Innovation',
      description: 'We constantly explore new ways to entertain, connect, and empower communities through technology.',
    },
    {
      icon: Award,
      title: 'Authenticity',
      description: 'Everything we create is rooted in real culture, real experiences, and genuine connections.',
    },
    {
      icon: Zap,
      title: 'Excellence',
      description: 'Quality, professionalism, and attention to detail are at the heart of everything we do.',
    },
  ];

  const entities = [
    {
      icon: PartyPopper,
      name: 'Sound It Events',
      description: 'Sound It Events is the live experiences division of the Sound It ecosystem, producing curated parties, showcases, networking events, and cultural gatherings that celebrate African and global music. Through unique concepts, quality entertainment, and community engagement, Sound It Events connects artists, audiences, brands, and event professionals across multiple markets.',
      status: 'Active',
      url: '/events',
    },
    {
      icon: Music,
      name: 'RNB & Slow Sessions',
      description: "RNB & Slow Sessions is Sound It's signature event series dedicated to soulful music, R&B, slow jams, Afro-R&B, and timeless classics. Since its launch, the series has successfully hosted multiple editions, creating intimate experiences for music lovers while building a loyal and growing community around quality music and nightlife culture.",
      status: 'Active',
      url: 'https://rnbnslowsessions.com/',
    },
    {
      icon: Globe,
      name: 'BOA Festival',
      description: "BOA Festival (Beatz of Afrika) is Shanghai's premier African music and cultural festival, uniting international Afrobeats and Amapiano artists, live performances, African cuisine, fashion showcases, and global audiences.",
      status: 'Active',
      url: 'https://boa.sounditent.com/',
    },
    {
      icon: BarChart3,
      name: 'Sound It DJ',
      description: 'Sound It DJ is the professional DJ intelligence and music curation cloud platform built for DJs, producers, and performers. The platform offers multi-platform music library import and export across all major DJ software, AI-powered mix analysis, automated waveform visualizer creation, and direct USB export for pioneer CDJs and club gear.',
      status: 'Active',
      url: 'https://sounditdj.cloud/',
    },
    {
      icon: Code2,
      name: 'Sound It Tech',
      description: 'Sound It Tech is the technology and creative engineering division of Sound It, specializing in custom app development, website engineering, WeChat mini programs, enterprise IT solutions, computer sales & repair, graphic design, and digital innovation for modern businesses.',
      status: 'Active',
      url: 'https://www.soundit.tech/#',
    },
    {
      icon: Zap,
      name: 'Sound It Platform',
      description: 'Sound It Platform is the flagship digital ecosystem connecting the entertainment industry in one place. The platform enables event organizers, artists, DJs, photographers, dancers, vendors, venues, businesses, and fans to discover opportunities, promote services, sell tickets, manage bookings, and grow their presence through powerful networking and business tools.',
      status: 'Active',
      url: '/',
    },
    {
      icon: Users,
      name: 'Deck Salone',
      description: "Deck Salone is Sierra Leone's official DJ and entertainment ecosystem connecting top DJs, event organizers, venues, and music lovers with streaming mixes, artist bookings, and live DJ battles.",
      status: 'Active',
      url: 'https://www.decksalone.com/',
    },
    {
      icon: Headphones,
      name: 'Sound It Muzik',
      description: 'Sound It Muzik is a music streaming, discovery, and distribution platform focused on empowering independent artists, beginning with Sierra Leone and expanding across Africa. The platform aims to provide artists with greater visibility, direct fan engagement, distribution opportunities, performance analytics, and monetization tools while promoting African music globally.',
      status: 'In Development',
    },
  ];

  const philosophy = [
    'Authentic culture over trends',
    'Quality over volume',
    'Community over hype',
    'Long-term value over short-term wins',
  ];

  return (
    <div className="min-h-screen pt-20 pb-24 bg-[#020b00]">
      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1920&h=1080&fit=crop')`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020b00] via-transparent to-[#020b00]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4">
              Sound It Entertainment Global
            </span>
            <h1 className="text-5xl md:text-7xl font-display text-white mb-6">
              WHERE SOUND MEETS{' '}
              <span className="text-[#d3da0c]">CULTURE</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto leading-relaxed">
              Sound It is a cultural and entertainment brand focused on creating meaningful
              music experiences and platforms that connect Africa, China, and the global community.
              Built on authenticity, quality, and community.
            </p>
            <p className="text-gray-500 text-base max-w-3xl mx-auto mt-4">
              Founded August 20, 2020 in Hangzhou, China by Frederick Julian Max-Macauley. Now based in Shanghai, China. Music • Events • Culture • Technology • Creative Ecosystems
            </p>
          </motion.div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4"
            >
              Our Story
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="text-4xl font-display text-white"
            >
              FROM MUSIC TO A <span className="text-[#d3da0c]">MOVEMENT</span>
            </motion.h2>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl p-8"
            >
              <span className="inline-block text-xs px-3 py-1 rounded-full bg-[#d3da0c]/10 text-[#d3da0c] font-medium mb-3">2020</span>
              <h3 className="text-xl font-semibold text-white mb-2">The Beginning</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Sound It Entertainment Co. Ltd. was founded by Frederick Julian Max-Macauley on August 20, 2020.
                The company began as Sound It Music Entertainment during the COVID-19 pandemic, focusing on DJ mixes,
                artist collaborations, music releases, and entertainment content. An early milestone was the release of
                "Don't Leave Me (Big Matter)", featuring Drizilik, Mello Seven, and Jooel, produced by Lanzo J.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl p-8"
            >
              <span className="inline-block text-xs px-3 py-1 rounded-full bg-[#d3da0c]/10 text-[#d3da0c] font-medium mb-3">April 2021</span>
              <h3 className="text-xl font-semibold text-white mb-2">First Live Experience</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                In April 2021, Sound It expanded into live experiences with the Sierra Leone Independence Day
                Celebration at Prince Club in Hangzhou, China, marking the start of Sound It Events.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl p-8"
            >
              <span className="inline-block text-xs px-3 py-1 rounded-full bg-[#d3da0c]/10 text-[#d3da0c] font-medium mb-3">Today</span>
              <h3 className="text-xl font-semibold text-white mb-2">An Entertainment & Technology Company</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Since then, Sound It Events has hosted, organized, and collaborated on more than 50 events across
                cities including Shanghai, Hangzhou, Nanjing, and Ningbo. The company has grown into a broader
                entertainment and technology company spanning live events, cultural programming, digital platforms,
                creative services, and community-building initiatives, connecting African culture, international
                entertainment, and the Chinese market.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-24 bg-[#020b00]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4">
                Our Purpose
              </span>
              <h2 className="text-4xl font-display text-white mb-6">
                OUR <span className="text-[#d3da0c]">MISSION</span>
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                To empower creators, connect communities, celebrate culture, and create opportunities
                through entertainment, technology, and innovation.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4">
                Our Future
              </span>
              <h2 className="text-4xl font-display text-white mb-6">
                OUR <span className="text-[#d3da0c]">VISION</span>
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                To become a globally recognized entertainment and technology ecosystem that transforms
                how people discover, create, experience, and engage with music, culture, and creative industries.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Brand Entities */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4"
            >
              Our Ecosystem
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="text-4xl font-display text-white"
            >
              BRAND <span className="text-[#d3da0c]">ENTITIES</span>
            </motion.h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {entities.map((entity, index) => {
              const Icon = entity.icon;
              const isExternal = entity.url?.startsWith('http');
              const hasUrl = Boolean(entity.url);

              const cardContent = (
                <div
                  className={`h-full glass rounded-2xl p-6 transition-all group flex flex-col justify-between ${
                    hasUrl
                      ? 'hover:bg-white/10 hover:border-[#d3da0c]/60 hover:-translate-y-1 cursor-pointer'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center group-hover:bg-[#d3da0c]/20 transition-colors">
                        <Icon className="w-6 h-6 text-[#d3da0c]" />
                      </div>
                      <div className="flex items-center gap-2">
                        {hasUrl && (
                          <span className="p-1 rounded-md bg-white/5 text-gray-400 group-hover:text-[#d3da0c] transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-medium ${
                            entity.status === 'Active'
                              ? 'bg-[#d3da0c]/10 text-[#d3da0c]'
                              : entity.status === 'Launching 2026' || entity.status === 'Launching Soon'
                              ? 'bg-purple-500/10 text-purple-400'
                              : entity.status === 'Partner Project'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-white/5 text-gray-400'
                          }`}
                        >
                          {entity.status}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">{entity.name}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{entity.description}</p>
                  </div>
                  {hasUrl && (
                    <div className="mt-5 pt-3.5 border-t border-white/5 flex items-center justify-between text-xs text-[#d3da0c] font-medium group-hover:text-[#e4ea20] transition-colors">
                      <span>{isExternal ? 'Visit Platform' : 'Explore Platform'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );

              return (
                <motion.div
                  key={entity.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  viewport={{ once: true }}
                  className="h-full"
                >
                  {entity.url ? (
                    isExternal ? (
                      <a
                        href={entity.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block h-full"
                      >
                        {cardContent}
                      </a>
                    ) : (
                      <Link to={entity.url} className="block h-full">
                        {cardContent}
                      </Link>
                    )
                  ) : (
                    cardContent
                  )}
                </motion.div>
              );
            })}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-gray-500 text-xs text-center max-w-3xl mx-auto mt-8 leading-relaxed"
          >
            Related initiatives such as Sound It Media and Sound It Digital, along with partner projects
            like Tritna Ride and West Cape Consultancy, are included only where their relationship to Sound It
            is accurate. Partner projects are not wholly owned Sound It brands unless explicitly verified.
          </motion.p>
        </div>
      </section>

      {/* Logo Story */}
      <section className="py-24 bg-[#020b00]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4"
            >
              Our Identity
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="text-4xl font-display text-white"
            >
              OUR <span className="text-[#d3da0c]">LOGO STORY</span>
            </motion.h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex items-center justify-center"
            >
              <img
                src="/logo.png"
                alt="Sound It Logo"
                className="w-full max-w-md object-contain"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <p className="text-gray-400 text-lg leading-relaxed">
                Every element of the Sound It logo was intentionally designed to reflect our identity, culture, and mission.
              </p>
              <p className="text-gray-400 text-lg leading-relaxed">
                At the heart of the logo is the iconic <span className="text-white font-semibold">“O”</span>, inspired by the African Talking Drum. For generations, the Talking Drum has been used across Africa as a symbol of communication, storytelling, celebration, and community. It represents the voice of the people and the heartbeat of culture.
              </p>
              <p className="text-gray-400 text-lg leading-relaxed">
                The sound waves surrounding the drum symbolize the power of music to connect people across borders, languages, and backgrounds. They represent energy, movement, and the universal language that unites communities around the world.
              </p>
              <p className="text-gray-400 text-lg leading-relaxed">
                The handwritten <span className="text-white font-semibold">“it”</span> represents creativity, individuality, and self-expression. It reflects the artists, creators, entrepreneurs, and dreamers who bring culture to life through their unique talents and stories.
              </p>
              <p className="text-gray-400 text-lg leading-relaxed">
                Together, these elements embody our purpose:
              </p>
              <p className="text-[#d3da0c] text-xl font-display font-semibold">
                Connecting Cultures Through Sound.
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-8 border border-[#d3da0c]/10 max-w-3xl mx-auto"
          >
            <h3 className="text-xl font-display text-white mb-6 text-center">
              WHAT THE <span className="text-[#d3da0c]">“O”</span> REPRESENTS
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                'African Heritage',
                'Communication & Storytelling',
                'Music & Rhythm',
                'Community & Connection',
                'Cultural Identity',
                'Global Reach Through Sound',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#d3da0c] shrink-0" />
                  <span className="text-gray-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-sm text-center mt-6 italic">
              More than a logo, Sound It is a symbol of culture, creativity, opportunity, and connection, rooted in Africa and built for the world.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-[#020b00]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4"
            >
              What We Stand For
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="text-4xl font-display text-white"
            >
              CORE <span className="text-[#d3da0c]">VALUES</span>
            </motion.h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="glass rounded-2xl p-6 hover:bg-white/10 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-[#d3da0c]" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{value.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{value.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4"
            >
              What We Believe
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="text-4xl font-display text-white"
            >
              BRAND <span className="text-[#d3da0c]">PHILOSOPHY</span>
            </motion.h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {philosophy.map((item, index) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative glass rounded-2xl p-6 text-center group hover:border-[#d3da0c]/30 transition-all"
              >
                <div className="text-5xl font-display text-[#d3da0c]/20 mb-4">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <p className="text-white font-medium text-lg leading-relaxed">{item}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* International Collaborations */}
      <section className="py-24 bg-[#020b00]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4"
            >
              International Collaborations
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="text-4xl font-display text-white"
            >
              GLOBAL ACTS. CULTURAL <span className="text-[#d3da0c]">IMPACT</span>
            </motion.h2>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-gray-400 text-center max-w-3xl mx-auto mb-16 leading-relaxed"
          >
            Over the past two years, Sound It Events & RNB & Slow Sessions have successfully
            collaborated with internationally recognized DJs and influencers, strengthening our
            position as a cross-cultural entertainment platform in China.
          </motion.p>

          {/* Collaborators Data & 3-in-a-Row Grid */}
          {(() => {
            const collaborators: Collaborator[] = [
              {
                name: 'BABALWA M',
                badge: '2026 BOA HEADLINER',
                headline: true,
                image: '/collab_babalwa_m.jpg',
                roleTitle: 'South African Vocalist & Songwriter · Queen of Private School Amapiano',
                description:
                  'Acclaimed South African vocalist and songwriter widely revered as the "Queen of Private School Amapiano." Renowned for her soul-stirring vocal melodies, spiritual resonance, and landmark collaborations with Kelvin Momo, Kabza De Small, and Stixx, Babalwa M brings unmatched emotional depth and authentic South African sounds as a premier headline act for the 2026 BOA Festival By Sound It Entertainment.',
                event: {
                  title: '2026 BOA Festival By Sound It Entertainment',
                  dateLocation: '2026 | Headline Stage',
                },
                tags: ['2026 BOA Headliner', 'Queen of Amapiano', 'Soulful Vocals', 'Cultural Ambassador'],
              },
              {
                name: 'FUNKY QLA',
                badge: '2026 BOA HEADLINER',
                headline: true,
                image: '/collab_funky_qla.jpg',
                roleTitle: 'Electronic Music Producer & DJ · Durban Gqom Pioneer',
                description:
                  'Pioneering South African electronic music producer and Gqom powerhouse hailing from Durban. Celebrated for raw, hypnotic drum rhythms, heavyweight club anthems, and electrifying high-octane performances that ignite international dance floors, Funky QLA brings the unstoppable energy of Durban street sounds to headline the 2026 BOA Festival By Sound It Entertainment.',
                event: {
                  title: '2026 BOA Festival By Sound It Entertainment',
                  dateLocation: '2026 | Headline Stage',
                },
                tags: ['2026 BOA Headliner', 'Gqom Pioneer', 'Durban Sound', 'Afro-House Powerhouse'],
              },
              {
                name: 'CHISWAY',
                badge: '2026 BOA HEADLINER',
                headline: true,
                image: '/collab_chisway.jpg',
                roleTitle: 'Afro-Fusion Sensation & Live Performer',
                description:
                  'Dynamic Afro-fusion recording artist and charismatic live performer captivating audiences with innovative soundscapes, magnetic stage presence, and infectious cross-cultural rhythms bridging African beats with global youth culture. ChisWay takes center stage as an official headliner for the 2026 BOA Festival By Sound It Entertainment.',
                event: {
                  title: '2026 BOA Festival By Sound It Entertainment',
                  dateLocation: '2026 | Headline Stage',
                },
                tags: ['2026 BOA Headliner', 'Afro-Fusion', 'Dynamic Performer', 'Global Sound'],
              },
              {
                name: 'DJ MELZI',
                badge: '2026 BOA HEADLINER',
                headline: true,
                image: '/collab_dj_melzi.jpg',
                roleTitle: 'International DJ & Multi-Platinum Amapiano Producer',
                description:
                  'Prodigious South African DJ, multi-platinum producer, and global Amapiano sensation. With international tour dates across Africa, the UK, and Europe, and millions of worldwide streams on hits like "La Melza", DJ Melzi represents the vibrant frontline of modern African electronic music dominating festival stages and headlining the 2026 BOA Festival By Sound It Entertainment.',
                event: {
                  title: '2026 BOA Festival By Sound It Entertainment',
                  dateLocation: '2026 | Headline Stage',
                },
                tags: ['2026 BOA Headliner', 'International DJ', 'Multi-Platinum Producer', 'Festival Vanguard'],
              },
              {
                name: 'DJ AKIO',
                badge: '2025',
                headline: false,
                image: '/collab_dj_akio.jpg',
                roleTitle: 'International RNB & Afrobeats DJ',
                description:
                  'Internationally recognized RNB and Afrobeats DJ known for high-energy sets and refined music curation across global nightlife scenes. Japanese origin, raised in the US, based in South Africa.',
                event: {
                  title: '1st Anniversary, RNB & Slow Sessions',
                  dateLocation: 'May 31, 2025 | Highline Rooftop',
                },
                tags: ['International-level experience', 'RNB & lifestyle positioning', 'Key brand milestone'],
              },
              {
                name: 'EVA MODIKA',
                badge: '2025',
                headline: false,
                image: '/collab_eva_modika.jpg',
                roleTitle: 'South African DJ, Media Personality & Influencer',
                description:
                  'South African DJ, media personality, and nightlife influencer known for her bold presence and strong audience engagement across Southern Africa.',
                event: {
                  title: 'Sound of the South',
                  dateLocation: 'October 3, 2025 | Synth Club',
                },
                tags: ['Southern African club culture', 'Expanded African audience', 'High-energy night of 2025'],
              },
              {
                name: 'DJ KAYWISE',
                badge: '2025',
                headline: false,
                image: '/collab_dj_kaywise.jpg',
                roleTitle: 'Celebrated Nigerian DJ & Afrobeats Pioneer',
                description:
                  'Internationally celebrated Nigerian DJ with a strong reputation in Afrobeats and global club culture, having performed across Africa, Europe, and beyond.',
                event: {
                  title: 'Synth Club Grand Opening',
                  dateLocation: 'October 18, 2025 | Synth Club',
                },
                tags: ['Premium international nightlife', 'Brand prestige & visibility', 'Landmark event'],
              },
              {
                name: 'MASTER WEN',
                badge: '2025',
                headline: false,
                image: '/collab_master_wen.jpg',
                roleTitle: 'Chinese Influencer & Media Personality (760K+ Followers)',
                description:
                  'Prominent Chinese social media personality and influencer with over 760,000+ followers, known for strong online engagement and youth market influence.',
                event: {
                  title: 'RNB & Slow Sessions 9th Edition',
                  dateLocation: 'December 20, 2025 | Highline Rooftop',
                },
                tags: ['Chinese market visibility', 'Cross-cultural bridge', 'Digital reach'],
              },
              {
                name: 'DJ NEPTUNE',
                badge: '2024',
                headline: false,
                image: '/collab_dj_neptune.jpg',
                roleTitle: 'Award-Winning Nigerian DJ & Producer',
                description:
                  'Globally recognized Nigerian DJ and producer with international touring credentials and collaborations with major Afrobeats artists. Headies Award winner.',
                event: {
                  title: 'Sound It Events 2024 International Showcase',
                  dateLocation: '2024 | Shanghai',
                },
                tags: ['Early international credibility', 'Afrobeats community', 'Foundation for 2025 expansion'],
              },
            ];

            return (
              <>
                {/* 3-in-a-row responsive grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                  {collaborators.map((collab, index) => (
                    <motion.button
                      key={collab.name}
                      type="button"
                      onClick={() => setSelectedCollaborator(collab)}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: (index % 3) * 0.1, duration: 0.4 }}
                      className="group relative rounded-2xl overflow-hidden glass border border-white/10 hover:border-[#d3da0c]/60 text-left transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[#d3da0c]/10 flex flex-col focus:outline-none focus:ring-2 focus:ring-[#d3da0c]/50"
                    >
                      {/* Image Container */}
                      <div className="relative aspect-[4/5] w-full overflow-hidden bg-black/60">
                        <img
                          src={collab.image}
                          alt={collab.name}
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#020b00] via-[#020b00]/20 to-transparent" />

                        {/* Top Badge */}
                        <div className="absolute top-3 left-3 z-10">
                          {collab.headline ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#d3da0c] text-black text-[11px] font-bold tracking-wider uppercase shadow-lg shadow-[#d3da0c]/30">
                              <Sparkles className="w-3 h-3" />
                              2026 BOA Headliner
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-semibold">
                              {collab.badge}
                            </span>
                          )}
                        </div>

                        {/* View Info Action Pill */}
                        <div className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white/80 group-hover:text-[#d3da0c] group-hover:border-[#d3da0c]/50 group-hover:bg-black/90 transition-all">
                          <Eye className="w-4 h-4" />
                        </div>

                        {/* Click Hint Bar */}
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-[11px]">
                          <span className="text-gray-300 font-medium">Click to view info</span>
                          <span className="text-[#d3da0c] font-semibold">Details →</span>
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="p-5 flex-1 flex flex-col justify-between bg-[#020b00]">
                        <div>
                          <h3 className="text-xl font-display text-white group-hover:text-[#d3da0c] transition-colors tracking-wide">
                            {collab.name}
                          </h3>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                            {collab.roleTitle}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                          <span className="text-gray-400 truncate max-w-[70%]">
                            {collab.event.title}
                          </span>
                          <span className="text-[#d3da0c] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            Bio & Details →
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Interactive Artist Info Modal */}
                <AnimatePresence>
                  {selectedCollaborator && (
                    <div
                      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
                      onClick={() => setSelectedCollaborator(null)}
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 16 }}
                        transition={{ duration: 0.2 }}
                        className="relative w-full max-w-2xl bg-[#020b00] border border-[#d3da0c]/30 rounded-3xl overflow-hidden shadow-2xl my-auto text-left"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Close Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedCollaborator(null)}
                          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/70 hover:bg-white/20 text-white hover:text-[#d3da0c] transition-colors backdrop-blur-md border border-white/15"
                          aria-label="Close dialog"
                        >
                          <X className="w-5 h-5" />
                        </button>

                        <div className="grid sm:grid-cols-[240px_1fr] max-h-[85vh] overflow-y-auto">
                          {/* Image Column */}
                          <div className="relative bg-black flex items-center justify-center min-h-[280px] sm:min-h-full overflow-hidden">
                            <img
                              src={selectedCollaborator.image}
                              alt={selectedCollaborator.name}
                              className="w-full h-full object-cover object-center"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#020b00] via-transparent to-transparent sm:hidden" />
                          </div>

                          {/* Details Column */}
                          <div className="p-6 sm:p-8 flex flex-col justify-between">
                            <div>
                              {/* Badge */}
                              {selectedCollaborator.headline ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d3da0c] text-black text-xs font-bold tracking-wider uppercase mb-3 shadow-md shadow-[#d3da0c]/20">
                                  <Sparkles className="w-3.5 h-3.5" /> 2026 BOA FESTIVAL HEADLINER
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#d3da0c]/15 text-[#d3da0c] text-xs font-semibold uppercase mb-3 border border-[#d3da0c]/20">
                                  {selectedCollaborator.badge} Collaborator
                                </span>
                              )}

                              <h3 className="text-3xl font-display text-white mb-1 tracking-wide">
                                {selectedCollaborator.name}
                              </h3>
                              <p className="text-xs sm:text-sm text-[#d3da0c] font-medium mb-4">
                                {selectedCollaborator.roleTitle}
                              </p>

                              {/* Event Hosted Box */}
                              <div className="glass rounded-xl p-3.5 border border-white/10 mb-4 bg-white/[0.03]">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 font-semibold flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-[#d3da0c]" /> Event Hosted / Headline
                                </p>
                                <p className="text-white text-sm font-semibold">
                                  {selectedCollaborator.event.title}
                                </p>
                                <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-[#d3da0c]" />{' '}
                                  {selectedCollaborator.event.dateLocation}
                                </p>
                              </div>

                              {/* Bio / Description ("In Image description") */}
                              <div className="mb-5">
                                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
                                  Artist Bio & Description
                                </p>
                                <p className="text-gray-300 text-sm leading-relaxed">
                                  {selectedCollaborator.description}
                                </p>
                              </div>

                              {/* Tags */}
                              <div className="flex flex-wrap gap-2">
                                {selectedCollaborator.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 font-medium"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
                              <button
                                type="button"
                                onClick={() => setSelectedCollaborator(null)}
                                className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </>
            );
          })()}

          {/* Strategic Value */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 glass rounded-2xl p-8 border border-[#d3da0c]/10"
          >
            <h3 className="text-xl font-display text-white mb-6 text-center">
              STRATEGIC VALUE FOR <span className="text-[#d3da0c]">BRANDS</span>
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {[
                'Proven international bookings',
                'Strong African diaspora engagement',
                'Growing Chinese youth market',
                'Cross-cultural event production',
                '4,000+ annual attendees',
                'Bridge between African sound & Chinese market',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#d3da0c] shrink-0" />
                  <span className="text-gray-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-sm text-center italic">
              We are positioned as a bridge between African sound, international culture,
              and the Chinese nightlife market.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Leadership Team */}
      <section className="py-24 bg-[#020b00]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4"
            >
              The Minds Behind Sound It
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl font-display text-white mb-6"
            >
              OUR LEADERSHIP <span className="text-[#d3da0c]">TEAM</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed"
            >
              Sound It Events & RNB & Slow Sessions are powered by a dedicated leadership team
              committed to culture, quality, and long-term growth.
            </motion.p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start mb-24">
            {/* Fred Max */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-8">
                <img
                  src="/fred_max_portrait.jpg"
                  alt="Fred Max"
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-2xl font-display text-white mb-2">FREDERICK JULIAN MAX-MACAULEY</h3>
              <p className="text-[#d3da0c] text-sm font-medium uppercase tracking-wider mb-4">
                Founder & Chief Executive Officer, Sound It Entertainment | Also Known Professionally as Fred Max or DJ Fred Max
              </p>
              <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
                <p>
                  Frederick Julian Max-Macauley is the founder and Chief Executive Officer of Sound It Entertainment Co. Ltd.
                  and the driving force behind Sound It Events and RNB & Slow Sessions. A computer scientist, software developer,
                  entrepreneur, creative technologist, graphic designer, music producer, cultural curator, and international DJ,
                  he has built Sound It into a recognized cross-cultural entertainment platform in China.
                </p>
                <p>
                  He oversees brand strategy, partnerships, international bookings, creative direction,
                  and overall execution. Known for blending African, RNB, and global sounds seamlessly,
                  Fred Max has positioned Sound It as a bridge between cultures and a growing force in
                  the entertainment space.
                </p>
                <p>
                  His long-term vision includes expanding into festivals, media, and global collaborations.
                </p>
              </div>
            </motion.div>

            {/* Team Photo & Other Leaders */}
            <div className="space-y-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="aspect-video rounded-2xl overflow-hidden mb-12"
              >
                <img
                  src="/leadership_team.jpg"
                  alt="Sound It Leadership Team"
                  className="w-full h-full object-cover"
                />
              </motion.div>

              {/* Jayel Belford */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="glass rounded-xl p-8 border border-[#d3da0c]/10"
              >
                <h3 className="text-xl font-display text-white mb-2">JAYEL O. BELFORD</h3>
                <p className="text-[#d3da0c] text-xs font-medium uppercase tracking-wider mb-4">
                  Finance Manager and Co-Founder, Sound It Events
                </p>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  Jayel Belford plays a key leadership role in the company's stability and scalability.
                  As Co-Founder and Finance Manager, he oversees budgeting, financial planning, compliance,
                  and event cost management.
                </p>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  His structured financial oversight ensures sustainability, smart expansion, and responsible growth.
                  Jayel is instrumental in maintaining clear operational systems and long-term profitability while supporting the creative vision of the brand.
                </p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Together with the founder, he helps translate ideas into structured execution.
                </p>
              </motion.div>

              {/* Samuel S. Scott */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                viewport={{ once: true }}
                className="glass rounded-xl p-8 border border-[#d3da0c]/10"
              >
                <h3 className="text-xl font-display text-white mb-2">SAMUEL S. SCOTT</h3>
                <p className="text-[#d3da0c] text-xs font-medium uppercase tracking-wider mb-4">
                  Co-Founder, Sound It Events
                </p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Samuel S. Scott is a Co-Founder of Sound It Events, contributing to the growth and
                  development of the company's live experiences and cultural programming.
                </p>
              </motion.div>

              {/* Thembi */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                viewport={{ once: true }}
                className="glass rounded-xl p-8 border border-[#d3da0c]/10"
              >
                <h3 className="text-xl font-display text-white mb-2">THEMBALETU NCENE MABUZA</h3>
                <p className="text-[#d3da0c] text-xs font-medium uppercase tracking-wider mb-4">
                  Event Manager & Coordinator; Co-Founder, RNB & Slow Sessions
                </p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Thembi manages the operational flow of Sound It Events and RNB & Slow Sessions.
                  From vendor coordination to team scheduling and event-day supervision, she ensures that
                  every event runs smoothly.
                </p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Her attention to detail, communication skills, and hands-on coordination allow the brand to deliver high-quality experiences consistently. She bridges communication between performers, venues, and internal teams, making sure every production element aligns.
                </p>
              </motion.div>

              {/* Lynique */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                viewport={{ once: true }}
                className="glass rounded-xl p-8 border border-[#d3da0c]/10"
              >
                <h3 className="text-xl font-display text-white mb-2">LYNIQUE</h3>
                <p className="text-[#d3da0c] text-xs font-medium uppercase tracking-wider mb-4">
                  Official Host, Brand Voice | Audience Engagement | Stage Presence
                </p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Lynique serves as the official host and energy curator of Sound It events. She brings charisma,
                  professionalism, and audience connection to every stage.
                </p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Her role extends beyond hosting, she strengthens brand personality, keeps audiences engaged, and ensures each event maintains a dynamic and memorable atmosphere.
                </p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  She represents the voice and energy of the Sound It community.
                </p>
              </motion.div>
            </div>
          </div>

          {/* Why This Matters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <h3 className="text-xl font-display text-white mb-6">
              WHY THIS MATTERS FOR <span className="text-[#d3da0c]">BRANDS</span>
            </h3>
            <p className="text-gray-400 mb-6">Behind every Sound It event is:</p>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {[
                'Structured leadership',
                'Financial accountability',
                'Coordinated execution',
                'Strong audience engagement',
                'Clear long-term vision',
              ].map((item) => (
                <span key={item} className="px-4 py-2 rounded-full bg-white/5 text-gray-300 text-sm border border-white/10">
                  {item}
                </span>
              ))}
            </div>
            <p className="text-gray-400 font-medium">
              We are not just event organizers, we are an organized entertainment company building sustainable cultural experiences.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-8 md:p-12 text-center border border-[#d3da0c]/10"
          >
            <span className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4">
              Get In Touch
            </span>
            <h2 className="text-3xl md:text-4xl font-display text-white mb-4">
              WORK WITH <span className="text-[#d3da0c]">SOUND IT</span>
            </h2>
            <p className="text-gray-400 text-base leading-relaxed max-w-2xl mx-auto mb-8">
              For event bookings, partnerships, brand collaborations, and creative services,
              reach out through our contact page. We work with artists, brands, venues,
              and businesses across Africa, China, and international markets.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="/contact"
                className="px-8 py-3 bg-[#d3da0c] text-black font-semibold rounded-full hover:bg-[#bbc10b] transition-colors"
              >
                Contact Us
              </a>
              <a
                href="/events"
                className="px-8 py-3 border border-white/20 text-white font-semibold rounded-full hover:border-[#d3da0c]/60 hover:text-[#d3da0c] transition-colors"
              >
                Explore Events
              </a>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
};

export default About;
