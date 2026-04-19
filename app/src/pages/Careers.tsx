import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Globe, Zap, Heart, Mail, Rocket, Users, Code, Palette, Megaphone, MessageCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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

const values = [
  {
    icon: Zap,
    title: 'Fast-moving and innovative',
    description: 'We embrace change and constantly explore new ideas.',
  },
  {
    icon: Users,
    title: 'Collaborative and inclusive',
    description: 'Great things happen when diverse minds work together.',
  },
  {
    icon: Heart,
    title: 'Driven by impact',
    description: 'We build with purpose and measure success by the value we create.',
  },
];

const opportunities = [
  { title: 'Software Development', icon: Code },
  { title: 'Product Design', icon: Palette },
  { title: 'Marketing & Growth', icon: Megaphone },
  { title: 'Community Management', icon: MessageCircle },
  { title: 'Operations', icon: Briefcase },
];

const Careers = () => {
  useEffect(() => {
    document.title = 'Careers | Sound It';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Join the Sound It team. Explore remote opportunities in software, design, marketing, and operations.');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A0A0A] to-[#111111]">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
          <div className="w-96 h-96 bg-[#d3da0c] rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white">
              Join the <span className="text-[#d3da0c]">Team</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              Join the team building the future of events. At Sound It, we are passionate about innovation, creativity, and community.
            </p>
            <a href="mailto:careers@soundit.com">
              <Button className="bg-[#d3da0c] text-black hover:bg-[#bbc10b]">
                <Mail className="w-4 h-4 mr-2" />
                Send Your CV
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Why Work With Us */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Why Work With Us</h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-6">
                We are building a platform that connects people and empowers creators worldwide. If you love fast-paced environments, creative problem solving, and making a real impact, you will feel at home here.
              </p>
              <div className="flex items-center gap-3 text-gray-300">
                <Globe className="w-5 h-5 text-[#d3da0c]" />
                <span>Remote & global work environment</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <Card className="bg-[#111111] border-white/10">
                <CardContent className="p-6">
                  <Rocket className="w-8 h-8 text-[#d3da0c] mb-3" />
                  <h3 className="text-white font-semibold mb-1">Innovation</h3>
                  <p className="text-sm text-gray-400">Shape the future of events and entertainment.</p>
                </CardContent>
              </Card>
              <Card className="bg-[#111111] border-white/10">
                <CardContent className="p-6">
                  <Globe className="w-8 h-8 text-[#d3da0c] mb-3" />
                  <h3 className="text-white font-semibold mb-1">Global Reach</h3>
                  <p className="text-sm text-gray-400">Work on products used across continents.</p>
                </CardContent>
              </Card>
              <Card className="bg-[#111111] border-white/10">
                <CardContent className="p-6">
                  <Heart className="w-8 h-8 text-[#d3da0c] mb-3" />
                  <h3 className="text-white font-semibold mb-1">Community</h3>
                  <p className="text-sm text-gray-400">Be part of a passionate, people-first team.</p>
                </CardContent>
              </Card>
              <Card className="bg-[#111111] border-white/10">
                <CardContent className="p-6">
                  <Zap className="w-8 h-8 text-[#d3da0c] mb-3" />
                  <h3 className="text-white font-semibold mb-1">Growth</h3>
                  <p className="text-sm text-gray-400">Learn fast and level up your career.</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Culture */}
      <section className="py-20 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Our Culture</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">What defines life at Sound It.</p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {values.map((value) => (
              <motion.div key={value.title} variants={itemVariants}>
                <Card className="bg-[#111111] border-white/10 hover:border-[#d3da0c]/30 transition-all h-full">
                  <CardContent className="p-6">
                    <value.icon className="w-10 h-10 text-[#d3da0c] mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">{value.title}</h3>
                    <p className="text-gray-400 text-sm">{value.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Opportunities */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Opportunities</h2>
            <p className="text-gray-400">We are always looking for talented individuals in:</p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {opportunities.map((role) => (
              <motion.div key={role.title} variants={itemVariants}>
                <Card className="bg-[#111111] border-white/10 hover:border-[#d3da0c]/30 transition-all cursor-pointer group">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center">
                      <role.icon className="w-5 h-5 text-[#d3da0c]" />
                    </div>
                    <span className="text-white font-medium flex-1">{role.title}</span>
                    <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-[#d3da0c] group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Internships */}
      <section className="py-20 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Internship Programs</h2>
            <p className="text-gray-400 mb-8">
              We offer opportunities for students and early-career professionals to gain real-world experience.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">How to Apply</h2>
            <p className="text-gray-400 mb-8 text-lg">
              Send your CV and portfolio to: <a href="mailto:careers@soundit.com" className="text-[#d3da0c] hover:underline">careers@soundit.com</a>
            </p>
            <a href="mailto:careers@soundit.com">
              <Button className="bg-[#d3da0c] text-black hover:bg-[#bbc10b]">
                <Mail className="w-4 h-4 mr-2" />
                Apply Now
              </Button>
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Careers;
