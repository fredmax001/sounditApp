import json
import sys
import re
from pathlib import Path

base_dir = Path('/Users/djfredmax/Desktop/SOUND IT WEB APP COMPLETE/app')
result = {}

# ===================== Help.tsx =====================
help_path = base_dir / 'src/pages/Help.tsx'
help_content = help_path.read_text()

help_content = help_content.replace(
    "import { useEffect, useState } from 'react';",
    "import { useEffect, useState } from 'react';\nimport { useTranslation } from 'react-i18next';"
)
help_content = help_content.replace(
    "  const [activeCategory, setActiveCategory] = useState('all');",
    "  const { t } = useTranslation();\n  const [activeCategory, setActiveCategory] = useState('all');"
)

def faq_repl(m):
    qid = m.group(1)
    cat = m.group(2)
    q = m.group(3)
    a = m.group(4)
    result.setdefault('help', {})[f'faq.{qid}.question'] = q
    result.setdefault('help', {})[f'faq.{qid}.answer'] = a
    return f"    {{\n      id: '{qid}',\n      category: '{cat}',\n      question: t('help.faq.{qid}.question'),\n      answer: t('help.faq.{qid}.answer'),\n    }}"

help_content = re.sub(
    r"    \{\n      id: '([^']+)',\n      category: '([^']+)',\n      question: '((?:[^'\\]|\\.)*)',\n      answer: '((?:[^'\\]|\\.)*)',\n    \}",
    faq_repl,
    help_content
)

help_repls = [
    ("document.title = 'Help Center | Sound It China';", "document.title = t('help.pageTitle');", "Help Center | Sound It China"),
    ("'Find answers to your questions about events, tickets, payments, and more. Get support for Sound It China platform.'", "t('help.metaDescription')", "Find answers to your questions about events, tickets, payments, and more. Get support for Sound It China platform."),
    ("label: 'All',", "label: t('help.categories.all'),", "All"),
    ("label: 'Getting Started',", "label: t('help.categories.gettingStarted'),", "Getting Started"),
    ("label: 'Tickets & Payments',", "label: t('help.categories.ticketsPayments'),", "Tickets & Payments"),
    ("label: 'Account',", "label: t('help.categories.account'),", "Account"),
    ("label: 'For Organizers',", "label: t('help.categories.organizers'),", "For Organizers"),
    ("label: 'For Artists',", "label: t('help.categories.artists'),", "For Artists"),
    ("label: 'For Vendors',", "label: t('help.categories.vendors'),", "For Vendors"),
    ("title: 'Buy Tickets',", "title: t('help.quickLinks.buyTickets'),", "Buy Tickets"),
    ("title: 'Payment Issues',", "title: t('help.quickLinks.paymentIssues'),", "Payment Issues"),
    ("title: 'Account Settings',", "title: t('help.quickLinks.accountSettings'),", "Account Settings"),
    ("title: 'Contact Support',", "title: t('help.quickLinks.contactSupport'),", "Contact Support"),
    ('Help Center', '{t(\'help.helpCenter\')}', 'Help Center'),
    ('How can we <span className="text-[#d3da0c]">help you?</span>', '{t(\'help.heroTitle\')} <span className="text-[#d3da0c]">{t(\'help.heroHighlight\')}</span>', 'How can we help you?'),
    ('Find answers to common questions about events, tickets, payments, and more.', '{t(\'help.subtitle\')}', 'Find answers to common questions about events, tickets, payments, and more.'),
    ('Search for answers...', '{t(\'help.searchPlaceholder\')}', 'Search for answers...'),
    ('No results found', '{t(\'help.noResults\')}', 'No results found'),
    ('Try adjusting your search or browse all categories', '{t(\'help.adjustSearch\')}', 'Try adjusting your search or browse all categories'),
    ('Clear Filters', '{t(\'help.clearFilters\')}', 'Clear Filters'),
    ('Still need help?', '{t(\'help.stillNeedHelp\')}', 'Still need help?'),
    ('Our support team is here to assist you', '{t(\'help.supportTeam\')}', 'Our support team is here to assist you'),
    ('Email Support', '{t(\'help.emailSupport\')}', 'Email Support'),
    ('Avg. response: 4 hours', '{t(\'help.avgResponse\')}', 'Avg. response: 4 hours'),
    ('WeChat Support', '{t(\'help.weChatSupport\')}', 'WeChat Support'),
    ('Add us on WeChat', '{t(\'help.addOnWeChat\')}', 'Add us on WeChat'),
    ('Support Hours', '{t(\'help.supportHours\')}', 'Support Hours'),
    ('Mon - Fri: 9:00 AM - 6:00 PM', '{t(\'help.supportHoursValue\')}', 'Mon - Fri: 9:00 AM - 6:00 PM'),
    ('China Standard Time (CST)', '{t(\'help.timezone\')}', 'China Standard Time (CST)'),
    ('For urgent issues during events, please contact the event organizer directly or\n                    reach out to our on-site support team.', '{t(\'help.urgentIssues\')}', 'For urgent issues during events, please contact the event organizer directly or reach out to our on-site support team.'),
]

