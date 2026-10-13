import { useEffect } from 'react';
import { ArrowUpRight, Camera, ExternalLink, Image as ImageIcon } from 'lucide-react';

const articleTitle = 'BEATZ OF AFRIKA 2026: A Landmark Celebration of African Music, Culture and Creativity in Shanghai';
const seoTitle = 'BEATZ OF AFRIKA 2026 Shanghai Festival | Sound It Entertainment';
const articleDescription = 'Discover the story of BEATZ OF AFRIKA 2026 in Shanghai, presented by Sound It Entertainment, celebrating African artists, music, culture, creativity, and international collaboration.';
const articleUrl = 'https://sounditent.com/news/beatz-of-afrika-2026-shanghai-recap';
const robotsContent = 'noindex, nofollow';

const artists = [
  {
    name: 'Babalwa',
    description: 'A featured performer representing South Africa at the inaugural festival.',
  },
  {
    name: 'Funky Qla',
    description: 'South African DJ and producer featured among the festival’s international acts.',
  },
  {
    name: 'Crayon',
    description: 'Nigerian recording artist featured as part of the international lineup.',
  },
  {
    name: 'Eva Modika',
    description: 'South African entertainer and DJ featured at the inaugural edition.',
  },
  {
    name: 'DJ Melzi',
    description: 'South African DJ and producer featured in the festival program.',
  },
  {
    name: 'ChisWay',
    description: 'China-based artist contributing to African music experiences in China.',
  },
];

const sections = [
  {
    id: 'beginning',
    title: 'The Beginning of Something Bigger',
    paragraphs: [
      'In October 2026, Sound It Entertainment brought a bold vision to life with the inaugural edition of BEATZ OF AFRIKA, a two-day African music and cultural festival held in Shanghai on October 3 and 4, during China’s National Day holiday period.',
      'More than an entertainment event, BEATZ OF AFRIKA was created to celebrate the richness, diversity, and global influence of African music while building meaningful connections between African artists, music lovers, creative communities, and international audiences.',
      'Hosted at Most Club in Shanghai, the first edition brought together international performers, local artists, DJs, hosts, and music enthusiasts for a celebration inspired by the sounds and spirit of Africa. It marked an important milestone for Sound It Entertainment and the beginning of a longer-term festival vision.',
    ],
  },
  {
    id: 'bringing-africas-sound',
    title: 'Bringing Africa’s Sound to Shanghai',
    paragraphs: [
      'African music continues to influence dance floors, streaming platforms, fashion, youth culture, and popular music around the world. From Afrobeats and Amapiano to Afro-house and other contemporary African sounds, the continent’s creative influence crosses borders and connects audiences from different backgrounds.',
      'BEATZ OF AFRIKA was conceived with this movement in mind: to give audiences in China an opportunity to engage with African music through live performances, DJ sets, dance, and a shared appreciation of the continent’s creative diversity.',
      'The ambition was not simply to organize another party. It was to establish a platform capable of bringing artists from different countries together, creating opportunities for local talent, and introducing more audiences to the depth and variety of African music and culture.',
    ],
  },
  {
    id: 'international-lineup',
    title: 'An International Lineup Celebrating African Talent',
    paragraphs: [
      'One of the defining elements of BEATZ OF AFRIKA 2026 was its international lineup, featuring artists associated with contemporary African music alongside local performers and DJs contributing to Shanghai’s multicultural music community.',
      'The festival featured performers from South Africa and Nigeria, bringing different sounds, artistic backgrounds, and audiences together. Their participation reflected the festival’s ambition to connect Shanghai audiences with African talent and a wider global music movement.',
    ],
  },
  {
    id: 'local-community',
    title: 'Celebrating the Local Artists and Creative Community',
    paragraphs: [
      'While international performers helped define the festival’s reach, local artists, DJs, hosts, and creative collaborators were equally important. BEATZ OF AFRIKA was designed as a space where local talent could share the stage with international performers and take part in the continued development of African music events in China.',
      'From performances and DJ sets to hosting and audience engagement, the wider creative community contributed to bringing the festival’s vision to life. Cultural platforms grow through the people who support them, and the inaugural edition recognized the local creativity, commitment, and community spirit behind the experience.',
    ],
  },
  {
    id: 'two-days',
    title: 'Two Days of Music, Culture and Connection',
    paragraphs: [
      'Held across October 3 and 4, the festival was designed as a two-day experience bringing together live entertainment, DJ culture, and an international audience.',
      'Its program reflected a central idea: African music is diverse, constantly evolving, and capable of connecting people across languages, nationalities, and cultural backgrounds. The National Day holiday timing offered an opportunity to bring that celebration to audiences enjoying Shanghai’s entertainment and nightlife scene.',
    ],
  },
  {
    id: 'vision',
    title: 'The Vision Behind BEATZ OF AFRIKA',
    paragraphs: [
      'BEATZ OF AFRIKA was developed as part of Sound It Entertainment’s broader vision of building creative platforms that connect music, culture, technology, and communities.',
      'African music deserves platforms that do more than provide a stage. It needs spaces that support artists, encourage cross-border collaboration, strengthen cultural visibility, and create opportunities for the next generation of African and international creatives.',
      'Shanghai provides an important starting point for a platform with ambitions to grow, collaborate internationally, and create further opportunities for African music and culture in China and beyond. The inaugural festival established the foundation for that journey.',
    ],
  },
  {
    id: 'lessons',
    title: 'Lessons, Growth and the Road Ahead',
    paragraphs: [
      'Every first edition is both an achievement and a learning experience. Bringing an international festival to life requires coordination across artists, venues, production, travel, marketing, ticketing, hospitality, and audience engagement. It also requires resilience, collaboration, and the ability to respond to challenges while protecting the creative vision behind the event.',
      'For Sound It Entertainment, BEATZ OF AFRIKA 2026 was an opportunity to put its vision into practice, gain experience, and identify areas for continued development. Those lessons will inform future planning, strengthen operational processes, and help shape the next stage of the festival.',
      'The objective is to build on this foundation with stronger partnerships, expanded audience engagement, improved event experiences, and more opportunities for artists and creative collaborators. The first edition was an important beginning, and the lessons gained from it will remain part of the festival’s continuing story.',
    ],
  },
  {
    id: 'thank-you',
    title: 'A Thank You to Everyone Who Made It Possible',
    paragraphs: [
      'Sound It Entertainment extends its sincere appreciation to every artist, DJ, MC, partner, collaborator, team member, supporter, ticket holder, and guest who contributed to BEATZ OF AFRIKA 2026.',
      'To the international performers who joined us in Shanghai, thank you for bringing your talent and creativity to the festival. To the local artists and DJs, thank you for contributing your time, energy, and performances. Your involvement is central to the community we aim to build.',
      'To our hosts, production teams, venue collaborators, and everyone working behind the scenes, thank you for the commitment required to bring this vision to life. And to everyone who supported the project, attended, or encouraged it from the beginning, your support helped make the inaugural edition possible.',
      'A festival is never the work of one person or one organization alone. It is built through collective effort, trust, creativity, and a shared belief in what is possible. BEATZ OF AFRIKA 2026 belongs to everyone who played a part in its journey.',
    ],
  },
  {
    id: 'future',
    title: 'Looking Towards the Future',
    paragraphs: [
      'The first edition of BEATZ OF AFRIKA is now part of Sound It Entertainment’s history and the foundation of a larger ambition. Our commitment remains to celebrating African music, creating meaningful cultural experiences, connecting artists with audiences, and developing platforms that can grow beyond geographical boundaries.',
      'We envision future editions that expand the festival’s reach, welcome more artists from across the continent, strengthen partnerships, and create new opportunities for cultural exchange between Africa, China, and the wider world.',
      'This is more than a festival. It is a platform for expression, discovery, collaboration, and connection. BEATZ OF AFRIKA has begun its journey. And this is only the beginning.',
    ],
  },
];

