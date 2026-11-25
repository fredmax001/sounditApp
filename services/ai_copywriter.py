"""
Sound It - Zero-Key Smart Copywriter & Optional Pluggable LLM Adapter
Generates specific, curiosity-driven, non-repetitive engagement notifications
grounded strictly in verified live database facts.

Works out-of-the-box with ZERO external API keys ($0/month) via a multi-angle,
multi-language (en/fr/zh) dynamic copy engine. Automatically upgrades to an
optional LLM if GEMINI_API_KEY, DEEPSEEK_API_KEY, QWEN_API_KEY, or
OPENAI_API_KEY is configured in .env, with automatic zero-failure fallback.
"""
from __future__ import annotations

import json
import logging
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional, Set, Tuple

from config import get_settings

logger = logging.getLogger("soundit.ai_copywriter")


# ---------------------------------------------------------------------------
# Provider Discovery
# ---------------------------------------------------------------------------

def get_active_copywriter_status() -> Dict[str, Any]:
    """Reports whether an external LLM key is active or zero-key smart engine is running."""
    settings = get_settings()
    if settings.AI_COPYWRITER_ENABLED:
        if settings.GEMINI_API_KEY:
            return {
                "mode": "llm_with_fallback",
                "provider": "gemini",
                "model": settings.GEMINI_MODEL,
                "label": f"Google Gemini ({settings.GEMINI_MODEL})",
                "zero_key": False,
            }
        if settings.DEEPSEEK_API_KEY:
            return {
                "mode": "llm_with_fallback",
                "provider": "deepseek",
                "model": settings.DEEPSEEK_MODEL,
                "label": f"DeepSeek ({settings.DEEPSEEK_MODEL})",
                "zero_key": False,
            }
        if settings.QWEN_API_KEY:
            return {
                "mode": "llm_with_fallback",
                "provider": "qwen",
                "model": settings.QWEN_MODEL,
                "label": f"Alibaba Qwen ({settings.QWEN_MODEL})",
                "zero_key": False,
            }
        if settings.OPENAI_API_KEY:
            return {
                "mode": "llm_with_fallback",
                "provider": "openai",
                "model": settings.OPENAI_MODEL,
                "label": f"OpenAI ({settings.OPENAI_MODEL})",
                "zero_key": False,
            }

    return {
        "mode": "zero_key_smart_engine",
        "provider": "template_engine",
        "model": "rotating-data-driven-v1",
        "label": "Built-in Template Engine ($0/mo)",
        "zero_key": True,
    }


def _normalize_lang(lang: Optional[str]) -> str:
    if not lang:
        return "en"
    short = str(lang).lower().split("-")[0].strip()
    return short if short in ("en", "fr", "zh") else "en"


# ---------------------------------------------------------------------------
# Curated Non-Repetitive Copy Bank (Zero AI Emojis, Specific Real Data)
# ---------------------------------------------------------------------------

def _pick_template(
    bank: List[Tuple[str, Dict[str, Tuple[str, str]]]],
    used_angles: Set[str],
    seed: int = 0,
    lang: str = "en",
) -> Tuple[str, str, str]:
    """Selects an unused copy angle so no user receives the same phrasing twice."""
    unused = [item for item in bank if item[0] not in used_angles]
    pool = unused if unused else bank
    angle_key, translations = pool[seed % len(pool)]
    title_tpl, msg_tpl = translations.get(lang) or translations["en"]
    return angle_key, title_tpl, msg_tpl


