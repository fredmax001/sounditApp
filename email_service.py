"""
Email service module using SMTP SSL for transactional emails.
If SMTP is not configured, emails are logged to console (dev mode).
"""
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
from config import get_settings

logger = logging.getLogger(__name__)


# ─────────────────────────── Core Transport ───────────────────────────

def _smtp_send(
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None,
    from_email: Optional[str] = None
) -> bool:
    """Send email via SMTP SSL (Hostinger/any provider)."""
    settings = get_settings()
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        return False

    sender = from_email or settings.SMTP_FROM or settings.SMTP_USER
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender
        msg["To"] = to_email

        msg.attach(MIMEText(body, "plain"))
        if html_body:
            msg.attach(MIMEText(html_body, "html"))

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=30) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            # Use SMTP_USER as envelope-from to satisfy strict SMTP servers
            envelope_from = settings.SMTP_USER
            server.sendmail(envelope_from, [to_email], msg.as_string())

        logger.info(f"[SMTP EMAIL SENT] To: {to_email}, Subject: {subject}")
        return True
    except Exception as e:
        logger.error(f"SMTP send failed: {e}")
        return False


def _console_log(to_email: str, subject: str, body: str):
    """Dev fallback: log email to console."""
    logger.info(f"[EMAIL LOG — DEV MODE] To: {to_email} | Subject: {subject}")
    logger.info(f"Body preview: {body[:200]}...")


# ─────────────────────────── Public API ───────────────────────────

def send_email(
    to_email: str,
    subject: str,
    body: str = "",
    html_body: Optional[str] = None,
    from_email: Optional[str] = None
) -> bool:
    """
    Send an email via SMTP SSL → console log fallback.
    At least one of body or html_body must be provided.
    """
    settings = get_settings()
    sender = from_email or settings.SMTP_FROM or settings.SMTP_USER or "support@sounditent.com"

    # Send via SMTP SSL
    if _smtp_send(to_email, subject, body, html_body, from_email):
        return True

    # Dev fallback
    _console_log(to_email, subject, body or html_body or "")
    return False


# ─────────────────────────── Template Helpers ───────────────────────────

