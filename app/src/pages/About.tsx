import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Users, Globe, Award, Zap, Music, Ticket, BarChart3, Headphones, PartyPopper, Heart, Code2 } from 'lucide-react';

const About = () => {
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
    },
    {
      icon: Music,
      name: 'RNB & Slow Sessions',
      description: "RNB & Slow Sessions is Sound It's signature event series dedicated to soulful music, R&B, slow jams, Afro-R&B, and timeless classics. Since its launch, the series has successfully hosted multiple editions, creating intimate experiences for music lovers while building a loyal and growing community around quality music and nightlife culture.",
      status: 'Active',
    },
    {
      icon: Globe,
      name: 'BOA Festival',
      description: 'BOA Festival is a premium festival concept currently in development and planned for launch in 2026, designed to bring together African, Chinese, and international artists through large-scale cultural programming.',
      status: 'In Development',
    },
    {
      icon: Code2,
      name: 'Sound It Tech',
      description: 'Sound It Tech is the technology and creative services division of Sound It, focused on software development, mobile applications, website development, graphic design, branding, IT solutions, and digital innovation.',
      status: 'Active',
    },
    {
      icon: Zap,
      name: 'Sound It Platform',
      description: 'Sound It Platform is the flagship digital ecosystem connecting the entertainment industry in one place. The platform enables event organizers, artists, DJs, photographers, dancers, vendors, venues, businesses, and fans to discover opportunities, promote services, sell tickets, manage bookings, and grow their presence through powerful networking and business tools.',
      status: 'Active',
    },
    {
      icon: Headphones,
      name: 'Sound It Muzik',
      description: 'Sound It Muzik is a music streaming, discovery, and distribution platform focused on empowering independent artists, beginning with Sierra Leone and expanding across Africa. The platform aims to provide artists with greater visibility, direct fan engagement, distribution opportunities, performance analytics, and monetization tools while promoting African music globally.',
      status: 'In Development',
    },
    {
      icon: BarChart3,
      name: 'Sound It DJ',
      description: 'Sound It DJ is a specialized ecosystem built for DJs and music curators. The platform will offer profile management, booking opportunities, performance tracking, playlist management, audience analytics, and career development tools, enabling DJs to make data-driven decisions and grow their professional presence within the entertainment industry.',
      status: 'In Development',
    },
    {
      icon: Users,
      name: 'Deck Salone',
      description: 'Deck Salone is a planned, pre-launch Sierra Leone-focused DJ and entertainment ecosystem supporting DJs, promoters, event organizers, venues, brands, and music fans.',
      status: 'Pre-launch',
    },
  ];

  const philosophy = [
    'Authentic culture over trends',
    'Quality over volume',
    'Community over hype',
    'Long-term value over short-term wins',
  ];

  return (
    <div className="min-h-screen pt-20 pb-24">
      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1920&h=1080&fit=crop')`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A] via-transparent to-[#0A0A0A]" />
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
      <section className="py-24 bg-[#111111]">
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
              return (
                <motion.div
                  key={entity.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  viewport={{ once: true }}
                  className="glass rounded-2xl p-6 hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center group-hover:bg-[#d3da0c]/20 transition-colors">
                      <Icon className="w-6 h-6 text-[#d3da0c]" />
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${entity.status === 'Active'
                      ? 'bg-[#d3da0c]/10 text-[#d3da0c]'
                      : entity.status === 'Launching 2026' || entity.status === 'Launching Soon'
                        ? 'bg-purple-500/10 text-purple-400'
                        : entity.status === 'Partner Project'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-white/5 text-gray-400'
                      }`}>
                      {entity.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{entity.name}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{entity.description}</p>
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
      <section className="py-24 bg-[#111111]">
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
      <section className="py-24 bg-[#111111]">
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
      <section className="py-24 bg-[#111111]">
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

          {/* Collaborator Cards */}
          <div className="space-y-8">
            {/* DJ Akio */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl overflow-hidden"
            >
              <div className="grid md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
                <div className="aspect-square md:aspect-auto overflow-hidden">
                  <img
                    src="/collab_dj_akio.jpg"
                    alt="DJ Akio"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-display text-white">DJ AKIO</h3>
                    <span className="text-xs px-3 py-1 rounded-full bg-[#d3da0c]/10 text-[#d3da0c] font-medium">2025</span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">
                    Internationally recognized RNB and Afrobeats DJ known for high-energy sets and refined music
                    curation across global nightlife scenes. Japanese origin, raised in the US, based in South Africa.
                  </p>
                  <div className="glass rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Event Hosted</p>
                    <p className="text-white text-sm font-medium">1st Anniversary, RNB & Slow Sessions</p>
                    <p className="text-gray-500 text-xs">May 31, 2025 | Highline Rooftop</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">International-level experience</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">RNB & lifestyle positioning</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">Key brand milestone</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Eva Modika */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl overflow-hidden"
            >
              <div className="grid md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
                <div className="aspect-square md:aspect-auto overflow-hidden">
                  <img
                    src="/collab_eva_modika.jpg"
                    alt="Eva Modika"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-display text-white">EVA MODIKA</h3>
                    <span className="text-xs px-3 py-1 rounded-full bg-[#d3da0c]/10 text-[#d3da0c] font-medium">2025</span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">
                    South African DJ, media personality, and nightlife influencer known for her bold presence
                    and strong audience engagement across Southern Africa.
                  </p>
                  <div className="glass rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Event Hosted</p>
                    <p className="text-white text-sm font-medium">Sound of the South</p>
                    <p className="text-gray-500 text-xs">October 3, 2025 | Synth Club</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">Southern African club culture</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">Expanded African audience</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">High-energy night of 2025</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* DJ Kaywise */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl overflow-hidden"
            >
              <div className="grid md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
                <div className="aspect-square md:aspect-auto overflow-hidden">
                  <img
                    src="/collab_dj_kaywise.jpg"
                    alt="DJ Kaywise"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-display text-white">DJ KAYWISE</h3>
                    <span className="text-xs px-3 py-1 rounded-full bg-[#d3da0c]/10 text-[#d3da0c] font-medium">2025</span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">
                    Internationally celebrated Nigerian DJ with a strong reputation in Afrobeats and global club
                    culture, having performed across Africa, Europe, and beyond.
                  </p>
                  <div className="glass rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Event Hosted</p>
                    <p className="text-white text-sm font-medium">Synth Club Grand Opening</p>
                    <p className="text-gray-500 text-xs">October 18, 2025 | Synth Club</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">Premium international nightlife</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">Brand prestige & visibility</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">Landmark event</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Master Wen */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl overflow-hidden"
            >
              <div className="grid md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
                <div className="aspect-square md:aspect-auto overflow-hidden">
                  <img
                    src="/collab_master_wen.jpg"
                    alt="Master Wen"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-display text-white">MASTER WEN</h3>
                    <span className="text-xs px-3 py-1 rounded-full bg-[#d3da0c]/10 text-[#d3da0c] font-medium">2025</span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">
                    Prominent Chinese social media personality and influencer with over 760,000+ followers,
                    known for strong online engagement and youth market influence.
                  </p>
                  <div className="glass rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Event Hosted</p>
                    <p className="text-white text-sm font-medium">RNB & Slow Sessions 9th Edition</p>
                    <p className="text-gray-500 text-xs">December 20, 2025 | Highline Rooftop</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">Chinese market visibility</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">Cross-cultural bridge</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">Digital reach</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* DJ Neptune */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl overflow-hidden"
            >
              <div className="grid md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
                <div className="aspect-square md:aspect-auto overflow-hidden">
                  <img
                    src="/collab_dj_neptune.jpg"
                    alt="DJ Neptune"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-display text-white">DJ NEPTUNE</h3>
                    <span className="text-xs px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 font-medium">2024</span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">
                    Globally recognized Nigerian DJ and producer with international touring credentials and
                    collaborations with major Afrobeats artists. Headies Award winner.
                  </p>
                  <div className="glass rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Event Hosted</p>
                    <p className="text-white text-sm font-medium">Sound It Events 2024 International Showcase</p>
                    <p className="text-gray-500 text-xs">2024 | Shanghai</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">Early international credibility</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">Afrobeats community</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">Foundation for 2025 expansion</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

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
      <section className="py-24 bg-[#111111]">
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