EVENT_SINGLE_BANK: List[Tuple[str, Dict[str, Tuple[str, str]]]] = [
    (
        "event_single_drop",
        {
            "en": (
                "Just dropped in {city}: {event_title}",
                "{event_title} is set for {event_date} at {venue}. Check the lineup and grab early tickets before tiers sell out.",
            ),
            "fr": (
                "Nouveau a {city} : {event_title}",
                "{event_title} a lieu le {event_date} a {venue}. Decouvrez la programmation et reservez vos billets.",
            ),
            "zh": (
                "{city}新活动上线：{event_title}",
                "{event_title}将于{event_date}在{venue}举行，立即查看阵容并锁定早鸟票。",
            ),
        },
    ),
    (
        "event_single_plans",
        {
            "en": (
                "{occasion_prefix}{city} pick: {event_title}",
                "Planning {occasion_lower}? {event_title} goes live on {event_date} at {venue}. Tap to see who is playing and reserve your spot.",
            ),
            "fr": (
                "Selection {city} : {event_title}",
                "Vous preparez {occasion_lower} ? {event_title} vous attend le {event_date} a {venue}. Voir les details.",
            ),
            "zh": (
                "{city}精选活动：{event_title}",
                "还没定好{occasion_lower}去哪玩？{event_date}在{venue}举办的{event_title}值得一看。",
            ),
        },
    ),
    (
        "event_single_curiosity",
        {
            "en": (
                "Everyone in {city} is eyeing {event_title}",
                "Happening {event_date} at {venue}. View full event details, ticket options, and table availability on Sound It.",
            ),
            "fr": (
                "A ne pas manquer a {city} : {event_title}",
                "Rendez-vous le {event_date} a {venue}. Consultez les billets et tables disponibles sur Sound It.",
            ),
            "zh": (
                "{city}热门关注：{event_title}",
                "{event_date}在{venue}开场，点击查看完整活动详情与门票信息。",
            ),
        },
    ),
    (
        "event_single_morning_brief",
        {
            "en": (
                "Good morning {city} — {event_title} is on the calendar",
                "Mark {event_date} at {venue}. Tap to preview the flyer, lineup, and ticket tiers on Sound It.",
            ),
            "fr": (
                "Bonjour {city} — {event_title} arrive bientot",
                "Notez le {event_date} a {venue}. Decouvrez l'affiche et les billets sur Sound It.",
            ),
            "zh": (
                "早安{city}：{event_title}已开放查看",
                "时间定在{event_date}（{venue}），点击预览活动海报与票务信息。",
            ),
        },
    ),
]

EVENT_DIGEST_BANK: List[Tuple[str, Dict[str, Tuple[str, str]]]] = [
    (
        "event_digest_compare",
        {
            "en": (
                "{occasion_prefix}{count} events coming up in {city}",
                "From {first_title} to {second_title} — compare dates, venues, and ticket options for {occasion_lower} in {city}.",
            ),
            "fr": (
                "{count} evenements a venir a {city}",
                "De {first_title} a {second_title} — comparez les dates, lieux et billets a {city}.",
            ),
            "zh": (
                "{city}近期有{count}场活动即将开启",
                "包括{first_title}、{second_title}等精彩活动，点击对比时间、场地与票价。",
            ),
        },
    ),
    (
        "event_digest_choice",
        {
            "en": (
                "{occasion_title} in {city}: Which event are you choosing?",
                "{count} events are live on Sound It right now, including {first_title} ({first_date}). Tap to explore your options.",
            ),
            "fr": (
                "{occasion_title} a {city} : quelle soiree choisissez-vous ?",
                "{count} evenements sont disponibles sur Sound It, dont {first_title} ({first_date}).",
            ),
            "zh": (
                "{city}{occasion_title}去哪场？",
                "Sound It已有{count}场活动上线，包含{first_title}（{first_date}），立即挑选你的场次。",
            ),
        },
    ),
    (
        "event_digest_morning_pulse",
        {
            "en": (
                "Morning shortlist: {count} nights out in {city}",
                "Start planning early — {first_title} and {other_count} more events are open for tickets in {city}.",
            ),
            "fr": (
                "Selection matinale : {count} sorties a {city}",
                "Anticipez votre programme : {first_title} et {other_count} autres evenements sont ouverts a {city}.",
            ),
            "zh": (
                "早间清单：{city}{count}场活动推荐",
                "提前安排行程：{first_title}及另外{other_count}场活动现已开放购票。",
            ),
        },
    ),
]