for old, new, value in help_repls:
    if old not in help_content:
        print(f"WARNING Help: {old[:80]}", file=sys.stderr)
    else:
        help_content = help_content.replace(old, new, 1)
        for m in re.finditer(r"t\('([^']+)'\)", new):
            k = m.group(1)
            if k.startswith('help.'):
                result.setdefault('help', {})[k[5:]] = value

help_path.write_text(help_content)

# ===================== Press.tsx =====================
press_path = base_dir / 'src/pages/Press.tsx'
press_content = press_path.read_text()

press_content = press_content.replace(
    "import { useEffect } from 'react';",
    "import { useEffect } from 'react';\nimport { useTranslation } from 'react-i18next';"
)
press_content = press_content.replace(
    'const Press = () => {\n  // SEO',
    'const Press = () => {\n    const { t } = useTranslation();\n  // SEO'
)

press_repls = [
    ("document.title = 'Press & Media | Sound It China';", "document.title = t('press.pageTitle');", "Press & Media | Sound It China"),
    ("'Media resources, press releases, and brand assets for journalists, \n      content creators, and partners covering Sound It and the Afrobeats scene in China.'", "t('press.metaDescription')", "Media resources, press releases, and brand assets for journalists, content creators, and partners covering Sound It and the Afrobeats scene in China."),
    ('Press Room', '{t(\'press.pressRoom\')}', 'Press Room'),
    ('Sound It China\n              <br />\n              <span className="text-[#d3da0c]">in the News</span>', '{t(\'press.heroTitle\')}\n              <br />\n              <span className="text-[#d3da0c]">{t(\'press.heroHighlight\')}</span>', 'Sound It China in the News'),
    ('Media resources, press releases, and brand assets for journalists, \n              content creators, and partners covering Sound It and the Afrobeats scene in China.', '{t(\'press.heroSubtitle\')}', 'Media resources, press releases, and brand assets for journalists, content creators, and partners covering Sound It and the Afrobeats scene in China.'),
    ('Downloadable Assets', '{t(\'press.downloadableAssets\')}', 'Downloadable Assets'),
    ('Official brand materials for press use. All assets are free to use with proper attribution.', '{t(\'press.assetsDescription\')}', 'Official brand materials for press use. All assets are free to use with proper attribution.'),
    ("title: 'Brand Kit',", "title: t('press.brandKitTitle'),", "Brand Kit"),
    ("description: 'Logos in PNG/SVG formats, color palette (#d3da0c, #000000), and typography guidelines'", "description: t('press.brandKitDescription')", "Logos in PNG/SVG formats, color palette (#d3da0c, #000000), and typography guidelines"),
    ("action: 'Download ZIP (2.4 MB)'", "action: t('press.downloadBrandKit')", "Download ZIP (2.4 MB)"),
    ("title: 'Press Images',", "title: t('press.pressImagesTitle'),", "Press Images"),
    ("description: 'High-resolution event photos, founder headshots, and lifestyle images'", "description: t('press.pressImagesDescription')", "High-resolution event photos, founder headshots, and lifestyle images"),
    ("action: 'Download ZIP (15.8 MB)'", "action: t('press.downloadPressImages')", "Download ZIP (15.8 MB)"),
    ("title: 'Fact Sheet',", "title: t('press.factSheetTitle'),", "Fact Sheet"),
    ("description: 'Company overview, statistics, key facts, and contact information'", "description: t('press.factSheetDescription')", "Company overview, statistics, key facts, and contact information"),
    ("action: 'Download PDF (284 KB)'", "action: t('press.downloadFactSheet')", "Download PDF (284 KB)"),
    ('Media Contact', '{t(\'press.mediaContact\')}', 'Media Contact'),
    ('For press inquiries, interview requests, and partnership opportunities, \n                please contact our press team. We typically respond within 24 hours.', '{t(\'press.mediaContactDescription\')}', 'For press inquiries, interview requests, and partnership opportunities, please contact our press team. We typically respond within 24 hours.'),
    ('Email', '{t(\'press.emailLabel\')}', 'Email'),
    ('WeChat', '{t(\'press.weChatLabel\')}', 'WeChat'),
    ('QR Code', '{t(\'press.qrCode\')}', 'QR Code'),
    ('<span className="font-semibold">Response Time:</span> Within 24 hours during business days', '<span className="font-semibold">{t(\'press.responseTimeLabel\')}</span> {t(\'press.responseTimeValue\')}', 'Response Time: Within 24 hours during business days'),
    ('Press Kit Overview', '{t(\'press.pressKitOverview\')}', 'Press Kit Overview'),
    ('Founded', '{t(\'press.foundedLabel\')}', 'Founded'),
    ('Headquarters', '{t(\'press.headquartersLabel\')}', 'Headquarters'),
    ('Events Hosted', '{t(\'press.eventsHostedLabel\')}', 'Events Hosted'),
    ('Active Users', '{t(\'press.activeUsersLabel\')}', 'Active Users'),
    ('Cities', '{t(\'press.citiesLabel\')}', 'Cities'),
    ('Languages', '{t(\'press.languagesLabel\')}', 'Languages'),
    ('Recent Press Releases', '{t(\'press.recentPressReleases\')}', 'Recent Press Releases'),
    ('Official announcements and news from Sound It China.', '{t(\'press.pressReleasesDescription\')}', 'Official announcements and news from Sound It China.'),
    ('As Seen In', '{t(\'press.asSeenIn\')}', 'As Seen In'),
    ('Featured in leading publications across China', '{t(\'press.asSeenInDescription\')}', 'Featured in leading publications across China'),
    # Press releases
    ("title: 'Sound It China Launches Beta Platform for Afrobeats Events',", "title: t('press.pressRelease1Title'),", "Sound It China Launches Beta Platform for Afrobeats Events"),
    ("summary: 'New platform connects foreigners in China with African music events, DJs, and cultural experiences.',", "summary: t('press.pressRelease1Summary'),", "New platform connects foreigners in China with African music events, DJs, and cultural experiences."),
    ("category: 'Company News',", "category: t('press.pressRelease1Category'),", "Company News"),
    ("title: 'Partnership Announced: Shanghai Afrobeat Festival 2026',", "title: t('press.pressRelease2Title'),", "Partnership Announced: Shanghai Afrobeat Festival 2026"),
    ("summary: 'Sound It becomes official ticketing partner for Shanghai\\'s largest Afrobeats music festival.'", "summary: t('press.pressRelease2Summary')", "Sound It becomes official ticketing partner for Shanghai's largest Afrobeats music festival."),
    ("category: 'Partnership',", "category: t('press.pressRelease2Category'),", "Partnership"),
    ("title: 'Sound It Raises Pre-Seed Funding for China Expansion',", "title: t('press.pressRelease3Title'),", "Sound It Raises Pre-Seed Funding for China Expansion"),
    ("summary: 'Investment will support platform development and expansion to Beijing, Guangzhou, and Shenzhen.'", "summary: t('press.pressRelease3Summary')", "Investment will support platform development and expansion to Beijing, Guangzhou, and Shenzhen."),
    ("category: 'Funding',", "category: t('press.pressRelease3Category'),", "Funding"),
]