def _email_wrapper(title: str, content_html: str) -> str:
    """Standard HTML email wrapper with Sound It branding."""
    logo_url = "https://sounditent.com/logo.png"
    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{ margin: 0; padding: 0; background: #0a0a0a; font-family: 'Segoe UI', Arial, sans-serif; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #141414; border-radius: 16px; overflow: hidden; }}
        .header {{ background: #d3da0c; padding: 24px 32px; text-align: center; }}
        .header img {{ max-height: 48px; width: auto; display: block; margin: 0 auto; }}
        .content {{ padding: 32px; color: #e5e5e5; line-height: 1.6; }}
        .content p {{ margin: 0 0 16px; }}
        .content strong {{ color: #d3da0c; }}
        .cta {{ display: inline-block; margin: 16px 0; padding: 14px 28px; background: #d3da0c; color: #000; text-decoration: none; border-radius: 12px; font-weight: 700; }}
        .qr-box {{ background: #fff; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }}
        .qr-box img {{ max-width: 240px; height: auto; }}
        .footer {{ padding: 24px 32px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #222; }}
        .code {{ font-family: 'Courier New', monospace; font-size: 28px; letter-spacing: 4px; color: #d3da0c; background: #0a0a0a; padding: 12px 24px; border-radius: 8px; display: inline-block; margin: 12px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="{logo_url}" alt="Sound It" />
        </div>
        <div class="content">
            {content_html}
        </div>
        <div class="footer">
            <p>Sound It China — Your Nightlife Connection</p>
            <p>If you need help, contact us at support@sounditent.com</p>
        </div>
    </div>
</body>
</html>"""


# ─── Welcome Email ───

def send_welcome_email(to_email: str, first_name: str = "") -> bool:
    """Welcome email for regular users (sent immediately on registration)."""
    name = first_name or "there"
    subject = "Welcome to Sound It 🎉"
    body = f"""Hi {name},

Welcome to Sound It 🎉

We're excited to have you on the platform.

Sound It is designed for different types of users, and here's how to get the best experience depending on your role:

👤 USERS
The mobile version is best for regular users. You can:
• Discover events
• Buy tickets
• View your QR tickets
• Access event information
• Receive updates and notifications
• Scan into events quickly

For a better mobile experience, you can also add Sound It to your home screen like an app:

📱 On iPhone (Safari):
1. Open the website
2. Tap the Share button
3. Select "Add to Home Screen"

📱 On Android (Chrome):
1. Open the website
2. Tap the 3-dot menu
3. Select "Add to Home Screen"

Thank you for joining Sound It.
We're building a smarter event and entertainment experience for everyone.

— Sound It Team"""

    html = _email_wrapper(
        subject,
        f"""<p>Hi {name},</p>
        <p>Welcome to <strong>Sound It</strong> 🎉</p>
        <p>We're excited to have you on the platform.</p>
        <p>Sound It is designed for different types of users, and here's how to get the best experience depending on your role:</p>
        <div style="background:#0a0a0a; padding:20px; border-radius:12px; margin:16px 0;">
            <h3 style="color:#d3da0c; margin:0 0 12px;">👤 USERS</h3>
            <p style="margin:0 0 12px;">The mobile version is best for regular users. You can:</p>
            <ul style="margin:0; padding-left:20px; color:#ccc;">
                <li>Discover events</li>
                <li>Buy tickets</li>
                <li>View your QR tickets</li>
                <li>Access event information</li>
                <li>Receive updates and notifications</li>
                <li>Scan into events quickly</li>
            </ul>
        </div>
        <p>For a better mobile experience, you can also add Sound It to your home screen like an app:</p>
        <div style="background:#0a0a0a; padding:16px; border-radius:12px; margin:12px 0;">
            <p style="margin:0 0 8px; font-weight:600;">📱 On iPhone (Safari):</p>
            <ol style="margin:0; padding-left:20px; color:#ccc;">
                <li>Open the website</li>
                <li>Tap the Share button</li>
                <li>Select "Add to Home Screen"</li>
            </ol>
        </div>
        <div style="background:#0a0a0a; padding:16px; border-radius:12px; margin:12px 0;">
            <p style="margin:0 0 8px; font-weight:600;">📱 On Android (Chrome):</p>
            <ol style="margin:0; padding-left:20px; color:#ccc;">
                <li>Open the website</li>
                <li>Tap the 3-dot menu</li>
                <li>Select "Add to Home Screen"</li>
            </ol>
        </div>
        <a href="https://sounditent.com" class="cta">Start Exploring</a>
        <p style="margin-top:24px; color:#888;">Thank you for joining Sound It.<br>We're building a smarter event and entertainment experience for everyone.</p>
        <p style="color:#888;">— Sound It Team</p>"""
    )
    return send_email(to_email, subject, body, html)


def send_business_welcome_email(to_email: str, first_name: str = "") -> bool:
    """Welcome email for business/organizer accounts (sent after admin approval)."""
    name = first_name or "there"
    subject = "Your Organizer Account is Approved — Welcome to Sound It!"
    body = f"""Hi {name},

Welcome to Sound It 🎉

We're excited to have you on the platform.

Sound It is designed for different types of users, and here's how to get the best experience depending on your role:

🎟️ ORGANIZERS
For organizers, we highly recommend using a laptop or desktop during setup and event creation.

Desktop gives you full access to:
• Event creation tools
• Ticket management
• Analytics & reports
• Team & vendor management
• Revenue tracking
• Full dashboard controls

Mobile is mainly optimized for:
• Viewing metrics
• Event scanning/check-ins
• Managing quick tasks on the go

Thank you for joining Sound It. We're building a smarter event and entertainment experience for everyone.

— Sound It Team"""

    html = _email_wrapper(
        subject,
        f"""<p>Hi {name},</p>
        <p>Welcome to <strong>Sound It</strong> 🎉</p>
        <p>We're excited to have you on the platform.</p>
        <p>Sound It is designed for different types of users, and here's how to get the best experience depending on your role:</p>
        <div style="background:#0a0a0a; padding:20px; border-radius:12px; margin:16px 0;">
            <h3 style="color:#d3da0c; margin:0 0 12px;">🎟️ ORGANIZERS</h3>
            <p style="margin:0 0 12px;">For organizers, we highly recommend using a <strong>laptop or desktop</strong> during setup and event creation.</p>
            <p style="margin:0 0 8px; font-weight:600;">Desktop gives you full access to:</p>
            <ul style="margin:0 0 16px; padding-left:20px; color:#ccc;">
                <li>Event creation tools</li>
                <li>Ticket management</li>
                <li>Analytics & reports</li>
                <li>Team & vendor management</li>
                <li>Revenue tracking</li>
                <li>Full dashboard controls</li>
            </ul>
            <p style="margin:0 0 8px; font-weight:600;">Mobile is mainly optimized for:</p>
            <ul style="margin:0; padding-left:20px; color:#ccc;">
                <li>Viewing metrics</li>
                <li>Event scanning/check-ins</li>
                <li>Managing quick tasks on the go</li>
            </ul>
        </div>
        <a href="https://sounditent.com/login" class="cta">Go to Dashboard</a>
        <p style="margin-top:24px; color:#888;">Thank you for joining Sound It.<br>We're building a smarter event and entertainment experience for everyone.</p>
        <p style="color:#888;">— Sound It Team</p>"""
    )
    return send_email(to_email, subject, body, html)


def send_artist_welcome_email(to_email: str, first_name: str = "") -> bool:
    """Welcome email for artist accounts (sent after admin approval)."""
    name = first_name or "there"
    subject = "Your Artist Account is Approved — Welcome to Sound It!"
    body = f"""Hi {name},

Welcome to Sound It 🎉

We're excited to have you on the platform.

Sound It is designed for different types of users, and here's how to get the best experience depending on your role:

🎤 ARTISTS & DJs
Artists and DJs are encouraged to use a laptop or desktop for the best experience while setting up profiles and managing bookings.

Desktop access is best for:
• Uploading media & press kits
• Managing artist profiles
• Viewing booking requests
• Event collaborations
• Analytics & audience insights
• Full dashboard access

Mobile is mainly useful for:
• Checking notifications
• Viewing bookings
• Messaging & updates
• Quick account management

Thank you for joining Sound It. We're building a smarter event and entertainment experience for everyone.

— Sound It Team"""

    html = _email_wrapper(
        subject,
        f"""<p>Hi {name},</p>
        <p>Welcome to <strong>Sound It</strong> 🎉</p>
        <p>We're excited to have you on the platform.</p>
        <p>Sound It is designed for different types of users, and here's how to get the best experience depending on your role:</p>
        <div style="background:#0a0a0a; padding:20px; border-radius:12px; margin:16px 0;">
            <h3 style="color:#d3da0c; margin:0 0 12px;">🎤 ARTISTS & DJs</h3>
            <p style="margin:0 0 12px;">Artists and DJs are encouraged to use a <strong>laptop or desktop</strong> for the best experience while setting up profiles and managing bookings.</p>
            <p style="margin:0 0 8px; font-weight:600;">Desktop access is best for:</p>
            <ul style="margin:0 0 16px; padding-left:20px; color:#ccc;">
                <li>Uploading media & press kits</li>
                <li>Managing artist profiles</li>
                <li>Viewing booking requests</li>
                <li>Event collaborations</li>
                <li>Analytics & audience insights</li>
                <li>Full dashboard access</li>
            </ul>
            <p style="margin:0 0 8px; font-weight:600;">Mobile is mainly useful for:</p>
            <ul style="margin:0; padding-left:20px; color:#ccc;">
                <li>Checking notifications</li>
                <li>Viewing bookings</li>
                <li>Messaging & updates</li>
                <li>Quick account management</li>
            </ul>
        </div>
        <a href="https://sounditent.com/login" class="cta">Go to Dashboard</a>
        <p style="margin-top:24px; color:#888;">Thank you for joining Sound It.<br>We're building a smarter event and entertainment experience for everyone.</p>
        <p style="color:#888;">— Sound It Team</p>"""
    )
    return send_email(to_email, subject, body, html)


def send_vendor_welcome_email(to_email: str, first_name: str = "") -> bool:
    """Welcome email for vendor accounts (sent after admin approval)."""
    name = first_name or "there"
    subject = "Your Vendor Account is Approved — Welcome to Sound It!"
    body = f"""Hi {name},

Welcome to Sound It 🎉

We're excited to have you on the platform.

Sound It is designed for different types of users, and here's how to get the best experience depending on your role:

🛍️ VENDORS
Vendors are also encouraged to use a laptop or desktop for full setup and management.

Desktop access is best for:
• Product uploads
• Vendor profile setup
• Inventory management
• Sales tracking
• Full dashboard controls

Mobile is mainly useful for:
• Monitoring activity
• Quick updates
• Scanning during events
• Basic management on the move

Thank you for joining Sound It. We're building a smarter event and entertainment experience for everyone.

— Sound It Team"""

    html = _email_wrapper(
        subject,
        f"""<p>Hi {name},</p>
        <p>Welcome to <strong>Sound It</strong> 🎉</p>
        <p>We're excited to have you on the platform.</p>
        <p>Sound It is designed for different types of users, and here's how to get the best experience depending on your role:</p>
        <div style="background:#0a0a0a; padding:20px; border-radius:12px; margin:16px 0;">
            <h3 style="color:#d3da0c; margin:0 0 12px;">🛍️ VENDORS</h3>
            <p style="margin:0 0 12px;">Vendors are also encouraged to use a <strong>laptop or desktop</strong> for full setup and management.</p>
            <p style="margin:0 0 8px; font-weight:600;">Desktop access is best for:</p>
            <ul style="margin:0 0 16px; padding-left:20px; color:#ccc;">
                <li>Product uploads</li>
                <li>Vendor profile setup</li>
                <li>Inventory management</li>
                <li>Sales tracking</li>
                <li>Full dashboard controls</li>
            </ul>
            <p style="margin:0 0 8px; font-weight:600;">Mobile is mainly useful for:</p>
            <ul style="margin:0; padding-left:20px; color:#ccc;">
                <li>Monitoring activity</li>
                <li>Quick updates</li>
                <li>Scanning during events</li>
                <li>Basic management on the move</li>
            </ul>
        </div>
        <a href="https://sounditent.com/login" class="cta">Go to Dashboard</a>
        <p style="margin-top:24px; color:#888;">Thank you for joining Sound It.<br>We're building a smarter event and entertainment experience for everyone.</p>
        <p style="color:#888;">— Sound It Team</p>"""
    )
    return send_email(to_email, subject, body, html)


# ─── OTP Email ───

def send_otp_email(to_email: str, otp_code: str, purpose: str = "verification") -> bool:
    subject = "Your Sound It verification code"
    body = f"""Your Sound It verification code is: {otp_code}

This code will expire in 10 minutes.

If you didn't request this code, you can safely ignore this email.

— Sound It Team"""

    html = _email_wrapper(
        subject,
        f"""<p>Your verification code is:</p>
        <div class="code">{otp_code}</div>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <p style="color:#888; font-size:13px;">If you didn't request this code, you can safely ignore this email.</p>"""
    )
    return send_email(to_email, subject, body, html)


# ─── Ticket Approved Email ───

def send_ticket_approved_email(
    to_email: str,
    first_name: str,
    event_title: str,
    event_date: str,
    event_venue: str,
    tickets: List[dict],  # Each dict: {ticket_number, qr_code}
    quantity: int = 1
) -> bool:
    """Send ticket approval email with ALL individual ticket QR codes."""
    subject = f"Your tickets for {event_title} are confirmed!"
    name = first_name or "there"

    # Build plain text body
    ticket_list_text = "\n".join(
        f"• Ticket #{i+1}: {t['ticket_number']}" for i, t in enumerate(tickets)
    )
    body = f"""Hi {name},

Great news! Your ticket order for "{event_title}" has been approved.

Event Details:
• Event: {event_title}
• Date: {event_date}
• Venue: {event_venue}
• Quantity: {quantity} ticket(s)

Your Tickets:
{ticket_list_text}

Please show each QR code at the entrance (one per person).
View your tickets: https://sounditent.com/tickets

— Sound It Team"""

    # Build HTML with all QR codes in a grid
    if len(tickets) == 1:
        # Single ticket - large display
        t = tickets[0]
        qr_html = f"""<div class="qr-box">
            <p style="color:#000; margin:0 0 12px; font-weight:600;">Show this QR at the entrance</p>
            <img src="{t['qr_code']}" alt="Ticket QR Code" style="max-width:240px;" />
            <p style="color:#000; margin:12px 0 0; font-family:monospace; font-size:14px;">{t['ticket_number']}</p>
        </div>"""
    else:
        # Multiple tickets - grid display
        qr_items = []
        for i, t in enumerate(tickets):
            qr_items.append(f"""<div style="background:#fff; padding:16px; border-radius:12px; text-align:center;">
                <p style="color:#000; margin:0 0 8px; font-weight:700; font-size:16px;">Ticket #{i+1}</p>
                <img src="{t['qr_code']}" alt="Ticket QR #{i+1}" style="max-width:180px; width:100%; height:auto;" />
                <p style="color:#000; margin:8px 0 0; font-family:monospace; font-size:11px; word-break:break-all;">{t['ticket_number']}</p>
            </div>""")
        qr_html = f"""<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:16px; margin:20px 0;">
            {''.join(qr_items)}
        </div>"""

    html = _email_wrapper(
        subject,
        f"""<p>Hi {name},</p>
        <p>Great news! Your ticket order for <strong>{event_title}</strong> has been approved.</p>
        <div style="background:#0a0a0a; padding:16px; border-radius:12px; margin:16px 0;">
            <p style="margin:4px 0;"><strong>Event:</strong> {event_title}</p>
            <p style="margin:4px 0;"><strong>Date:</strong> {event_date}</p>
            <p style="margin:4px 0;"><strong>Venue:</strong> {event_venue}</p>
            <p style="margin:4px 0;"><strong>Quantity:</strong> {quantity} ticket(s)</p>
        </div>
        <p style="margin:0 0 12px; font-weight:600;">Show each QR code at the entrance (one per person):</p>
        {qr_html}
        <a href="https://sounditent.com/tickets" class="cta">View My Tickets</a>
        <p style="margin-top:24px; color:#888;">— Sound It Team</p>"""
    )
    return send_email(to_email, subject, body, html)


# ─── Account Approved Email ───

def send_account_approved_email(
    to_email: str,
    first_name: str,
    account_type: str  # "business", "artist", or "vendor"
) -> bool:
    name = first_name or "there"
    type_label = account_type.capitalize()
    subject = f"Your {type_label} account has been approved!"

    body = f"""Hi {name},

Congratulations! Your {type_label} account on Sound It China has been approved.

You can now:
• Create and manage events
• Access your dashboard
• Connect with your audience

Log in to get started: https://sounditent.com/login

— Sound It Team"""

    html = _email_wrapper(
        subject,
        f"""<p>Hi {name},</p>
        <p>Congratulations! Your <strong>{type_label}</strong> account on Sound It China has been approved.</p>
        <p>You can now create and manage events, access your dashboard, and connect with your audience.</p>
        <a href="https://sounditent.com/login" class="cta">Go to Dashboard</a>
        <p style="margin-top:24px; color:#888;">— Sound It Team</p>"""
    )
    return send_email(to_email, subject, body, html)


# ─── Account Rejected Email ───

def send_account_rejected_email(
    to_email: str,
    first_name: str,
    account_type: str,
    reason: Optional[str] = None
) -> bool:
    name = first_name or "there"
    type_label = account_type.capitalize()
    subject = f"Your {type_label} account application"

    reason_text = f"\nReason: {reason}\n" if reason else ""
    body = f"""Hi {name},

Thank you for applying for a {type_label} account on Sound It China.

Unfortunately, your application could not be approved at this time.{reason_text}

If you have any questions, please contact our support team.

— Sound It Team"""

    reason_html = f"<p><strong>Reason:</strong> {reason}</p>" if reason else ""
    html = _email_wrapper(
        subject,
        f"""<p>Hi {name},</p>
        <p>Thank you for applying for a <strong>{type_label}</strong> account on Sound It China.</p>
        <p>Unfortunately, your application could not be approved at this time.</p>
        {reason_html}
        <p>If you have any questions, please contact our support team.</p>
        <p style="margin-top:24px; color:#888;">— Sound It Team</p>"""
    )
    return send_email(to_email, subject, body, html)


# ─── Legacy wrappers (kept for backwards compatibility) ───

def send_ticket_confirmation(
    to_email: str,
    order_details: dict,
    tickets: List[dict],
    event_details: dict
) -> bool:
    """Send ticket confirmation email."""
    subject = f"Your tickets for {event_details.get('title', 'the event')}"
    body = f"Hi! Your ticket order (#{order_details.get('id')}) is confirmed. See you at the event!"
    return send_email(to_email, subject, body)


def send_contact_form_email(
    name: str,
    email: str,
    subject: str,
    message: str
) -> bool:
    """Send contact form notification."""
    full_subject = f"Contact Form: {subject}"
    body = f"From: {name} <{email}>\n\n{message}"
    return send_email(email, full_subject, body)


def send_password_reset_email(
    to_email: str,
    reset_token: str,
    reset_url: str
) -> bool:
    """Send password reset email with reset link."""
    subject = "Reset your Sound It password"
    body = (
        f"Hello,\n\n"
        f"You requested a password reset. Click the link below to reset your password:\n\n"
        f"{reset_url}\n\n"
        f"This link will expire in 1 hour.\n\n"
        f"If you didn't request this, you can safely ignore this email.\n\n"
        f"— Sound It Team"
    )
    html = _email_wrapper(
        subject,
        f"""<p>Hello,</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="{reset_url}" class="cta">Reset Password</a>
        <p style="color:#888; margin-top:16px;">This link will expire in 1 hour.</p>
        <p style="color:#888;">If you didn't request this, you can safely ignore this email.</p>"""
    )
    return send_email(to_email, subject, body, html)


def send_password_changed_confirmation(to_email: str) -> bool:
    """Send password changed confirmation."""
    subject = "Your Sound It password was changed"
    body = (
        "Hello,\n\n"
        "Your password was successfully changed.\n\n"
        "If you didn't make this change, please contact support immediately.\n\n"
        "— Sound It Team"
    )
    return send_email(to_email, subject, body)


def send_broadcast_email(
    to_emails: List[str],
    subject: str,
    body: str,
    html_body: Optional[str] = None
) -> dict:
    """Send broadcast email to multiple recipients."""
    sent = 0
    failed = 0
    for email in to_emails:
        if send_email(email, subject, body, html_body):
            sent += 1
        else:
            failed += 1
    return {"sent": sent, "failed": failed}
