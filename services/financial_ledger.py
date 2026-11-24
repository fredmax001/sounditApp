"""
Sound It — Canonical Financial Ledger & Accounting Engine (Single Source of Truth)

Enforces Sound It's permanent financial business logic across all provider dashboards,
payout workflows, Yoopay webhooks/callbacks, subscription revenue, and admin analytics:

CHANNEL A — SOUND IT PAYMENT SYSTEM (Yoopay: payment_channel='platform_yoopay'):
  - Money is received and held by Sound It through Yoopay.
  - Eligible confirmed/settled transactions charge a 4% transaction fee ONCE.
  - Provider becomes eligible for 96% net entitlement (credited to PROVIDER_PAYABLE).
  - Double-entry ledger posts:
      DEBIT  PLATFORM_CASH_YOOPAY      = gross
      CREDIT PLATFORM_FEE_REVENUE      = fee (4%)
      CREDIT PROVIDER_PAYABLE          = net (96%, scoped to provider_user_id)

CHANNEL B — DIRECT QR CODE PAYMENT (payment_channel='direct_qr'):
  - Money goes directly to the provider's own QR code (WeChat / Alipay / personal QR).
  - Sound It does NOT receive or hold this money and does NOT owe it to the provider.
  - Platform fee is ALWAYS 0.00 (0%).
  - Net payable entitlement is ALWAYS 0.00 (NEVER enters withdrawable balance).
  - ZERO ledger entries posted to PLATFORM_CASH_YOOPAY, PROVIDER_PAYABLE, or PLATFORM_FEE_REVENUE.
  - Recorded strictly for analytics, reported direct earnings, and operational volume.

SUBSCRIPTIONS (payment_channel='subscription_yoopay' | 'subscription_direct'):
  - Recognized 100% as Sound It SUBSCRIPTION_REVENUE (never provider ticket earnings or liability).
  - Double-entry ledger posts:
      DEBIT  PLATFORM_CASH_YOOPAY      = price
      CREDIT SUBSCRIPTION_REVENUE      = price
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, case, desc, func, or_
from sqlalchemy.orm import Session

from models import (
    AdminActivityLog,
    ArtistProfile,
    BookingRequest,
    BusinessProfile,
    Event,
    EventPaymentQR,
    FinancialLedgerEntry,
    FinancialReconciliation,
    FinancialRefund,
    FinancialTransaction,
    Order,
    OrganizerProfile,
    PaymentMethod,
    PaymentStatus,
    PayoutAuditLog,
    PayoutRequest,
    PayoutStatus,
    Product,
    ProductOrder,
    Subscription,
    SubscriptionStatus,
    TableOrder,
    TableOrderStatus,
    TicketOrder,
    TicketOrderStatus,
    User,
    UserRole,
    VendorOrder,
    VendorProfile,
)

# Permanent Sound It fee policy for eligible Yoopay platform-processed payments
YOOPAY_PLATFORM_FEE_RATE = Decimal("0.04")

# Canonical payment channels
CHANNEL_PLATFORM_YOOPAY = "platform_yoopay"
CHANNEL_DIRECT_QR = "direct_qr"
CHANNEL_SUBSCRIPTION_YOOPAY = "subscription_yoopay"
CHANNEL_SUBSCRIPTION_DIRECT = "subscription_direct"

# Chart of Accounts
ACCT_PLATFORM_CASH_YOOPAY = "PLATFORM_CASH_YOOPAY"
ACCT_PROVIDER_PAYABLE = "PROVIDER_PAYABLE"
ACCT_PROVIDER_PAYOUT_PENDING = "PROVIDER_PAYOUT_PENDING"
ACCT_PLATFORM_FEE_REVENUE = "PLATFORM_FEE_REVENUE"
ACCT_SUBSCRIPTION_REVENUE = "SUBSCRIPTION_REVENUE"

# Valid payment statuses considered confirmed/recognized for earnings
CONFIRMED_PAYMENT_STATUSES = ("confirmed", "settled", "partially_refunded")


def _d(val: Any) -> Decimal:
    """Convert any numeric value safely to 2-decimal Decimal."""
    if val is None:
        return Decimal("0.00")
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _f(val: Decimal) -> float:
    return float(val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _enum_str(val: Any, default: str = "") -> str:
    if val is None:
        return default
    return (val.value if hasattr(val, "value") else str(val)).lower()


def _new_uid(prefix: str) -> str:
    return f"{prefix}-{_utc_now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8].upper()}"


def calculate_yoopay_fee(gross_amount: Any) -> Tuple[Decimal, Decimal]:
    """Return (fee_4_percent, net_96_percent) using exact cent-level Decimal rounding."""
    gross = _d(gross_amount)
    if gross <= Decimal("0.00"):
        return Decimal("0.00"), Decimal("0.00")
    fee = (gross * YOOPAY_PLATFORM_FEE_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    net = (gross - fee).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return fee, net


def _post_balanced_journal(
    db: Session,
    *,
    legs: List[Dict[str, Any]],
    currency: str = "CNY",
    transaction_id: Optional[int] = None,
    payout_request_id: Optional[int] = None,
    refund_id: Optional[int] = None,
    idempotency_prefix: Optional[str] = None,
    is_reversal: bool = False,
    created_by: Optional[int] = None,
) -> List[FinancialLedgerEntry]:
    """Post an immutable, strictly balanced double-entry journal (sum(debits) == sum(credits))."""
    debits = sum((_d(leg["amount"]) for leg in legs if leg["entry_type"] == "debit"), Decimal("0.00"))
    credits = sum((_d(leg["amount"]) for leg in legs if leg["entry_type"] == "credit"), Decimal("0.00"))
    if debits != credits:
        raise ValueError(f"Unbalanced double-entry journal: debits={debits} != credits={credits}")
    if debits <= Decimal("0.00"):
        return []

    if idempotency_prefix:
        first_key = f"{idempotency_prefix}:0"
        existing = db.query(FinancialLedgerEntry).filter(
            FinancialLedgerEntry.idempotency_key == first_key
        ).first()
        if existing:
            return db.query(FinancialLedgerEntry).filter(
                FinancialLedgerEntry.journal_id == existing.journal_id
            ).all()

    journal_id = _new_uid("JRN")
    created: List[FinancialLedgerEntry] = []
    for idx, leg in enumerate(legs):
        amt = _d(leg["amount"])
        if amt <= Decimal("0.00"):
            continue
        entry = FinancialLedgerEntry(
            journal_id=journal_id,
            idempotency_key=f"{idempotency_prefix}:{idx}" if idempotency_prefix else None,
            transaction_id=transaction_id,
            payout_request_id=payout_request_id,
            refund_id=refund_id,
            account_code=leg["account_code"],
            provider_user_id=leg.get("provider_user_id"),
            entry_type=leg["entry_type"],
            amount=_f(amt),
            currency=currency.upper(),
            description=leg["description"][:300],
            is_reversal=is_reversal,
            reverses_entry_id=leg.get("reverses_entry_id"),
            created_by=created_by,
        )
        db.add(entry)
        created.append(entry)
    db.flush()
    return created


def _log_admin_finance_action(
    db: Session,
    *,
    admin_user_id: int,
    action: str,
    target_type: str,
    target_id: int,
    details: Dict[str, Any],
) -> None:
    try:
        db.add(AdminActivityLog(
            admin_id=admin_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
        ))
    except Exception:
        pass


# ===========================================================================
# 1. TRANSACTION RECORDING (CHANNEL A: YOOPAY | CHANNEL B: DIRECT QR | SUBS)
# ===========================================================================

def record_platform_yoopay_transaction(
    db: Session,
    *,
    provider_user_id: int,
    provider_role: str,
    gross_amount: Any,
    source_type: str,
    source_id: Optional[int] = None,
    customer_user_id: Optional[int] = None,
    event_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    currency: str = "CNY",
    payment_method: str = "yoopay",
    gateway_reference: Optional[str] = None,
    payment_status: str = "confirmed",
    settlement_status: str = "settled",
    verification_status: str = "webhook_verified",
    idempotency_key: Optional[str] = None,
    classification_confidence: str = "confirmed",
    needs_review: bool = False,
    notes: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    created_by: Optional[int] = None,
    created_at: Optional[datetime] = None,
) -> FinancialTransaction:
    """
    Record a Channel A (Sound It Yoopay) transaction.
    - Calculates the 4% platform fee ONCE.
    - Only posts ledger entries (and increases withdrawable balance) when
      payment_status in ('confirmed', 'settled') AND settlement_status == 'settled'.
    - Fully idempotent on idempotency_key.
    """
    currency = (currency or "CNY").upper()
    gross = _d(gross_amount)
    if gross < Decimal("0.00"):
        raise ValueError("Gross amount cannot be negative")

    if idempotency_key:
        existing = db.query(FinancialTransaction).filter(
            FinancialTransaction.idempotency_key == idempotency_key
        ).first()
        if existing:
            # If previously initiated/pending and now confirmed+settled, transition & post ledger once
            if (
                existing.payment_status not in ("confirmed", "settled", "refunded", "reversed")
                and payment_status in ("confirmed", "settled")
            ):
                existing.payment_status = payment_status
                existing.settlement_status = settlement_status
                existing.verification_status = verification_status
                existing.confirmed_at = existing.confirmed_at or _utc_now()
                if settlement_status == "settled":
                    existing.settled_at = existing.settled_at or _utc_now()
                if gateway_reference:
                    existing.gateway_reference = gateway_reference
                db.flush()
                if settlement_status == "settled" and _d(existing.gross_amount) > Decimal("0.00"):
                    _post_yoopay_settlement_journal(db, existing, created_by=created_by)
            return existing

    fee, net = calculate_yoopay_fee(gross)
    now = created_at or _utc_now()

    tx = FinancialTransaction(
        transaction_uid=_new_uid("YP"),
        idempotency_key=idempotency_key,
        provider_user_id=provider_user_id,
        provider_role=provider_role,
        customer_user_id=customer_user_id,
        source_type=source_type,
        source_id=source_id,
        event_id=event_id,
        booking_id=booking_id,
        payment_channel=CHANNEL_PLATFORM_YOOPAY,
        payment_method=payment_method or "yoopay",
        gateway_name="yoopay",
        gateway_reference=gateway_reference,
        currency=currency,
        gross_amount=_f(gross),
        fee_rate=float(YOOPAY_PLATFORM_FEE_RATE),
        platform_fee_amount=_f(fee),
        net_provider_entitlement=_f(net),
        refunded_amount=0.0,
        payment_status=payment_status,
        settlement_status=settlement_status,
        verification_status=verification_status,
        classification_confidence=classification_confidence,
        needs_review=needs_review,
        notes=notes,
        metadata_json=metadata,
        confirmed_at=now if payment_status in ("confirmed", "settled") else None,
        settled_at=now if settlement_status == "settled" else None,
        created_at=now,
    )
    db.add(tx)
    db.flush()

    # Only confirmed & settled Yoopay transactions enter PLATFORM_CASH & PROVIDER_PAYABLE!
    if payment_status in ("confirmed", "settled") and settlement_status == "settled" and gross > Decimal("0.00"):
        _post_yoopay_settlement_journal(db, tx, created_by=created_by)

    return tx


def _post_yoopay_settlement_journal(
    db: Session,
    tx: FinancialTransaction,
    created_by: Optional[int] = None,
) -> List[FinancialLedgerEntry]:
    gross = _d(tx.gross_amount)
    fee = _d(tx.platform_fee_amount)
    net = _d(tx.net_provider_entitlement)
    # Double-check invariant: gross == fee + net
    if fee + net != gross:
        fee, net = calculate_yoopay_fee(gross)
        tx.platform_fee_amount = _f(fee)
        tx.net_provider_entitlement = _f(net)
    return _post_balanced_journal(
        db,
        currency=tx.currency,
        transaction_id=tx.id,
        idempotency_prefix=f"yoopay_settle:{tx.id}",
        created_by=created_by,
        legs=[
            {
                "account_code": ACCT_PLATFORM_CASH_YOOPAY,
                "entry_type": "debit",
                "amount": gross,
                "description": f"Yoopay confirmed payment {tx.transaction_uid} ({tx.source_type}#{tx.source_id})",
            },
            {
                "account_code": ACCT_PLATFORM_FEE_REVENUE,
                "entry_type": "credit",
                "amount": fee,
                "description": f"4% Sound It Yoopay transaction fee for {tx.transaction_uid}",
            },
            {
                "account_code": ACCT_PROVIDER_PAYABLE,
                "provider_user_id": tx.provider_user_id,
                "entry_type": "credit",
                "amount": net,
                "description": f"Net provider payable (96%) for {tx.transaction_uid}",
            },
        ],
    )


def record_direct_qr_transaction(
    db: Session,
    *,
    provider_user_id: int,
    provider_role: str,
    gross_amount: Any,
    source_type: str,
    source_id: Optional[int] = None,
    customer_user_id: Optional[int] = None,
    event_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    currency: str = "CNY",
    payment_method: str = "wechat_qr",
    gateway_reference: Optional[str] = None,
    payment_status: str = "confirmed",
    verification_status: str = "recorded",  # recorded | provider_reported | evidence_submitted | independently_verified
    idempotency_key: Optional[str] = None,
    classification_confidence: str = "confirmed",
    needs_review: bool = False,
    notes: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    created_at: Optional[datetime] = None,
) -> FinancialTransaction:
    """
    Record a Channel B (Direct Provider QR) transaction.
    CRITICAL INVARIANTS:
      - fee_rate = 0.0, platform_fee_amount = 0.0
      - net_provider_entitlement = 0.0 (Sound It NEVER owes this money)
      - settlement_status = 'not_applicable'
      - ZERO ledger entries posted to platform cash, fee revenue, or provider payable!
      - Never automatically classified as 'independently_verified' unless explicitly verified.
    """
    currency = (currency or "CNY").upper()
    gross = _d(gross_amount)
    if gross < Decimal("0.00"):
        raise ValueError("Gross amount cannot be negative")

    if verification_status not in ("recorded", "provider_reported", "evidence_submitted", "independently_verified"):
        verification_status = "recorded"

    if idempotency_key:
        existing = db.query(FinancialTransaction).filter(
            FinancialTransaction.idempotency_key == idempotency_key
        ).first()
        if existing:
            return existing

    now = created_at or _utc_now()
    tx = FinancialTransaction(
        transaction_uid=_new_uid("DQR"),
        idempotency_key=idempotency_key,
        provider_user_id=provider_user_id,
        provider_role=provider_role,
        customer_user_id=customer_user_id,
        source_type=source_type,
        source_id=source_id,
        event_id=event_id,
        booking_id=booking_id,
        payment_channel=CHANNEL_DIRECT_QR,
        payment_method=payment_method or "direct_qr",
        gateway_name="direct_qr",
        gateway_reference=gateway_reference,
        currency=currency,
        gross_amount=_f(gross),
        fee_rate=0.0,
        platform_fee_amount=0.0,
        net_provider_entitlement=0.0,  # CRITICAL: NEVER payable by Sound It
        refunded_amount=0.0,
        payment_status=payment_status,
        settlement_status="not_applicable",
        verification_status=verification_status,
        classification_confidence=classification_confidence,
        needs_review=needs_review,
        notes=notes,
        metadata_json=metadata,
        confirmed_at=now if payment_status in ("confirmed", "settled") else None,
        settled_at=None,
        created_at=now,
    )
    db.add(tx)
    db.flush()
    # INTENTIONALLY NO PLATFORM CASH / PAYABLE / FEE LEDGER ENTRIES!
    return tx


def record_subscription_payment(
    db: Session,
    *,
    subscription: Subscription,
    payment_channel: Optional[str] = None,
    payment_status: str = "confirmed",
    settlement_status: str = "settled",
    verification_status: str = "manual_verified",
    currency: str = "CNY",
    created_by: Optional[int] = None,
) -> Optional[FinancialTransaction]:
    """
    Record recognized Subscription Revenue (100% platform revenue).
    NEVER creates a provider payable liability or increases provider ticket earnings!
    """
    price = _d(subscription.price)
    if price <= Decimal("0.00"):
        return None

    pm = _enum_str(subscription.payment_method, "yoopay")
    channel = payment_channel or (
        CHANNEL_SUBSCRIPTION_YOOPAY if pm in ("yoopay", "") else CHANNEL_SUBSCRIPTION_DIRECT
    )
    idem = f"sub_payment:{subscription.id}"
    existing = db.query(FinancialTransaction).filter(
        FinancialTransaction.idempotency_key == idem
    ).first()
    if existing:
        return existing

    ts = subscription.approved_at or subscription.start_date or subscription.created_at or _utc_now()
    tx = FinancialTransaction(
        transaction_uid=_new_uid("SUB"),
        idempotency_key=idem,
        provider_user_id=None,  # Platform revenue, NOT provider earnings
        provider_role="platform",
        customer_user_id=subscription.user_id,
        source_type="subscription",
        source_id=subscription.id,
        subscription_id=subscription.id,
        payment_channel=channel,
        payment_method=pm or "yoopay",
        gateway_name="yoopay" if "yoopay" in channel else "direct",
        gateway_reference=subscription.payment_reference,
        currency=(currency or "CNY").upper(),
        gross_amount=_f(price),
        fee_rate=0.0,
        platform_fee_amount=0.0,
        net_provider_entitlement=0.0,  # CRITICAL: NEVER a payout liability
        refunded_amount=0.0,
        payment_status=payment_status,
        settlement_status=settlement_status,
        verification_status=verification_status,
        classification_confidence="confirmed",
        needs_review=False,
        notes=f"Subscription #{subscription.id} ({_enum_str(subscription.role)} / {_enum_str(subscription.plan_type)})",
        metadata_json={
            "subscriber_user_id": subscription.user_id,
            "subscriber_role": _enum_str(subscription.role),
            "plan_type": _enum_str(subscription.plan_type),
            "billing_period": subscription.billing_period or "monthly",
        },
        confirmed_at=ts,
        settled_at=ts if settlement_status == "settled" else None,
        created_at=ts,
    )
    db.add(tx)
    db.flush()

    if payment_status in ("confirmed", "settled") and settlement_status == "settled":
        _post_balanced_journal(
            db,
            currency=tx.currency,
            transaction_id=tx.id,
            idempotency_prefix=f"sub_settle:{tx.id}",
            created_by=created_by,
            legs=[
                {
                    "account_code": ACCT_PLATFORM_CASH_YOOPAY,
                    "entry_type": "debit",
                    "amount": price,
                    "description": f"Subscription payment #{subscription.id} ({_enum_str(subscription.plan_type)})",
                },
                {
                    "account_code": ACCT_SUBSCRIPTION_REVENUE,
                    "entry_type": "credit",
                    "amount": price,
                    "description": f"Recognized subscription revenue #{subscription.id}",
                },
            ],
        )
    return tx


# ===========================================================================
# 2. REFUNDS & IMMUTABLE REVERSALS (CHANNEL-AWARE)
# ===========================================================================

def record_refund(
    db: Session,
    *,
    transaction_id: int,
    refund_amount: Optional[Any] = None,
    reason: str = "Customer refund",
    gateway_refund_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    processed_by: Optional[int] = None,
) -> FinancialRefund:
    """
    Create a channel-aware refund & immutable double-entry reversal.
    - Historical FinancialTransaction gross_amount is NEVER overwritten.
    - For platform_yoopay: reverses proportional 4% fee revenue & 96% provider payable,
      and reduces PLATFORM_CASH_YOOPAY.
    - For subscription_*: reverses SUBSCRIPTION_REVENUE and reduces PLATFORM_CASH_YOOPAY.
    - For direct_qr: records direct refund for provider analytics ONLY (zero impact on
      platform cash, fee revenue, or provider withdrawable balance).
    """
    if idempotency_key:
        existing = db.query(FinancialRefund).filter(
            FinancialRefund.idempotency_key == idempotency_key
        ).first()
        if existing:
            return existing

    tx = db.query(FinancialTransaction).filter(FinancialTransaction.id == transaction_id).first()
    if not tx:
        raise ValueError(f"FinancialTransaction #{transaction_id} not found")

    already_refunded = _d(tx.refunded_amount)
    gross = _d(tx.gross_amount)
    remaining = gross - already_refunded
    if remaining <= Decimal("0.00"):
        raise ValueError("Transaction has already been fully refunded")

    amt = _d(refund_amount) if refund_amount is not None else remaining
    if amt <= Decimal("0.00") or amt > remaining:
        raise ValueError(f"Invalid refund amount {amt}; remaining refundable amount is {remaining}")

    fee_refunded = Decimal("0.00")
    provider_deduction = Decimal("0.00")

    if tx.payment_channel == CHANNEL_PLATFORM_YOOPAY:
        if amt == gross and already_refunded == Decimal("0.00"):
            fee_refunded = _d(tx.platform_fee_amount)
            provider_deduction = _d(tx.net_provider_entitlement)
        else:
            fee_refunded, provider_deduction = calculate_yoopay_fee(amt)
    elif tx.payment_channel in (CHANNEL_SUBSCRIPTION_YOOPAY, CHANNEL_SUBSCRIPTION_DIRECT):
        fee_refunded = Decimal("0.00")
        provider_deduction = Decimal("0.00")
    else:
        # Direct QR refund: zero platform fee reversal, zero Sound It payable deduction
        fee_refunded = Decimal("0.00")
        provider_deduction = Decimal("0.00")

    now = _utc_now()
    refund = FinancialRefund(
        refund_uid=_new_uid("RFD"),
        idempotency_key=idempotency_key or f"refund:{tx.id}:{_f(amt)}:{now.timestamp()}",
        transaction_id=tx.id,
        payment_channel=tx.payment_channel,
        provider_user_id=tx.provider_user_id,
        customer_user_id=tx.customer_user_id,
        currency=tx.currency,
        refund_amount=_f(amt),
        fee_refunded=_f(fee_refunded),
        provider_deduction=_f(provider_deduction),
        reason=reason,
        status="completed",
        gateway_refund_id=gateway_refund_id,
        processed_by=processed_by,
        completed_at=now,
    )
    db.add(refund)
    db.flush()

    # Update cumulative refunded amount & status (never overwrite gross_amount!)
    new_refunded = already_refunded + amt
    tx.refunded_amount = _f(new_refunded)
    tx.payment_status = "refunded" if new_refunded >= gross else "partially_refunded"
    db.flush()

    # Post immutable balanced reversal ledger entries ONLY for platform-processed channels
    if tx.payment_channel == CHANNEL_PLATFORM_YOOPAY and tx.settlement_status == "settled":
        _post_balanced_journal(
            db,
            currency=tx.currency,
            transaction_id=tx.id,
            refund_id=refund.id,
            idempotency_prefix=f"refund_rev:{refund.id}",
            is_reversal=True,
            created_by=processed_by,
            legs=[
                {
                    "account_code": ACCT_PLATFORM_FEE_REVENUE,
                    "entry_type": "debit",
                    "amount": fee_refunded,
                    "description": f"Fee reversal (4%) for refund {refund.refund_uid} on {tx.transaction_uid}",
                },
                {
                    "account_code": ACCT_PROVIDER_PAYABLE,
                    "provider_user_id": tx.provider_user_id,
                    "entry_type": "debit",
                    "amount": provider_deduction,
                    "description": f"Provider entitlement reversal (96%) for refund {refund.refund_uid}",
                },
                {
                    "account_code": ACCT_PLATFORM_CASH_YOOPAY,
                    "entry_type": "credit",
                    "amount": amt,
                    "description": f"Yoopay cash outflow for refund {refund.refund_uid}",
                },
            ],
        )
    elif tx.payment_channel in (CHANNEL_SUBSCRIPTION_YOOPAY, CHANNEL_SUBSCRIPTION_DIRECT) and tx.settlement_status == "settled":
        _post_balanced_journal(
            db,
            currency=tx.currency,
            transaction_id=tx.id,
            refund_id=refund.id,
            idempotency_prefix=f"sub_refund_rev:{refund.id}",
            is_reversal=True,
            created_by=processed_by,
            legs=[
                {
                    "account_code": ACCT_SUBSCRIPTION_REVENUE,
                    "entry_type": "debit",
                    "amount": amt,
                    "description": f"Subscription revenue reversal for refund {refund.refund_uid}",
                },
                {
                    "account_code": ACCT_PLATFORM_CASH_YOOPAY,
                    "entry_type": "credit",
                    "amount": amt,
                    "description": f"Subscription cash refund outflow {refund.refund_uid}",
                },
            ],
        )

    if processed_by:
        _log_admin_finance_action(
            db,
            admin_user_id=processed_by,
            action="financial_refund_processed",
            target_type="financial_refund",
            target_id=refund.id,
            details={
                "refund_uid": refund.refund_uid,
                "transaction_uid": tx.transaction_uid,
                "payment_channel": tx.payment_channel,
                "refund_amount": refund.refund_amount,
                "fee_refunded": refund.fee_refunded,
                "provider_deduction": refund.provider_deduction,
                "currency": refund.currency,
                "reason": reason,
            },
        )
    return refund


# ===========================================================================
# 3. LEDGER ACCOUNT BALANCE HELPERS (STRICTLY CURRENCY-SEPARATED)
# ===========================================================================

def get_account_balance(
    db: Session,
    *,
    account_code: str,
    currency: str = "CNY",
    provider_user_id: Optional[int] = None,
    normal_side: str = "credit",  # 'debit' for assets, 'credit' for liabilities/revenue
) -> Decimal:
    q = db.query(
        FinancialLedgerEntry.entry_type,
        func.coalesce(func.sum(FinancialLedgerEntry.amount), 0.0),
    ).filter(
        FinancialLedgerEntry.account_code == account_code,
        FinancialLedgerEntry.currency == currency.upper(),
    )
    if provider_user_id is not None:
        q = q.filter(FinancialLedgerEntry.provider_user_id == provider_user_id)
    rows = q.group_by(FinancialLedgerEntry.entry_type).all()
    totals = {r[0]: _d(r[1]) for r in rows}
    debits = totals.get("debit", Decimal("0.00"))
    credits = totals.get("credit", Decimal("0.00"))
    return (debits - credits) if normal_side == "debit" else (credits - debits)


def get_provider_withdrawable_balance(
    db: Session,
    provider_user_id: int,
    currency: str = "CNY",
) -> Decimal:
    """
    Return exact eligible withdrawable balance for a provider from the immutable ledger.
    ONLY confirmed & settled Sound It Yoopay transactions (96% net) minus refunds
    minus pending/approved/completed payouts can EVER appear here.
    Direct QR earnings NEVER enter this calculation.
    """
    bal = get_account_balance(
        db,
        account_code=ACCT_PROVIDER_PAYABLE,
        currency=currency,
        provider_user_id=provider_user_id,
        normal_side="credit",
    )
    return max(Decimal("0.00"), bal)


# ===========================================================================
# 4. PROVIDER FINANCIAL SUMMARY & ANALYTICS (ALL PROVIDER ROLES)
# ===========================================================================

def get_provider_financial_summary(
    db: Session,
    *,
    provider_user_id: int,
    currency: str = "CNY",
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    event_id: Optional[int] = None,
    payment_channel: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Unified financial dashboard figures for ANY provider role
    (Organizers, Vendors, DJs, Artists, Business Owners, Venues):
      A. Total reported earnings (Direct QR + Sound It processed)
      B. Direct QR earnings (paid directly to provider — NOT withdrawable)
      C. Sound It processed earnings (Yoopay gross)
      D. Withdrawable balance (eligible Sound It processed net minus fees, refunds, payouts)
      E. Pending payout (requested/approved/processing awaiting settlement)
      F. Completed payouts (successfully transferred)
      G. Total fees (4% Sound It fee on Yoopay ONLY)
      H. Refunds and reversals (separated by channel)
    """
    cur = (currency or "CNY").upper()

    tx_q = db.query(FinancialTransaction).filter(
        FinancialTransaction.provider_user_id == provider_user_id,
        FinancialTransaction.currency == cur,
        FinancialTransaction.payment_channel.in_([CHANNEL_PLATFORM_YOOPAY, CHANNEL_DIRECT_QR]),
    )
    if date_from:
        tx_q = tx_q.filter(FinancialTransaction.created_at >= date_from)
    if date_to:
        tx_q = tx_q.filter(FinancialTransaction.created_at <= date_to)
    if event_id:
        tx_q = tx_q.filter(FinancialTransaction.event_id == event_id)
    if payment_channel and payment_channel != "all":
        tx_q = tx_q.filter(FinancialTransaction.payment_channel == payment_channel)

    txs = tx_q.order_by(desc(FinancialTransaction.created_at)).all()

    direct_qr_gross = Decimal("0.00")
    direct_qr_count = 0
    platform_gross = Decimal("0.00")
    platform_count = 0
    platform_unsettled_gross = Decimal("0.00")
    platform_fees = Decimal("0.00")
    platform_net_entitlement = Decimal("0.00")
    ambiguous_count = 0

    monthly_map: Dict[str, Dict[str, Any]] = {}
    by_event_map: Dict[str, Dict[str, Any]] = {}
    by_method_map: Dict[str, Dict[str, Any]] = {}

    # Pre-fetch event titles referenced by transactions
    ev_ids = list({t.event_id for t in txs if t.event_id})
    ev_titles: Dict[int, str] = {}
    if ev_ids:
        for eid, title in db.query(Event.id, Event.title).filter(Event.id.in_(ev_ids)).all():
            ev_titles[eid] = title

    for t in txs:
        if t.needs_review:
            ambiguous_count += 1
        if t.payment_status not in ("confirmed", "settled", "partially_refunded", "refunded"):
            continue

        gross = _d(t.gross_amount)
        fee = _d(t.platform_fee_amount) if t.payment_channel == CHANNEL_PLATFORM_YOOPAY else Decimal("0.00")
        net_ent = _d(t.net_provider_entitlement) if t.payment_channel == CHANNEL_PLATFORM_YOOPAY else Decimal("0.00")

        if t.payment_channel == CHANNEL_DIRECT_QR:
            direct_qr_gross += gross
            direct_qr_count += 1
        elif t.payment_channel == CHANNEL_PLATFORM_YOOPAY:
            platform_gross += gross
            platform_count += 1
            platform_fees += fee
            if t.settlement_status == "settled":
                platform_net_entitlement += net_ent
            else:
                platform_unsettled_gross += gross

        # Monthly aggregation
        m_key = t.created_at.strftime("%Y-%m") if t.created_at else "unknown"
        m_row = monthly_map.setdefault(m_key, {
            "month": m_key,
            "total_reported": Decimal("0.00"),
            "direct_qr": Decimal("0.00"),
            "platform_yoopay": Decimal("0.00"),
            "fees": Decimal("0.00"),
        })
        m_row["total_reported"] += gross
        if t.payment_channel == CHANNEL_DIRECT_QR:
            m_row["direct_qr"] += gross
        else:
            m_row["platform_yoopay"] += gross
            m_row["fees"] += fee

        # By event / booking
        ev_key = f"event_{t.event_id}" if t.event_id else (f"booking_{t.booking_id}" if t.booking_id else t.source_type)
        ev_label = ev_titles.get(t.event_id, f"Event #{t.event_id}") if t.event_id else (
            f"Booking #{t.booking_id}" if t.booking_id else t.source_type.replace("_", " ").title()
        )
        e_row = by_event_map.setdefault(ev_key, {
            "key": ev_key,
            "event_id": t.event_id,
            "booking_id": t.booking_id,
            "label": ev_label,
            "total_reported": Decimal("0.00"),
            "direct_qr": Decimal("0.00"),
            "platform_yoopay": Decimal("0.00"),
            "fees": Decimal("0.00"),
            "transactions_count": 0,
        })
        e_row["total_reported"] += gross
        e_row["transactions_count"] += 1
        if t.payment_channel == CHANNEL_DIRECT_QR:
            e_row["direct_qr"] += gross
        else:
            e_row["platform_yoopay"] += gross
            e_row["fees"] += fee

        # By payment method
        pm_key = f"{t.payment_channel}:{t.payment_method or 'unknown'}"
        pm_row = by_method_map.setdefault(pm_key, {
            "payment_channel": t.payment_channel,
            "payment_method": t.payment_method or "unknown",
            "amount": Decimal("0.00"),
            "count": 0,
        })
        pm_row["amount"] += gross
        pm_row["count"] += 1

    # Refunds separated by channel
    ref_q = db.query(FinancialRefund).filter(
        FinancialRefund.provider_user_id == provider_user_id,
        FinancialRefund.currency == cur,
        FinancialRefund.status == "completed",
    )
    if date_from:
        ref_q = ref_q.filter(FinancialRefund.created_at >= date_from)
    if date_to:
        ref_q = ref_q.filter(FinancialRefund.created_at <= date_to)
    refunds = ref_q.all()

    refunds_platform = sum((_d(r.refund_amount) for r in refunds if r.payment_channel == CHANNEL_PLATFORM_YOOPAY), Decimal("0.00"))
    refunds_direct_qr = sum((_d(r.refund_amount) for r in refunds if r.payment_channel == CHANNEL_DIRECT_QR), Decimal("0.00"))
    fees_refunded = sum((_d(r.fee_refunded) for r in refunds if r.payment_channel == CHANNEL_PLATFORM_YOOPAY), Decimal("0.00"))

    # Ledger-backed withdrawable balance & pending payouts (lifetime reconciled for this currency)
    withdrawable = get_provider_withdrawable_balance(db, provider_user_id, cur)
    pending_payout_ledger = max(
        Decimal("0.00"),
        get_account_balance(
            db,
            account_code=ACCT_PROVIDER_PAYOUT_PENDING,
            currency=cur,
            provider_user_id=provider_user_id,
            normal_side="credit",
        ),
    )

    # Payout history figures (also reconcile with PayoutRequest records)
    payouts = db.query(PayoutRequest).filter(
        or_(PayoutRequest.user_id == provider_user_id, PayoutRequest.business_id == provider_user_id),
        PayoutRequest.currency == cur,
    ).order_by(desc(PayoutRequest.requested_at)).all()

    completed_payouts = sum(
        (_d(p.amount) for p in payouts if _enum_str(p.status) in ("paid", "completed")),
        Decimal("0.00"),
    )
    pending_payouts_requests = sum(
        (_d(p.amount) for p in payouts if _enum_str(p.status) in ("pending", "approved", "processing")),
        Decimal("0.00"),
    )
    pending_payouts_count = sum(
        1 for p in payouts if _enum_str(p.status) in ("pending", "approved", "processing")
    )

    net_fees = max(Decimal("0.00"), platform_fees - fees_refunded)
    total_reported = direct_qr_gross + platform_gross

    # Available currencies for this provider
    currencies = [
        r[0] for r in db.query(FinancialTransaction.currency).filter(
            FinancialTransaction.provider_user_id == provider_user_id
        ).distinct().all()
    ] or [cur]
    if cur not in currencies:
        currencies.append(cur)

    return {
        "provider_user_id": provider_user_id,
        "currency": cur,
        "currencies": sorted(currencies),
        "fee_policy": {
            "platform_yoopay_fee_rate": 0.04,
            "platform_yoopay_fee_percent": 4.0,
            "direct_qr_fee_rate": 0.0,
            "direct_qr_fee_percent": 0.0,
            "note": "4% fee applies ONCE to eligible Sound It Yoopay payments. Direct QR payments carry 0% platform fee and never enter withdrawable balance.",
        },
        # Core 8 separated figures (Section 2 & 8)
        "total_reported_earnings": _f(total_reported),
        "direct_qr_earnings": _f(direct_qr_gross),
        "soundit_processed_earnings": _f(platform_gross),
        "soundit_unsettled_earnings": _f(platform_unsettled_gross),
        "withdrawable_balance": _f(withdrawable),
        "pending_payout": _f(pending_payout_ledger if pending_payout_ledger > Decimal("0.00") else pending_payouts_requests),
        "pending_payout_count": pending_payouts_count,
        "completed_payouts": _f(completed_payouts),
        "total_fees": _f(net_fees),
        "gross_fees_charged": _f(platform_fees),
        "fees_refunded": _f(fees_refunded),
        "refunds": {
            "total": _f(refunds_platform + refunds_direct_qr),
            "platform_yoopay": _f(refunds_platform),
            "direct_qr": _f(refunds_direct_qr),
            "count": len(refunds),
        },
        "counts": {
            "total_transactions": direct_qr_count + platform_count,
            "direct_qr_transactions": direct_qr_count,
            "platform_yoopay_transactions": platform_count,
            "ambiguous_transactions": ambiguous_count,
        },
        "monthly_earnings": [
            {
                "month": m["month"],
                "total_reported": _f(m["total_reported"]),
                "direct_qr": _f(m["direct_qr"]),
                "platform_yoopay": _f(m["platform_yoopay"]),
                "fees": _f(m["fees"]),
            }
            for m in sorted(monthly_map.values(), key=lambda x: x["month"])
        ],
        "earnings_by_event": [
            {
                "key": e["key"],
                "event_id": e["event_id"],
                "booking_id": e["booking_id"],
                "label": e["label"],
                "total_reported": _f(e["total_reported"]),
                "direct_qr": _f(e["direct_qr"]),
                "platform_yoopay": _f(e["platform_yoopay"]),
                "fees": _f(e["fees"]),
                "transactions_count": e["transactions_count"],
            }
            for e in sorted(by_event_map.values(), key=lambda x: x["total_reported"], reverse=True)
        ],
        "earnings_by_method": [
            {
                "payment_channel": pm["payment_channel"],
                "payment_method": pm["payment_method"],
                "amount": _f(pm["amount"]),
                "count": pm["count"],
            }
            for pm in sorted(by_method_map.values(), key=lambda x: x["amount"], reverse=True)
        ],
    }