const BeatzOfAfrikaRecap = () => {
  useEffect(() => {
    const priorTitle = document.title;
    document.title = seoTitle;

    const previousMeta = new Map<string, { element: HTMLMetaElement | null; content: string | null }>();
    const metaContent: [string, string, string][] = [
      ['name', 'description', articleDescription],
      ['name', 'robots', robotsContent],
      ['property', 'og:title', articleTitle],
      ['property', 'og:description', articleDescription],
      ['property', 'og:type', 'article'],
      ['property', 'og:url', articleUrl],
      ['name', 'twitter:card', 'summary'],
      ['name', 'twitter:title', articleTitle],
      ['name', 'twitter:description', articleDescription],
    ];

    metaContent.forEach(([attribute, value, content]) => {
      const selector = `meta[${attribute}="${value}"]`;
      let element = document.querySelector<HTMLMetaElement>(selector);
      previousMeta.set(selector, { element, content: element?.content ?? null });
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, value);
        document.head.appendChild(element);
      }
      element.content = content;
    });

    const priorCanonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const priorCanonicalHref = priorCanonical?.href ?? null;
    const canonical = priorCanonical ?? document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = articleUrl;
    if (!priorCanonical) document.head.appendChild(canonical);

    const structuredData = document.createElement('script');
    structuredData.type = 'application/ld+json';
    structuredData.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: articleTitle,
      description: articleDescription,
      mainEntityOfPage: articleUrl,
      author: { '@type': 'Organization', name: 'Sound It Entertainment' },
      publisher: {
        '@type': 'Organization',
        name: 'Sound It Entertainment',
        url: 'https://sounditent.com',
      },
    });
    document.head.appendChild(structuredData);

    return () => {
      document.title = priorTitle;
      previousMeta.forEach(({ element, content }, selector) => {
        if (element && content !== null) {
          element.content = content;
        } else if (element) {
          element.remove();
        } else {
          document.querySelector(selector)?.remove();
        }
      });
      if (priorCanonical) {
        if (priorCanonicalHref) priorCanonical.href = priorCanonicalHref;
      } else {
        canonical.remove();
      }
      structuredData.remove();
    };
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="border-b border-amber-300/30 bg-amber-300/10 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#F4E059]">
        Editorial preview · Not published · Photography pending verification
      </div>

      <header className="relative isolate overflow-hidden border-b border-white/10">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute -right-24 -top-20 h-96 w-96 rounded-full bg-[#CEB100]/15 blur-[120px]" />
          <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-[#F4E059]/10 blur-[120px]" />
          <div className="absolute inset-0 bg-[linear-gradient(125deg,transparent_0%,rgba(244,224,89,0.04)_50%,transparent_50%)]" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-12">
          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-[#F4E059]">
              Sound It Entertainment presents
            </p>
            <p className="mb-4 text-sm uppercase tracking-[0.18em] text-white/60">
              Inaugural edition · October 3–4, 2026 · Shanghai, China
            </p>
            <h1 className="max-w-4xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
              BEATZ OF AFRIKA 2026:
              <span className="mt-2 block text-[#F4E059]">
                A Landmark Celebration of African Music, Culture and Creativity in Shanghai
              </span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
              Two days. One continent of sound. A shared vision for the future of African music and culture.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/55">
              <span>Most Club</span>
              <span aria-hidden="true">/</span>
              <span>Shanghai, China</span>
              <span aria-hidden="true">/</span>
              <span>Presented by Sound It Entertainment</span>
            </div>
          </div>

          <div
            role="img"
            aria-label="Branded editorial artwork placeholder; official BEATZ OF AFRIKA 2026 festival image has not yet been supplied"
            className="relative flex min-h-64 items-center justify-center overflow-hidden border border-[#F4E059]/30 bg-[#090909] px-6 py-12 text-center sm:min-h-80"
          >
            <div aria-hidden="true" className="absolute inset-5 border border-[#F4E059]/10" />
            <div aria-hidden="true" className="absolute h-48 w-48 rounded-full border border-[#F4E059]/20 sm:h-60 sm:w-60" />
            <div className="relative">
              <p className="text-6xl font-black tracking-tighter text-[#F4E059] sm:text-8xl">BOA</p>
              <p className="mt-1 text-2xl font-bold tracking-[0.4em] text-white sm:text-3xl">2026</p>
              <p className="mx-auto mt-5 max-w-xs text-xs uppercase leading-relaxed tracking-[0.15em] text-white/50">
                Editorial artwork only
                <br />
                Official festival photograph pending
              </p>
            </div>
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-7xl px-5 py-14 sm:px-8 md:py-20 lg:px-12">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-20">
          <div className="min-w-0">
            <section aria-labelledby="introduction" className="mb-16 border-l-2 border-[#F4E059] pl-5 sm:pl-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#F4E059]">The story</p>
              <h2 id="introduction" className="mb-5 text-2xl font-bold sm:text-3xl">
                A first edition with a wider purpose
              </h2>
              <p className="max-w-3xl text-lg leading-8 text-white/75">
                BEATZ OF AFRIKA was created to celebrate the richness and global influence of African music, bring artists and audiences together, and build a platform for creative exchange. Its inaugural Shanghai edition marked the start of that journey—not its conclusion.
              </p>
            </section>

            {sections.slice(0, 3).map((section) => (
              <section key={section.id} aria-labelledby={section.id} className="mb-14 scroll-mt-24">
                <h2 id={section.id} className="mb-5 border-b border-white/10 pb-4 text-2xl font-bold sm:text-3xl">
                  {section.title}
                </h2>
                <div className="space-y-5">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-base leading-8 text-white/70">{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}

            <section aria-labelledby="featured-artists" className="mb-16">
              <div className="mb-7">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#F4E059]">The lineup</p>
                <h2 id="featured-artists" className="text-3xl font-bold sm:text-4xl">Featured International Artists</h2>
                <p className="mt-3 max-w-3xl leading-7 text-white/60">
                  These acts were featured in the inaugural festival brief. Verified artist portraits and profile links have not yet been provided, so the cards below intentionally use labeled placeholders rather than unverified photographs.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {artists.map((artist, index) => (
                  <article key={artist.name} className="overflow-hidden border border-white/10 bg-white/[0.025]">
                    <div
                      role="img"
                      aria-label={`Portrait placeholder for ${artist.name}; verified artist image pending`}
                      className="flex aspect-[4/3] items-center justify-center border-b border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(244,224,89,0.12),transparent_55%),linear-gradient(145deg,#151515,#080808)]"
                    >
                      <div className="text-center">
                        <span className="block text-5xl font-black text-[#F4E059]/80">{String(index + 1).padStart(2, '0')}</span>
                        <span className="mt-2 block text-[10px] uppercase tracking-[0.18em] text-white/45">Verified portrait pending</span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-xl font-bold">{artist.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/60">{artist.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section aria-labelledby="festival-gallery" className="mb-16">
              <div className="mb-6 flex items-start gap-3">
                <Camera className="mt-1 h-5 w-5 shrink-0 text-[#F4E059]" aria-hidden="true" />
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#F4E059]">In pictures</p>
                  <h2 id="festival-gallery" className="text-3xl font-bold sm:text-4xl">Festival Gallery</h2>
                </div>
              </div>
              <div className="border border-dashed border-[#F4E059]/40 bg-[#F4E059]/[0.035] p-6 sm:p-8">
                <ImageIcon className="mb-4 h-7 w-7 text-[#F4E059]" aria-hidden="true" />
                <h3 className="text-lg font-semibold">Official event photographs are still needed</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                  No verified photographs from the October 3–4, 2026 festival were present in the available project media. This draft does not use unrelated venue, crowd, promotional, or stock images as event documentation.
                </p>
                <p className="mt-4 text-xs uppercase tracking-[0.12em] text-white/40">
                  Stage · performances · audience · production · group moments
                </p>
              </div>
            </section>

            {sections.slice(3).map((section) => (
              <section key={section.id} aria-labelledby={section.id} className="mb-14 scroll-mt-24">
                <h2 id={section.id} className="mb-5 border-b border-white/10 pb-4 text-2xl font-bold sm:text-3xl">
                  {section.title}
                </h2>
                <div className="space-y-5">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-base leading-8 text-white/70">{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}

            <section aria-labelledby="about-boa" className="mb-10 grid gap-6 border-t border-white/10 pt-10 md:grid-cols-2">
              <div>
                <h2 id="about-boa" className="mb-3 text-xl font-bold text-[#F4E059]">About BEATZ OF AFRIKA</h2>
                <p className="text-sm leading-7 text-white/65">
                  BEATZ OF AFRIKA is an African music and cultural festival platform developed by Sound It Entertainment. Based in Shanghai, China, the platform celebrates African music, artistic expression, and cultural creativity while connecting artists, audiences, and communities through live experiences and international collaboration.
                </p>
              </div>
              <div>
                <h2 className="mb-3 text-xl font-bold text-[#F4E059]">About Sound It Entertainment</h2>
                <p className="text-sm leading-7 text-white/65">
                  Sound It Entertainment is a multidisciplinary entertainment, music, events, media, and technology company founded by Frederick Julian Max-Macauley, professionally known as Fred Max. The company develops creative projects, cultural experiences, and digital platforms designed to connect people and create opportunities across the entertainment and creative industries.
                </p>
              </div>
            </section>

            <section aria-label="Festival links" className="border border-[#F4E059]/25 bg-[#F4E059]/[0.06] p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F4E059]">The journey continues</p>
              <h2 className="mt-3 text-2xl font-black sm:text-3xl">BEATZ OF AFRIKA</h2>
              <p className="mt-2 text-sm text-white/65">Celebrating African Music, Culture &amp; Creativity</p>
              <p className="mt-5 text-sm italic text-white/70">The first edition was the beginning. The journey continues.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="https://boa.sounditent.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 bg-[#F4E059] px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-white"
                >
                  Visit BEATZ OF AFRIKA <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="https://www.instagram.com/beatzofafrika/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 border border-white/20 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-[#F4E059] hover:text-[#F4E059]"
                >
                  Instagram <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="https://sounditent.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 border border-white/20 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-[#F4E059] hover:text-[#F4E059]"
                >
                  Sound It Entertainment <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-28 border-l border-white/10 pl-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#F4E059]">In this story</p>
              <nav aria-label="Article sections" className="space-y-3">
                {[
                  ...sections.map(({ id, title }) => ({ id, title })),
                  { id: 'featured-artists', title: 'Featured artists' },
                  { id: 'festival-gallery', title: 'Festival gallery' },
                  { id: 'about-boa', title: 'About the brands' },
                ].map(({ id, title }) => (
                  <a key={id} href={`#${id}`} className="block text-sm leading-5 text-white/55 transition-colors hover:text-[#F4E059]">
                    {title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      </article>
    </main>
  );
};

export default BeatzOfAfrikaRecap;
