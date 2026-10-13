#!/usr/bin/env python3
"""One-off: send BOA Festival venue address correction to ticket holders.

Run on the production server from the release directory:
    cd /var/www/soundit/current && venv/bin/python /tmp/send_boa_venue_update.py

Uses the platform's own email system (email_service.send_broadcast_email).
"""

import sys

sys.path.insert(0, "/var/www/soundit/current")

from email_service import send_broadcast_email, _email_wrapper  # noqa: E402

RECIPIENTS = [
    "Simphiwesamketi@gmail.com",
    "s.nxumalo.sn@gmail.com",
    "Ssmkemwelase@outlook.com",
    "naurianchochoma@gmail.com",
    "nicoletenyamadzawo3@gmail.com",
    "robynjaptha.rj@gmail.com",
    "Kealynbrown96@gmail.com",
    "xavierowona@yahoo.com",
    "p.ulchritudinous@hotmail.com",
    "oabaleng@gmail.com",
    "biancaabaakile@gmail.com",
    "Prettyncenya@gmail.com",
    "thando.mabandla@gmail.com",
    "nwabisamene@gmail.com",
    "tshezia@gmail.com",
    "tmjwara14@gmail.com",
    "lintonpietersen302@gmail.com",
    "sitholemfuno01@gmail.com",
    "lunanasambo@gmail.com",
    "aneesajaylarnie@gmail.com",
    "karaborankaisang20@gmail.com",
    "ebenezerobi303@gmail.com",
    "nomfundopromise.gambu@gmail.com",
    "kdiouf2003@gmail.com",
    "nainagiam@gmail.com",
    "maiselatp@gmail.com",
    "atlehangmoame@gmail.com",
    "chiwotoedith@gmail.com",
    "nemanhampossa@gmail.com",
    "chris.foya01@gmail.com",
    "giftmona0@gmail.com",
    "marjorine9@gmail.com",
    "jeffreyjude123@gmail.com",
    "palesamoloi81@gmail.com",
    "sabrinaarbelle@gmail.com",
    "audreyknoble@gmail.com",
    "calistaalberto@gmail.com",
    "moyochawezi3@gmail.com",
    "Paleesetaim@gmail.com",
    "hadebenokuthula1@gmail.com",
    "Adedokunstella6789@gmail.com",
    "Lydiatrinity8@gmail.com",
]

SUBJECT = "🚨 IMPORTANT VENUE ADDRESS UPDATE, BOA FESTIVAL 🚨"

PLAIN_BODY = """Dear BOA Festival Ticket Holder,

Please be informed that the venue address previously shown on our ticketing platform was incorrect. We sincerely apologize for the inconvenience.

CORRECT VENUE ADDRESS:
MOST CLUB电音派对酒吧·KTV（旗舰店）
上海市松江区九亭沪松公路1108号 F3

Please use ONLY the address above when heading to the festival.

If you are using Amap/高德地图 or Didi, please search for:
MOST CLUB电音派对酒吧·KTV(旗舰店)

Your ticket remains valid, only the venue address has been corrected.

Thank you for your understanding, and we can't wait to welcome you to BOA Festival! 🌍🔥

, Beatz of Afrika (BOA) Festival Team
"""

HTML_CONTENT = """
    <div style="text-align: center; margin-bottom: 24px;">
        <span style="background-color: rgba(211, 218, 12, 0.15); color: #8a9000; border: 1px solid rgba(211, 218, 12, 0.4); padding: 6px 16px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block;">
            🚨 IMPORTANT UPDATE
        </span>
    </div>
    <h2 style="color: #18181b; font-size: 24px; font-weight: 800; margin: 0 0 8px 0; text-align: center; letter-spacing: -0.5px;">
        Venue Address Update, BOA Festival
    </h2>
    <p style="text-align: center; color: #8a9000; font-size: 14px; font-weight: 600; margin-bottom: 20px;">Beatz of Afrika (BOA) Festival</p>

    <p style="font-size: 15px; color: #3f3f46; line-height: 1.7; margin-bottom: 16px;">
        Dear BOA Festival Ticket Holder,
    </p>
    <p style="font-size: 15px; color: #3f3f46; line-height: 1.7; margin-bottom: 20px;">
        Please be informed that the venue address previously shown on our ticketing platform was <strong>incorrect</strong>. We sincerely apologize for the inconvenience.
    </p>

    <div style="background-color: #f9fafb; border: 1px solid #e4e4e7; border-left: 4px solid #8a9000; border-radius: 12px; padding: 22px; margin: 20px 0;">
        <p style="font-size: 12px; font-weight: 800; color: #8a9000; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 10px 0;">📍 Correct Venue Address</p>
        <p style="font-size: 16px; color: #18181b; font-weight: 700; line-height: 1.6; margin: 0 0 4px 0;">
            MOST CLUB电音派对酒吧·KTV（旗舰店）
        </p>
        <p style="font-size: 15px; color: #3f3f46; line-height: 1.6; margin: 0;">
            上海市松江区九亭沪松公路1108号 F3
        </p>
    </div>

    <p style="font-size: 15px; color: #3f3f46; line-height: 1.7; margin-bottom: 16px;">
        ⚠️ Please use <strong>only</strong> the address above when heading to the festival.
    </p>
    <p style="font-size: 15px; color: #3f3f46; line-height: 1.7; margin-bottom: 20px;">
        If you are using Amap/高德地图 or Didi, please search for:<br/>
        <strong style="color: #18181b;">MOST CLUB电音派对酒吧·KTV(旗舰店)</strong>
    </p>

    <div style="background-color: rgba(211, 218, 12, 0.08); border: 1px solid rgba(211, 218, 12, 0.35); border-radius: 12px; padding: 16px 22px; margin: 20px 0;">
        <p style="font-size: 14px; color: #3f3f46; margin: 0;">
            🎟️ <strong>Your ticket remains valid</strong>, only the venue address has been corrected.
        </p>
    </div>

    <p style="font-size: 15px; color: #3f3f46; line-height: 1.7; margin-bottom: 8px;">
        Thank you for your understanding, and we can't wait to welcome you to BOA Festival! 🌍🔥
    </p>
    <p style="font-size: 14px; color: #18181b; font-weight: 700; margin: 0;">
, Beatz of Afrika (BOA) Festival Team
    </p>
"""


def main() -> int:
    emails = list(dict.fromkeys(RECIPIENTS))  # dedupe, preserve order
    print(f"Sending venue update to {len(emails)} unique recipients...")
    html = _email_wrapper("BOA Festival, Venue Address Update", HTML_CONTENT)
    result = send_broadcast_email(emails, SUBJECT, PLAIN_BODY, html)
    print(f"RESULT: sent={result['sent']} failed={result['failed']} total={len(emails)}")
    return 0 if result["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