ARTIST_SPOTLIGHT_BANK: List[Tuple[str, Dict[str, Tuple[str, str]]]] = [
    (
        "artist_meet_talent",
        {
            "en": (
                "Artist Spotlight in {city}: {stage_name}",
                "{stage_name} brings {genre} energy to Sound It. Check their profile, listen to their mixes, or follow for upcoming gigs.",
            ),
            "fr": (
                "Artiste a decouvrir a {city} : {stage_name}",
                "{stage_name} ({genre}) est sur Sound It. Decouvrez son profil, ses mix et ses prochaines dates.",
            ),
            "zh": (
                "{city}音乐人推荐：{stage_name}",
                "{stage_name}擅长{genre}风格，点击查看主页、试听作品并关注最新演出。",
            ),
        },
    ),
    (
        "artist_discover_vibe",
        {
            "en": (
                "Looking for {genre} in {city}? Meet {stage_name}",
                "Explore {stage_name}'s portfolio, past sets, and booking availability directly on Sound It.",
            ),
            "fr": (
                "Fan de {genre} a {city} ? Decouvrez {stage_name}",
                "Explorez le portfolio, les performances et les disponibilites de {stage_name} sur Sound It.",
            ),
            "zh": (
                "喜欢{genre}吗？认识{city}的{stage_name}",
                "在Sound It浏览{stage_name}的作品集、演出经历与预约信息。",
            ),
        },
    ),
    (
        "artist_morning_check",
        {
            "en": (
                "Talent to follow: {stage_name} ({city})",
                "{bio_snippet} Tap to view {stage_name}'s Sound It profile and stay notified when they announce their next show.",
            ),
            "fr": (
                "Talent a suivre : {stage_name} ({city})",
                "{bio_snippet} Suivez {stage_name} sur Sound It pour ne manquer aucune date.",
            ),
            "zh": (
                "值得关注：{stage_name}（{city}）",
                "{bio_snippet} 点击关注{stage_name}，第一时间获取演出动态。",
            ),
        },
    ),
]

VENDOR_SPOTLIGHT_BANK: List[Tuple[str, Dict[str, Tuple[str, str]]]] = [
    (
        "vendor_store_drop",
        {
            "en": (
                "Discover {vendor_name} on Sound It ({city})",
                "{vendor_name} has {product_count} items live right now, including {sample_product}. Tap to browse their store.",
            ),
            "fr": (
                "Decouvrez {vendor_name} sur Sound It ({city})",
                "{vendor_name} propose {product_count} articles dont {sample_product}. Explorez la boutique.",
            ),
            "zh": (
                "发现{city}精选商户：{vendor_name}",
                "{vendor_name}已上架{product_count}款商品（含{sample_product}），点击逛逛店铺。",
            ),
        },
    ),
    (
        "vendor_community_pick",
        {
            "en": (
                "Community Vendor Pick: {vendor_name}",
                "Browse {vendor_name}'s catalog in {city} — check prices, photos, and order directly on Sound It.",
            ),
            "fr": (
                "Boutique de la communaute : {vendor_name}",
                "Parcourez le catalogue de {vendor_name} a {city} et commandez directement sur Sound It.",
            ),
            "zh": (
                "社区好店推荐：{vendor_name}",
                "查看{city}商户{vendor_name}的精选商品与实拍图，支持直接下单。",
            ),
        },
    ),
]