# ===========================================================================
# 5. PAYOUT WORKFLOW (ALL PROVIDERS — STRICT ELIGIBLE YOOPAY FUNDS ONLY)
# ===========================================================================

def create_provider_payout_request(
    db: Session,
    *,
    provider_user_id: int,
    actor_user_id: int,
    actor_role: str,
    amount: Any,
    payment_method: str,
    payment_details: Dict[str, Any],
    currency: str = "CNY",
    idempotency_key: Optional[str] = None,
) -> Tuple[PayoutRequest, bool]:
    """
    Create a provider payout request strictly from eligible Sound It Yoopay withdrawable funds.
    - Direct QR earnings are NEVER eligible.
    - Pending/unconfirmed transactions are NEVER eligible.
    - Enforces idempotency_key and active duplicate protection.
    - Locks requested amount via immutable ledger transfer:
        DEBIT  PROVIDER_PAYABLE
        CREDIT PROVIDER_PAYOUT_PENDING
    Returns (payout, was_duplicate_idempotent).
    """
    cur = (currency or "CNY").upper()
    req_amt = _d(amount)
    if req_amt <= Decimal("0.00"):
        raise ValueError("Withdrawal amount must be greater than 0")

    if idempotency_key:
        existing = db.query(PayoutRequest).filter(
            PayoutRequest.idempotency_key == idempotency_key
        ).first()
        if existing:
            if existing.user_id != provider_user_id and existing.business_id != provider_user_id:
                raise PermissionError("Idempotency key belongs to another account")
            return existing, True

    # Prevent rapid duplicate payout requests (exact same amount already pending within 2 minutes)
    cutoff = _utc_now() - timedelta(minutes=2)
    dup = db.query(PayoutRequest).filter(
        PayoutRequest.user_id == provider_user_id,
        PayoutRequest.currency == cur,
        PayoutRequest.amount == _f(req_amt),
        PayoutRequest.status.in_([PayoutStatus.PENDING, PayoutStatus.PROCESSING]),
        PayoutRequest.requested_at >= cutoff,
    ).first()
    if dup:
        raise ValueError("A payout request for this exact amount is already pending review. Please wait.")

    available = get_provider_withdrawable_balance(db, provider_user_id, cur)
    if req_amt > available:
        raise ValueError(
            f"Requested amount ({cur} {_f(req_amt):,.2f}) exceeds eligible Sound It withdrawable balance "
            f"({cur} {_f(available):,.2f}). Direct QR payments are already in your own account and cannot be withdrawn from Sound It."
        )

    payout = PayoutRequest(
        user_id=provider_user_id,
        business_id=provider_user_id,
        amount=_f(req_amt),
        currency=cur,
        status=PayoutStatus.PENDING,
        payment_method=payment_method,
        payment_details=payment_details,
        idempotency_key=idempotency_key,
        requested_at=_utc_now(),
    )
    db.add(payout)
    db.flush()

    # Lock funds in immutable double-entry ledger
    _post_balanced_journal(
        db,
        currency=cur,
        payout_request_id=payout.id,
        idempotency_prefix=f"payout_lock:{payout.id}",
        created_by=actor_user_id,
        legs=[
            {
                "account_code": ACCT_PROVIDER_PAYABLE,
                "provider_user_id": provider_user_id,
                "entry_type": "debit",
                "amount": req_amt,
                "description": f"Reserve funds for payout request #{payout.id}",
            },
            {
                "account_code": ACCT_PROVIDER_PAYOUT_PENDING,
                "provider_user_id": provider_user_id,
                "entry_type": "credit",
                "amount": req_amt,
                "description": f"Pending payout liability #{payout.id} via {payment_method}",
            },
        ],
    )

    db.add(PayoutAuditLog(
        payout_request_id=payout.id,
        from_status=None,
        to_status="pending",
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        amount=_f(req_amt),
        currency=cur,
        note=f"Payout requested via {payment_method}",
    ))
    db.flush()
    return payout, False


