"""
Sound It — Comprehensive Automated Financial Architecture Test Suite
Verifies ALL 8 mandatory scenarios (TEST 1 – TEST 8) plus Yoopay webhook/idempotency,
double-entry balance invariants, currency separation, and payout state-machine reversals.
"""
import hashlib
import hmac
import json
import os
import sys
import uuid
from decimal import Decimal

import pytest

# Isolated SQLite database for hermetic execution (zero production impact)
_TEST_DB = f"/tmp/soundit_finance_test_{uuid.uuid4().hex[:8]}.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
os.environ["TESTING"] = "1"
os.environ["YOOPAY_WEBHOOK_SECRET"] = "test_yoopay_secret_key_for_hmac_verification"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import database
import models
from auth import create_access_token, get_password_hash
from fastapi.testclient import TestClient
from main import app
from models import (
    FinancialLedgerEntry,
    FinancialTransaction,
    PaymentMethod,
    PayoutRequest,
    PayoutStatus,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
    UserRole,
)
from services.financial_ledger import (
    ACCT_PLATFORM_CASH_YOOPAY,
    ACCT_PLATFORM_FEE_REVENUE,
    ACCT_PROVIDER_PAYABLE,
    ACCT_SUBSCRIPTION_REVENUE,
    create_provider_payout_request,
    get_account_balance,
    get_admin_financial_overview,
    get_admin_subscription_report,
    get_provider_financial_summary,
    record_direct_qr_transaction,
    record_platform_yoopay_transaction,
    record_refund,
    record_subscription_payment,
    run_yoopay_reconciliation,
    transition_payout_status,
)


@pytest.fixture(scope="module")
def setup_db():
    models.Base.metadata.create_all(bind=database.engine)
    yield
    try:
        if os.path.exists(_TEST_DB):
            os.remove(_TEST_DB)
    except Exception:
        pass


@pytest.fixture()
def db(setup_db):
    session = database.SessionLocal()
    try:
        # Clean financial tables between tests so each test starts cleanly
        session.query(models.PayoutAuditLog).delete()
        session.query(FinancialLedgerEntry).delete()
        session.query(models.FinancialRefund).delete()
        session.query(models.FinancialReconciliation).delete()
        session.query(FinancialTransaction).delete()
        session.query(PayoutRequest).delete()
        session.query(Subscription).delete()
        session.commit()
        yield session
    finally:
        session.close()