BUSINESS_SPOTLIGHT_BANK: List[Tuple[str, Dict[str, Tuple[str, str]]]] = [
    (
        "business_organizer_spotlight",
        {
            "en": (
                "Organizer & Venue Spotlight: {business_name}",
                "Follow {business_name} in {city} on Sound It to get early alerts when their next events and VIP tables open.",
            ),
            "fr": (
                "Organisateur a suivre : {business_name}",
                "Suivez {business_name} a {city} sur Sound It pour etre informe en priorite de leurs prochains evenements.",
            ),
            "zh": (
                "热门主办方/场地推荐：{business_name}",
                "关注{city}的{business_name}，第一时间获取新活动与卡座开放通知。",
            ),
        },
    ),
    (
        "business_city_hub",
        {
            "en": (
                "Know the scene in {city}: {business_name}",
                "{bio_snippet} Tap to explore {business_name}'s profile, photos, and upcoming experiences.",
            ),
            "fr": (
                "A decouvrir a {city} : {business_name}",
                "{bio_snippet} Explorez le profil et les experiences de {business_name} sur Sound It.",
            ),
            "zh": (
                "探索{city}夜生活名片：{business_name}",
                "{bio_snippet} 点击查看{business_name}的主页与精彩回顾。",
            ),
        },
    ),
]

COACH_BANKS: Dict[str, List[Tuple[str, Dict[str, Tuple[str, str]]]]] = {
    "artist": [
        (
            "coach_artist_day_1",
            {
                "en": (
                    "Your Artist profile is {completion_pct}% ready",
                    "Complete your {missing_summary} so fans and event organizers in {city} can discover and book you on Sound It.",
                ),
                "fr": (
                    "Votre profil Artiste est pret a {completion_pct}%",
                    "Ajoutez {missing_summary} pour que les organisateurs et fans a {city} puissent vous trouver et vous reserver.",
                ),
                "zh": (
                    "您的艺人主页已完成{completion_pct}%",
                    "补充{missing_summary}，让{city}的粉丝与活动主办方更容易发现并预约您。",
                ),
            },
        ),
        (
            "coach_artist_day_4",
            {
                "en": (
                    "Get discovered by promoters in {city}",
                    "Artists with a complete bio, photo, and music mix get far more profile visits and booking requests. Take 2 minutes to finish: {missing_summary}.",
                ),
                "fr": (
                    "Soyez visible aupres des promoteurs a {city}",
                    "Les artistes avec photo, bio et mix recoivent plus de demandes. Completez : {missing_summary}.",
                ),
                "zh": (
                    "让{city}的活动主办方看到您",
                    "完善头像、简介和作品链接的艺人会获得更多主页访问与演出邀约。还差：{missing_summary}。",
                ),
            },
        ),
        (
            "coach_artist_day_10",
            {
                "en": (
                    "Ready to receive bookings on Sound It?",
                    "You are only a few details away ({missing_summary}). Finish your Artist profile so we can feature you in city spotlights.",
                ),
                "fr": (
                    "Pret a recevoir des reservations sur Sound It ?",
                    "Il ne manque que quelques elements ({missing_summary}) pour apparaitre dans nos selections locales.",
                ),
                "zh": (
                    "准备好在Sound It接单了吗？",
                    "只需补全最后几项（{missing_summary}），即可进入城市音乐人推荐位。",
                ),
            },
        ),
    ],
    "business": [
        (
            "coach_business_day_1",
            {
                "en": (
                    "Finish setting up {display_name} on Sound It",
                    "Your organizer workspace is {completion_pct}% complete. Add {missing_summary} to start reaching fans in {city}.",
                ),
                "fr": (
                    "Finalisez la page {display_name} sur Sound It",
                    "Votre espace organisateur est complete a {completion_pct}%. Ajoutez {missing_summary} pour toucher votre public a {city}.",
                ),
                "zh": (
                    "完善{display_name}的主办方主页",
                    "您的商家主页已完成{completion_pct}%，补充{missing_summary}即可触达{city}用户。",
                ),
            },
        ),
        (
            "coach_business_day_4",
            {
                "en": (
                    "Publish your first event on Sound It",
                    "Community members in {city} are browsing for upcoming nights out. Missing right now: {missing_summary}. Upload an event in under 3 minutes.",
                ),
                "fr": (
                    "Publiez votre premier evenement sur Sound It",
                    "La communaute a {city} recherche des sorties. A completer : {missing_summary}.",
                ),
                "zh": (
                    "发布您在Sound It的第一场活动",
                    "{city}的用户正在浏览近期活动。待完成：{missing_summary}，3分钟即可上线售票。",
                ),
            },
        ),
        (
            "coach_business_day_10",
            {
                "en": (
                    "Put {display_name} in front of {city} event-goers",
                    "Complete {missing_summary} so Sound It can automatically notify matching local attendees when you post your next event.",
                ),
                "fr": (
                    "Mettez {display_name} en avant a {city}",
                    "Completez {missing_summary} pour que Sound It alerte automatiquement le public local lors de votre prochain evenement.",
                ),
                "zh": (
                    "让{city}玩家看到{display_name}",
                    "完成{missing_summary}后，Sound It会在您发布活动时自动推送给匹配的本地用户。",
                ),
            },
        ),
    ],
    "vendor": [
        (
            "coach_vendor_day_1",
            {
                "en": (
                    "Your Vendor store is {completion_pct}% ready",
                    "Add {missing_summary} so Sound It users in {city} can browse your store and place orders.",
                ),
                "fr": (
                    "Votre boutique est prete a {completion_pct}%",
                    "Ajoutez {missing_summary} pour permettre aux utilisateurs a {city} de commander chez vous.",
                ),
                "zh": (
                    "您的商户店铺已完成{completion_pct}%",
                    "补充{missing_summary}，让{city}的Sound It用户立即浏览并下单。",
                ),
            },
        ),
        (
            "coach_vendor_day_4",
            {
                "en": (
                    "Upload your first products to start selling",
                    "Shoppers on Sound It can only discover your store once products are listed. Next steps: {missing_summary}.",
                ),
                "fr": (
                    "Ajoutez vos premiers produits pour vendre",
                    "Les clients ne peuvent decouvrir votre boutique qu'une fois vos produits publies. Etapes suivantes : {missing_summary}.",
                ),
                "zh": (
                    "上架首批商品，开启线上接单",
                    "商品上架后您的店铺才能进入推荐与搜索。待完成：{missing_summary}。",
                ),
            },
        ),
        (
            "coach_vendor_day_10",
            {
                "en": (
                    "Get {display_name} featured in Sound It spotlights",
                    "Finish {missing_summary} so our discovery engine can showcase your products to local customers in {city}.",
                ),
                "fr": (
                    "Mettez {display_name} en avant sur Sound It",
                    "Finalisez {missing_summary} pour apparaitre dans nos recommandations locales a {city}.",
                ),
                "zh": (
                    "让{display_name}进入Sound It精选推荐",
                    "补全{missing_summary}后，系统会自动向{city}用户推荐您的商品。",
                ),
            },
        ),
    ],
}


