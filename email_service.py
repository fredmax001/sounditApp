"""
Email service module using SendGrid for transactional emails.
Falls back to console logging if SendGrid is not configured.
"""
import logging
from typing import Optional, List
from config import get_settings

logger = logging.getLogger(__name__)


def _get_sendgrid_client():
    settings = get_settings()
    if not settings.SENDGRID_API_KEY:
        return None
    try:
        from sendgrid import SendGridAPIClient
        return SendGridAPIClient(settings.SENDGRID_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize SendGrid client: {e}")
        return None


def _sendgrid_send(mail) -> bool:
    sg = _get_sendgrid_client()
    if not sg:
        return False
    try:
        response = sg.client.mail.send.post(request_body=mail.get())
        if response.status_code in (200, 201, 202):
            return True
        logger.error(f"SendGrid error: {response.status_code} - {response.body}")
        return False
    except Exception as e:
        logger.error(f"SendGrid send failed: {e}")
        return False


def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None,
    from_email: Optional[str] = None
) -> bool:
    """Send a plain text or HTML email via SendGrid."""
    settings = get_settings()
    sender = from_email or settings.SENDGRID_FROM_EMAIL or "noreply@sounditent.com"

    try:
        from sendgrid.helpers.mail import Mail, Email, To, Content

        message = Mail(
            from_email=Email(email=sender),
            to_emails=[To(email=to_email)],
            subject=subject,
        )
        # Add plain text content
        message.add_content(Content(mime_type="text/plain", content=body))
        # Add HTML content if provided
        if html_body:
            message.add_content(Content(mime_type="text/html", content=html_body))

        if _sendgrid_send(message):
            logger.info(f"[EMAIL SENT] To: {to_email}, Subject: {subject}")
            return True
    except Exception as e:
        logger.error(f"Email send exception: {e}")

    logger.warning(f"[EMAIL FAILED] To: {to_email}, Subject: {subject}")
    return False


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
    html_body = (
        f"<p>Hello,</p>"
        f"<p>You requested a password reset. Click the link below to reset your password:</p>"
        f'<p><a href="{reset_url}">{reset_url}</a></p>'
        f"<p>This link will expire in 1 hour.</p>"
        f"<p>If you didn't request this, you can safely ignore this email.</p>"
        f"<p>— Sound It Team</p>"
    )
    return send_email(to_email, subject, body, html_body)


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
