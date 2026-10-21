"""
Generate an Event-Day Table Bookings & Drink Selections PDF for organizers.
Uses Pillow (PIL.Image / ImageDraw / ImageFont) to render crisp multi-page A4 PDF
documents with full English + Chinese (CJK) glyph support and zero extra dependencies.
"""
import io
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from PIL import Image, ImageDraw, ImageFont

# A4 @ 150 DPI: 1240 x 1754 px
PAGE_W = 1240
PAGE_H = 1754
MARGIN_X = 60
MARGIN_TOP = 60
MARGIN_BOTTOM = 70
CONTENT_W = PAGE_W - 2 * MARGIN_X

FONT_CANDIDATES = [
    # Linux (production server)
    "/usr/share/fonts/google-droid-sans-fonts/DroidSansFallbackFull.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    # macOS (local dev)
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> List[str]:
    if not text:
        return []
    lines: List[str] = []
    for paragraph in str(text).splitlines() or [""]:
        current = ""
        for ch in paragraph:
            test = current + ch
            bbox = draw.textbbox((0, 0), test, font=font)
            if (bbox[2] - bbox[0]) <= max_width or not current:
                current = test
            else:
                lines.append(current)
                current = ch
        if current:
            lines.append(current)
    return lines or [""]


def generate_table_orders_pdf(
    orders: List[Dict[str, Any]],
    event_title: Optional[str] = None,
    event_date: Optional[str] = None,
    organizer_name: Optional[str] = None,
) -> bytes:
    """Render an Event-Day Table Bookings & Drink Selections PDF and return raw PDF bytes."""
    f_title = _load_font(30)
    f_subtitle = _load_font(18)
    f_section = _load_font(20)
    f_card_title = _load_font(20)
    f_body = _load_font(16)
    f_small = _load_font(14)

    pages: List[Image.Image] = []

    def new_page() -> tuple[Image.Image, ImageDraw.ImageDraw, int]:
        img = Image.new("RGB", (PAGE_W, PAGE_H), color=(255, 255, 255))
        d = ImageDraw.Draw(img)
        pages.append(img)
        return img, d, MARGIN_TOP

    img, draw, y = new_page()

    # ---- Top Header Banner ----
    banner_h = 128
    draw.rounded_rectangle(
        [MARGIN_X, y, PAGE_W - MARGIN_X, y + banner_h],
        radius=14,
        fill=(18, 18, 18),
    )
    draw.text((MARGIN_X + 28, y + 20), "SOUND IT — EVENT DAY TABLE BOOKING SHEET", fill=(211, 218, 12), font=f_title)
    subtitle_line = f"Event: {event_title or 'All Events'}"
    if event_date:
        subtitle_line += f"   |   Event Date: {event_date}"
    draw.text((MARGIN_X + 28, y + 64), subtitle_line, fill=(255, 255, 255), font=f_subtitle)
    gen_str = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}   |   Organizer: {organizer_name or 'Sound It Organizer'}"
    draw.text((MARGIN_X + 28, y + 94), gen_str, fill=(180, 180, 180), font=f_small)
    y += banner_h + 24

    # ---- Summary KPI Boxes ----
    total_bookings = len(orders)
    approved_count = sum(1 for o in orders if o.get("status") in ("approved", "used"))
    pending_count = sum(1 for o in orders if o.get("status") == "pending")
    total_guests = sum(int(o.get("guest_count") or 0) for o in orders)
    total_revenue = sum(float(o.get("payment_amount") or 0) for o in orders if o.get("status") != "rejected")

    kpi_items = [
        ("TOTAL TABLES", f"{total_bookings} ({approved_count} Approved / {pending_count} Pending)"),
        ("TOTAL GUEST TICKETS", f"{total_guests} Guests"),
        ("PACKAGE REVENUE", f"¥{total_revenue:,.2f}"),
    ]
    box_gap = 16
    box_w = (CONTENT_W - box_gap * (len(kpi_items) - 1)) // len(kpi_items)
    box_h = 78
    for idx, (label, val) in enumerate(kpi_items):
        bx = MARGIN_X + idx * (box_w + box_gap)
        draw.rounded_rectangle([bx, y, bx + box_w, y + box_h], radius=10, fill=(246, 247, 249), outline=(220, 224, 230), width=1)
        draw.text((bx + 18, y + 14), label, fill=(100, 105, 115), font=f_small)
        draw.text((bx + 18, y + 38), val, fill=(20, 20, 20), font=f_section)
    y += box_h + 24

    # ---- Aggregate Bar Prep Summary (All Bottles & Mixers across bookings) ----
    drink_totals: Dict[str, int] = {}
    mixer_totals: Dict[str, int] = {}
    upgrade_totals: List[str] = []

    for o in orders:
        if o.get("status") in ("rejected", "cancelled"):
            continue
        for d in (o.get("drink_selections") or []):
            dname = d.get("name") or "Drink"
            dqty = int(d.get("qty") or 1)
            drink_totals[dname] = drink_totals.get(dname, 0) + dqty
            for m in (d.get("mixers") or []):
                mname = m.get("name") or "Mixer"
                mqty = int(m.get("qty") or 1)
                mixer_totals[mname] = mixer_totals.get(mname, 0) + mqty
        upg = o.get("upgrade_request")
        if upg and o.get("upgrade_status") not in (None, "none", "declined"):
            upgrade_totals.append(
                f"#{o.get('id')} {o.get('contact_name')}: {upg.get('name')} x{upg.get('qty', 1)} ({o.get('upgrade_status')})"
            )

    if drink_totals or mixer_totals or upgrade_totals:
        prep_lines: List[str] = []
        if drink_totals:
            bottles_str = "   |   ".join(f"{k} ×{v}" for k, v in sorted(drink_totals.items()))
            prep_lines.extend(_wrap_text(draw, f"Bottles / Drinks to Prep:  {bottles_str}", f_body, CONTENT_W - 36))
        if mixer_totals:
            mixers_str = "   |   ".join(f"{k} ×{v}" for k, v in sorted(mixer_totals.items()))
            prep_lines.extend(_wrap_text(draw, f"Mixers to Prep:  {mixers_str}", f_body, CONTENT_W - 36))
        if upgrade_totals:
            upg_str = "   |   ".join(upgrade_totals)
            prep_lines.extend(_wrap_text(draw, f"Upgrade Requests:  {upg_str}", f_body, CONTENT_W - 36))

        prep_h = 46 + len(prep_lines) * 24 + 14
        if y + prep_h > PAGE_H - MARGIN_BOTTOM:
            img, draw, y = new_page()
        draw.rounded_rectangle(
            [MARGIN_X, y, PAGE_W - MARGIN_X, y + prep_h],
            radius=10,
            fill=(254, 252, 232),
            outline=(211, 218, 12),
            width=2,
        )
        draw.text((MARGIN_X + 18, y + 12), "BAR & FLOOR PREP SUMMARY (ALL ACTIVE TABLES)", fill=(30, 30, 30), font=f_section)
        py = y + 42
        for line in prep_lines:
            draw.text((MARGIN_X + 18, py), line, fill=(40, 40, 40), font=f_body)
            py += 24
        y += prep_h + 24

    # ---- Empty State ----
    if not orders:
        draw.rounded_rectangle(
            [MARGIN_X, y, PAGE_W - MARGIN_X, y + 120],
            radius=12,
            fill=(248, 249, 250),
            outline=(220, 224, 230),
        )
        draw.text((MARGIN_X + 28, y + 48), "No table bookings found for the selected filter.", fill=(100, 100, 100), font=f_section)
    else:
        # ---- Individual Table Booking Cards ----
        for idx, o in enumerate(orders, start=1):
            pkg = o.get("package") or {}
            ev = o.get("event") or {}
            status_val = str(o.get("status") or "pending").upper()
            buyer_confirmed = bool(o.get("buyer_confirmed_at"))
            status_label = f"{status_val}{' · BUYER CONFIRMED PAID' if buyer_confirmed else ''}"

            # Build card content lines dynamically to measure height first
            card_lines: List[tuple[str, tuple[int, int, int], ImageFont.ImageFont]] = []

            # 1. Customer & Contact Info
            contact_name = o.get("contact_name") or (o.get("user") or {}).get("name") or "Guest"
            contact_phone = o.get("contact_phone") or "—"
            contact_email = o.get("contact_email") or (o.get("user") or {}).get("email") or "—"
            created_raw = o.get("created_at") or ""
            created_str = created_raw[:16].replace("T", " ") if created_raw else "—"
            ticket_code = o.get("ticket_code") or "Pending Approval"

            info_line_1 = f"Customer: {contact_name}     |     Phone: {contact_phone}     |     Email: {contact_email}"
            info_line_2 = (
                f"Guests / Tickets Included: {o.get('guest_count') or 1}     |     "
                f"Table Code: {ticket_code}     |     Booked: {created_str}"
            )
            for l in _wrap_text(draw, info_line_1, f_body, CONTENT_W - 40):
                card_lines.append((l, (30, 30, 30), f_body))
            for l in _wrap_text(draw, info_line_2, f_body, CONTENT_W - 40):
                card_lines.append((l, (60, 60, 60), f_body))

            # 2. Financial / Allowance line
            if o.get("drink_allowance") is not None:
                fin_line = (
                    f"Package: ¥{float(o.get('payment_amount') or 0):,.0f}   |   "
                    f"Drink Allowance: ¥{float(o.get('drink_allowance') or 0):,.0f}   |   "
                    f"Selected Drinks Value: ¥{float(o.get('allowance_used') or 0):,.0f}"
                )
                card_lines.append((fin_line, (70, 75, 85), f_small))

            # 3. Drink Selections & Mixers
            selections = o.get("drink_selections") or []
            if selections:
                card_lines.append(("SELECTED DRINKS & MIXERS:", (15, 23, 42), f_body))
                for sel in selections:
                    mixers = sel.get("mixers") or []
                    mixer_txt = (
                        f"   [Mixers: {', '.join(f'{m.get('name')} ×{m.get('qty', 1)}' for m in mixers)}]"
                        if mixers else ""
                    )
                    s_line = f"  • {sel.get('name')} ×{sel.get('qty', 1)}  (¥{float(sel.get('line_total') or 0):,.0f}){mixer_txt}"
                    for l in _wrap_text(draw, s_line, f_body, CONTENT_W - 40):
                        card_lines.append((l, (15, 80, 50), f_body))
            else:
                card_lines.append(("SELECTED DRINKS & MIXERS:  None selected from menu (see package items / special request)", (110, 110, 110), f_small))

            # 4. Upgrade Request
            upg = o.get("upgrade_request")
            upg_status = o.get("upgrade_status")
            if upg and upg_status and upg_status != "none":
                upg_mixers = upg.get("mixers") or []
                upg_mixer_txt = (
                    f" [Mixers: {', '.join(f'{m.get('name')} ×{m.get('qty', 1)}' for m in upg_mixers)}]"
                    if upg_mixers else ""
                )
                extra_val = o.get("upgrade_final_price") if o.get("upgrade_final_price") is not None else upg.get("estimated_extra", 0)
                upg_line = (
                    f"UPGRADE REQUEST ({str(upg_status).upper()}): {upg.get('name')} ×{upg.get('qty', 1)}"
                    f"{upg_mixer_txt}  |  Extra: +¥{float(extra_val or 0):,.0f} ({o.get('upgrade_payment_status') or upg.get('payment_preference') or 'pending'})"
                )
                for l in _wrap_text(draw, upg_line, f_body, CONTENT_W - 40):
                    card_lines.append((l, (180, 83, 9), f_body))
                if upg.get("notes"):
                    for l in _wrap_text(draw, f"  Upgrade Note: {upg.get('notes')}", f_small, CONTENT_W - 40):
                        card_lines.append((l, (146, 64, 14), f_small))

            # 5. Special Requests / Customer Notes
            if o.get("special_requests"):
                for l in _wrap_text(draw, f"SPECIAL REQUEST / MESSAGE:  {o.get('special_requests')}", f_body, CONTENT_W - 40):
                    card_lines.append((l, (153, 27, 27), f_body))

            # 6. Guest Ticket Numbers
            tickets = o.get("tickets") or []
            if tickets:
                t_nums = ", ".join(str(t.get("ticket_number")) for t in tickets if t.get("ticket_number"))
                for l in _wrap_text(draw, f"Guest Ticket IDs: {t_nums}", f_small, CONTENT_W - 40):
                    card_lines.append((l, (90, 95, 105), f_small))

            # Calculate card height
            header_h = 46
            footer_h = 38
            body_h = sum(24 if f == f_body else 20 for _, _, f in card_lines) + 20
            card_h = header_h + body_h + footer_h

            if y + card_h > PAGE_H - MARGIN_BOTTOM:
                img, draw, y = new_page()

            # Draw Card Outer Box
            draw.rounded_rectangle(
                [MARGIN_X, y, PAGE_W - MARGIN_X, y + card_h],
                radius=12,
                fill=(255, 255, 255),
                outline=(200, 205, 215),
                width=2,
            )
            # Card Header Bar
            draw.rounded_rectangle(
                [MARGIN_X, y, PAGE_W - MARGIN_X, y + header_h],
                radius=12,
                fill=(28, 30, 36),
            )
            header_left = f"#{idx}  Booking #{o.get('id')}  —  {pkg.get('name') or 'Table Package'}  (¥{float(o.get('payment_amount') or pkg.get('price') or 0):,.0f})"
            if not event_title and ev.get("title"):
                header_left += f"  [{ev.get('title')}]"
            draw.text((MARGIN_X + 18, y + 11), header_left, fill=(255, 255, 255), font=f_card_title)

            # Status pill on right of header
            status_color = (34, 197, 94) if status_val in ("APPROVED", "USED") else ((234, 179, 8) if status_val == "PENDING" else (239, 68, 68))
            sb = draw.textbbox((0, 0), status_label, font=f_small)
            sw = sb[2] - sb[0]
            draw.text((PAGE_W - MARGIN_X - sw - 20, y + 14), status_label, fill=status_color, font=f_small)

            # Card Body Lines
            cy = y + header_h + 12
            for text_line, color, font_obj in card_lines:
                draw.text((MARGIN_X + 20, cy), text_line, fill=color, font=font_obj)
                cy += 24 if font_obj == f_body else 20

            # Card Footer (Event-Day Staff Checkboxes)
            fy = y + card_h - footer_h
            draw.line([MARGIN_X + 16, fy, PAGE_W - MARGIN_X - 16, fy], fill=(225, 228, 235), width=1)
            staff_line = "[   ] Guest Checked In       [   ] Bottles & Mixers Delivered       [   ] Upgrade Settled       Table #: ____________"
            draw.text((MARGIN_X + 20, fy + 10), staff_line, fill=(80, 85, 95), font=f_small)

            y += card_h + 18

    # ---- Page Numbers Footer on Every Page ----
    total_pages = len(pages)
    for idx, p_img in enumerate(pages, start=1):
        p_draw = ImageDraw.Draw(p_img)
        footer_text = f"Sound It Event Day Table Booking & Drink Sheet   —   Page {idx} of {total_pages}"
        p_draw.text((MARGIN_X, PAGE_H - 42), footer_text, fill=(140, 145, 155), font=f_small)

    buf = io.BytesIO()
    pages[0].save(
        buf,
        format="PDF",
        resolution=150.0,
        save_all=True,
        append_images=pages[1:],
    )
    buf.seek(0)
    return buf.getvalue()