for old, new, value in press_repls:
    if old not in press_content:
        print(f"WARNING Press: {old[:80]}", file=sys.stderr)
    else:
        press_content = press_content.replace(old, new, 1)
        for m in re.finditer(r"t\('([^']+)'\)", new):
            k = m.group(1)
            if k.startswith('press.'):
                result.setdefault('press', {})[k[6:]] = value

press_path.write_text(press_content)

# ===================== About.tsx =====================
about_path = base_dir / 'src/pages/About.tsx'
about_content = about_path.read_text()

about_content = about_content.replace(
    "import { Sparkles, Users, Globe, Award, Zap, Music, Ticket, BarChart3, Headphones, PartyPopper } from 'lucide-react';",
    "import { Sparkles, Users, Globe, Award, Zap, Music, Ticket, BarChart3, Headphones, PartyPopper } from 'lucide-react';\nimport { useTranslation } from 'react-i18next';"
)
about_content = about_content.replace(
    'const About = () => {\n  const values = [',
    'const About = () => {\n  const { t } = useTranslation();\n  const values = ['
)

# Replace values array objects
about_values_repls = [
    ("title: 'Creativity & Innovation',", "title: t('about.values.creativityInnovation.title'),", "Creativity & Innovation"),
    ("description: 'We constantly explore new ways to entertain and engage audiences.',", "description: t('about.values.creativityInnovation.description'),", "We constantly explore new ways to entertain and engage audiences."),
    ("title: 'Authenticity',", "title: t('about.values.authenticity.title'),", "Authenticity"),
    ("description: 'Every event and production reflects real music culture.',", "description: t('about.values.authenticity.description'),", "Every event and production reflects real music culture."),
    ("title: 'Community & Collaboration',", "title: t('about.values.communityCollaboration.title'),", "Community & Collaboration"),
    ("description: 'We build bridges between artists, brands, and audiences.',", "description: t('about.values.communityCollaboration.description'),", "We build bridges between artists, brands, and audiences."),
    ("title: 'Excellence',", "title: t('about.values.excellence.title'),", "Excellence"),
    ("description: 'Quality and attention to detail are at the heart of every project.',", "description: t('about.values.excellence.description'),", "Quality and attention to detail are at the heart of every project."),
    ("title: 'Global Perspective',", "title: t('about.values.globalPerspective.title'),", "Global Perspective"),
    ("description: 'We merge local culture with international reach.',", "description: t('about.values.globalPerspective.description'),", "We merge local culture with international reach."),
]
for old, new, value in about_values_repls:
    about_content = about_content.replace(old, new, 1)
    for m in re.finditer(r"t\('([^']+)'\)", new):
        k = m.group(1)
        if k.startswith('about.'):
            result.setdefault('about', {})[k[6:]] = value

