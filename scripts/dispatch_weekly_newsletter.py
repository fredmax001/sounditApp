"""
Weekly / Bi-Weekly Entertainment Digest Dispatcher.
Can be run via cron (e.g. every Thursday and Sunday at 18:00) or called on demand.
"""
import os
import sys
import logging
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import NewsletterSubscriber, Event, ArtistProfile
from email_service import send_email, _email_wrapper, is_deliverable_email

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("newsletter_digest")

def build_digest_html(db) -> tuple[str, str, str]:
    now = datetime.now(timezone.utc)
    next_week = now + timedelta(days=14)

    # Fetch top upcoming events
    events = db.query(Event).filter(
        Event.status == "approved",
        Event.start_time >= now,
        Event.start_time <= next_week
    ).order_by(Event.start_time.asc()).limit(3).all()

    # Fetch featured DJs/Artists
    artists = db.query(ArtistProfile).filter(
        ArtistProfile.is_approved.is_(True)
    ).order_by(ArtistProfile.rating.desc().nullslast()).limit(3).all()

    subject = f"Sound It Weekly: Top China Nightlife, Events & DJs This Week"

    events_html = ""
    for ev in events:
        date_str = ev.start_time.strftime("%a, %b %d • %H:%M") if ev.start_time else "Upcoming"
        ev_url = f"https://sounditent.com/events/{ev.slug or ev.id}"
        events_html += f"""
        <div style="margin-bottom: 16px; padding: 14px; background: #fafafa; border: 1px solid #e4e4e7; border-radius: 10px;">
            <div style="font-weight: 700; font-size: 15px; color: #111;"><a href="{ev_url}" style="color: #111; text-decoration: none;">{ev.title}</a></div>
            <div style="font-size: 13px; color: #71717a; margin-top: 4px;">📅 {date_str} • 📍 {ev.city or 'China'}</div>
            <div style="margin-top: 8px;"><a href="{ev_url}" style="color: #8a9000; font-size: 13px; font-weight: 700; text-decoration: underline;">View Event &amp; Tickets →</a></div>
        </div>
        """

    artists_html = ""
    for art in artists:
        art_url = f"https://sounditent.com/artists/{art.slug or art.id}"
        role_label = getattr(art, 'artist_type', 'DJ')
        role_str = role_label.value if hasattr(role_label, 'value') else str(role_label)
        artists_html += f"""
        <div style="display: inline-block; width: 46%; margin: 1%; vertical-align: top; padding: 12px; background: #fafafa; border: 1px solid #e4e4e7; border-radius: 10px; text-align: center;">
            <div style="font-weight: 700; font-size: 14px; color: #111;"><a href="{art_url}" style="color: #111; text-decoration: none;">{art.stage_name}</a></div>
            <div style="font-size: 11px; color: #8a9000; font-weight: 600; text-transform: uppercase; margin-top: 2px;">{role_str}</div>
            <div style="margin-top: 6px;"><a href="{art_url}" style="font-size: 12px; color: #71717a; text-decoration: underline;">Book Artist</a></div>
        </div>
        """

    content_html = f"""
    <p style="font-size: 16px; margin-bottom: 12px;">Hey Partygoers &amp; Nightlife Enthusiasts,</p>
    <p style="font-size: 15px; line-height: 1.6; color: #374151;">
        Here is your curated weekly digest of what's happening across China's hottest venues, festival stages, and underground scenes.
    </p>

    <div style="margin: 28px 0 16px 0;">
        <h3 style="font-size: 16px; font-weight: 800; color: #111; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 2px solid #d3da0c; padding-bottom: 6px;">
            🔥 Top Featured Events
        </h3>
        {events_html or '<p style="color: #71717a;">New secret party announcements dropping soon!</p>'}
    </div>

    <div style="margin: 28px 0 24px 0;">
        <h3 style="font-size: 16px; font-weight: 800; color: #111; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 2px solid #d3da0c; padding-bottom: 6px;">
            🎧 Featured Talent &amp; DJs
        </h3>
        {artists_html}
    </div>

    <div style="text-align: center; margin: 32px 0 16px 0;">
        <a href="https://sounditent.com/events" class="cta" style="background-color: #d3da0c !important; color: #000000 !important; font-weight: 800; font-size: 15px; padding: 14px 34px; border-radius: 12px; text-decoration: none; display: inline-block; box-shadow: 0 4px 15px rgba(211, 218, 12, 0.35);">
            Explore All Live Events in China
        </a>
    </div>
    """

    plain_body = f"Sound It Weekly Digest\nExplore live events and book DJs at https://sounditent.com"
    return subject, plain_body, content_html


def dispatch_newsletter():
    db = SessionLocal()
    try:
        subscribers = db.query(NewsletterSubscriber).filter(
            NewsletterSubscriber.is_active.is_(True)
        ).all()

        if not subscribers:
            logger.info("No active newsletter subscribers found.")
            return

        subject, plain_body, content_html = build_digest_html(db)
        logger.info(f"Dispatching weekly digest '{subject}' to {len(subscribers)} subscribers...")

        sent_count = 0
        for sub in subscribers:
            if not is_deliverable_email(sub.email):
                continue

            unsub_url = f"https://sounditent.com/api/v1/newsletter/unsubscribe?email={sub.email}"
            subscriber_html = content_html + f"""
            <p style="font-size: 12px; color: #a1a1aa; margin-top: 32px; text-align: center; line-height: 1.6;">
                You're receiving this because you subscribed to Sound It Insider.<br/>
                <a href="{unsub_url}" style="color: #71717a; text-decoration: underline;">Unsubscribe from this newsletter</a>
            </p>
            """
            full_html = _email_wrapper(subject, subscriber_html)

            try:
                if send_email(sub.email, subject, plain_body, full_html, is_marketing=True):
                    sent_count += 1
            except Exception as e:
                logger.error(f"Failed sending to {sub.email}: {e}")

        logger.info(f"Successfully dispatched newsletter to {sent_count} subscribers.")
    finally:
        db.close()


if __name__ == "__main__":
    dispatch_newsletter()
