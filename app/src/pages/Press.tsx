import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, Mail, Download, Image as ImageIcon, FileText, Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const Press = () => {
  useEffect(() => {
    document.title = 'Press | Sound It';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Learn about Sound It, our story, mission, vision, and media resources.');
    }
  }, []);

  const brandAssets = [
    {
      title: 'Brand Kit',
      description: 'Logos, colors, and brand guidelines.',
      icon: Palette,
      action: 'Download Brand Kit',
    },
    {
      title: 'Press Images',
      description: 'High-resolution images for media use.',
      icon: ImageIcon,
      action: 'Download Press Images',
    },
    {
      title: 'Fact Sheet',
      description: 'Company overview and key facts.',
      icon: FileText,
      action: 'Download Fact Sheet',
    },
  ];

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#d3da0c]/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#d3da0c]/10 rounded-full blur-[150px]" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d3da0c]/10 border border-[#d3da0c]/20 mb-6">
              <Newspaper className="w-4 h-4 text-[#d3da0c]" />
              <span className="text-sm text-[#d3da0c] font-medium">Press Room</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6">
              Press & <span className="text-[#d3da0c]">Media</span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-400 leading-relaxed">
              Learn about Sound It, our story, and how we are connecting communities through events and entertainment.
            </p>
          </motion.div>
        </div>
      </section>

      {/* About + Story */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">About Sound It</h2>
              <p className="text-gray-400 leading-relaxed mb-6">
                Sound It is a digital platform designed to connect people through events, entertainment, and community experiences. From local gatherings to large-scale productions, Sound It empowers organizers and venues to reach their audience effectively.
              </p>
              <h3 className="text-xl font-semibold text-white mb-2">Our Story</h3>
              <p className="text-gray-400 leading-relaxed">
                Founded in 2020, Sound It began as a vision to simplify event discovery and empower creators. After initial development in China, the platform expanded to serve communities globally, with a strong focus on emerging markets like Sierra Leone.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="glass h-full">
                <CardHeader>
                  <CardTitle className="text-xl text-white">At a Glance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-gray-400">Founded</span>
                    <span className="text-white">2020</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-gray-400">Founder</span>
                    <span className="text-white">Frederick Julian Max-Macauley (Fred Max)</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-gray-400">Focus Markets</span>
                    <span className="text-white">China, Sierra Leone, Global</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Mission</span>
                    <span className="text-white">Make events accessible & engaging</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 md:py-24 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            <motion.div variants={itemVariants}>
              <Card className="glass h-full">
                <CardContent className="p-8">
                  <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center mb-4">
                    <span className="text-xl font-bold text-[#d3da0c]">M</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Mission</h3>
                  <p className="text-gray-400 leading-relaxed">
                    To empower communities by making events more accessible, discoverable, and engaging.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card className="glass h-full">
                <CardContent className="p-8">
                  <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center mb-4">
                    <span className="text-xl font-bold text-[#d3da0c]">V</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Vision</h3>
                  <p className="text-gray-400 leading-relaxed">
                    To become a global hub for event experiences and digital entertainment.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Brand Assets */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <motion.div variants={itemVariants} className="mb-12">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">Media Resources</h2>
              <p className="text-gray-400">For logos, brand assets, and press kits, please contact us or download below.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {brandAssets.map((asset) => (
                <motion.div key={asset.title} variants={itemVariants}>
                  <Card className="glass h-full group hover:border-[#d3da0c]/30 transition-all duration-300">
                    <CardContent className="p-6 flex flex-col h-full">
                      <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center mb-4 group-hover:bg-[#d3da0c]/20 transition-colors">
                        <asset.icon className="w-6 h-6 text-[#d3da0c]" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{asset.title}</h3>
                      <p className="text-gray-400 text-sm mb-4 flex-grow">{asset.description}</p>
                      <Button
                        variant="outline"
                        className="w-full border-[#d3da0c]/30 text-[#d3da0c] hover:bg-[#d3da0c] hover:text-black"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {asset.action}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 md:py-24 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">Press Inquiries</h2>
            <p className="text-gray-400 mb-8">For interview requests, press kits, and media partnerships.</p>
            <a 
              href="mailto:press@soundit.com"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#d3da0c]/10 text-[#d3da0c] hover:bg-[#d3da0c]/20 transition-colors"
            >
              <Mail className="w-4 h-4" />
              press@soundit.com
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Press;
