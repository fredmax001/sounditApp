import json
import sys
import re
from pathlib import Path

base_dir = Path('/Users/djfredmax/Desktop/SOUND IT WEB APP COMPLETE/app')

configs = {
    'src/pages/CityGuide.tsx': {
        'namespace': 'cityGuide',
        'import_after': "import { useState, useEffect } from 'react';",
        'hooks': [{'before': "  const [selectedCity, setSelectedCity] = useState('all');", 'insert': '  const { t } = useTranslation();\n'}],
        'replacements': [
            ("name: 'All Cities'", "name: t('cityGuide.allCities')", "All Cities"),
            ('Explore China', '{t(\'cityGuide.exploreChina\')}', 'Explore China'),
            ('CHINA{\' \'}\n              <span className="text-[#d3da0c]">CITY GUIDE</span>', '{t(\'cityGuide.title\')}{\' \'}\n              <span className="text-[#d3da0c]">{t(\'cityGuide.titleHighlight\')}</span>', 'CHINA CITY GUIDE'),
            ("Discover the best African-friendly venues, restaurants, and food across China's major cities.", '{t(\'cityGuide.subtitle\')}', "Discover the best African-friendly venues, restaurants, and food across China's major cities."),
            ('Top Venues', '{t(\'cityGuide.topVenues\')}', 'Top Venues'),
            ('Neighborhoods', '{t(\'cityGuide.neighborhoods\')}', 'Neighborhoods'),
            ('Search venues, restaurants...', '{t(\'cityGuide.searchPlaceholder\')}', 'Search venues, restaurants...'),
            ("venue.music_genres[0] || 'Club'", "venue.music_genres[0] || t('cityGuide.club')", 'Club'),
            ("'New'", "t('cityGuide.new')", 'New'),
            ('No venues found', '{t(\'cityGuide.noVenuesFound\')}', 'No venues found'),
            ('Nightlife & Venues', '{t(\'cityGuide.nightlifeVenues\')}', 'Nightlife & Venues'),
            ('African Restaurants', '{t(\'cityGuide.africanRestaurants\')}', 'African Restaurants'),
            ('No restaurants found', '{t(\'cityGuide.noRestaurantsFound\')}', 'No restaurants found'),
            ('Join the Community', '{t(\'cityGuide.joinCommunity\')}', 'Join the Community'),
            ('Connect with fellow Africans in China', '{t(\'cityGuide.communitySubtitle\')}', 'Connect with fellow Africans in China'),
            ('Find Your City Group', '{t(\'cityGuide.findCityGroup\')}', 'Find Your City Group'),
        ]
    },
    'src/pages/Community.tsx': {
        'namespace': 'community',
        'import_after': "import { useState, useEffect, useRef } from 'react';",
        'hooks': [{'before': '  const { user, profile, isAuthenticated } = useAuthStore();', 'insert': '  const { t } = useTranslation();\n'}],
        'replacements': [
            ("toast.error('Please sign in to like posts')", "toast.error(t('community.signInToLike'))", "Please sign in to like posts"),
            ("toast.error('Please sign in to comment')", "toast.error(t('community.signInToComment'))", "Please sign in to comment"),
            ("title: 'Sound It Community'", "title: t('community.shareTitle')", "Sound It Community"),
            ("text: 'Check out this post on Sound It!'", "text: t('community.shareText')", "Check out this post on Sound It!"),
            ('Community', '{t(\'community.title\')}', 'Community'),
            ('Share memories, connect with friends, and relive the best moments from past events.', '{t(\'community.subtitle\')}', 'Share memories, connect with friends, and relive the best moments from past events.'),
            ('Share your event experience...', '{t(\'community.shareExperience\')}', 'Share your event experience...'),
            ('Add Photo', '{t(\'community.addPhoto\')}', 'Add Photo'),
            ('Cancel', '{t(\'community.cancel\')}', 'Cancel'),
            ('Post', '{t(\'community.post\')}', 'Post'),
            ('...see more', '{t(\'community.seeMore\')}', '...see more'),
            ('alt="Post"', 'alt={t(\'community.postImage\')}', 'Post'),
            (' likes', ' {t(\'community.likes\')}', ' likes'),
            (' comments', ' {t(\'community.comments\')}', ' comments'),
            (' shares', ' {t(\'community.shares\')}', ' shares'),
            ('Like', '{t(\'community.like\')}', 'Like'),
            ('Comment', '{t(\'community.comment\')}', 'Comment'),
            ('Share', '{t(\'community.share\')}', 'Share'),
            ('Write a comment...', '{t(\'community.writeComment\')}', 'Write a comment...'),
            ('No posts yet', '{t(\'community.noPostsYet\')}', 'No posts yet'),
            ('Be the first to share your event experience!', '{t(\'community.beFirst\')}', 'Be the first to share your event experience!'),
            ('Share Post', '{t(\'community.sharePost\')}', 'Share Post'),
            ('Share via...', '{t(\'community.shareVia\')}', 'Share via...'),
            ('Copy Link', '{t(\'community.copyLink\')}', 'Copy Link'),
        ]
    },
    'src/pages/Recaps.tsx': {
        'namespace': 'recaps',
        'import_after': "import { useState, useEffect } from 'react';",
        'hooks': [{'before': '  const { recaps, isLoading: loading, fetchRecaps, fetchRecapById, likeRecap } = useRecapsStore();', 'insert': '  const { t } = useTranslation();\n'}],
        'replacements': [
            ('Event Recaps', '{t(\'recaps.title\')}', 'Event Recaps'),
            ('Relive the moments from past events', '{t(\'recaps.subtitle\')}', 'Relive the moments from past events'),
            ('No Recaps Yet', '{t(\'recaps.noRecapsYet\')}', 'No Recaps Yet'),
            ('Event highlights will appear here when organizers share photos from their amazing events.', '{t(\'recaps.noRecapsDescription\')}', 'Event highlights will appear here when organizers share photos from their amazing events.'),
            ('Back to Recaps', '{t(\'recaps.backToRecaps\')}', 'Back to Recaps'),
            ('alt={`Photo ${selectedPhotoIndex + 1}`}', 'alt={`${t(\'recaps.photo\')} ${selectedPhotoIndex + 1}`}', 'Photo'),
            ('Photos', '{t(\'recaps.photos\')}', 'Photos'),
            ('alt={`Thumbnail ${idx + 1}`}', 'alt={`${t(\'recaps.thumbnail\')} ${idx + 1}`}', 'Thumbnail'),
            ('Views', '{t(\'recaps.views\')}', 'Views'),
            ('Likes', '{t(\'recaps.likes\')}', 'Likes'),
        ]
    },
    'src/pages/Scan.tsx': {
        'namespace': 'scan',
        'import_after': "import { useState, useRef, useEffect } from 'react';",
        'hooks': [{'before': '  const navigate = useNavigate();', 'insert': '  const { t } = useTranslation();\n'}],
        'replacements': [
            ("toast.error('Camera access denied. Use manual entry.')", "toast.error(t('scan.cameraDenied'))", "Camera access denied. Use manual entry."),
            ("message: 'Invalid QR code format'", "message: t('scan.invalidQRCode')", "Invalid QR code format"),
            ("toast.success('Ticket validated!')", "toast.success(t('scan.ticketValidated'))", "Ticket validated!"),
            ("`Ticket already used at ${data.used_at}`", "`${t('scan.ticketAlreadyUsed')} ${data.used_at}`", "Ticket already used at"),
            ("toast.error('Ticket has been cancelled')", "toast.error(t('scan.ticketCancelled'))", "Ticket has been cancelled"),
            ("toast.error('Ticket not found')", "toast.error(t('scan.ticketNotFound'))", "Ticket not found"),
            ("toast.error(data.message || 'Invalid ticket')", "toast.error(data.message || t('scan.invalidTicket'))", "Invalid ticket"),
            ("message: 'Network error. Please try again.'", "message: t('scan.networkError')", "Network error. Please try again."),
            ("toast.error('Validation failed - network error')", "toast.error(t('scan.validationFailed'))", "Validation failed - network error"),
            ('Scan Ticket', '{t(\'scan.title\')}', 'Scan Ticket'),
            ('Valid Ticket', '{t(\'scan.validTicket\')}', 'Valid Ticket'),
            ('Invalid Ticket', '{t(\'scan.invalidTicketTitle\')}', 'Invalid Ticket'),
            ('Scan Another', '{t(\'scan.scanAnother\')}', 'Scan Another'),
            ('Done', '{t(\'scan.done\')}', 'Done'),
            ('Position QR code within frame', '{t(\'scan.positionQR\')}', 'Position QR code within frame'),
            ('Camera not available. Use manual entry.', '{t(\'scan.cameraNotAvailable\')}', 'Camera not available. Use manual entry.'),
            ('Enter Code Manually', '{t(\'scan.enterCodeManually\')}', 'Enter Code Manually'),
            ('Enter Ticket Code', '{t(\'scan.enterTicketCode\')}', 'Enter Ticket Code'),
            ('e.g., TKT-123456', '{t(\'scan.codePlaceholder\')}', 'e.g., TKT-123456'),
            ('Back', '{t(\'scan.back\')}', 'Back'),
            ('Validate', '{t(\'scan.validate\')}', 'Validate'),
            ("event_title: `Event ${data.event_id}`", "event_title: `${t('scan.event')} ${data.event_id}`", "Event"),
            ("user_name: `User ${data.user_id}`", "user_name: `${t('scan.user')} ${data.user_id}`", "User"),
            ("toast.error('Flashlight not available')", "toast.error(t('scan.flashlightNotAvailable'))", "Flashlight not available"),
        ]
    },
    'src/pages/Validate.tsx': {
        'namespace': 'validate',
        'import_after': "import { useEffect, useState } from 'react';",
        'hooks': [{'before': "    const { token } = useParams<{ token: string }>();", 'insert': '    const { t } = useTranslation();\n'}],
        'replacements': [
            ("setError('Invalid token')", "setError(t('validate.invalidToken'))", "Invalid token"),
            ("setError('Please log in to validate tickets')", "setError(t('validate.loginToValidate'))", "Please log in to validate tickets"),
            ('Validating ticket...', '{t(\'validate.validating\')}', 'Validating ticket...'),
            ('Authentication Required', '{t(\'validate.authRequired\')}', 'Authentication Required'),
            ('Please log in to validate this ticket', '{t(\'validate.loginPrompt\')}', 'Please log in to validate this ticket'),
            ('Go to Login', '{t(\'validate.goToLogin\')}', 'Go to Login'),
            ('No validation result', '{t(\'validate.noResult\')}', 'No validation result'),
            ('Ticket Validation', '{t(\'validate.title\')}', 'Ticket Validation'),
            ('Valid Ticket', '{t(\'validate.validTicket\')}', 'Valid Ticket'),
            ('Ticket has been successfully validated', '{t(\'validate.successMessage\')}', 'Ticket has been successfully validated'),
            ('Ticket ID', '{t(\'validate.ticketId\')}', 'Ticket ID'),
            ('Validated At', '{t(\'validate.validatedAt\')}', 'Validated At'),
            ('Event ID', '{t(\'validate.eventId\')}', 'Event ID'),
            ('Back to Dashboard', '{t(\'validate.backToDashboard\')}', 'Back to Dashboard'),
            ('Invalid Ticket', '{t(\'validate.invalidTicket\')}', 'Invalid Ticket'),
            ("This ticket was already used on{' '}", "{t('validate.alreadyUsedOn')}{' '}", "This ticket was already used on"),
            ('This ticket has been cancelled and cannot be used', '{t(\'validate.cancelledMessage\')}', 'This ticket has been cancelled and cannot be used'),
            ("toast.success('Ticket validated successfully!')", "toast.success(t('validate.toastSuccess'))", "Ticket validated successfully!"),
            ("toast.error(data.message || 'Ticket validation failed')", "toast.error(data.message || t('validate.toastFailed'))", "Ticket validation failed"),
            ("toast.error('Validation failed')", "toast.error(t('validate.validationFailedToast'))", "Validation failed"),
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