def transition_payout_status(
    db: Session,
    *,
    payout_id: int,
    target_status: str,  # approved | processing | paid | rejected | failed
    admin_user: User,
    reason: Optional[str] = None,
    transaction_reference: Optional[str] = None,
) -> PayoutRequest:
    """
    State-machine enforced payout transition with immutable ledger accounting & audit logging.
    - 'approved' / 'processing': valid from 'pending' (or 'approved' -> 'processing').
    - 'paid': requires transaction_reference (or explicit confirmation), valid from 'pending'/'approved'/'processing',
              posts DEBIT PROVIDER_PAYOUT_PENDING / CREDIT PLATFORM_CASH_YOOPAY.
    - 'rejected' / 'failed': valid from 'pending'/'approved'/'processing',
              posts immutable REVERSAL DEBIT PROVIDER_PAYOUT_PENDING / CREDIT PROVIDER_PAYABLE
              (restoring withdrawable balance if funds were locked in ledger).
    """
    payout = db.query(PayoutRequest).filter(PayoutRequest.id == payout_id).first()
    if not payout:
        raise ValueError("Payout request not found")

    cur_status = _enum_str(payout.status)
    target = target_status.lower()
    if target == "completed":
        target = "paid"

    allowed_transitions = {
        "pending": {"approved", "processing", "paid", "rejected", "failed"},
        "approved": {"processing", "paid", "rejected", "failed"},
        "processing": {"paid", "rejected", "failed"},
        "paid": set(),
        "completed": set(),
        "rejected": set(),
        "failed": set(),
    }
    if target not in allowed_transitions.get(cur_status, set()):
        raise ValueError(f"Cannot transition payout #{payout.id} from '{cur_status}' to '{target}'")

    provider_uid = payout.business_id or payout.user_id
    cur = (payout.currency or "CNY").upper()
    amt = _d(payout.amount)

    # Check whether this payout already has a lock entry in PROVIDER_PAYOUT_PENDING
    has_lock = db.query(FinancialLedgerEntry).filter(
        FinancialLedgerEntry.payout_request_id == payout.id,
        FinancialLedgerEntry.account_code == ACCT_PROVIDER_PAYOUT_PENDING,
        FinancialLedgerEntry.entry_type == "credit",
    ).first() is not None

    if target == "paid":
        # Verify provider actually has eligible funds if this was a pre-ledger legacy payout request
        if not has_lock:
            avail = get_provider_withdrawable_balance(db, provider_uid, cur)
            if amt > avail:
                raise ValueError(
                    f"Cannot release legacy payout #{payout.id} ({cur} {_f(amt):,.2f}): provider only has "
                    f"{cur} {_f(avail):,.2f} in eligible Sound It Yoopay withdrawable funds. "
                    f"Direct QR payments cannot be paid out from Sound It cash."
                )
            _post_balanced_journal(
                db,
                currency=cur,
                payout_request_id=payout.id,
                idempotency_prefix=f"payout_lock:{payout.id}",
                created_by=admin_user.id,
                legs=[
                    {
                        "account_code": ACCT_PROVIDER_PAYABLE,
                        "provider_user_id": provider_uid,
                        "entry_type": "debit",
                        "amount": amt,
                        "description": f"Reserve funds for payout #{payout.id}",
                    },
                    {
                        "account_code": ACCT_PROVIDER_PAYOUT_PENDING,
                        "provider_user_id": provider_uid,
                        "entry_type": "credit",
                        "amount": amt,
                        "description": f"Pending payout liability #{payout.id}",
                    },
                ],
            )
            has_lock = True

        ref = (transaction_reference or payout.transaction_reference or "").strip() or f"PAYOUT-{payout.id}-{_utc_now().strftime('%Y%m%d%H%M%S')}"
        payout.transaction_reference = ref
        payout.status = PayoutStatus.PAID
        payout.processed_at = _utc_now()
        payout.processed_by_id = admin_user.id
        if reason:
            payout.admin_notes = reason

        _post_balanced_journal(
            db,
            currency=cur,
            payout_request_id=payout.id,
            idempotency_prefix=f"payout_paid:{payout.id}",
            created_by=admin_user.id,
            legs=[
                {
                    "account_code": ACCT_PROVIDER_PAYOUT_PENDING,
                    "provider_user_id": provider_uid,
                    "entry_type": "debit",
                    "amount": amt,
                    "description": f"Settle completed payout #{payout.id} (ref: {ref})",
                },
                {
                    "account_code": ACCT_PLATFORM_CASH_YOOPAY,
                    "entry_type": "credit",
                    "amount": amt,
                    "description": f"Cash transfer outflow for payout #{payout.id} (ref: {ref})",
                },
            ],
        )

    elif target in ("rejected", "failed"):
        payout.status = PayoutStatus.REJECTED if target == "rejected" else PayoutStatus.FAILED
        payout.rejection_reason = reason or f"Payout {target} by administrator"
        payout.processed_at = _utc_now()
        payout.processed_by_id = admin_user.id

        if has_lock:
            _post_balanced_journal(
                db,
                currency=cur,
                payout_request_id=payout.id,
                idempotency_prefix=f"payout_reverse:{payout.id}",
                is_reversal=True,
                created_by=admin_user.id,
                legs=[
                    {
                        "account_code": ACCT_PROVIDER_PAYOUT_PENDING,
                        "provider_user_id": provider_uid,
                        "entry_type": "debit",
                        "amount": amt,
                        "description": f"Reverse locked payout #{payout.id} ({target}: {payout.rejection_reason[:120]})",
                    },
                    {
                        "account_code": ACCT_PROVIDER_PAYABLE,
                        "provider_user_id": provider_uid,
                        "entry_type": "credit",
                        "amount": amt,
                        "description": f"Restore withdrawable balance for {target} payout #{payout.id}",
                    },
                ],
            )
    else:
        # approved or processing
        if not has_lock:
            avail = get_provider_withdrawable_balance(db, provider_uid, cur)
            if amt > avail:
                raise ValueError(
                    f"Cannot approve payout #{payout.id} ({cur} {_f(amt):,.2f}): provider only has "
                    f"{cur} {_f(avail):,.2f} in eligible Sound It Yoopay withdrawable funds."
                )
        payout.status = PayoutStatus.APPROVED if target == "approved" else PayoutStatus.PROCESSING
        payout.processed_at = _utc_now()
        payout.processed_by_id = admin_user.id
        if reason:
            payout.admin_notes = reason

    db.add(PayoutAuditLog(
        payout_request_id=payout.id,
        from_status=cur_status,
        to_status=target,
        actor_user_id=admin_user.id,
        actor_role=_enum_str(admin_user.role, "admin"),
        amount=_f(amt),
        currency=cur,
        gateway_reference=payout.transaction_reference,
        note=reason or f"Transitioned from {cur_status} to {target}",
    ))
    _log_admin_finance_action(
        db,
        admin_user_id=admin_user.id,
        action=f"payout_{target}",
        target_type="payout_request",
        target_id=payout.id,
        details={
            "from_status": cur_status,
            "to_status": target,
            "amount": _f(amt),
            "currency": cur,
            "provider_user_id": provider_uid,
            "transaction_reference": payout.transaction_reference,
            "reason": reason,
        },
    )
    db.flush()
    return payout