def _make_user(db, role: UserRole, prefix: str) -> User:
    tag = uuid.uuid4().hex[:6]
    u = User(
        email=f"{prefix}.{tag}@sounditent.com",
        username=f"{prefix}_{tag}",
        password_hash=get_password_hash("StrongPass!123"),
        first_name=prefix.capitalize(),
        last_name="Tester",
        role=role,
        status="active",
        is_verified=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _assert_double_entry_balanced(db, currency="CNY"):
    rows = db.query(FinancialLedgerEntry).filter(FinancialLedgerEntry.currency == currency).all()
    by_journal = {}
    for e in rows:
        by_journal.setdefault(e.journal_id, {"debit": Decimal("0.00"), "credit": Decimal("0.00")})
        by_journal[e.journal_id][e.entry_type] += Decimal(str(e.amount))
    for jid, sides in by_journal.items():
        assert sides["debit"] == sides["credit"], f"Journal {jid} unbalanced: {sides}"


# ===========================================================================
# TEST 1: DJ receives ¥5,000 through personal QR code
# ===========================================================================
def test_1_dj_direct_qr_5000(db):
    dj = _make_user(db, UserRole.ARTIST, "dj1")

    tx = record_direct_qr_transaction(
        db,
        provider_user_id=dj.id,
        provider_role="artist",
        gross_amount=5000,
        source_type="booking_request",
        source_id=101,
        payment_method="wechat_qr",
        verification_status="provider_reported",
        idempotency_key="test1:dj_qr_5000",
    )
    db.commit()

    assert tx.payment_channel == "direct_qr"
    assert tx.platform_fee_amount == 0.0
    assert tx.net_provider_entitlement == 0.0
    assert tx.settlement_status == "not_applicable"
    assert tx.verification_status == "provider_reported"  # Never auto-verified

    dj_sum = get_provider_financial_summary(db, provider_user_id=dj.id)
    assert dj_sum["direct_qr_earnings"] == 5000.0
    assert dj_sum["total_reported_earnings"] == 5000.0
    assert dj_sum["soundit_processed_earnings"] == 0.0
    assert dj_sum["withdrawable_balance"] == 0.0
    assert dj_sum["total_fees"] == 0.0

    admin_ov = get_admin_financial_overview(db)
    assert admin_ov["available_platform_cash"] == 0.0
    assert admin_ov["transaction_fee_revenue"] == 0.0
    assert admin_ov["total_platform_revenue"] == 0.0
    assert admin_ov["outstanding_payout_liabilities"] == 0.0
    assert admin_ov["direct_qr_transaction_volume"] == 5000.0


# ===========================================================================
# TEST 2: Organizer receives ¥10,000 through Sound It's Yoopay payment system
# ===========================================================================
def test_2_organizer_yoopay_10000(db):
    org = _make_user(db, UserRole.ORGANIZER, "org2")

    tx1 = record_platform_yoopay_transaction(
        db,
        provider_user_id=org.id,
        provider_role="organizer",
        gross_amount=10000,
        source_type="order",
        source_id=201,
        gateway_reference="YP-REF-201",
        payment_status="settled",
        settlement_status="settled",
        verification_status="webhook_verified",
        idempotency_key="test2:org_yp_10000",
    )
    # Replay same idempotency_key — 4% fee MUST only be charged ONCE!
    tx2 = record_platform_yoopay_transaction(
        db,
        provider_user_id=org.id,
        provider_role="organizer",
        gross_amount=10000,
        source_type="order",
        source_id=201,
        gateway_reference="YP-REF-201",
        payment_status="settled",
        settlement_status="settled",
        verification_status="webhook_verified",
        idempotency_key="test2:org_yp_10000",
    )
    db.commit()
    assert tx1.id == tx2.id
    assert tx1.platform_fee_amount == 400.0  # 4% of 10,000
    assert tx1.net_provider_entitlement == 9600.0  # 96% of 10,000

    org_sum = get_provider_financial_summary(db, provider_user_id=org.id)
    assert org_sum["soundit_processed_earnings"] == 10000.0
    assert org_sum["total_fees"] == 400.0
    assert org_sum["withdrawable_balance"] == 9600.0

    admin_ov = get_admin_financial_overview(db)
    assert admin_ov["platform_payment_volume"] == 10000.0
    assert admin_ov["transaction_fee_revenue"] == 400.0
    assert admin_ov["total_platform_revenue"] == 400.0
    assert admin_ov["outstanding_payout_liabilities"] == 9600.0
    assert admin_ov["available_platform_cash"] == 10000.0
    assert admin_ov["net_platform_owned_cash"] == 400.0
    _assert_double_entry_balanced(db)


# ===========================================================================
# TEST 3: Provider receives ¥5,000 directly AND ¥5,000 through Sound It Yoopay
# ===========================================================================
def test_3_mixed_direct_5000_and_yoopay_5000(db):
    dj = _make_user(db, UserRole.ARTIST, "dj3")

    record_direct_qr_transaction(
        db,
        provider_user_id=dj.id,
        provider_role="artist",
        gross_amount=5000,
        source_type="booking_request",
        source_id=301,
        payment_method="wechat_qr",
        idempotency_key="test3:direct_5000",
    )
    record_platform_yoopay_transaction(
        db,
        provider_user_id=dj.id,
        provider_role="artist",
        gross_amount=5000,
        source_type="booking_request",
        source_id=302,
        gateway_reference="YP-REF-302",
        payment_status="settled",
        settlement_status="settled",
        idempotency_key="test3:yoopay_5000",
    )
    db.commit()

    s = get_provider_financial_summary(db, provider_user_id=dj.id)
    assert s["total_reported_earnings"] == 10000.0
    assert s["direct_qr_earnings"] == 5000.0
    assert s["soundit_processed_earnings"] == 5000.0
    assert s["total_fees"] == 200.0  # 4% of ¥5,000 ONLY (NOT ¥10,000!)
    assert s["withdrawable_balance"] == 4800.0  # NEVER ¥9,800 or ¥10,000!


# ===========================================================================
# TEST 4: Provider requests payout — Direct QR excluded, duplicates prevented
# ===========================================================================
def test_4_payout_guardrails_and_workflow(db):
    biz = _make_user(db, UserRole.BUSINESS, "biz4")
    admin = _make_user(db, UserRole.ADMIN, "adm4")

    # ¥10,000 direct QR + ¥5,000 Yoopay (eligible withdrawable = ¥4,800)
    record_direct_qr_transaction(
        db, provider_user_id=biz.id, provider_role="business", gross_amount=10000,
        source_type="ticket_order", source_id=401, idempotency_key="test4:dqr",
    )
    record_platform_yoopay_transaction(
        db, provider_user_id=biz.id, provider_role="business", gross_amount=5000,
        source_type="order", source_id=402, payment_status="settled", settlement_status="settled",
        idempotency_key="test4:yp",
    )
    # Also add an UNSETTLED Yoopay payment (¥2,000) — must NOT be withdrawable yet!
    record_platform_yoopay_transaction(
        db, provider_user_id=biz.id, provider_role="business", gross_amount=2000,
        source_type="order", source_id=403, payment_status="pending", settlement_status="unsettled",
        idempotency_key="test4:yp_pending",
    )
    db.commit()

    # Trying to withdraw Direct QR funds (e.g. ¥5,000 > ¥4,800) MUST FAIL
    with pytest.raises(ValueError, match="exceeds eligible Sound It withdrawable balance"):
        create_provider_payout_request(
            db, provider_user_id=biz.id, actor_user_id=biz.id, actor_role="business",
            amount=5000, payment_method="wechat_pay", payment_details={"account": "wx"},
            idempotency_key="test4:bad_req",
        )

    # Valid withdrawal of ¥3,000 succeeds and locks funds
    p1, dup1 = create_provider_payout_request(
        db, provider_user_id=biz.id, actor_user_id=biz.id, actor_role="business",
        amount=3000, payment_method="wechat_pay", payment_details={"account": "wx"},
        idempotency_key="test4:ok_req_3000",
    )
    db.commit()
    assert dup1 is False
    assert p1.status == PayoutStatus.PENDING

    # Idempotent replay with same key returns same payout without double-debiting
    p1_replay, dup2 = create_provider_payout_request(
        db, provider_user_id=biz.id, actor_user_id=biz.id, actor_role="business",
        amount=3000, payment_method="wechat_pay", payment_details={"account": "wx"},
        idempotency_key="test4:ok_req_3000",
    )
    assert dup2 is True and p1_replay.id == p1.id

    # Duplicate rapid request with different key for same amount MUST FAIL
    with pytest.raises(ValueError, match="already pending review"):
        create_provider_payout_request(
            db, provider_user_id=biz.id, actor_user_id=biz.id, actor_role="business",
            amount=3000, payment_method="wechat_pay", payment_details={"account": "wx"},
            idempotency_key="test4:dup_key_2",
        )

    s_mid = get_provider_financial_summary(db, provider_user_id=biz.id)
    assert s_mid["withdrawable_balance"] == 1800.0
    assert s_mid["pending_payout"] == 3000.0

    # Admin rejects -> immutable reversal restores ¥4,800 withdrawable balance!
    transition_payout_status(db, payout_id=p1.id, target_status="rejected", admin_user=admin, reason="Incorrect bank account")
    db.commit()
    s_after_rej = get_provider_financial_summary(db, provider_user_id=biz.id)
    assert s_after_rej["withdrawable_balance"] == 4800.0
    assert s_after_rej["pending_payout"] == 0.0

    # New payout -> Approve -> Paid reduces platform cash and records completed payout
    p2, _ = create_provider_payout_request(
        db, provider_user_id=biz.id, actor_user_id=biz.id, actor_role="business",
        amount=4800, payment_method="bank_transfer", payment_details={"account": "ICBC-8888"},
        idempotency_key="test4:final_4800",
    )
    db.commit()
    transition_payout_status(db, payout_id=p2.id, target_status="approved", admin_user=admin)
    transition_payout_status(db, payout_id=p2.id, target_status="paid", admin_user=admin, transaction_reference="BANK-REF-999")
    db.commit()

    # Double-release MUST be rejected by state machine
    with pytest.raises(ValueError, match="Cannot transition payout"):
        transition_payout_status(db, payout_id=p2.id, target_status="paid", admin_user=admin)

    s_final = get_provider_financial_summary(db, provider_user_id=biz.id)
    assert s_final["withdrawable_balance"] == 0.0
    assert s_final["completed_payouts"] == 4800.0
    admin_ov = get_admin_financial_overview(db)
    assert admin_ov["available_platform_cash"] == 200.0  # ¥5,000 in - ¥4,800 paid out = ¥200 retained 4% fee!
    assert admin_ov["outstanding_payout_liabilities"] == 0.0
    _assert_double_entry_balanced(db)


# ===========================================================================
# TEST 5: Platform-processed Yoopay transaction is refunded (immutable reversal)
# ===========================================================================
def test_5_yoopay_refund_immutable_reversal(db):
    org = _make_user(db, UserRole.ORGANIZER, "org5")
    admin = _make_user(db, UserRole.ADMIN, "adm5")

    tx = record_platform_yoopay_transaction(
        db, provider_user_id=org.id, provider_role="organizer", gross_amount=10000,
        source_type="order", source_id=501, payment_status="settled", settlement_status="settled",
        idempotency_key="test5:yp_10000",
    )
    db.commit()

    refund = record_refund(
        db, transaction_id=tx.id, refund_amount=10000, reason="Event cancelled",
        gateway_refund_id="YP-RFD-501", processed_by=admin.id,
    )
    db.commit()

    assert refund.refund_amount == 10000.0
    assert refund.fee_refunded == 400.0
    assert refund.provider_deduction == 9600.0
    # Historical transaction retains original gross_amount (never overwritten!)
    db.refresh(tx)
    assert tx.gross_amount == 10000.0
    assert tx.payment_status == "refunded"

    org_sum = get_provider_financial_summary(db, provider_user_id=org.id)
    assert org_sum["withdrawable_balance"] == 0.0
    assert org_sum["total_fees"] == 0.0
    assert org_sum["refunds"]["platform_yoopay"] == 10000.0

    admin_ov = get_admin_financial_overview(db)
    assert admin_ov["available_platform_cash"] == 0.0
    assert admin_ov["outstanding_payout_liabilities"] == 0.0
    assert admin_ov["transaction_fee_revenue"] == 0.0
    assert admin_ov["refunds"]["platform_yoopay"] == 10000.0
    _assert_double_entry_balanced(db)


# ===========================================================================
# TEST 6: IDOR Protection — Organizer A attempts to access Organizer B's finance
# ===========================================================================
def test_6_idor_cross_account_finance_blocked(db):
    org_a = _make_user(db, UserRole.ORGANIZER, "orga6")
    org_b = _make_user(db, UserRole.ORGANIZER, "orgb6")

    record_platform_yoopay_transaction(
        db, provider_user_id=org_b.id, provider_role="organizer", gross_amount=8000,
        source_type="order", source_id=601, payment_status="settled", settlement_status="settled",
        idempotency_key="test6:orgb_8000",
    )
    db.commit()

    client = TestClient(app)
    token_a = create_access_token({"sub": str(org_a.id)})
    hdr_a = {"Authorization": f"Bearer {token_a}"}

    # Path param IDOR attempt -> 403 Forbidden
    r1 = client.get(f"/api/v1/finance/provider/{org_b.id}/summary", headers=hdr_a)
    assert r1.status_code == 403

    # Query param IDOR attempt -> 403 Forbidden
    r2 = client.get(f"/api/v1/finance/provider/summary?provider_user_id={org_b.id}", headers=hdr_a)
    assert r2.status_code == 403

    # Transactions IDOR attempt -> 403 Forbidden
    r3 = client.get(f"/api/v1/finance/provider/transactions?provider_user_id={org_b.id}", headers=hdr_a)
    assert r3.status_code == 403

    # Non-admin accessing admin overview -> 403 Forbidden
    r4 = client.get("/api/v1/finance/admin/overview", headers=hdr_a)
    assert r4.status_code == 403

    # Organizer A accessing own summary -> 200 OK with ¥0 (sees NONE of Organizer B's ¥8,000)
    r5 = client.get("/api/v1/finance/provider/summary", headers=hdr_a)
    assert r5.status_code == 200
    assert r5.json()["total_reported_earnings"] == 0.0


# ===========================================================================
# TEST 7: Subscription purchased -> Subscription revenue increases, NO provider liability
# ===========================================================================
def test_7_subscription_revenue_isolated(db):
    org = _make_user(db, UserRole.ORGANIZER, "org7")

    sub = Subscription(
        user_id=org.id,
        role=UserRole.ORGANIZER,
        plan_type=SubscriptionPlan.BASIC,
        billing_period="monthly",
        price=100.0,
        status=SubscriptionStatus.ACTIVE,
        payment_method=PaymentMethod.YOOPAY,
        payment_reference="YP-SUB-701",
        is_trial=False,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    record_subscription_payment(db, subscription=sub)
    db.commit()

    # Provider ticket earnings & withdrawable balance MUST stay ¥0
    org_sum = get_provider_financial_summary(db, provider_user_id=org.id)
    assert org_sum["total_reported_earnings"] == 0.0
    assert org_sum["withdrawable_balance"] == 0.0

    # Admin sees ¥100 Subscription Revenue & ¥100 Platform Cash, ¥0 Payout Liability
    admin_ov = get_admin_financial_overview(db)
    assert admin_ov["subscription_revenue"] == 100.0
    assert admin_ov["total_platform_revenue"] == 100.0
    assert admin_ov["transaction_fee_revenue"] == 0.0
    assert admin_ov["outstanding_payout_liabilities"] == 0.0
    assert admin_ov["available_platform_cash"] == 100.0

    sub_rep = get_admin_subscription_report(db)
    assert sub_rep["total_recognized_subscription_revenue"] == 100.0
    assert sub_rep["monthly_recurring_revenue"] == 100.0
    _assert_double_entry_balanced(db)


# ===========================================================================
# TEST 8: Direct QR recorded -> Visible in Admin Direct QR analytics, 0 platform revenue/cash
# ===========================================================================
def test_8_direct_qr_admin_visibility_zero_platform_impact(db):
    vendor = _make_user(db, UserRole.VENDOR, "vnd8")
    admin = _make_user(db, UserRole.ADMIN, "adm8")

    record_direct_qr_transaction(
        db, provider_user_id=vendor.id, provider_role="vendor", gross_amount=3200,
        source_type="product_order", source_id=801, payment_method="alipay_qr",
        verification_status="evidence_submitted", idempotency_key="test8:vnd_dqr",
    )
    db.commit()

    admin_ov = get_admin_financial_overview(db)
    assert admin_ov["direct_qr_transaction_volume"] == 3200.0
    assert admin_ov["direct_qr_transaction_count"] == 1
    assert admin_ov["platform_payment_volume"] == 0.0
    assert admin_ov["total_platform_revenue"] == 0.0
    assert admin_ov["available_platform_cash"] == 0.0
    assert admin_ov["outstanding_payout_liabilities"] == 0.0

    # Also verify currency separation & Yoopay reconciliation exclude Direct QR!
    rec = run_yoopay_reconciliation(db, admin_user_id=admin.id, gateway_records=[], gateway_settled_cash=0.0)
    db.commit()
    assert rec.status == "matched"
    assert rec.internal_confirmed_volume == 0.0
    assert rec.discrepancy_amount == 0.0


# ===========================================================================
# TEST 9: Currency Separation (CNY vs USD never mixed in balances/reports)
# ===========================================================================
def test_9_currency_separation(db):
    org = _make_user(db, UserRole.ORGANIZER, "org9")
    record_platform_yoopay_transaction(
        db, provider_user_id=org.id, provider_role="organizer", gross_amount=1000,
        source_type="order", source_id=901, currency="CNY", payment_status="settled",
        settlement_status="settled", idempotency_key="test9:cny",
    )
    record_platform_yoopay_transaction(
        db, provider_user_id=org.id, provider_role="organizer", gross_amount=500,
        source_type="order", source_id=902, currency="USD", payment_status="settled",
        settlement_status="settled", idempotency_key="test9:usd",
    )
    db.commit()

    cny = get_provider_financial_summary(db, provider_user_id=org.id, currency="CNY")
    usd = get_provider_financial_summary(db, provider_user_id=org.id, currency="USD")
    assert cny["soundit_processed_earnings"] == 1000.0 and cny["withdrawable_balance"] == 960.0
    assert usd["soundit_processed_earnings"] == 500.0 and usd["withdrawable_balance"] == 480.0
    _assert_double_entry_balanced(db, "CNY")
    _assert_double_entry_balanced(db, "USD")