# Replace entities array objects (status logic kept on English values, display text translated via ternary)
about_content = about_content.replace(
    "{entity.status}",
    "{entity.status === 'Active' ? t('about.statusActive') : entity.status === 'Launching 2026' ? t('about.statusLaunching2026') : entity.status === 'Partner Project' ? t('about.statusPartnerProject') : t('about.statusInDevelopment')}"
)

about_entities_repls = [
    ("name: 'Sound It Events',", "name: t('about.entities.soundItEvents.name'),", "Sound It Events"),
    ("description: 'Curated parties, showcases, and cultural gatherings blending African and global music with modern nightlife culture.',", "description: t('about.entities.soundItEvents.description'),", "Curated parties, showcases, and cultural gatherings blending African and global music with modern nightlife culture."),
    ("name: 'RNB & Slow Sessions',", "name: t('about.entities.rnbSlowSessions.name'),", "RNB & Slow Sessions"),
    ("description: 'A signature event series dedicated to soulful music, R&B, slow jams, and timeless classics. 10+ editions hosted.',", "description: t('about.entities.rnbSlowSessions.description'),", "A signature event series dedicated to soulful music, R&B, slow jams, and timeless classics. 10+ editions hosted."),
    ("name: 'Sound It Festival',", "name: t('about.entities.soundItFestival.name'),", "Sound It Festival"),
    ("description: 'A premium indoor music and culture experience launching in 2026. Single-stage, industrial-style festival in Shanghai.',", "description: t('about.entities.soundItFestival.description'),", "A premium indoor music and culture experience launching in 2026. Single-stage, industrial-style festival in Shanghai."),
    ("name: 'Sound It Ticketing',", "name: t('about.entities.soundItTicketing.name'),", "Sound It Ticketing"),
    ("description: 'A digital ticketing platform for seamless ticket sales, audience data insights, and brand integration.',", "description: t('about.entities.soundItTicketing.description'),", "A digital ticketing platform for seamless ticket sales, audience data insights, and brand integration."),
    ("name: 'Sound It Muzik',", "name: t('about.entities.soundItMuzik.name'),", "Sound It Muzik"),
    ("description: 'A music streaming and distribution platform focused on supporting African artists, starting with Sierra Leone.',", "description: t('about.entities.soundItMuzik.description'),", "A music streaming and distribution platform focused on supporting African artists, starting with Sierra Leone."),
    ("name: 'DRICKS DJ Ecosystem',", "name: t('about.entities.dricksDJ.name'),", "DRICKS DJ Ecosystem"),
    ("description: 'A DJ-focused digital ecosystem for performance analysis, playlist management, and data-driven insights.',", "description: t('about.entities.dricksDJ.description'),", "A DJ-focused digital ecosystem for performance analysis, playlist management, and data-driven insights."),
]
for old, new, value in about_entities_repls:
    about_content = about_content.replace(old, new, 1)
    for m in re.finditer(r"t\('([^']+)'\)", new):
        k = m.group(1)
        if k.startswith('about.'):
            result.setdefault('about', {})[k[6:]] = value