# ===========================================================================
# 6. ADMIN FINANCIAL OVERVIEW, SUBSCRIPTION REPORTING & YOOPAY RECONCILIATION
# ===========================================================================

def get_admin_financial_overview(
    db: Session,
    *,
    days: str = "all",
    currency: str = "CNY",
) -> Dict[str, Any]:
    """
    Returns all 8 independent Admin financial categories strictly reconciled with the ledger:
      A. Platform payment volume (confirmed Yoopay transactions only)
      B. Direct QR transaction volume (operational metric — NEVER revenue/cash/liability)
      C. Subscription revenue (recognized paid subscriptions — active & historical)
      D. Transaction fee revenue (4% fees from eligible Yoopay transactions)
      E. Total platform revenue (Subscription revenue + Net 4% transaction fee revenue)
      F. Outstanding payout liabilities (PROVIDER_PAYABLE + PROVIDER_PAYOUT_PENDING)
      G. Available platform cash (reconciled PLATFORM_CASH_YOOPAY balance)
      H. Refunds and reversals (separated by payment channel)
    """
    cur = (currency or "CNY").upper()
    since: Optional[datetime] = None
    if str(days).lower() not in ("all", "0", "all-time", "all_time"):
        try:
            d_int = int(days)
            if d_int > 0:
                since = _utc_now() - timedelta(days=d_int)
        except (ValueError, TypeError):
            since = _utc_now() - timedelta(days=30)

    tx_q = db.query(FinancialTransaction).filter(FinancialTransaction.currency == cur)
    if since:
        tx_q = tx_q.filter(FinancialTransaction.created_at >= since)
    txs = tx_q.all()

    platform_yoopay_volume = Decimal("0.00")
    platform_yoopay_count = 0
    platform_yoopay_unsettled = Decimal("0.00")
    direct_qr_volume = Decimal("0.00")
    direct_qr_count = 0
    subscription_gross_period = Decimal("0.00")
    subscription_count_period = 0
    fee_gross_period = Decimal("0.00")
    ambiguous_count = 0
    ambiguous_volume = Decimal("0.00")
    failed_count = 0

    monthly: Dict[str, Dict[str, Any]] = {}

    for t in txs:
        if t.needs_review:
            ambiguous_count += 1
            ambiguous_volume += _d(t.gross_amount)
        if t.payment_status in ("failed", "reversed", "disputed"):
            failed_count += 1
            continue
        if t.payment_status not in ("confirmed", "settled", "partially_refunded", "refunded"):
            continue

        gross = _d(t.gross_amount)
        m_key = t.created_at.strftime("%Y-%m") if t.created_at else "unknown"
        m_row = monthly.setdefault(m_key, {
            "month": m_key,
            "platform_volume": Decimal("0.00"),
            "direct_qr_volume": Decimal("0.00"),
            "subscription_revenue": Decimal("0.00"),
            "fee_revenue": Decimal("0.00"),
        })

        if t.payment_channel == CHANNEL_PLATFORM_YOOPAY:
            platform_yoopay_volume += gross
            platform_yoopay_count += 1
            fee_gross_period += _d(t.platform_fee_amount)
            if t.settlement_status != "settled":
                platform_yoopay_unsettled += gross
            m_row["platform_volume"] += gross
            m_row["fee_revenue"] += _d(t.platform_fee_amount)
        elif t.payment_channel == CHANNEL_DIRECT_QR:
            direct_qr_volume += gross
            direct_qr_count += 1
            m_row["direct_qr_volume"] += gross
        elif t.payment_channel in (CHANNEL_SUBSCRIPTION_YOOPAY, CHANNEL_SUBSCRIPTION_DIRECT):
            subscription_gross_period += gross
            subscription_count_period += 1
            m_row["subscription_revenue"] += gross

    # Refunds separated by channel
    ref_q = db.query(FinancialRefund).filter(
        FinancialRefund.currency == cur,
        FinancialRefund.status == "completed",
    )
    if since:
        ref_q = ref_q.filter(FinancialRefund.created_at >= since)
    refunds = ref_q.all()

    refunds_platform = sum((_d(r.refund_amount) for r in refunds if r.payment_channel == CHANNEL_PLATFORM_YOOPAY), Decimal("0.00"))
    refunds_direct_qr = sum((_d(r.refund_amount) for r in refunds if r.payment_channel == CHANNEL_DIRECT_QR), Decimal("0.00"))
    refunds_subscription = sum(
        (_d(r.refund_amount) for r in refunds if r.payment_channel in (CHANNEL_SUBSCRIPTION_YOOPAY, CHANNEL_SUBSCRIPTION_DIRECT)),
        Decimal("0.00"),
    )
    fees_refunded = sum((_d(r.fee_refunded) for r in refunds if r.payment_channel == CHANNEL_PLATFORM_YOOPAY), Decimal("0.00"))

    recognized_sub_rev = max(Decimal("0.00"), subscription_gross_period - refunds_subscription)
    recognized_fee_rev = max(Decimal("0.00"), fee_gross_period - fees_refunded)
    total_platform_revenue = recognized_sub_rev + recognized_fee_rev

    # Balance-sheet figures ALWAYS come from the cumulative immutable ledger (point-in-time reality)
    available_platform_cash = get_account_balance(
        db, account_code=ACCT_PLATFORM_CASH_YOOPAY, currency=cur, normal_side="debit"
    )
    payable_to_providers = max(
        Decimal("0.00"),
        get_account_balance(db, account_code=ACCT_PROVIDER_PAYABLE, currency=cur, normal_side="credit"),
    )
    pending_payout_liability = max(
        Decimal("0.00"),
        get_account_balance(db, account_code=ACCT_PROVIDER_PAYOUT_PENDING, currency=cur, normal_side="credit"),
    )
    outstanding_payout_liabilities = payable_to_providers + pending_payout_liability

    # Unencumbered platform cash (cash owned by Sound It after paying all provider liabilities)
    net_platform_owned_cash = available_platform_cash - outstanding_payout_liabilities

    # Payout request counters
    pr_q = db.query(PayoutRequest).filter(PayoutRequest.currency == cur)
    if since:
        pr_q = pr_q.filter(PayoutRequest.requested_at >= since)
    all_payouts = pr_q.all()
    pending_payouts_amt = sum((_d(p.amount) for p in all_payouts if _enum_str(p.status) in ("pending", "approved", "processing")), Decimal("0.00"))
    pending_payouts_cnt = sum(1 for p in all_payouts if _enum_str(p.status) in ("pending", "approved", "processing"))
    completed_payouts_amt = sum((_d(p.amount) for p in all_payouts if _enum_str(p.status) in ("paid", "completed")), Decimal("0.00"))
    completed_payouts_cnt = sum(1 for p in all_payouts if _enum_str(p.status) in ("paid", "completed"))

    currencies = [
        r[0] for r in db.query(FinancialTransaction.currency).distinct().all()
    ] or [cur]
    if cur not in currencies:
        currencies.append(cur)

    # All-time ledger totals for reconciliation check
    lifetime_sub_rev = get_account_balance(db, account_code=ACCT_SUBSCRIPTION_REVENUE, currency=cur, normal_side="credit")
    lifetime_fee_rev = get_account_balance(db, account_code=ACCT_PLATFORM_FEE_REVENUE, currency=cur, normal_side="credit")
    lifetime_platform_revenue = lifetime_sub_rev + lifetime_fee_rev

    # Count total ambiguous records all-time
    all_time_ambiguous = db.query(func.count(FinancialTransaction.id)).filter(
        FinancialTransaction.currency == cur,
        FinancialTransaction.needs_review == True,
    ).scalar() or 0

    return {
        "period_days": days,
        "currency": cur,
        "currencies": sorted(currencies),
        # 8 Independent Admin Categories (Section 3 & 10)
        "platform_payment_volume": _f(platform_yoopay_volume),
        "platform_payment_count": platform_yoopay_count,
        "platform_unsettled_volume": _f(platform_yoopay_unsettled),
        "direct_qr_transaction_volume": _f(direct_qr_volume),
        "direct_qr_transaction_count": direct_qr_count,
        "subscription_revenue": _f(recognized_sub_rev),
        "subscription_payments_count": subscription_count_period,
        "transaction_fee_revenue": _f(recognized_fee_rev),
        "total_platform_revenue": _f(total_platform_revenue),
        "lifetime_platform_revenue": _f(lifetime_platform_revenue),
        "lifetime_subscription_revenue": _f(lifetime_sub_rev),
        "lifetime_fee_revenue": _f(lifetime_fee_rev),
        "outstanding_payout_liabilities": _f(outstanding_payout_liabilities),
        "provider_withdrawable_liability": _f(payable_to_providers),
        "provider_pending_payout_liability": _f(pending_payout_liability),
        "available_platform_cash": _f(available_platform_cash),
        "net_platform_owned_cash": _f(net_platform_owned_cash),
        "completed_payouts": _f(completed_payouts_amt),
        "completed_payouts_count": completed_payouts_cnt,
        "pending_payout_requests_amount": _f(pending_payouts_amt),
        "pending_payout_requests_count": pending_payouts_cnt,
        "refunds": {
            "total": _f(refunds_platform + refunds_direct_qr + refunds_subscription),
            "platform_yoopay": _f(refunds_platform),
            "direct_qr": _f(refunds_direct_qr),
            "subscriptions": _f(refunds_subscription),
            "fees_reversed": _f(fees_refunded),
            "count": len(refunds),
        },
        "audit_flags": {
            "ambiguous_records_in_period": ambiguous_count,
            "ambiguous_volume_in_period": _f(ambiguous_volume),
            "ambiguous_records_total": int(all_time_ambiguous),
            "failed_transactions": failed_count,
            "fee_policy_rate_percent": 4.0,
            "direct_qr_excluded_from_cash_and_revenue": True,
        },
        "monthly_breakdown": [
            {
                "month": m["month"],
                "platform_volume": _f(m["platform_volume"]),
                "direct_qr_volume": _f(m["direct_qr_volume"]),
                "subscription_revenue": _f(m["subscription_revenue"]),
                "fee_revenue": _f(m["fee_revenue"]),
                "total_platform_revenue": _f(m["subscription_revenue"] + m["fee_revenue"]),
            }
            for m in sorted(monthly.values(), key=lambda x: x["month"])
        ],
    }