# ---------------------------------------------------------------------------
# Optional Pluggable LLM Writer (Standard Library HTTP — Zero Extra Deps)
# ---------------------------------------------------------------------------

def _call_optional_llm(
    scenario: str,
    facts: Dict[str, Any],
    language: str,
    fallback_title: str,
    fallback_message: str,
) -> Tuple[str, str, str]:
    """
    If any optional LLM API key is configured, politely asks it to craft crisp,
    curiosity-driven notification copy strictly from `facts`. Always falls back
    safely to (fallback_title, fallback_message, "template_engine").
    """
    status = get_active_copywriter_status()
    if status["zero_key"]:
        return fallback_title, fallback_message, "template_engine"

    settings = get_settings()
    provider = status["provider"]

    system_prompt = (
        "You are Sound It's mobile engagement copywriter for China's African and international "
        "entertainment community. Write ONE short, natural, click-worthy notification based ONLY on "
        "the verified JSON facts provided. Rules: never invent events/dates/names not in facts; "
        "no emojis; no clichés like 'We miss you'; title <= 65 chars; message <= 165 chars; "
        f"write in language code '{language}'. Return strictly valid JSON: "
        '{"title": "...", "message": "..."}'
    )
    user_prompt = json.dumps({"scenario": scenario, "facts": facts}, ensure_ascii=False)

    try:
        raw_text = ""
        if provider == "gemini":
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            )
            payload = {
                "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}],
                "generationConfig": {"temperature": 0.6, "maxOutputTokens": 180},
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        else:
            if provider == "deepseek":
                url = "https://api.deepseek.com/v1/chat/completions"
                api_key = settings.DEEPSEEK_API_KEY
                model = settings.DEEPSEEK_MODEL
            elif provider == "qwen":
                url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
                api_key = settings.QWEN_API_KEY
                model = settings.QWEN_MODEL
            else:
                url = "https://api.openai.com/v1/chat/completions"
                api_key = settings.OPENAI_API_KEY
                model = settings.OPENAI_MODEL

            payload = {
                "model": model,
                "temperature": 0.6,
                "max_tokens": 180,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw_text = data["choices"][0]["message"]["content"]

        # Strip optional markdown code fences
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
        parsed = json.loads(cleaned.strip())
        title = str(parsed.get("title", "")).strip()
        msg = str(parsed.get("message", "")).strip()
        if 4 <= len(title) <= 120 and 10 <= len(msg) <= 300:
            return title, msg, provider
    except Exception as exc:
        logger.warning(f"Optional LLM copywriter ({provider}) failed, falling back to smart engine: {exc}")

    return fallback_title, fallback_message, "template_engine"


# ---------------------------------------------------------------------------
# Public Copy Generation Entrypoint
# ---------------------------------------------------------------------------

def generate_agent_copy(
    scenario: str,
    facts: Dict[str, Any],
    used_angles: Optional[Set[str]] = None,
    language: Optional[str] = "en",
    seed: int = 0,
    milestone_index: Optional[int] = None,
) -> Dict[str, str]:
    """
    Returns {"title", "message", "angle_key", "generated_by"} using verified facts.
    """
    lang = _normalize_lang(language)
    used = used_angles or set()

    if scenario == "event_single":
        angle_key, t_tpl, m_tpl = _pick_template(EVENT_SINGLE_BANK, used, seed, lang)
    elif scenario == "event_digest":
        angle_key, t_tpl, m_tpl = _pick_template(EVENT_DIGEST_BANK, used, seed, lang)
    elif scenario == "artist_spotlight":
        angle_key, t_tpl, m_tpl = _pick_template(ARTIST_SPOTLIGHT_BANK, used, seed, lang)
    elif scenario == "vendor_spotlight":
        angle_key, t_tpl, m_tpl = _pick_template(VENDOR_SPOTLIGHT_BANK, used, seed, lang)
    elif scenario == "business_spotlight":
        angle_key, t_tpl, m_tpl = _pick_template(BUSINESS_SPOTLIGHT_BANK, used, seed, lang)
    elif scenario.startswith("coach_"):
        role_key = scenario.replace("coach_", "")
        bank = COACH_BANKS.get(role_key, COACH_BANKS["artist"])
        if milestone_index is not None and 0 <= milestone_index < len(bank):
            angle_key, translations = bank[milestone_index]
            t_tpl, m_tpl = translations.get(lang) or translations["en"]
        else:
            angle_key, t_tpl, m_tpl = _pick_template(bank, used, seed, lang)
    else:
        angle_key = f"generic_{scenario}"
        t_tpl = facts.get("fallback_title", "New on Sound It")
        m_tpl = facts.get("fallback_message", "Check out what is new in your city on Sound It.")

    # Safe formatting with defaults
    safe_facts = {k: ("" if v is None else v) for k, v in facts.items()}
    fallback_title = t_tpl.format_map(_DefaultDict(safe_facts)).strip()
    fallback_message = m_tpl.format_map(_DefaultDict(safe_facts)).strip()

    title, message, generated_by = _call_optional_llm(
        scenario=scenario,
        facts=safe_facts,
        language=lang,
        fallback_title=fallback_title,
        fallback_message=fallback_message,
    )

    return {
        "title": title,
        "message": message,
        "angle_key": angle_key,
        "generated_by": generated_by,
    }


class _DefaultDict(dict):
    def __missing__(self, key: str) -> str:
        return ""
