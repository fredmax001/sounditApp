import json
import sys
from pathlib import Path

base_dir = Path('/Users/djfredmax/Desktop/SOUND IT WEB APP COMPLETE/app')

configs = {
    'src/pages/Careers.tsx': {
        'namespace': 'careers',
        'import_after': "import { useEffect } from 'react';",
        'hooks': [{'before': '    // SEO', 'insert': '    const { t } = useTranslation();\n'}],
        'replacements': [
            ("'Careers | Sound It China'", "t('careers.pageTitle')", "Careers | Sound It China"),
            ("'Join the Sound It team! We\\'re hiring talented people who are passionate about connecting foreigners in China with incredible Afrobeats events and African culture.'", "t('careers.metaDescription')", "Join the Sound It team! We're hiring talented people who are passionate about connecting foreigners in China with incredible Afrobeats events and African culture."),
            ("title: 'Full Stack Developer',", "title: t('careers.openings.fullStackDeveloper.title'),", "Full Stack Developer"),
            ("location: 'Shanghai, China',", "location: t('careers.openings.fullStackDeveloper.location'),", "Shanghai, China"),
            ("type: 'Full-time',", "type: t('careers.openings.fullStackDeveloper.type'),", "Full-time"),
            ("description: 'Build and maintain our web platform using React, Node.js, and PostgreSQL.',", "description: t('careers.openings.fullStackDeveloper.description'),", "Build and maintain our web platform using React, Node.js, and PostgreSQL."),
            ("title: 'Community Manager',", "title: t('careers.openings.communityManager.title'),", "Community Manager"),
            ("description: 'Lead our community engagement and help connect users with amazing events.',", "description: t('careers.openings.communityManager.description'),", "Lead our community engagement and help connect users with amazing events."),
            ("title: 'Event Coordinator',", "title: t('careers.openings.eventCoordinator.title'),", "Event Coordinator"),
            ("description: 'Organize and promote Afrobeats events across major Chinese cities.',", "description: t('careers.openings.eventCoordinator.description'),", "Organize and promote Afrobeats events across major Chinese cities."),
            ("title: 'Marketing Specialist',", "title: t('careers.openings.marketingSpecialist.title'),", "Marketing Specialist"),
            ("location: 'Remote',", "location: t('careers.openings.marketingSpecialist.location'),", "Remote"),
            ("description: 'Drive user acquisition and brand awareness across social media platforms.',", "description: t('careers.openings.marketingSpecialist.description'),", "Drive user acquisition and brand awareness across social media platforms."),
            ("title: 'Global Minded',", "title: t('careers.values.globalMinded.title'),", "Global Minded"),
            ("description: 'We celebrate diversity and connect people across cultures.',", "description: t('careers.values.globalMinded.description'),", "We celebrate diversity and connect people across cultures."),
            ("title: 'Innovation First',", "title: t('careers.values.innovationFirst.title'),", "Innovation First"),
            ("description: 'We constantly push boundaries to create better experiences.',", "description: t('careers.values.innovationFirst.description'),", "We constantly push boundaries to create better experiences."),
            ("title: 'Community Driven',", "title: t('careers.values.communityDriven.title'),", "Community Driven"),
            ("description: 'Our success is built on the passion of our users.',", "description: t('careers.values.communityDriven.description'),", "Our success is built on the passion of our users."),
            ("title: 'Excellence',", "title: t('careers.values.excellence.title'),", "Excellence"),
            ("description: 'We strive for the highest quality in everything we do.',", "description: t('careers.values.excellence.description'),", "We strive for the highest quality in everything we do."),
            ('Join Our <span className="text-[#d3da0c]">Team</span>', '{t(\'careers.heroTitle\')} <span className="text-[#d3da0c]">{t(\'careers.heroHighlight\')}</span>', 'Join Our Team'),
            ('Help us build the ultimate platform for connecting people with amazing Afrobeats events in China', '{t(\'careers.heroSubtitle\')}', 'Help us build the ultimate platform for connecting people with amazing Afrobeats events in China'),
            ('View Open Positions', '{t(\'careers.viewOpenPositions\')}', 'View Open Positions'),
            ('Our Values', '{t(\'careers.ourValues\')}', 'Our Values'),
            ('Open Positions', '{t(\'careers.openPositions\')}', 'Open Positions'),
            ("Don't See Your Role?", '{t(\'careers.dontSeeRole\')}', "Don't See Your Role?"),
            ("We're always looking for talented people. Send us your resume and let us know what you're interested in.", '{t(\'careers.sendResumeText\')}', "We're always looking for talented people. Send us your resume and let us know what you're interested in."),
            ('Contact Us', '{t(\'careers.contactUs\')}', 'Contact Us'),
        ]
    },
    'src/pages/Cart.tsx': {
        'namespace': 'cart',
        'import_after': "import { Minus, Plus, ArrowRight, ShoppingCart } from 'lucide-react';",
        'hooks': [{'before': '    const navigate = useNavigate();', 'insert': '    const { t } = useTranslation();\n'}],
        'replacements': [
            ("toast.success('Item removed from cart')", "toast.success(t('cart.itemRemoved'))", "Item removed from cart"),
            ("toast.success('Cart cleared')", "toast.success(t('cart.cartCleared'))", "Cart cleared"),
            ('Your cart is empty', "{t('cart.emptyTitle')}", 'Your cart is empty'),
            ('Add some tickets to get started', "{t('cart.emptySubtitle')}", 'Add some tickets to get started'),
            ('Browse Events', "{t('cart.browseEvents')}", 'Browse Events'),
            ('Your Cart', "{t('cart.title')}", 'Your Cart'),
            ('Clear Cart', "{t('cart.clearCart')}", 'Clear Cart'),
            ('Remove', "{t('cart.remove')}", 'Remove'),
            ('Checkout for this event', "{t('cart.checkoutForEvent')}", 'Checkout for this event'),
            ('<span className="text-white">Total</span>', '<span className="text-white">{t(\'cart.total\')}</span>', 'Total'),
            ('¥{item.price} each', '¥{item.price} {t(\'cart.each\')}', 'each'),
        ]
    },
    'src/pages/Contact.tsx': {
        'namespace': 'contact',
        'import_after': "import { useState } from 'react';",
        'hooks': [{'before': '  const [formData, setFormData] = useState({', 'insert': '  const { t } = useTranslation();\n'}],
        'replacements': [
            ("toast.error('Please fill in all required fields')", "toast.error(t('contact.fillRequiredFields'))", "Please fill in all required fields"),
            ("toast.success('Message sent successfully!')", "toast.success(t('contact.messageSent'))", "Message sent successfully!"),
            ("toast.error(errorData.detail || 'Failed to send message')", "toast.error(errorData.detail || t('contact.failedToSendMessage'))", "Failed to send message"),
            ("toast.error('Network error. Please try again later.')", "toast.error(t('contact.networkError'))", "Network error. Please try again later."),
            ("label: 'Email',", "label: t('contact.emailLabel'),", "Email"),
            ("label: 'Phone',", "label: t('contact.phoneLabel'),", "Phone"),
            ("label: 'Address',", "label: t('contact.addressLabel'),", "Address"),
            ('Message Sent!', '{t(\'contact.messageSentTitle\')}', 'Message Sent!'),
            ("Thank you for reaching out. We'll get back to you within 24 hours.", '{t(\'contact.thankYouMessage\')}', "Thank you for reaching out. We'll get back to you within 24 hours."),
            ('Send Another Message', '{t(\'contact.sendAnotherMessage\')}', 'Send Another Message'),
            ('Get In Touch', '{t(\'contact.getInTouch\')}', 'Get In Touch'),
            ('CONTACT{\' \'}\n              <span className="text-[#d3da0c]">US</span>', '{t(\'contact.title\')}{\' \'}\n              <span className="text-[#d3da0c]">{t(\'contact.titleHighlight\')}</span>', 'CONTACT US'),
            ("Have a question or want to work with us? We'd love to hear from you.", '{t(\'contact.subtitle\')}', "Have a question or want to work with us? We'd love to hear from you."),
            ('Contact Information', '{t(\'contact.contactInformation\')}', 'Contact Information'),
            ('Follow Us', '{t(\'contact.followUs\')}', 'Follow Us'),
            ('Send Us a Message', '{t(\'contact.sendUsAMessage\')}', 'Send Us a Message'),
            ('Your Name <span className="text-[#FF2D8F]">*</span>', '{t(\'contact.yourName\')} <span className="text-[#FF2D8F]">*</span>', 'Your Name *'),
            ('John Doe', '{t(\'contact.namePlaceholder\')}', 'John Doe'),
            ('Your Email <span className="text-[#FF2D8F]">*</span>', '{t(\'contact.yourEmail\')} <span className="text-[#FF2D8F]">*</span>', 'Your Email *'),
            ('you@example.com', '{t(\'contact.emailPlaceholder\')}', 'you@example.com'),
            ('Subject', '{t(\'contact.subjectLabel\')}', 'Subject'),
            ('Select a subject', '{t(\'contact.selectSubject\')}', 'Select a subject'),
            ('General Inquiry', '{t(\'contact.subjectGeneralInquiry\')}', 'General Inquiry'),
            ('Support', '{t(\'contact.subjectSupport\')}', 'Support'),
            ('Partnership', '{t(\'contact.subjectPartnership\')}', 'Partnership'),
            ('Press', '{t(\'contact.subjectPress\')}', 'Press'),
            ('Message <span className="text-[#FF2D8F]">*</span>', '{t(\'contact.messageLabel\')} <span className="text-[#FF2D8F]">*</span>', 'Message *'),
            ("Tell us what's on your mind...", '{t(\'contact.messagePlaceholder\')}', "Tell us what's on your mind..."),
            ('Sending...', '{t(\'contact.sending\')}', 'Sending...'),
            ('Send Message', '{t(\'contact.sendMessage\')}', 'Send Message'),
            ('title="Instagram"', 'title={t(\'contact.instagram\')}', 'Instagram'),
            ('title="X (Twitter)"', 'title={t(\'contact.xTwitter\')}', 'X (Twitter)'),
            ('title="TikTok"', 'title={t(\'contact.tikTok\')}', 'TikTok'),
            ('title="Facebook"', 'title={t(\'contact.facebook\')}', 'Facebook'),
        ]
    },
    'src/pages/Subscriptions.tsx': {
        'namespace': 'subscriptions',
        'import_after': "import { useEffect, useState } from 'react';",
        'hooks': [{'before': '  const { user, profile, session } = useAuthStore();', 'insert': '  const { t } = useTranslation();\n'}],
        'replacements': [
            ("toast.error('Failed to load data')", "toast.error(t('subscriptions.failedToLoadData'))", "Failed to load data"),
            ("toast.success('Subscription created! Please complete payment.')", "toast.success(t('subscriptions.subscriptionCreated'))", "Subscription created! Please complete payment."),
            ("toast.error((err.response?.data as { detail?: string })?.detail || 'Failed to subscribe')", "toast.error((err.response?.data as { detail?: string })?.detail || t('subscriptions.failedToSubscribe'))", "Failed to subscribe"),
            ("toast.error('Failed to subscribe')", "toast.error(t('subscriptions.failedToSubscribe'))", "Failed to subscribe"),
            ('Choose Your <span className="text-[#d3da0c]">Plan</span>', '{t(\'subscriptions.title\')} <span className="text-[#d3da0c]">{t(\'subscriptions.titleHighlight\')}</span>', 'Choose Your Plan'),
            ('Unlock premium features', '{t(\'subscriptions.subtitle\')}', 'Unlock premium features'),
            ('Active Plan: ', '{t(\'subscriptions.activePlan\')} ', 'Active Plan: '),
            (' days remaining', ' {t(\'subscriptions.daysRemaining\')}', ' days remaining'),
            ('/month', '{t(\'subscriptions.perMonth\')}', '/month'),
            ('Current Plan', '{t(\'subscriptions.currentPlan\')}', 'Current Plan'),
            ('Subscribe', '{t(\'subscriptions.subscribe\')}', 'Subscribe'),
        ]
    },
}

def main():
    result = {}
    for rel_path, ops in configs.items():
        file_path = base_dir / rel_path
        content = file_path.read_text()

        if 'import_after' in ops:
            import_line = ops['import_after']
            new_import = "import { useTranslation } from 'react-i18next';"
            content = content.replace(import_line, import_line + '\n' + new_import, 1)

        for hook in ops.get('hooks', []):
            before = hook['before']
            insert = hook['insert']
            content = content.replace(before, insert + before, 1)

        for old, new, value in ops.get('replacements', []):
            if old not in content:
                print(f"WARNING: not found in {rel_path}: {old[:80]}", file=sys.stderr)
            else:
                content = content.replace(old, new, 1)

        file_path.write_text(content)

        ns = ops['namespace']
        keys = {}
        for old, new, value in ops.get('replacements', []):
            # extract key from new string like t('key') or {t('key')}
            import re
            m = re.search(r"t\('([^']+)'\)", new)
            if not m:
                m = re.search(r't\("([^"]+)"\)', new)
            if m:
                full_key = m.group(1)
                if full_key.startswith(ns + '.'):
                    short = full_key[len(ns)+1:]
                else:
                    short = full_key
                keys[short] = value
        result[ns] = keys

    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