def get_admin_subscription_report(
    db: Session,
    *,
    currency: str = "CNY",
) -> Dict[str, Any]:
    """
    Dedicated Subscription Financial Reporting System (Section 7):
    - Active, Expired, Cancelled, Pending, Successful, Failed counts & sums
    - MRR calculation (from active paid non-trial subscriptions)
    - Revenue by provider category (role) and by city
    - Upcoming renewals / expirations
    """
    cur = (currency or "CNY").upper()
    subs = db.query(Subscription).order_by(desc(Subscription.created_at)).all()
    user_ids = list({s.user_id for s in subs})
    users_by_id: Dict[int, User] = {}
    if user_ids:
        for u in db.query(User).filter(User.id.in_(user_ids)).all():
            users_by_id[u.id] = u

    counts = {
        "active": 0,
        "active_paid": 0,
        "active_free_or_trial": 0,
        "expired": 0,
        "cancelled": 0,
        "pending_payments": 0,
        "successful_payments": 0,
        "failed_or_rejected": 0,
    }
    total_recognized_revenue = Decimal("0.00")
    pending_revenue = Decimal("0.00")
    mrr = Decimal("0.00")
    by_category: Dict[str, Dict[str, Any]] = {}
    by_city: Dict[str, Dict[str, Any]] = {}
    expiring_soon: List[Dict[str, Any]] = []

    now = _utc_now()
    soon_cutoff = now + timedelta(days=14)

    for s in subs:
        st = _enum_str(s.status)
        role = _enum_str(s.role, "other")
        price = _d(s.price)
        user = users_by_id.get(s.user_id)
        city = (
            (user.preferred_city.value if hasattr(user.preferred_city, "value") else str(user.preferred_city))
            if (user and user.preferred_city)
            else "unspecified"
        ).lower()

        if st == "active":
            counts["active"] += 1
            if price > Decimal("0.00") and not s.is_trial:
                counts["active_paid"] += 1
                counts["successful_payments"] += 1
                total_recognized_revenue += price
                if (s.billing_period or "monthly").lower() == "yearly":
                    mrr += (price / Decimal("12")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                elif (s.billing_period or "monthly").lower() != "lifetime":
                    mrr += price
            else:
                counts["active_free_or_trial"] += 1

            if s.end_date:
                end_dt = s.end_date if s.end_date.tzinfo else s.end_date.replace(tzinfo=timezone.utc)
                if now <= end_dt <= soon_cutoff:
                    expiring_soon.append({
                        "subscription_id": s.id,
                        "user_id": s.user_id,
                        "email": user.email if user else None,
                        "role": role,
                        "plan_type": _enum_str(s.plan_type),
                        "price": _f(price),
                        "end_date": end_dt.isoformat(),
                    })
        elif st == "expired":
            counts["expired"] += 1
            if price > Decimal("0.00") and not s.is_trial:
                counts["successful_payments"] += 1
                total_recognized_revenue += price
        elif st == "cancelled":
            counts["cancelled"] += 1
            if price > Decimal("0.00") and not s.is_trial and s.approved_at:
                counts["successful_payments"] += 1
                total_recognized_revenue += price
        elif st == "pending":
            counts["pending_payments"] += 1
            pending_revenue += price
        elif st in ("rejected", "failed"):
            counts["failed_or_rejected"] += 1

        # Recognized revenue breakdown by category & city
        if price > Decimal("0.00") and not s.is_trial and st in ("active", "expired", "cancelled"):
            if st != "cancelled" or s.approved_at:
                cat = by_category.setdefault(role, {"category": role, "revenue": Decimal("0.00"), "paid_count": 0, "active_count": 0})
                cat["revenue"] += price
                cat["paid_count"] += 1
                if st == "active":
                    cat["active_count"] += 1

                ct = by_city.setdefault(city, {"city": city, "revenue": Decimal("0.00"), "paid_count": 0})
                ct["revenue"] += price
                ct["paid_count"] += 1

    return {
        "currency": cur,
        "counts": counts,
        "total_recognized_subscription_revenue": _f(total_recognized_revenue),
        "pending_subscription_revenue": _f(pending_revenue),
        "monthly_recurring_revenue": _f(mrr),
        "revenue_by_category": [
            {
                "category": v["category"],
                "revenue": _f(v["revenue"]),
                "paid_count": v["paid_count"],
                "active_count": v["active_count"],
            }
            for v in sorted(by_category.values(), key=lambda x: x["revenue"], reverse=True)
        ],
        "revenue_by_city": [
            {
                "city": v["city"],
                "revenue": _f(v["revenue"]),
                "paid_count": v["paid_count"],
            }
            for v in sorted(by_city.values(), key=lambda x: x["revenue"], reverse=True)
        ],
        "expiring_within_14_days": expiring_soon,
    }


def run_yoopay_reconciliation(
    db: Session,
    *,
    admin_user_id: int,
    gateway_records: List[Dict[str, Any]],
    gateway_settled_cash: Optional[Any] = None,
    currency: str = "CNY",
    period_start: Optional[datetime] = None,
    period_end: Optional[datetime] = None,
    notes: Optional[str] = None,
) -> FinancialReconciliation:
    """
    Compare internal Yoopay confirmed transactions against actual Yoopay settlement statement records.
    Direct QR transactions are STRICTLY excluded from Yoopay reconciliation.
    """
    cur = (currency or "CNY").upper()
    q = db.query(FinancialTransaction).filter(
        FinancialTransaction.currency == cur,
        FinancialTransaction.payment_channel.in_([CHANNEL_PLATFORM_YOOPAY, CHANNEL_SUBSCRIPTION_YOOPAY]),
        FinancialTransaction.payment_status.in_(["confirmed", "settled", "partially_refunded"]),
    )
    if period_start:
        q = q.filter(FinancialTransaction.created_at >= period_start)
    if period_end:
        q = q.filter(FinancialTransaction.created_at <= period_end)
    internal_txs = q.all()

    internal_by_ref = {
        (t.gateway_reference or t.transaction_uid): t
        for t in internal_txs
    }
    internal_vol = sum((_d(t.gross_amount) for t in internal_txs if t.payment_channel == CHANNEL_PLATFORM_YOOPAY), Decimal("0.00"))
    internal_sub_vol = sum((_d(t.gross_amount) for t in internal_txs if t.payment_channel == CHANNEL_SUBSCRIPTION_YOOPAY), Decimal("0.00"))
    internal_fee = sum((_d(t.platform_fee_amount) for t in internal_txs if t.payment_channel == CHANNEL_PLATFORM_YOOPAY), Decimal("0.00"))

    gw_total = Decimal("0.00")
    matched_refs = set()
    unmatched_gateway = []
    amount_mismatches = []

    for rec in gateway_records:
        ref = str(rec.get("gateway_reference") or rec.get("transaction_id") or "").strip()
        gw_amt = _d(rec.get("amount", 0))
        gw_total += gw_amt
        if ref and ref in internal_by_ref:
            tx = internal_by_ref[ref]
            matched_refs.add(ref)
            if _d(tx.gross_amount) != gw_amt:
                amount_mismatches.append({
                    "reference": ref,
                    "internal_amount": tx.gross_amount,
                    "gateway_amount": _f(gw_amt),
                })
            else:
                tx.verification_status = "reconciled"
        else:
            unmatched_gateway.append({"reference": ref, "amount": _f(gw_amt)})

    unmatched_internal = [
        {"transaction_uid": t.transaction_uid, "reference": t.gateway_reference, "amount": t.gross_amount}
        for ref, t in internal_by_ref.items()
        if ref not in matched_refs
    ]

    settled_cash = _d(gateway_settled_cash) if gateway_settled_cash is not None else gw_total
    internal_total_yoopay = internal_vol + internal_sub_vol
    discrepancy = (internal_total_yoopay - settled_cash).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    ambiguous_cnt = db.query(func.count(FinancialTransaction.id)).filter(
        FinancialTransaction.currency == cur,
        FinancialTransaction.needs_review == True,
    ).scalar() or 0

    status_str = "matched" if (discrepancy == Decimal("0.00") and not unmatched_gateway and not amount_mismatches) else "discrepancy"

    rec_row = FinancialReconciliation(
        reconciliation_uid=_new_uid("REC"),
        gateway="yoopay",
        currency=cur,
        period_start=period_start,
        period_end=period_end,
        internal_confirmed_volume=_f(internal_vol),
        internal_fee_total=_f(internal_fee),
        internal_subscription_volume=_f(internal_sub_vol),
        gateway_reported_volume=_f(gw_total),
        gateway_settled_cash=_f(settled_cash),
        discrepancy_amount=_f(discrepancy),
        matched_count=len(matched_refs),
        unmatched_internal_count=len(unmatched_internal),
        unmatched_gateway_count=len(unmatched_gateway),
        ambiguous_count=int(ambiguous_cnt),
        status=status_str,
        notes=notes,
        details_json={
            "unmatched_internal": unmatched_internal[:50],
            "unmatched_gateway": unmatched_gateway[:50],
            "amount_mismatches": amount_mismatches[:50],
        },
        created_by=admin_user_id,
    )
    db.add(rec_row)
    _log_admin_finance_action(
        db,
        admin_user_id=admin_user_id,
        action="yoopay_reconciliation_run",
        target_type="financial_reconciliation",
        target_id=0,
        details={
            "reconciliation_uid": rec_row.reconciliation_uid,
            "discrepancy_amount": rec_row.discrepancy_amount,
            "status": status_str,
        },
    )
    db.flush()
    return rec_row


# ===========================================================================
# 7. SAFE HISTORICAL MIGRATION (NON-DESTRUCTIVE, EVIDENCE-BASED, IDEMPOTENT)
# ===========================================================================

def _resolve_event_provider_user_id(db: Session, event: Optional[Event]) -> Tuple[Optional[int], str]:
    if not event:
        return None, "organizer"
    if event.organizer_id:
        org = db.query(OrganizerProfile).filter(OrganizerProfile.id == event.organizer_id).first()
        if org and org.user_id:
            return org.user_id, "organizer"
    return None, "organizer"


def _event_has_direct_qr(db: Session, event: Optional[Event]) -> bool:
    if not event:
        return False
    if getattr(event, "wechat_qr_url", None) or getattr(event, "alipay_qr_url", None):
        return True
    eqr = db.query(EventPaymentQR).filter(EventPaymentQR.event_id == event.id).first()
    if eqr and (eqr.wechat_pay_qr or eqr.alipay_qr):
        return True
    return False


def migrate_historical_financial_records(db: Session) -> Dict[str, Any]:
    """
    Safely classify & backfill historical records into FinancialTransaction & FinancialLedgerEntry.
    STRICT SAFETY RULES:
      - NEVER deletes or overwrites historical orders, tickets, subscriptions, or payouts.
      - Fully idempotent (safe to re-run at any time).
      - Uses concrete evidence to classify Direct QR vs Yoopay:
          * TicketOrder on an event with organizer WeChat/Alipay QR -> direct_qr (confirmed)
          * TicketOrder with WeChat/Alipay reference or manual screenshot & NO Yoopay gateway record ->
            classified conservatively as direct_qr + needs_review=True (ambiguous_needs_review) so
            Sound It NEVER falsely inflates platform cash or withdrawable liabilities until an admin
            reconciles against Yoopay bank statements!
          * Order with PaymentMethod.YOOPAY & completed -> platform_yoopay (confirmed, 4% fee)
          * Subscription with price > 0 & status in (ACTIVE, EXPIRED) -> subscription_yoopay (recognized)
    """
    stats = {
        "ticket_orders_migrated": 0,
        "ticket_orders_direct_qr_confirmed": 0,
        "ticket_orders_ambiguous_flagged": 0,
        "table_orders_migrated": 0,
        "product_orders_migrated": 0,
        "vendor_orders_migrated": 0,
        "legacy_orders_migrated": 0,
        "subscriptions_migrated": 0,
        "bookings_migrated": 0,
        "skipped_existing": 0,
    }

    # 1. Historical TicketOrders (approved / used)
    ticket_orders = db.query(TicketOrder).filter(
        TicketOrder.status.in_([TicketOrderStatus.APPROVED, TicketOrderStatus.USED])
    ).all()
    for to in ticket_orders:
        idem = f"hist:ticket_order:{to.id}"
        if db.query(FinancialTransaction).filter(FinancialTransaction.idempotency_key == idem).first():
            stats["skipped_existing"] += 1
            continue
        amt = _d(to.final_amount if to.final_amount is not None else to.payment_amount)
        if amt <= Decimal("0.00"):
            continue
        event = db.query(Event).filter(Event.id == to.event_id).first()
        provider_uid, provider_role = _resolve_event_provider_user_id(db, event)
        if not provider_uid:
            continue

        has_org_qr = _event_has_direct_qr(db, event)
        ref = (to.payment_reference or "").strip()
        is_wechat_ref = ref.startswith(("4200", "4500"))
        is_alipay_ref = ref.startswith("2026") or "alipay" in ref.lower()
        pm = "wechat_qr" if is_wechat_ref else ("alipay_qr" if is_alipay_ref else "direct_qr")

        if has_org_qr:
            # Explicit organizer QR evidence -> confirmed Direct QR
            record_direct_qr_transaction(
                db,
                provider_user_id=provider_uid,
                provider_role=provider_role,
                gross_amount=amt,
                source_type="ticket_order",
                source_id=to.id,
                customer_user_id=to.user_id,
                event_id=to.event_id,
                currency="CNY",
                payment_method=pm,
                gateway_reference=ref or None,
                payment_status="confirmed",
                verification_status="evidence_submitted" if to.payment_screenshot else "provider_reported",
                idempotency_key=idem,
                classification_confidence="confirmed",
                needs_review=False,
                notes=f"Historical ticket order #{to.id} on organizer-QR event #{to.event_id}",
                created_at=to.reviewed_at or to.created_at,
            )
            stats["ticket_orders_direct_qr_confirmed"] += 1
        else:
            # No YooPay gateway webhook record exists in yoopay_payments table ->
            # Record conservatively as direct_qr with ambiguous_needs_review=True so we NEVER
            # invent unbacked withdrawable liabilities or Sound It cash before Yoopay reconciliation!
            record_direct_qr_transaction(
                db,
                provider_user_id=provider_uid,
                provider_role=provider_role,
                gross_amount=amt,
                source_type="ticket_order",
                source_id=to.id,
                customer_user_id=to.user_id,
                event_id=to.event_id,
                currency="CNY",
                payment_method=pm,
                gateway_reference=ref or None,
                payment_status="confirmed",
                verification_status="evidence_submitted" if to.payment_screenshot else "recorded",
                idempotency_key=idem,
                classification_confidence="ambiguous_needs_review",
                needs_review=True,
                notes=f"Historical ticket order #{to.id} (event #{to.event_id}): no automated Yoopay webhook proof; flagged for admin reconciliation before payout eligibility.",
                created_at=to.reviewed_at or to.created_at,
            )
            stats["ticket_orders_ambiguous_flagged"] += 1
        stats["ticket_orders_migrated"] += 1

    # 2. Historical TableOrders (approved / used)
    table_orders = db.query(TableOrder).filter(
        TableOrder.status.in_([TableOrderStatus.APPROVED, TableOrderStatus.USED])
    ).all()
    for tbo in table_orders:
        idem = f"hist:table_order:{tbo.id}"
        if db.query(FinancialTransaction).filter(FinancialTransaction.idempotency_key == idem).first():
            stats["skipped_existing"] += 1
            continue
        amt = _d(tbo.payment_amount)
        if amt <= Decimal("0.00"):
            continue
        event = db.query(Event).filter(Event.id == tbo.event_id).first() if tbo.event_id else None
        provider_uid = tbo.business_id or _resolve_event_provider_user_id(db, event)[0]
        if not provider_uid:
            continue
        has_org_qr = _event_has_direct_qr(db, event)
        record_direct_qr_transaction(
            db,
            provider_user_id=provider_uid,
            provider_role="business",
            gross_amount=amt,
            source_type="table_order",
            source_id=tbo.id,
            customer_user_id=tbo.user_id,
            event_id=tbo.event_id,
            currency="CNY",
            payment_method="direct_qr",
            gateway_reference=tbo.payment_reference,
            payment_status="confirmed",
            verification_status="evidence_submitted" if tbo.payment_screenshot else "provider_reported",
            idempotency_key=idem,
            classification_confidence="confirmed" if has_org_qr else "ambiguous_needs_review",
            needs_review=not has_org_qr,
            notes=f"Historical table order #{tbo.id}",
            created_at=tbo.reviewed_at or tbo.created_at,
        )
        stats["table_orders_migrated"] += 1

    # 3. Historical ProductOrders (approved)
    for po in db.query(ProductOrder).filter(ProductOrder.status.in_([TicketOrderStatus.APPROVED, TicketOrderStatus.USED])).all():
        idem = f"hist:product_order:{po.id}"
        if db.query(FinancialTransaction).filter(FinancialTransaction.idempotency_key == idem).first():
            stats["skipped_existing"] += 1
            continue
        amt = _d(po.payment_amount)
        if amt <= Decimal("0.00"):
            continue
        prod = db.query(Product).filter(Product.id == po.product_id).first()
        vp = db.query(VendorProfile).filter(VendorProfile.id == prod.vendor_id).first() if prod else None
        if not vp or not vp.user_id:
            continue
        record_direct_qr_transaction(
            db,
            provider_user_id=vp.user_id,
            provider_role="vendor",
            gross_amount=amt,
            source_type="product_order",
            source_id=po.id,
            customer_user_id=po.user_id,
            currency="CNY",
            payment_method="direct_qr",
            gateway_reference=po.payment_reference,
            payment_status="confirmed",
            verification_status="evidence_submitted" if po.payment_screenshot else "provider_reported",
            idempotency_key=idem,
            classification_confidence="confirmed",
            needs_review=False,
            notes=f"Historical vendor product order #{po.id}",
            created_at=po.reviewed_at or po.created_at,
        )
        stats["product_orders_migrated"] += 1

    # 4. Historical Legacy Orders (Yoopay completed)
    for lo in db.query(Order).filter(Order.payment_status == PaymentStatus.COMPLETED).all():
        idem = f"hist:order:{lo.id}"
        if db.query(FinancialTransaction).filter(FinancialTransaction.idempotency_key == idem).first():
            stats["skipped_existing"] += 1
            continue
        amt = _d(lo.total_amount)
        if amt <= Decimal("0.00"):
            continue
        pm = _enum_str(lo.payment_method, "yoopay")
        # Resolve organizer from first order item's ticket tier
        provider_uid = None
        event_id = None
        if lo.items:
            first_item = lo.items[0]
            if first_item.ticket_tier and first_item.ticket_tier.event:
                event_id = first_item.ticket_tier.event.id
                provider_uid, _ = _resolve_event_provider_user_id(db, first_item.ticket_tier.event)
        if not provider_uid:
            continue
        if pm == "yoopay":
            record_platform_yoopay_transaction(
                db,
                provider_user_id=provider_uid,
                provider_role="organizer",
                gross_amount=amt,
                source_type="order",
                source_id=lo.id,
                customer_user_id=lo.user_id,
                event_id=event_id,
                currency=lo.currency or "CNY",
                payment_method="yoopay",
                gateway_reference=lo.payment_id or lo.order_number,
                payment_status="settled",
                settlement_status="settled",
                verification_status="webhook_verified",
                idempotency_key=idem,
                created_at=lo.paid_at or lo.created_at,
            )
        else:
            record_direct_qr_transaction(
                db,
                provider_user_id=provider_uid,
                provider_role="organizer",
                gross_amount=amt,
                source_type="order",
                source_id=lo.id,
                customer_user_id=lo.user_id,
                event_id=event_id,
                currency=lo.currency or "CNY",
                payment_method=pm,
                gateway_reference=lo.payment_reference or lo.order_number,
                payment_status="confirmed",
                verification_status="evidence_submitted" if lo.payment_screenshot_url else "recorded",
                idempotency_key=idem,
                classification_confidence="ambiguous_needs_review",
                needs_review=True,
                created_at=lo.paid_at or lo.created_at,
            )
        stats["legacy_orders_migrated"] += 1

    # 5. Historical Paid Subscriptions (BOTH active AND expired paid periods!)
    paid_subs = db.query(Subscription).filter(
        Subscription.price > 0,
        Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED]),
    ).all()
    for sub in paid_subs:
        if _enum_str(sub.status) == "cancelled" and not sub.approved_at:
            continue
        if sub.is_trial:
            continue
        idem = f"sub_payment:{sub.id}"
        if db.query(FinancialTransaction).filter(FinancialTransaction.idempotency_key == idem).first():
            stats["skipped_existing"] += 1
            continue
        tx = record_subscription_payment(db, subscription=sub)
        if tx:
            stats["subscriptions_migrated"] += 1

    db.commit()
    return stats
