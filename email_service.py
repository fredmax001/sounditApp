"""
Email service module using SMTP SSL for transactional emails.
If SMTP is not configured, emails are logged to console (dev mode).
"""
import base64
import io
import logging
import smtplib
import ssl
import zipfile
from email import encoders
from email.mime.base import MIMEBase
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
    from_email: Optional[str] = None,
    attachments: Optional[List[tuple]] = None
) -> bool:
    """Send email via SMTP SSL (Hostinger/any provider).
    attachments: list of (filename, bytes, mimetype) tuples
    """
    settings = get_settings()
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        return False

    sender_addr = from_email or settings.SMTP_FROM or settings.SMTP_USER
    sender_formatted = f"Sound It <{sender_addr}>" if "<" not in sender_addr else sender_addr

    try:
        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = sender_formatted
        msg["To"] = to_email

        # Body part
        body_part = MIMEMultipart("alternative")
        body_part.attach(MIMEText(body, "plain"))
        if html_body:
            body_part.attach(MIMEText(html_body, "html"))
        msg.attach(body_part)

        # Attachments
        if attachments:
            for filename, file_bytes, mimetype in attachments:
                maintype, subtype = mimetype.split("/", 1) if "/" in mimetype else ("application", "octet-stream")
                part = MIMEBase(maintype, subtype)
                part.set_payload(file_bytes)
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f"attachment; filename=\"{filename}\"")
                msg.attach(part)

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=30) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            envelope_from = settings.SMTP_USER
            server.sendmail(envelope_from, [to_email], msg.as_string())

        logger.info(f"[SMTP EMAIL SENT] To: {to_email}, Subject: {subject}, Attachments: {len(attachments or [])}")
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
    from_email: Optional[str] = None,
    attachments: Optional[List[tuple]] = None
) -> bool:
    """
    Send an email via SMTP SSL → console log fallback.
    At least one of body or html_body must be provided.
    attachments: list of (filename, bytes, mimetype) tuples
    """
    settings = get_settings()
    sender = from_email or settings.SMTP_FROM or settings.SMTP_USER or "support@sounditent.com"

    # Send via SMTP SSL
    if _smtp_send(to_email, subject, body, html_body, from_email, attachments):
        return True

    # Dev fallback
    _console_log(to_email, subject, body or html_body or "")
    return False


# ─────────────────────────── Template Helpers ───────────────────────────

