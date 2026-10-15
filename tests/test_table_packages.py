"""Acceptance tests for the Table Packages & Drinks financial spec (§13).

Pure-function tests (no DB writes) for the authoritative server-side math,
plus mixer/upgrade invariants enforced in api.table_reservations.book_table.
Run: .venv-ui/bin/python -m pytest tests/test_table_packages.py -q
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from types import SimpleNamespace
import pytest
from fastapi import HTTPException

from api.table_reservations import _calc_table_financials, _cents, _yuan, _derive_guest_count


def ev(ticket_price, allocation_percent):
    return SimpleNamespace(ticket_price=ticket_price, table_allocation_percent=allocation_percent)


def pkg(price):
    return SimpleNamespace(price=price)


# Spec §2.3 worked example (acceptance #1)
def test_worked_example_1000_table_for_2():
    fin = _calc_table_financials(ev(100, 80), pkg(1000), 2)
    assert fin["ticket_total"] == 200.0
    assert fin["allocation_amount"] == 80.0      # 80% of ONE ticket, once per table
    assert fin["drink_allowance"] == 720.0


# Acceptance #2: ticket price change recalculates allocation
def test_allocation_follows_ticket_price():
    fin = _calc_table_financials(ev(120, 80), pkg(1000), 2)
    assert fin["allocation_amount"] == 96.0


# Acceptance #3: allocation once per table regardless of guest count
@pytest.mark.parametrize("guests", [2, 4, 6])
def test_allocation_once_per_table(guests):
    fin = _calc_table_financials(ev(100, 80), pkg(2000), guests)
    assert fin["allocation_amount"] == 80.0
    assert fin["ticket_total"] == 100.0 * guests


# Acceptance #4: per-event percentage (no global hardcode)
def test_percentage_is_per_event():
    assert _calc_table_financials(ev(100, 50), pkg(1000), 2)["allocation_amount"] == 50.0
    assert _calc_table_financials(ev(100, 90), pkg(1000), 2)["allocation_amount"] == 90.0


# Acceptance #17 / §2.4: negative allowance blocked with a clear error
def test_negative_allowance_rejected():
    with pytest.raises(HTTPException) as e:
        _calc_table_financials(ev(100, 80), pkg(100), 2)  # 100 - 200 - 80 < 0
    assert e.value.status_code == 400
    assert "negative" in str(e.value.detail)


# Missing configuration errors
def test_missing_ticket_price():
    with pytest.raises(HTTPException) as e:
        _calc_table_financials(ev(None, 80), pkg(1000), 2)
    assert "ticket price" in str(e.value.detail)


def test_missing_allocation_percent():
    with pytest.raises(HTTPException) as e:
        _calc_table_financials(ev(100, None), pkg(1000), 2)
    assert "allocation" in str(e.value.detail)


# Decimal safety: cents rounding avoids float drift
def test_cents_arithmetic_is_exact():
    assert _cents(0.1) + _cents(0.2) == _cents(0.3) == 30
    assert _yuan(305) == 3.05
    assert _yuan(_cents(19.99) * 3) == 59.97


# Buyer cannot choose the guest count — it is fixed by the organizer's package
def test_guest_count_is_organizer_controlled():
    # ticket_quantity (organizer-set per table) wins
    assert _derive_guest_count(SimpleNamespace(ticket_quantity=6, max_people=10)) == 6
    # falls back to max_people only when no ticket quantity configured
    assert _derive_guest_count(SimpleNamespace(ticket_quantity=0, max_people=8)) == 8
    # at least one guest even on a bare package
    assert _derive_guest_count(SimpleNamespace(ticket_quantity=0, max_people=None)) == 1
