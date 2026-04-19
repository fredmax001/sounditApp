import json
import sys
import re
from pathlib import Path

base_dir = Path('/Users/djfredmax/Desktop/SOUND IT WEB APP COMPLETE/app')

configs = {
    'src/pages/EventDetail.tsx': {
        'namespace': 'eventDetail',
        'import_after': "import { useState, useEffect } from 'react';",
        'hooks': [{'before': '  const { id } = useParams<{ id: string }>();', 'insert': '  const { t } = useTranslation();\n'}],
        'replacements': [
            ("'Event'", "t('eventDetail.event')", "Event"),
            ('Event not found', '{t(\'eventDetail.eventNotFound\')}', 'Event not found'),
            ('Retry', '{t(\'eventDetail.retry\')}', 'Retry'),
            ('Back to events', '{t(\'eventDetail.backToEvents\')}', 'Back to events'),
            ("toast.error('Please select a ticket type')", "toast.error(t('eventDetail.selectTicketType'))", "Please select a ticket type"),
            ("toast.error('Invalid ticket tier selected')", "toast.error(t('eventDetail.invalidTicketTier'))", "Invalid ticket tier selected"),
            ("toast.error('This ticket tier is sold out')", "toast.error(t('eventDetail.soldOut'))", "This ticket tier is sold out"),
            ("toast.error('No tickets available for this tier')", "toast.error(t('eventDetail.noTicketsAvailable'))", "No tickets available for this tier"),
            ('`Only ${availableQuantity} tickets remaining`', '`${t(\'eventDetail.only\')} ${availableQuantity} ${t(\'eventDetail.ticketsRemaining\')}`', 'Only tickets remaining'),
            ("toast.success('Tickets added to cart!')", "toast.success(t('eventDetail.ticketsAddedToCart'))", "Tickets added to cart!"),
            ("toast.error(error instanceof Error ? error.message : 'Failed to add tickets to cart')", "toast.error(error instanceof Error ? error.message : t('eventDetail.failedToAddToCart'))", "Failed to add tickets to cart"),
            ('Back', '{t(\'eventDetail.back\')}', 'Back'),
            ('Date', '{t(\'eventDetail.date\')}', 'Date'),
            ('Time', '{t(\'eventDetail.time\')}', 'Time'),
            ('Venue', '{t(\'eventDetail.venue\')}', 'Venue'),
            ('To Be Announced', '{t(\'eventDetail.toBeAnnounced\')}', 'To Be Announced'),
            ('Availability', '{t(\'eventDetail.availability\')}', 'Availability'),
            ('Limited availability', '{t(\'eventDetail.limitedAvailability\')}', 'Limited availability'),
            ('} tickets', '} {t(\'eventDetail.ticketsLabel\')}', 'tickets'),
            ('About this event', '{t(\'eventDetail.aboutThisEvent\')}', 'About this event'),
            ('Featured DJs & Artists', '{t(\'eventDetail.featuredDJsAndArtists\')}', 'Featured DJs & Artists'),
            ("dj.genres?.join(', ') || 'Artist'", "dj.genres?.join(', ') || t('eventDetail.artist')", "Artist"),
            ('Business', '{t(\'eventDetail.business\')}', 'Business'),
            ('Verified Business', '{t(\'eventDetail.verifiedBusiness\')}', 'Verified Business'),
            ('Similar Events', '{t(\'eventDetail.similarEvents\')}', 'Similar Events'),
            ('Select Ticket Type', '{t(\'eventDetail.selectTicketType\')}', 'Select Ticket Type'),
            (' tickets remaining', ' {t(\'eventDetail.ticketsRemaining\')}', ' tickets remaining'),
            ('Quantity', '{t(\'eventDetail.quantity\')}', 'Quantity'),
            ('Total', '{t(\'eventDetail.total\')}', 'Total'),
            ('Login to Purchase', '{t(\'eventDetail.loginToPurchase\')}', 'Login to Purchase'),
            ('Sold Out', '{t(\'eventDetail.soldOutLabel\')}', 'Sold Out'),
            ('Get Tickets', '{t(\'eventDetail.getTickets\')}', 'Get Tickets'),
            ('Tickets Coming Soon', '{t(\'eventDetail.ticketsComingSoon\')}', 'Tickets Coming Soon'),
            ('Ticket information for this event will be available shortly.', '{t(\'eventDetail.ticketInfoSoon\')}', 'Ticket information for this event will be available shortly.'),
            ('Login for Updates', '{t(\'eventDetail.loginForUpdates\')}', 'Login for Updates'),
            ("toast.success('You\\'ll be notified when tickets are available!')", "toast.success(t('eventDetail.notifySuccess'))", "You'll be notified when tickets are available!"),
            ('Notify Me', '{t(\'eventDetail.notifyMe\')}', 'Notify Me'),
            ('Share Event', '{t(\'eventDetail.shareEvent\')}', 'Share Event'),
            ('Scan this QR code to share this event with others', '{t(\'eventDetail.scanQRToShare\')}', 'Scan this QR code to share this event with others'),
            ('Copy Link', '{t(\'eventDetail.copyLink\')}', 'Copy Link'),
            ("toast.textContent = 'Link copied!';", "toast.textContent = t('eventDetail.linkCopied');", "Link copied!"),
            ("sessionStorage.setItem('toast-message', 'Link copied!');", "sessionStorage.setItem('toast-message', t('eventDetail.linkCopied'));", "Link copied!"),
        ]
    },
    'src/pages/ArtistDetail.tsx': {
        'namespace': 'artistDetail',
        'import_after': "import { useEffect, useState, useRef, useCallback } from 'react';",
        'hooks': [
            {'before': '  const [step, setStep] = useState(1);', 'insert': '  const { t } = useTranslation();\n'},
            {'before': '  const [currentTrack, setCurrentTrack] = useState<number | null>(null);', 'insert': '  const { t } = useTranslation();\n'},
            {'before': '  const [currentDate, setCurrentDate] = useState(new Date());', 'insert': '  const { t } = useTranslation();\n'},
            {'before': '  const { id } = useParams<{ id: string }>();', 'insert': '  const { t } = useTranslation();\n'},
        ],
        'replacements': [
            # BookingModal
            ("toast.error('Please login to book this artist')", "toast.error(t('artistDetail.loginToBook'))", "Please login to book this artist"),
            ("toast.success('Booking request sent successfully!')", "toast.success(t('artistDetail.bookingSentSuccess'))", "Booking request sent successfully!"),
            ("toast.error(error.detail || 'Failed to send booking request')", "toast.error(error.detail || t('artistDetail.failedToSendBooking'))", "Failed to send booking request"),
            ("toast.error('Network error. Please try again.')", "toast.error(t('artistDetail.networkError'))", "Network error. Please try again."),
            ('Book {artist.stage_name}', '{t(\'artistDetail.book\')} {artist.stage_name}', 'Book'),
            ('Fill in the details for your event', '{t(\'artistDetail.bookingSubtitle\')}', 'Fill in the details for your event'),
            ('Event Details', '{t(\'artistDetail.eventDetails\')}', 'Event Details'),
            ('Event Name *', '{t(\'artistDetail.eventName\')}', 'Event Name *'),
            ('e.g., Summer Beach Party', '{t(\'artistDetail.eventNamePlaceholder\')}', 'e.g., Summer Beach Party'),
            ('Event Type', '{t(\'artistDetail.eventType\')}', 'Event Type'),
            ('Select type', '{t(\'artistDetail.selectType\')}', 'Select type'),
            ('Club Night', '{t(\'artistDetail.clubNight\')}', 'Club Night'),
            ('Private Party', '{t(\'artistDetail.privateParty\')}', 'Private Party'),
            ('Wedding', '{t(\'artistDetail.wedding\')}', 'Wedding'),
            ('Corporate Event', '{t(\'artistDetail.corporateEvent\')}', 'Corporate Event'),
            ('Festival', '{t(\'artistDetail.festival\')}', 'Festival'),
            ('Other', '{t(\'artistDetail.other\')}', 'Other'),
            ('Event Date', '{t(\'artistDetail.eventDate\')}', 'Event Date'),
            ('City', '{t(\'artistDetail.city\')}', 'City'),
            ('Select city', '{t(\'artistDetail.selectCity\')}', 'Select city'),
            ('Venue/Location', '{t(\'artistDetail.venueLocation\')}', 'Venue/Location'),
            ('Venue name', '{t(\'artistDetail.venuePlaceholder\')}', 'Venue name'),
            ('Booking Details', '{t(\'artistDetail.bookingDetails\')}', 'Booking Details'),
            ('Budget (¥)', '{t(\'artistDetail.budget\')}', 'Budget (¥)'),
            ('e.g., 5000', '{t(\'artistDetail.budgetPlaceholder\')}', 'e.g., 5000'),
            ('Artist starts from ¥{artist.starting_price}', '{t(\'artistDetail.startsFrom\')} ¥{artist.starting_price}', 'Artist starts from ¥'),
            ('Duration (hours)', '{t(\'artistDetail.duration\')}', 'Duration (hours)'),
            ('Select duration', '{t(\'artistDetail.selectDuration\')}', 'Select duration'),
            ('1 hour', '{t(\'artistDetail.oneHour\')}', '1 hour'),
            ('2 hours', '{t(\'artistDetail.twoHours\')}', '2 hours'),
            ('3 hours', '{t(\'artistDetail.threeHours\')}', '3 hours'),
            ('4 hours', '{t(\'artistDetail.fourHours\')}', '4 hours'),
            ('5+ hours', '{t(\'artistDetail.fivePlusHours\')}', '5+ hours'),
            ('Message to Artist', '{t(\'artistDetail.messageToArtist\')}', 'Message to Artist'),
            ('Tell the artist about your event, preferred music style, etc.', '{t(\'artistDetail.messagePlaceholder\')}', 'Tell the artist about your event, preferred music style, etc.'),
            ('Travel required (outside artist\'s city)', '{t(\'artistDetail.travelRequired\')}', "Travel required (outside artist's city)"),
            ('Contact Information', '{t(\'artistDetail.contactInformation\')}', 'Contact Information'),
            ('Contact Name *', '{t(\'artistDetail.contactName\')}', 'Contact Name *'),
            ('Phone *', '{t(\'artistDetail.phone\')}', 'Phone *'),
            ('Email *', '{t(\'artistDetail.email\')}', 'Email *'),
            ('Special Requests', '{t(\'artistDetail.specialRequests\')}', 'Special Requests'),
            ('Any special requirements or requests...', '{t(\'artistDetail.specialRequestsPlaceholder\')}', 'Any special requirements or requests...'),
            ('Booking Summary', '{t(\'artistDetail.bookingSummary\')}', 'Booking Summary'),
            ('Artist:', '{t(\'artistDetail.summaryArtist\')}', 'Artist:'),
            ('Event:', '{t(\'artistDetail.summaryEvent\')}', 'Event:'),
            ('Not specified', '{t(\'artistDetail.notSpecified\')}', 'Not specified'),
            ('Date:', '{t(\'artistDetail.summaryDate\')}', 'Date:'),
            ('Budget:', '{t(\'artistDetail.summaryBudget\')}', 'Budget:'),
            ('Back', '{t(\'artistDetail.back\')}', 'Back'),
            ('Continue', '{t(\'artistDetail.continue\')}', 'Continue'),
            ('Send Booking Request', '{t(\'artistDetail.sendBookingRequest\')}', 'Send Booking Request'),
            ('Sending...', '{t(\'artistDetail.sending\')}', 'Sending...'),
            # MusicPlayer
            ('No tracks available yet', '{t(\'artistDetail.noTracksAvailable\')}', 'No tracks available yet'),
            ('Music Preview', '{t(\'artistDetail.musicPreview\')}', 'Music Preview'),
            (' plays', ' {t(\'artistDetail.plays\')}', ' plays'),
            # AvailabilityCalendar
            ('Availability', '{t(\'artistDetail.availability\')}', 'Availability'),
            ('Available', '{t(\'artistDetail.available\')}', 'Available'),
            ('Booked', '{t(\'artistDetail.booked\')}', 'Booked'),
            ("{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (\n          <div key={day} className=\"text-center text-gray-500 text-xs py-2\">{day}</div>\n        ))}", "{[t('artistDetail.sun'), t('artistDetail.mon'), t('artistDetail.tue'), t('artistDetail.wed'), t('artistDetail.thu'), t('artistDetail.fri'), t('artistDetail.sat')].map((day, i) => (\n          <div key={i} className=\"text-center text-gray-500 text-xs py-2\">{day}</div>\n        ))}", "Sun Mon Tue Wed Thu Fri Sat"),
            # ArtistDetail main
            ("toast.error('Failed to load artist profile')", "toast.error(t('artistDetail.failedToLoadProfile'))", "Failed to load artist profile"),
            ('Artist Not Found', '{t(\'artistDetail.artistNotFound\')}', 'Artist Not Found'),
            ("The artist you're looking for doesn't exist.", '{t(\'artistDetail.artistNotFoundDescription\')}', "The artist you're looking for doesn't exist."),
            ('Browse All Artists', '{t(\'artistDetail.browseAllArtists\')}', 'Browse All Artists'),
            ('Book Now', '{t(\'artistDetail.bookNow\')}', 'Book Now'),
            ("toast.info('Messaging feature coming soon!', { description: 'Use the booking form to contact this artist.' })", "toast.info(t('artistDetail.messagingComingSoon'), { description: t('artistDetail.messagingDescription') })", "Messaging feature coming soon!"),
            ('Message', '{t(\'artistDetail.message\')}', 'Message'),
            # Tabs block replacement
            ("{['about', 'reviews', 'gallery'].map((tab) => (\n                <button\n                  key={tab}\n                  onClick={() => setActiveTab(tab as 'about' | 'reviews' | 'gallery')}\n                  className={`px-6 py-2 rounded-lg font-medium capitalize transition-colors ${activeTab === tab\n                    ? 'bg-[#d3da0c] text-black'\n                    : 'text-gray-400 hover:text-white hover:bg-white/5'\n                    }`}\n                >\n                  {tab}\n                </button>\n              ))}", "{[\n                { id: 'about', label: t('artistDetail.tabAbout') },\n                { id: 'reviews', label: t('artistDetail.tabReviews') },\n                { id: 'gallery', label: t('artistDetail.tabGallery') }\n              ].map((tab) => (\n                <button\n                  key={tab.id}\n                  onClick={() => setActiveTab(tab.id as 'about' | 'reviews' | 'gallery')}\n                  className={`px-6 py-2 rounded-lg font-medium capitalize transition-colors ${activeTab === tab.id\n                    ? 'bg-[#d3da0c] text-black'\n                    : 'text-gray-400 hover:text-white hover:bg-white/5'\n                    }`}\n                >\n                  {tab.label}\n                </button>\n              ))}", "about reviews gallery tabs"),
            ('<h3 className="text-xl font-bold text-white mb-4">About</h3>', '<h3 className="text-xl font-bold text-white mb-4">{t(\'artistDetail.about\')}</h3>', 'About'),
            ('No bio available yet.', '{t(\'artistDetail.noBio\')}', 'No bio available yet.'),
            ('Years Experience', '{t(\'artistDetail.yearsExperience\')}', 'Years Experience'),
            ('Languages', '{t(\'artistDetail.languages\')}', 'Languages'),
            ('Starting Price', '{t(\'artistDetail.startingPrice\')}', 'Starting Price'),
            ('Performance Duration', '{t(\'artistDetail.performanceDuration\')}', 'Performance Duration'),
            ('Event Types', '{t(\'artistDetail.eventTypes\')}', 'Event Types'),
            ('Travel', '{t(\'artistDetail.travel\')}', 'Travel'),
            ('Local only', '{t(\'artistDetail.localOnly\')}', 'Local only'),
            ('Music & Social', '{t(\'artistDetail.musicAndSocial\')}', 'Music & Social'),
            ('Photo & Video Gallery', '{t(\'artistDetail.photoVideoGallery\')}', 'Photo & Video Gallery'),
            ('Quick Info', '{t(\'artistDetail.quickInfo\')}', 'Quick Info'),
            ('Equipment', '{t(\'artistDetail.equipment\')}', 'Equipment'),
            ('Response Time', '{t(\'artistDetail.responseTime\')}', 'Response Time'),
            ('Usually within 24 hours', '{t(\'artistDetail.responseTimeValue\')}', 'Usually within 24 hours'),
            ('Ready to book this artist for your event?', '{t(\'artistDetail.readyToBook\')}', 'Ready to book this artist for your event?'),
            (' reviews', ' {t(\'artistDetail.reviews\')}', ' reviews'),
            (' stars', ' {t(\'artistDetail.stars\')}', ' stars'),
            ('Verified Booking', '{t(\'artistDetail.verifiedBooking\')}', 'Verified Booking'),
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
                print(f"WARNING: not found in {rel_path}: {old[:120]}", file=sys.stderr)
            else:
                content = content.replace(old, new, 1)

        file_path.write_text(content)

        ns = ops['namespace']
        keys = result.setdefault(ns, {})
        for old, new, value in ops.get('replacements', []):
            for m in re.finditer(r"t\('([^']+)'\)", new):
                full_key = m.group(1)
                if full_key.startswith(ns + '.'):
                    short = full_key[len(ns)+1:]
                else:
                    short = full_key
                keys[short] = value
            for m in re.finditer(r't\("([^"]+)"\)', new):
                full_key = m.group(1)
                if full_key.startswith(ns + '.'):
                    short = full_key[len(ns)+1:]
                else:
                    short = full_key
                keys[short] = value

    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
