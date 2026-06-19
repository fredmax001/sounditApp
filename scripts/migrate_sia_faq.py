"""
Migration: SIA Phase 1 — FAQ knowledge base, chat logging, unanswered queue.

Run: python scripts/migrate_sia_faq.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, Base
from models import AssistantMessage, AssistantFAQ, AssistantUnansweredQuestion


STARTER_FAQS = [
    # EVENT DISCOVERY
    {"faq_id": "find_events", "category": "events", "patterns": ["what events are happening", "upcoming events", "what's on this weekend", "show me events"], "answer": "I can help you find events! You can browse by genre, date, or venue on the main page. What's your vibe — Afrobeats, Amapiano, RNB, Hip Hop? Or tell me a date and I'll show you what's on."},
    {"faq_id": "event_details", "category": "events", "patterns": ["what time does [event] start", "when is [event]", "event time"], "answer": "Let me check that event for you. Doors usually open 30 minutes before the listed start time. Which event are you asking about?"},
    {"faq_id": "event_location", "category": "events", "patterns": ["where is [event]", "event address", "venue location", "how do I get there"], "answer": "You can tap the map icon on the event page for directions. Need the exact address? Tell me the event name and I'll check."},
    {"faq_id": "event_price", "category": "events", "patterns": ["how much is [event]", "ticket price", "cost of tickets", "is it free"], "answer": "Ticket prices vary by event and tier. Check the event page for current pricing — there might be early bird or group discounts too."},
    {"faq_id": "event_cancelled", "category": "events", "patterns": ["is [event] cancelled", "event postponed", "event still happening"], "answer": "Let me check the current status for you. If there's been any change, you should have received a notification. Which event are you asking about?"},
    {"faq_id": "genre_events", "category": "events", "patterns": ["afrobeats events", "amapiano events", "rnb events", "hip hop events"], "answer": "I can show you upcoming events by genre. Which genre are you in the mood for — Afrobeats, Amapiano, RNB, or Hip Hop?"},
    {"faq_id": "recommend_events", "category": "events", "patterns": ["recommend me an event", "what should I go to", "what's good this weekend"], "answer": "I can recommend events based on what's trending. What kind of vibe are you looking for — chill, high energy, a specific genre, or something with friends?"},
    # TICKETS & PAYMENTS
    {"faq_id": "buy_tickets", "category": "tickets", "patterns": ["how do I buy tickets", "purchase tickets", "get tickets", "buying process"], "answer": "Easy:\n1. Find the event and tap the ticket price\n2. Select how many tickets\n3. Pay with WeChat Pay or AliPay\n4. Your tickets appear in 'My Tickets'\n\nNeed me to walk you through finding an event first?"},
    {"faq_id": "ticket_not_received", "category": "tickets", "patterns": ["didn't get my ticket", "ticket not showing", "where is my ticket", "purchase confirmation"], "answer": "First, check 'My Tickets' in your profile — sometimes there's a delay. If it's not there after 5 minutes, it might be a payment processing issue. Can you tell me which event and roughly when you bought it?"},
    {"faq_id": "ticket_transfer", "category": "tickets", "patterns": ["transfer ticket", "send ticket to friend", "share ticket", "give ticket to someone"], "answer": "You can share your ticket from 'My Tickets' — tap the ticket and look for the share icon. Each ticket has a unique QR code, so only one person can use it. Make sure you're sending it to the right person!"},
    {"faq_id": "refund_request", "category": "payments", "patterns": ["how do I get a refund", "can I refund", "money back", "cancel ticket"], "answer": "Refund policies are set by each event organizer. I can put you in touch with them directly, or if it's a platform issue (double charge, wrong event), our support team can step in. Which situation applies to you?"},
    {"faq_id": "double_charge", "category": "payments", "patterns": ["charged twice", "double payment", "paid twice", "duplicate charge"], "answer": "That's annoying — let me help. First, check 'My Tickets' — do you see two tickets for the same event? Sometimes the payment processes twice but only one ticket is issued. If you were definitely charged twice, I'll escalate this to our billing team right now. They usually resolve these within 24 hours."},
    {"faq_id": "payment_failed", "category": "payments", "patterns": ["payment not working", "transaction failed", "can't pay", "payment error"], "answer": "Sorry about that. A few things to check:\n1. Make sure your WeChat Pay / AliPay has sufficient balance\n2. Try a different payment method\n3. Check if your bank has any transaction limits\n\nIf it keeps failing, I can connect you with support to check if there's a platform issue."},
    {"faq_id": "ticket_types", "category": "tickets", "patterns": ["what ticket types", "early bird", "vip ticket", "group ticket", "ticket tiers"], "answer": "Most events have a few tiers:\n- **Early Bird** — cheapest, limited quantity\n- **General** — standard price\n- **VIP** — usually includes skip-the-line, better area, or drinks\n- **Group** — discount for 4+ tickets\n\nCheck the event page to see what's available for this specific event."},
    {"faq_id": "qr_code_not_working", "category": "tickets", "patterns": ["qr code not scanning", "ticket not working at door", "can't enter", "entry problem"], "answer": "That's stressful. A few things to try:\n1. Screenshot your QR code in case the app is loading slowly\n2. Make sure brightness is up on your phone\n3. If it's still not working, the door staff should have a backup list — give them your name and phone number\n\nIf this keeps happening, let me know which event and I'll flag it to the organizer."},
    # ACCOUNT & PROFILE
    {"faq_id": "create_account", "category": "account", "patterns": ["how to sign up", "create account", "register", "join sound it"], "answer": "Signing up is easy:\n1. Tap 'Sign Up' on the main page\n2. Enter your phone number\n3. Verify with the SMS code\n4. Fill in your profile\n5. Done!\n\nBusinesses, vendors, and artists can upgrade to special accounts after signing up."},
    {"faq_id": "login_issues", "category": "account", "patterns": ["can't log in", "forgot password", "login not working", "account locked"], "answer": "Let's get you back in. Try:\n1. 'Forgot Password' on the login screen\n2. Make sure you're using the right phone number\n3. Check if Caps Lock is on (if using email login)\n\nIf your account is locked after too many attempts, I can help unlock it — just confirm your phone number for me."},
    {"faq_id": "verification_badge", "category": "account", "patterns": ["how to get verified", "verification badge", "blue check", "verified account"], "answer": "Verification badges show that an account is legit. For users, you can get verified by subscribing to a Premium plan. For businesses and artists, it requires document verification. Want to know more about subscription plans?"},
    {"faq_id": "change_profile", "category": "account", "patterns": ["update profile", "change name", "edit profile", "update photo"], "answer": "Go to your profile page and tap 'Edit Profile.' You can update your name, photo, bio, and social links there. Some changes might need re-verification if you're a business or artist account."},
    {"faq_id": "delete_account", "category": "account", "patterns": ["delete account", "close account", "remove my account"], "answer": "Sorry to see you go. To delete your account, go to Settings > Account > Delete Account. Note: this can't be undone, and any active tickets or subscriptions will be lost. Want me to connect you with support to make sure everything is handled properly?"},
    # ORGANIZERS & CONTACT
    {"faq_id": "contact_organizer", "category": "organizers", "patterns": ["how to contact organizer", "message organizer", "reach event host", "talk to organizer"], "answer": "On the event page, tap the organizer's name — there should be a 'Message' or 'Contact' button. If it's not there, the organizer might have disabled direct messages. Which event are you trying to reach them about? I might be able to help another way."},
    {"faq_id": "become_organizer", "category": "organizers", "patterns": ["host an event", "create event", "become organizer", "list my event"], "answer": "Great! You'll need a Business account to host events. Sign up as a Business account or upgrade your existing account. Once verified, you can create events, sell tickets, and manage everything from your dashboard. Want me to walk you through the business signup?"},
    {"faq_id": "organizer_verification", "category": "organizers", "patterns": ["organizer verification", "business account approval", "pending approval"], "answer": "Business account approvals usually take 1-2 business days. We verify your business documents to keep the platform safe. If you've been waiting longer than that, I can flag it for priority review. What's your business name?"},
    # PLATFORM FEATURES
    {"faq_id": "follow_organizer", "category": "features", "patterns": ["follow organizer", "get notifications", "event alerts"], "answer": "Tap the 'Follow' button on any organizer's profile. You'll get notified when they post new events. You can manage notification settings in your profile if you want to customize what you hear about."},
    {"faq_id": "save_event", "category": "features", "patterns": ["save event", "wishlist", "bookmark event", "interested"], "answer": "Tap the heart or bookmark icon on any event to save it. All saved events show up in your profile under 'Saved Events' — great for planning your weekend!"},
    {"faq_id": "share_event", "category": "features", "patterns": ["share event", "send to friend", "event link"], "answer": "Tap the share icon on the event page — you can share via WeChat, copy the link, or generate a poster. Each share helps the event get more visibility!"},
    {"faq_id": "subscriptions", "category": "features", "patterns": ["subscription plans", "premium", "membership", "monthly plan"], "answer": "Sound It offers subscription plans for different user types:\n- **Businesses**: unlock event hosting and analytics tools\n- **Vendors**: unlock marketplace and order features\n- **Artists**: unlock profile promotion and booking tools\n\nEach tier unlocks more features. Check the 'Subscriptions' section in your profile for details."},
    # TRENDING & DISCOVERY
    {"faq_id": "trending_djs", "category": "trending", "patterns": ["trending djs", "popular djs", "who's playing", "best djs"], "answer": "I can check who's trending right now. Want me to show you the DJs with the most upcoming gigs or the most profile views this week?"},
    {"faq_id": "trending_venues", "category": "trending", "patterns": ["hot venues", "popular venues", "best clubs", "where to go"], "answer": "I can show you the hottest venues right now. Are you looking for a specific area in Shanghai, or open to anywhere?"},
    {"faq_id": "trending_events", "category": "trending", "patterns": ["what's trending", "popular events", "sold out events", "buzzing"], "answer": "I can check what's trending right now. Are you looking for this weekend, this month, or a specific genre?"},
    {"faq_id": "food_vendors", "category": "trending", "patterns": ["food at event", "vendors", "food selling", "what food"], "answer": "I don't always have detailed vendor info for every event, but most organizers list food vendors on the event page. If it's not there, your best bet is to message the organizer directly. Which event are you asking about? I can try to connect you."},
    # GENERAL & ESCALATION
    {"faq_id": "what_is_soundit", "category": "general", "patterns": ["what is sound it", "about sound it", "platform description"], "answer": "Sound It is a platform for discovering and booking African and global music events in China. We connect event organizers, DJs, venues, and fans — from RNB & Slow Sessions to Afrobeats nights to festival experiences. You can find events, buy tickets, follow your favorite organizers, and discover new music experiences."},
    {"faq_id": "soundit_app", "category": "general", "patterns": ["download app", "mobile app", "ios app", "android app"], "answer": "Sound It is available on both iOS and Android. You can download it from the App Store or Google Play — just search 'Sound It.' Or use the web version at sounditent.com — it works great on mobile browsers too."},
    {"faq_id": "support_contact", "category": "general", "patterns": ["contact support", "talk to human", "customer service", "help desk"], "answer": "I can handle most questions, but if you need a human, you can reach our support team through the 'Help' section in your profile. For urgent issues (like being stuck at an event door right now), there's an emergency contact on your ticket."},
    {"faq_id": "report_problem", "category": "general", "patterns": ["report issue", "something wrong", "bug", "report user"], "answer": "Sorry something's not right. Can you tell me more about what's happening? If it's urgent, I'll escalate it right away. If it's a user behavior issue (spam, fake event), you can also report directly from their profile or the event page."},
    {"faq_id": "partnership_inquiry", "category": "general", "patterns": ["partner with sound it", "sponsorship", "business partnership", "collaborate"], "answer": "For partnership and business inquiries, you'll want to talk to our business team. I can connect you with the right person — just let me know what kind of partnership you're interested in (events, sponsorship, vendor, etc.) and I'll make sure it gets to the right team."},
    {"faq_id": "dont_know", "category": "general", "patterns": [], "answer": "That's a good question — I don't have the answer to that right now. Let me connect you with someone who can help. Or if it's not urgent, I can make a note to get this answered and follow up with you. Which would you prefer?"},
]


def migrate_sqlite():
    from sqlalchemy import create_engine
    db_path = engine.url.database
    print(f"[migrate_sia_faq] Using SQLite: {db_path}")
    Base.metadata.create_all(bind=engine, tables=[
        AssistantMessage.__table__,
        AssistantFAQ.__table__,
        AssistantUnansweredQuestion.__table__,
    ])
    _seed_faqs()
    print("[migrate_sia_faq] Tables and FAQs created/verified.")


def migrate_postgres():
    print("[migrate_sia_faq] Using PostgreSQL")
    with engine.connect() as conn:
        # Add new columns to assistant_messages
        for col, ddl in [
            ("source", "ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS source VARCHAR(20)"),
            ("confidence", "ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS confidence FLOAT"),
            ("intent_detected", "ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS intent_detected VARCHAR(50)"),
            ("resolved", "ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE"),
            ("escalated_to_human", "ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS escalated_to_human BOOLEAN DEFAULT FALSE"),
        ]:
            try:
                conn.execute(text(ddl))
            except Exception as e:
                print(f"[migrate_sia_faq] Note while adding {col}: {e}")

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS assistant_faq (
                id SERIAL PRIMARY KEY,
                faq_id VARCHAR(100) UNIQUE NOT NULL,
                category VARCHAR(50),
                question_patterns JSONB DEFAULT '[]',
                answer TEXT NOT NULL,
                usage_count INTEGER DEFAULT 0,
                helpful_count INTEGER DEFAULT 0,
                not_helpful_count INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_assistant_faq_category ON assistant_faq(category);
            CREATE INDEX IF NOT EXISTS idx_assistant_faq_faq_id ON assistant_faq(faq_id);
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS assistant_unanswered (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                question TEXT NOT NULL,
                context TEXT,
                status VARCHAR(30) DEFAULT 'pending',
                admin_notes TEXT,
                suggested_answer TEXT,
                reviewed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_assistant_unanswered_status ON assistant_unanswered(status);
            CREATE INDEX IF NOT EXISTS idx_assistant_unanswered_user_id ON assistant_unanswered(user_id);
        """))
        conn.commit()

    _seed_faqs()
    print("[migrate_sia_faq] Tables and FAQs created/verified.")


def _seed_faqs():
    from sqlalchemy.orm import Session
    with Session(bind=engine) as db:
        existing = {f.faq_id for f in db.query(AssistantFAQ.faq_id).all()}
        added = 0
        for item in STARTER_FAQS:
            if item["faq_id"] in existing:
                continue
            db.add(AssistantFAQ(
                faq_id=item["faq_id"],
                category=item["category"],
                question_patterns=item["patterns"],
                answer=item["answer"],
            ))
            added += 1
        db.commit()
        print(f"[migrate_sia_faq] Seeded {added} new FAQs ({len(existing)} already present).")


if __name__ == "__main__":
    driver = engine.url.drivername
    if "sqlite" in driver:
        migrate_sqlite()
    elif "postgres" in driver:
        migrate_postgres()
    else:
        print(f"[migrate_sia_faq] Unsupported driver: {driver}")
        sys.exit(1)