def _email_wrapper(title: str, content_html: str) -> str:
    """Standard HTML email wrapper — light, email-client-safe Sound It branding.

    Light design chosen deliberately: dark body backgrounds are stripped or
    unpredictably inverted by Gmail/Apple Mail (incl. dark modes), while a
    light card renders consistently everywhere. Brand mark sits on a black
    header bar so the lime drum logo stays vivid.
    """
    logo_url = "https://sounditent.com/brand-mark.png"
    favicon_url = "https://sounditent.com/apple-touch-icon.png"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link rel="icon" type="image/png" href="{favicon_url}" />
    <link rel="apple-touch-icon" href="{favicon_url}" />
    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Sound It",
      "url": "https://sounditent.com",
      "logo": "https://sounditent.com/android-chrome-512x512.png"
    }}
    </script>
    <style>
        body {{
            margin: 0;
            padding: 0;
            background-color: #f4f4f5;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
        }}
        .wrapper {{
            width: 100%;
            background-color: #f4f4f5;
            padding: 32px 12px;
        }}
        .container {{
            max-width: 580px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid #e4e4e7;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
        }}
        .top-accent {{
            height: 4px;
            background: linear-gradient(90deg, #d3da0c 0%, #a8ad0a 100%);
        }}
        .header {{
            background-color: #000000;
            padding: 26px 24px;
            text-align: center;
        }}
        .header img {{
            max-height: 52px;
            width: auto;
            display: inline-block;
            vertical-align: middle;
        }}
        .brand-subtitle {{
            color: #d3da0c;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2.5px;
            margin-top: 12px;
        }}
        .content {{
            padding: 36px 28px;
            color: #27272a;
            font-size: 15px;
            line-height: 1.65;
        }}
        .content p {{
            margin: 0 0 18px 0;
        }}
        .content strong {{
            color: #111111;
        }}
        .content a {{
            color: #8a9000;
            text-decoration: underline;
        }}
        .cta {{
            display: inline-block;
            margin: 20px 0;
            padding: 14px 32px;
            background-color: #d3da0c;
            color: #000000 !important;
            text-decoration: none !important;
            border-radius: 12px;
            font-weight: 800;
            font-size: 15px;
            letter-spacing: 0.3px;
            box-shadow: 0 4px 15px rgba(211, 218, 12, 0.35);
        }}
        .card-box {{
            background-color: #fafafa;
            border: 1px solid #e4e4e7;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
        }}
        .qr-box {{
            background-color: #ffffff;
            border: 1px solid #e4e4e7;
            padding: 20px;
            border-radius: 14px;
            text-align: center;
            margin: 24px 0;
            display: inline-block;
        }}
        .qr-box img {{
            max-width: 220px;
            height: auto;
            display: block;
        }}
        .code {{
            font-family: 'SF Mono', Consolas, Monaco, monospace;
            font-size: 32px;
            font-weight: 800;
            letter-spacing: 6px;
            color: #111111;
            background-color: #f4f4f5;
            padding: 14px 28px;
            border-radius: 10px;
            border: 1px solid #e4e4e7;
            display: inline-block;
            margin: 16px 0;
        }}
        .footer {{
            padding: 28px 32px;
            text-align: center;
            color: #71717a;
            font-size: 12px;
            background-color: #fafafa;
            border-top: 1px solid #e4e4e7;
            line-height: 1.6;
        }}
        .footer p {{
            margin: 4px 0;
        }}
        .footer a {{
            color: #71717a;
            text-decoration: underline;
        }}
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="top-accent"></div>
            <div class="header">
                <a href="https://sounditent.com" target="_blank" style="text-decoration: none;">
                    <img src="{logo_url}" alt="Sound It" />
                </a>
                <div class="brand-subtitle">Entertainment &amp; Event Platform</div>
            </div>
            <div class="content">
                {content_html}
            </div>
            <div class="footer">
                <p style="font-weight: 700; color: #52525b;">Sound It China — Your Nightlife &amp; Event Connection</p>
                <p>Need assistance? Contact us at <a href="mailto:support@sounditent.com">support@sounditent.com</a></p>
                <p style="margin-top: 12px; color: #a1a1aa;">© 2026 Sound It. All rights reserved.</p>
            </div>
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
        <div style="background:#f9fafb; padding:20px; border-radius:12px; margin:16px 0;">
            <h3 style="color:#8a9000; margin:0 0 12px;">👤 USERS</h3>
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
        <div style="background:#f9fafb; padding:16px; border-radius:12px; margin:12px 0;">
            <p style="margin:0 0 8px; font-weight:600;">📱 On iPhone (Safari):</p>
            <ol style="margin:0; padding-left:20px; color:#ccc;">
                <li>Open the website</li>
                <li>Tap the Share button</li>
                <li>Select "Add to Home Screen"</li>
            </ol>
        </div>
        <div style="background:#f9fafb; padding:16px; border-radius:12px; margin:12px 0;">
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
        <div style="background:#f9fafb; padding:20px; border-radius:12px; margin:16px 0;">
            <h3 style="color:#8a9000; margin:0 0 12px;">🎟️ ORGANIZERS</h3>
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
        <div style="background:#f9fafb; padding:20px; border-radius:12px; margin:16px 0;">
            <h3 style="color:#8a9000; margin:0 0 12px;">🎤 ARTISTS & DJs</h3>
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
        <div style="background:#f9fafb; padding:20px; border-radius:12px; margin:16px 0;">
            <h3 style="color:#8a9000; margin:0 0 12px;">🛍️ VENDORS</h3>
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

def _decode_qr_bytes(qr_data: str) -> bytes:
    """Decode a base64 data URI into raw PNG bytes."""
    try:
        if qr_data.startswith("data:image"):
            # Strip the data URI prefix
            qr_data = qr_data.split(",", 1)[-1]
        return base64.b64decode(qr_data)
    except Exception:
        return b""


def send_ticket_approved_email(
    to_email: str,
    first_name: str,
    event_title: str,
    event_date: str,
    event_venue: str,
    tickets: List[dict],  # Each dict: {ticket_number, qr_code}
    quantity: int = 1
) -> bool:
    """Send ticket approval email with QR codes bundled in a ZIP attachment."""
    subject = f"Your tickets for {event_title} are confirmed!"
    name = first_name or "there"
    safe_title = "".join(c if c.isalnum() else "_" for c in event_title)[:30]

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

Please download the attached ZIP file and show each QR code at the entrance (one per person).
You can also view your tickets online: https://sounditent.com/tickets

— Sound It Team"""

    # Build clean HTML (no embedded base64 images — they break in many email clients)
    ticket_rows = "\n".join(
        f"""<tr>
            <td style="padding:10px 16px; border-bottom:1px solid #222; color:#8a9000; font-weight:700;">Ticket #{i+1}</td>
            <td style="padding:10px 16px; border-bottom:1px solid #222; color:#e5e5e5; font-family:monospace;">{t['ticket_number']}</td>
        </tr>"""
        for i, t in enumerate(tickets)
    )

    html = _email_wrapper(
        subject,
        f"""<p>Hi {name},</p>
        <p>Great news! Your ticket order for <strong>{event_title}</strong> has been approved.</p>
        <div style="background:#f9fafb; padding:16px; border-radius:12px; margin:16px 0;">
            <p style="margin:4px 0;"><strong>Event:</strong> {event_title}</p>
            <p style="margin:4px 0;"><strong>Date:</strong> {event_date}</p>
            <p style="margin:4px 0;"><strong>Venue:</strong> {event_venue}</p>
            <p style="margin:4px 0;"><strong>Quantity:</strong> {quantity} ticket(s)</p>
        </div>
        <p style="margin:0 0 12px; font-weight:600;">Your tickets:</p>
        <table style="width:100%; border-collapse:collapse; margin:0 0 20px;">
            {ticket_rows}
        </table>
        <p style="margin:0 0 16px;">📎 <strong>Download the attached ZIP file</strong> for your QR codes. Show each QR at the entrance (one per person).</p>
        <a href="https://sounditent.com/tickets" class="cta">View My Tickets</a>
        <p style="margin-top:24px; color:#888;">— Sound It Team</p>"""
    )

    # Build ZIP attachment with all QR codes
    attachments = []
    try:
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, t in enumerate(tickets):
                qr_bytes = _decode_qr_bytes(t.get("qr_code", ""))
                if qr_bytes:
                    filename = f"ticket_{i+1}_{t['ticket_number']}.png"
                    zf.writestr(filename, qr_bytes)
        zip_buffer.seek(0)
        zip_filename = f"soundit_tickets_{safe_title}.zip"
        attachments.append((zip_filename, zip_buffer.getvalue(), "application/zip"))
    except Exception as e:
        logger.warning(f"Failed to create ticket ZIP: {e}")

    return send_email(to_email, subject, body, html, attachments=attachments)


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


def send_booking_status_update_email(
    to_email: str,
    requester_name: str,
    artist_name: str,
    event_name: str,
    event_date: Optional[str],
    event_city: Optional[str],
    status: str,  # "accepted" or "rejected"
    rejection_reason: Optional[str] = None
) -> bool:
    """Send email to requester when artist accepts or rejects a booking."""
    status_label = status.capitalize()
    subject = f"Your booking request for {event_name or 'an event'} was {status_label}"
    name = requester_name or "there"
    safe_event = event_name or "TBD"
    safe_date = event_date or "TBD"
    safe_city = event_city or "TBD"
    dashboard_url = "https://sounditent.com/dashboard/user"

    if status.lower() == "accepted":
        body = f"""Hi {name},

Great news! {artist_name} has accepted your booking request for "{safe_event}".

Event Details:
• Event: {safe_event}
• Date: {safe_date}
• City: {safe_city}
• Artist: {artist_name}

You can view and manage your booking here: {dashboard_url}

— Sound It Team"""

        html = _email_wrapper(
            subject,
            f"""<p>Hi {name},</p>
            <p>Great news! <strong>{artist_name}</strong> has <span style="color:#22c55e; font-weight:700;">accepted</span> your booking request for <strong>{safe_event}</strong>.</p>
            <div style="background:#f9fafb; padding:16px; border-radius:12px; margin:16px 0;">
                <p style="margin:4px 0;"><strong>Event:</strong> {safe_event}</p>
                <p style="margin:4px 0;"><strong>Date:</strong> {safe_date}</p>
                <p style="margin:4px 0;"><strong>City:</strong> {safe_city}</p>
                <p style="margin:4px 0;"><strong>Artist:</strong> {artist_name}</p>
            </div>
            <a href="{dashboard_url}" class="cta">View My Booking</a>
            <p style="margin-top:24px; color:#888;">— Sound It Team</p>"""
        )
    else:
        reason_html = f"<p style='color:#888;'><strong>Reason:</strong> {rejection_reason}</p>" if rejection_reason else ""
        body = f"""Hi {name},

Unfortunately, {artist_name} has declined your booking request for "{safe_event}".

Event Details:
• Event: {safe_event}
• Date: {safe_date}
• City: {safe_city}
• Artist: {artist_name}
{rejection_reason and f'• Reason: {rejection_reason}' or ''}

You can submit a new request or explore other artists here: https://sounditent.com/artists

— Sound It Team"""

        html = _email_wrapper(
            subject,
            f"""<p>Hi {name},</p>
            <p>Unfortunately, <strong>{artist_name}</strong> has <span style="color:#ef4444; font-weight:700;">declined</span> your booking request for <strong>{safe_event}</strong>.</p>
            <div style="background:#f9fafb; padding:16px; border-radius:12px; margin:16px 0;">
                <p style="margin:4px 0;"><strong>Event:</strong> {safe_event}</p>
                <p style="margin:4px 0;"><strong>Date:</strong> {safe_date}</p>
                <p style="margin:4px 0;"><strong>City:</strong> {safe_city}</p>
                <p style="margin:4px 0;"><strong>Artist:</strong> {artist_name}</p>
                {reason_html}
            </div>
            <a href="https://sounditent.com/artists" class="cta">Find Other Artists</a>
            <p style="margin-top:24px; color:#888;">— Sound It Team</p>"""
        )

    return send_email(to_email, subject, body, html)


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


def send_test_email(to_email: str = "djfredmax221@gmail.com") -> bool:
    """Send a modern test email to demonstrate the upgraded Sound It template."""
    subject = "🎉 Welcome to Sound It — Modern Design Upgrade"
    body = (
        "Hi Fred Max,\n\n"
        "This is a test email demonstrating the new Sound It email template.\n\n"
        "Features:\n"
        "• Black header bar with the new lime drum brand mark\n"
        "• Light, client-safe layout that renders consistently in Gmail/Apple Mail (incl. dark modes)\n"
        "• Favicon and Apple Touch Icon integrated for email client avatar resolution\n\n"
        "— Sound It Team"
    )
    html = _email_wrapper(
        subject,
        """<div style="text-align: center; margin-bottom: 24px;">
            <span style="background-color: rgba(211, 218, 12, 0.15); color: #8a9000; border: 1px solid rgba(211, 218, 12, 0.4); padding: 6px 16px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block;">
                ✨ EMAIL TEMPLATE REDESIGN
            </span>
        </div>
        <h2 style="color: #18181b; font-size: 24px; font-weight: 800; margin: 0 0 16px 0; text-align: center; letter-spacing: -0.5px;">
            Welcome to the New Sound It Experience!
        </h2>
        <p style="font-size: 15px; color: #3f3f46; line-height: 1.65; margin-bottom: 18px;">
            Hi <strong>Fred Max</strong>,
        </p>
        <p style="font-size: 15px; color: #3f3f46; line-height: 1.65; margin-bottom: 20px;">
            We have upgraded our entire email delivery system with a clean, light design built for every email client.
        </p>

        <div style="background-color: #f9fafb; border: 1px solid #e4e4e7; border-radius: 12px; padding: 22px; margin: 24px 0;">
            <h3 style="color: #8a9000; font-size: 15px; font-weight: 700; margin: 0 0 14px 0; text-transform: uppercase; letter-spacing: 1px;">
                🚀 Key Enhancements:
            </h3>
            <ul style="margin: 0; padding-left: 20px; color: #52525b; font-size: 14px; line-height: 1.8;">
                <li><strong style="color:#18181b;">Black Header with New Brand Mark:</strong> The new Sound It drum logo sits on a black bar so the lime mark stays vivid in every client.</li>
                <li><strong style="color:#18181b;">Email Avatar &amp; Favicon:</strong> Formatted sender name <code style="color:#8a9000; background:#f4f4f5; padding:2px 6px; border-radius:4px;">Sound It &lt;support@sounditent.com&gt;</code> and embedded Apple Touch Icon / Favicon tags.</li>
                <li><strong style="color:#18181b;">Light, Client-Safe Design:</strong> White card on a light gray canvas renders consistently in Gmail, Apple Mail, Outlook, and their dark modes — no more unpredictable color inverting.</li>
            </ul>
        </div>

        <div style="text-align: center; margin: 32px 0 16px 0;">
            <a href="https://sounditent.com" class="cta">Launch Sound It Platform →</a>
        </div>
        """
    )
    return send_email(to_email, subject, body, html)


def send_organizer_announcement_email(
    to_emails: List[str],
    announcement_title: str,
    announcement_body: str,
    organizer_name: str,
    event_title: Optional[str] = None,
    event_id: Optional[int] = None
) -> dict:
    """Send an organizer broadcast announcement email to multiple recipients."""
    if not to_emails:
        return {"sent": 0, "failed": 0}

    subject = f"📢 {announcement_title}"
    if event_title:
        subject += f" — {event_title}"

    plain_body = f"Announcement from {organizer_name}:\n\n{announcement_title}\n\n{announcement_body}\n\n— Sound It Platform"
    
    event_url = f"https://sounditent.com/events/{event_id}" if event_id else "https://sounditent.com"

    html_content = f"""
    <div style="text-align: center; margin-bottom: 24px;">
        <span style="background-color: rgba(211, 218, 12, 0.15); color: #8a9000; border: 1px solid rgba(211, 218, 12, 0.4); padding: 6px 16px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block;">
            📢 ORGANIZER ANNOUNCEMENT
        </span>
    </div>
    <h2 style="color: #18181b; font-size: 24px; font-weight: 800; margin: 0 0 8px 0; text-align: center; letter-spacing: -0.5px;">
        {announcement_title}
    </h2>
    {f'<p style="text-align: center; color: #8a9000; font-size: 14px; font-weight: 600; margin-bottom: 20px;">Event: {event_title}</p>' if event_title else ''}
    <p style="font-size: 14px; color: #888888; margin-bottom: 20px;">
        Message from <strong>{organizer_name}</strong>:
    </p>

    <div style="background-color: #f9fafb; border: 1px solid #e4e4e7; border-radius: 12px; padding: 22px; margin: 20px 0;">
        <p style="font-size: 15px; color: #e1e1e1; line-height: 1.7; white-space: pre-wrap; margin: 0;">
            {announcement_body}
        </p>
    </div>

    <div style="text-align: center; margin: 32px 0 16px 0;">
        <a href="{event_url}" class="cta">View Event Details →</a>
    </div>
    """

    full_html = _email_wrapper(subject, html_content)
    return send_broadcast_email(to_emails, subject, plain_body, full_html)


def send_admin_role_invite_email(
    to_email: str,
    name: str,
    role_name: str,
    invite_url: str,
    assigned_by_name: str = "Administrator"
) -> bool:
    """Send an invitation email to a user appointed to an admin role (Finance, Marketing, Community Manager, etc.)."""
    subject = f"🛡️ You've been invited to join Sound It as {role_name}"
    
    plain_body = f"""Hello {name},

You have been appointed to the {role_name} role on Sound It by {assigned_by_name}.

You now have access to the Sound It Admin Workspace tailored to your role.

Access your dashboard here:
{invite_url}

If you have any questions, please contact your administrator.

— Sound It Platform Team
"""

    html_content = f"""
    <div style="text-align: center; margin-bottom: 24px;">
        <span style="background-color: rgba(211, 218, 12, 0.15); color: #8a9000; border: 1px solid rgba(211, 218, 12, 0.4); padding: 6px 16px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block;">
            🛡️ ADMIN ROLE INVITATION
        </span>
    </div>
    <h2 style="color: #18181b; font-size: 24px; font-weight: 800; margin: 0 0 8px 0; text-align: center; letter-spacing: -0.5px;">
        Welcome to the Team, {name}!
    </h2>
    <p style="text-align: center; color: #888888; font-size: 14px; margin-bottom: 24px;">
        You have been granted <strong>{role_name}</strong> permissions by {assigned_by_name}.
    </p>

    <div style="background-color: #f9fafb; border: 1px solid #e4e4e7; border-radius: 12px; padding: 22px; margin: 20px 0;">
        <p style="font-size: 14px; color: #e1e1e1; margin: 0 0 12px 0;">
            <strong>Your Role:</strong> <span style="color: #8a9000;">{role_name}</span>
        </p>
        <p style="font-size: 13px; color: #aaaaaa; margin: 0; line-height: 1.6;">
            Your account now has direct access to the specialized <strong>{role_name} Dashboard</strong>. When you log in, you will be taken directly to your management workspace.
        </p>
    </div>

    <div style="text-align: center; margin: 32px 0 16px 0;">
        <a href="{invite_url}" class="cta">Access {role_name} Dashboard →</a>
    </div>
    <p style="text-align: center; color: #666666; font-size: 12px; margin-top: 16px;">
        Direct link: <a href="{invite_url}" style="color: #8a9000;">{invite_url}</a>
    </p>
    """

    full_html = _email_wrapper(subject, html_content)
    return send_email(to_email, subject, plain_body, full_html)