# Philosophy array
about_content = about_content.replace(
    "const philosophy = [\n    'Authentic culture over trends',\n    'Quality over volume',\n    'Community over hype',\n    'Long-term value over short-term wins',\n  ];",
    "const philosophy = [\n    t('about.philosophy.authenticCulture'),\n    t('about.philosophy.qualityOverVolume'),\n    t('about.philosophy.communityOverHype'),\n    t('about.philosophy.longTermValue'),\n  ];"
)
result.setdefault('about', {})['philosophy.authenticCulture'] = 'Authentic culture over trends'
result.setdefault('about', {})['philosophy.qualityOverVolume'] = 'Quality over volume'
result.setdefault('about', {})['philosophy.communityOverHype'] = 'Community over hype'
result.setdefault('about', {})['longTermValue'] = 'Long-term value over short-term wins'

about_repls = [
    ('Sound It Entertainment Global', '{t(\'about.heroBadge\')}', 'Sound It Entertainment Global'),
    ('WHERE SOUND MEETS', '{t(\'about.heroTitle\')}', 'WHERE SOUND MEETS'),
    ('CULTURE', '{t(\'about.heroHighlight\')}', 'CULTURE'),
    ('Sound It is a cultural and entertainment brand focused on creating meaningful\n              music experiences and platforms that connect Africa, China, and the global community.\n              Built on authenticity, quality, and community.', '{t(\'about.heroDescription\')}', 'Sound It is a cultural and entertainment brand focused on creating meaningful music experiences and platforms that connect Africa, China, and the global community. Built on authenticity, quality, and community.'),
    ('Established April 2020 in Lin\'an, Hangzhou. Now based in Shanghai, China. Music • Events • Culture • Technology • Creative Ecosystems', '{t(\'about.heroSubDescription\')}', 'Established April 2020 in Lin\'an, Hangzhou. Now based in Shanghai, China. Music • Events • Culture • Technology • Creative Ecosystems'),
    ('Our Purpose', '{t(\'about.missionBadge\')}', 'Our Purpose'),
    ('OUR', '{t(\'about.missionTitle\')}', 'OUR'),
    ('MISSION', '{t(\'about.missionHighlight\')}', 'MISSION'),
    ('To deliver immersive music and cultural experiences that connect artists,\n                audiences, and brands globally, blending creativity, authenticity, and innovation.', '{t(\'about.missionText\')}', 'To deliver immersive music and cultural experiences that connect artists, audiences, and brands globally, blending creativity, authenticity, and innovation.'),
    ('Our Future', '{t(\'about.visionBadge\')}', 'Our Future'),
    ('VISION', '{t(\'about.visionHighlight\')}', 'VISION'),
    ('To be the leading entertainment company that shapes global music culture\n                while empowering talent and creating unforgettable experiences.', '{t(\'about.visionText\')}', 'To be the leading entertainment company that shapes global music culture while empowering talent and creating unforgettable experiences.'),
    ('Our Ecosystem', '{t(\'about.ecosystemBadge\')}', 'Our Ecosystem'),
    ('BRAND', '{t(\'about.entitiesTitle\')}', 'BRAND'),
    ('ENTITIES', '{t(\'about.entitiesHighlight\')}', 'ENTITIES'),
    ('What We Stand For', '{t(\'about.valuesBadge\')}', 'What We Stand For'),
    ('CORE', '{t(\'about.valuesTitle\')}', 'CORE'),
    ('VALUES', '{t(\'about.valuesHighlight\')}', 'VALUES'),
    ('What We Believe', '{t(\'about.philosophyBadge\')}', 'What We Believe'),
    ('BRAND', '{t(\'about.philosophyTitle\')}', 'BRAND'),
    ('PHILOSOPHY', '{t(\'about.philosophyHighlight\')}', 'PHILOSOPHY'),
    ('International Collaborations', '{t(\'about.collabsBadge\')}', 'International Collaborations'),
    ('GLOBAL ACTS. CULTURAL', '{t(\'about.collabsTitle\')}', 'GLOBAL ACTS. CULTURAL'),
    ('IMPACT', '{t(\'about.collabsHighlight\')}', 'IMPACT'),
    ('Over the past two years, Sound It Events & RNB & Slow Sessions have successfully\n            collaborated with internationally recognized DJs and influencers, strengthening our\n            position as a cross-cultural entertainment platform in China.', '{t(\'about.collabsDescription\')}', 'Over the past two years, Sound It Events & RNB & Slow Sessions have successfully collaborated with internationally recognized DJs and influencers, strengthening our position as a cross-cultural entertainment platform in China.'),
    # Collab shared label
    ('Event Hosted', '{t(\'about.collab.eventHosted\')}', 'Event Hosted'),
    # DJ Akio
    ("description: 'Internationally recognized RNB and Afrobeats DJ known for high-energy sets and refined music\n                    curation across global nightlife scenes. Japanese origin, raised in the US, based in South Africa.'", "description: t('about.collab.akio.description')", "Internationally recognized RNB and Afrobeats DJ known for high-energy sets and refined music curation across global nightlife scenes. Japanese origin, raised in the US, based in South Africa."),
    ("'1st Anniversary — RNB & Slow Sessions'", "t('about.collab.akio.eventName')", "1st Anniversary — RNB & Slow Sessions"),
    ("'May 31, 2025 | Highline Rooftop'", "t('about.collab.akio.eventDate')", "May 31, 2025 | Highline Rooftop"),
    ("'International-level experience'", "t('about.collab.akio.tag1')", "International-level experience"),
    ("'RNB & lifestyle positioning'", "t('about.collab.akio.tag2')", "RNB & lifestyle positioning"),
    ("'Key brand milestone'", "t('about.collab.akio.tag3')", "Key brand milestone"),
    # Eva Modika
    ("description: 'South African DJ, media personality, and nightlife influencer known for her bold presence\n                    and strong audience engagement across Southern Africa.'", "description: t('about.collab.eva.description')", "South African DJ, media personality, and nightlife influencer known for her bold presence and strong audience engagement across Southern Africa."),
    ("'Sound of the South'", "t('about.collab.eva.eventName')", "Sound of the South"),
    ("'October 3, 2025 | Synth Club'", "t('about.collab.eva.eventDate')", "October 3, 2025 | Synth Club"),
    ("'Southern African club culture'", "t('about.collab.eva.tag1')", "Southern African club culture"),
    ("'Expanded African audience'", "t('about.collab.eva.tag2')", "Expanded African audience"),
    ("'High-energy night of 2025'", "t('about.collab.eva.tag3')", "High-energy night of 2025"),
    # DJ Kaywise
    ("description: 'Internationally celebrated Nigerian DJ with a strong reputation in Afrobeats and global club\n                    culture, having performed across Africa, Europe, and beyond.'", "description: t('about.collab.kaywise.description')", "Internationally celebrated Nigerian DJ with a strong reputation in Afrobeats and global club culture, having performed across Africa, Europe, and beyond."),
    ("'Synth Club Grand Opening'", "t('about.collab.kaywise.eventName')", "Synth Club Grand Opening"),
    ("'October 18, 2025 | Synth Club'", "t('about.collab.kaywise.eventDate')", "October 18, 2025 | Synth Club"),
    ("'Premium international nightlife'", "t('about.collab.kaywise.tag1')", "Premium international nightlife"),
    ("'Brand prestige & visibility'", "t('about.collab.kaywise.tag2')", "Brand prestige & visibility"),
    ("'Landmark event'", "t('about.collab.kaywise.tag3')", "Landmark event"),
    # Master Wen
    ("description: 'Prominent Chinese social media personality and influencer with over 760,000+ followers,\n                    known for strong online engagement and youth market influence.'", "description: t('about.collab.wen.description')", "Prominent Chinese social media personality and influencer with over 760,000+ followers, known for strong online engagement and youth market influence."),
    ("'RNB & Slow Sessions 9th Edition'", "t('about.collab.wen.eventName')", "RNB & Slow Sessions 9th Edition"),
    ("'December 20, 2025 | Highline Rooftop'", "t('about.collab.wen.eventDate')", "December 20, 2025 | Highline Rooftop"),
    ("'Chinese market visibility'", "t('about.collab.wen.tag1')", "Chinese market visibility"),
    ("'Cross-cultural bridge'", "t('about.collab.wen.tag2')", "Cross-cultural bridge"),
    ("'Digital reach'", "t('about.collab.wen.tag3')", "Digital reach"),
    # DJ Neptune
    ("description: 'Globally recognized Nigerian DJ and producer with international touring credentials and\n                    collaborations with major Afrobeats artists. Headies Award winner.'", "description: t('about.collab.neptune.description')", "Globally recognized Nigerian DJ and producer with international touring credentials and collaborations with major Afrobeats artists. Headies Award winner."),
    ("'Sound It Events 2024 International Showcase'", "t('about.collab.neptune.eventName')", "Sound It Events 2024 International Showcase"),
    ("'2024 | Shanghai'", "t('about.collab.neptune.eventDate')", "2024 | Shanghai"),
    ("'Early international credibility'", "t('about.collab.neptune.tag1')", "Early international credibility"),
    ("'Afrobeats community'", "t('about.collab.neptune.tag2')", "Afrobeats community"),
    ("'Foundation for 2025 expansion'", "t('about.collab.neptune.tag3')", "Foundation for 2025 expansion"),
    # Strategic value
    ('STRATEGIC VALUE FOR', '{t(\'about.strategicValueTitle\')}', 'STRATEGIC VALUE FOR'),
    ('BRANDS', '{t(\'about.strategicValueHighlight\')}', 'BRANDS'),
    ("'Proven international bookings'", "t('about.strategic.bullet1')", "Proven international bookings"),
    ("'Strong African diaspora engagement'", "t('about.strategic.bullet2')", "Strong African diaspora engagement"),
    ("'Growing Chinese youth market'", "t('about.strategic.bullet3')", "Growing Chinese youth market"),
    ("'Cross-cultural event production'", "t('about.strategic.bullet4')", "Cross-cultural event production"),
    ("'4,000+ annual attendees'", "t('about.strategic.bullet5')", "4,000+ annual attendees"),
    ("'Bridge between African sound & Chinese market'", "t('about.strategic.bullet6')", "Bridge between African sound & Chinese market"),
    ('We are positioned as a bridge between African sound, international culture,\n              and the Chinese nightlife market.', '{t(\'about.strategicValueText\')}', 'We are positioned as a bridge between African sound, international culture, and the Chinese nightlife market.'),
    # Leadership
    ('The Minds Behind Sound It', '{t(\'about.leadershipBadge\')}', 'The Minds Behind Sound It'),
    ('OUR LEADERSHIP', '{t(\'about.leadershipTitle\')}', 'OUR LEADERSHIP'),
    ('TEAM', '{t(\'about.leadershipHighlight\')}', 'TEAM'),
    ('Sound It Events & RNB & Slow Sessions are powered by a dedicated leadership team\n              committed to culture, quality, and long-term growth.', '{t(\'about.leadershipDescription\')}', 'Sound It Events & RNB & Slow Sessions are powered by a dedicated leadership team committed to culture, quality, and long-term growth.'),
    # Fred Max
    ("'Founder — Visionary | Creative Director | Lead DJ'", "t('about.leadership.fred.title')", "Founder — Visionary | Creative Director | Lead DJ"),
    ("description: 'Fred Max is the founder of Sound It Entertainment Corporation and the driving force behind\n                  Sound It Events and RNB & Slow Sessions. With a strong background in music curation,\n                  DJ performance, and event production, he has built Sound It into a recognized cross-cultural\n                  nightlife platform in China.'", "description: t('about.leadership.fred.bio1')", "Fred Max is the founder of Sound It Entertainment Corporation and the driving force behind Sound It Events and RNB & Slow Sessions. With a strong background in music curation, DJ performance, and event production, he has built Sound It into a recognized cross-cultural nightlife platform in China."),
    ("description: 'He oversees brand strategy, partnerships, international bookings, creative direction,\n                  and overall execution. Known for blending African, RNB, and global sounds seamlessly,\n                  Fred Max has positioned Sound It as a bridge between cultures and a growing force in\n                  the entertainment space.'", "description: t('about.leadership.fred.bio2')", "He oversees brand strategy, partnerships, international bookings, creative direction, and overall execution. Known for blending African, RNB, and global sounds seamlessly, Fred Max has positioned Sound It as a bridge between cultures and a growing force in the entertainment space."),
    ("description: 'His long-term vision includes expanding into festivals, media, and global collaborations.'", "description: t('about.leadership.fred.bio3')", "His long-term vision includes expanding into festivals, media, and global collaborations."),
    # Jayel Belford
    ("'Co-Founder & Finance Manager — Operations | Financial Strategy | Structural Growth'", "t('about.leadership.jayel.title')", "Co-Founder & Finance Manager — Operations | Financial Strategy | Structural Growth"),
    ("description: 'Jayel Belford plays a key leadership role in the company\'s stability and scalability.\n                  As Co-Founder and Finance Manager, he oversees budgeting, financial planning, compliance,\n                  and event cost management.'", "description: t('about.leadership.jayel.bio1')", "Jayel Belford plays a key leadership role in the company's stability and scalability. As Co-Founder and Finance Manager, he oversees budgeting, financial planning, compliance, and event cost management."),
    ("description: 'His structured financial oversight ensures sustainability, smart expansion, and responsible growth.\n                  Jayel is instrumental in maintaining clear operational systems and long-term profitability while supporting the creative vision of the brand.'", "description: t('about.leadership.jayel.bio2')", "His structured financial oversight ensures sustainability, smart expansion, and responsible growth. Jayel is instrumental in maintaining clear operational systems and long-term profitability while supporting the creative vision of the brand."),
    ("description: 'Together with the founder, he helps translate ideas into structured execution.'", "description: t('about.leadership.jayel.bio3')", "Together with the founder, he helps translate ideas into structured execution."),
    # Thembi
    ("'Manager — Event Coordination | Logistics | Team Management'", "t('about.leadership.thembi.title')", "Manager — Event Coordination | Logistics | Team Management"),
    ("description: 'Thembi manages the operational flow of Sound It Events and RNB & Slow Sessions.\n                  From vendor coordination to team scheduling and event-day supervision, she ensures that\n                  every event runs smoothly.'", "description: t('about.leadership.thembi.bio1')", "Thembi manages the operational flow of Sound It Events and RNB & Slow Sessions. From vendor coordination to team scheduling and event-day supervision, she ensures that every event runs smoothly."),
    ("description: 'Her attention to detail, communication skills, and hands-on coordination allow the brand to deliver high-quality experiences consistently. She bridges communication between performers, venues, and internal teams, making sure every production element aligns.'", "description: t('about.leadership.thembi.bio2')", "Her attention to detail, communication skills, and hands-on coordination allow the brand to deliver high-quality experiences consistently. She bridges communication between performers, venues, and internal teams, making sure every production element aligns."),
    # Lynique
    ("'Official Host — Brand Voice | Audience Engagement | Stage Presence'", "t('about.leadership.lynique.title')", "Official Host — Brand Voice | Audience Engagement | Stage Presence"),
    ("description: 'Lynique serves as the official host and energy curator of Sound It events. She brings charisma,\n                  professionalism, and audience connection to every stage.'", "description: t('about.leadership.lynique.bio1')", "Lynique serves as the official host and energy curator of Sound It events. She brings charisma, professionalism, and audience connection to every stage."),
    ("description: 'Her role extends beyond hosting — she strengthens brand personality, keeps audiences engaged, and ensures each event maintains a dynamic and memorable atmosphere.'", "description: t('about.leadership.lynique.bio2')", "Her role extends beyond hosting — she strengthens brand personality, keeps audiences engaged, and ensures each event maintains a dynamic and memorable atmosphere."),
    ("description: 'She represents the voice and energy of the Sound It community.'", "description: t('about.leadership.lynique.bio3')", "She represents the voice and energy of the Sound It community."),
    # Why this matters
    ('WHY THIS MATTERS FOR', '{t(\'about.whyMattersTitle\')}', 'WHY THIS MATTERS FOR'),
    ('Behind every Sound It event is:', '{t(\'about.whyMattersSubtitle\')}', 'Behind every Sound It event is:'),
    ("'Structured leadership'", "t('about.whyMatters.structuredLeadership')", "Structured leadership"),
    ("'Financial accountability'", "t('about.whyMatters.financialAccountability')", "Financial accountability"),
    ("'Coordinated execution'", "t('about.whyMatters.coordinatedExecution')", "Coordinated execution"),
    ("'Strong audience engagement'", "t('about.whyMatters.strongEngagement')", "Strong audience engagement"),
    ("'Clear long-term vision'", "t('about.whyMatters.clearVision')", "Clear long-term vision"),
    ('We are not just event organizers — we are an organized entertainment company building sustainable cultural experiences.', '{t(\'about.whyMattersClosing\')}', 'We are not just event organizers — we are an organized entertainment company building sustainable cultural experiences.'),
]

for old, new, value in about_repls:
    if old not in about_content:
        print(f"WARNING About: {old[:80]}", file=sys.stderr)
    else:
        about_content = about_content.replace(old, new, 1)
        for m in re.finditer(r"t\('([^']+)'\)", new):
            k = m.group(1)
            if k.startswith('about.'):
                result.setdefault('about', {})[k[6:]] = value

about_path.write_text(about_content)

print(json.dumps(result, indent=2, ensure_ascii=False))
