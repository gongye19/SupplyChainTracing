from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any

import pycountry


COMPANY_PLACEHOLDERS = {"", "N A", "NA", "N/A", "N.A.", "NULL", "NONE", "UNKNOWN", "NOT REGISTERED", "-", "--"}
COUNTRY_CODE_RE = re.compile(r"\(([A-Z]{2,3})\)")

ISO2_TO_ISO3_MANUAL = {
    "UK": "GBR",
    "EL": "GRC",
}

COUNTRY_NAME_TO_ISO3 = {
    "HONG KONG,CHINA": "HKG",
    "TAIWAN,CHINA": "TWN",
    "SOUTH KOREA": "KOR",
    "RUSSIA": "RUS",
    "VIETNAM": "VNM",
    "MACAU": "MAC",
    "MACAO": "MAC",
    "S. AFRICA": "ZAF",
    "MYANMA (FORMER REP. OF BIRMAN)": "MMR",
    "ST.PIERRE AND MIQUELON (SP)": "SPM",
}


def to_iso3(code: str) -> str | None:
    code = (code or "").strip().upper()
    if not code:
        return None
    if len(code) == 3:
        return code
    if len(code) == 2:
        if code in ISO2_TO_ISO3_MANUAL:
            return ISO2_TO_ISO3_MANUAL[code]
        country = pycountry.countries.get(alpha_2=code)
        return country.alpha_3 if country else None
    return None


def clean_country(raw: object) -> str | None:
    if raw is None:
        return None
    value = str(raw).strip()
    if not value:
        return None
    match = COUNTRY_CODE_RE.search(value)
    if match:
        iso3 = to_iso3(match.group(1))
        if iso3:
            return iso3
    upper = value.upper()
    if upper in COUNTRY_NAME_TO_ISO3:
        return COUNTRY_NAME_TO_ISO3[upper]
    return None


def clean_company(raw: object) -> str | None:
    if raw is None:
        return None
    value = re.sub(r"\s+", " ", str(raw)).strip()
    if value.upper() in COMPANY_PLACEHOLDERS:
        return None
    return value or None


def parse_decimal(raw: object) -> Decimal:
    if raw is None or str(raw).strip() == "":
        return Decimal("0")
    try:
        return Decimal(str(raw).replace(",", "").strip())
    except InvalidOperation:
        return Decimal("0")


def parse_int(raw: object, default: int = 0) -> int:
    if raw is None or str(raw).strip() == "":
        return default
    try:
        return int(Decimal(str(raw).replace(",", "").strip()))
    except InvalidOperation:
        return default


def parse_month(raw: object) -> tuple[int, int] | None:
    if raw is None:
        return None
    value = str(raw).strip()
    if re.fullmatch(r"\d+(\.0+)?", value):
        value = str(int(float(value)))
    if not re.fullmatch(r"\d{6}", value):
        return None
    year = int(value[:4])
    month = int(value[4:6])
    if month < 1 or month > 12:
        return None
    return year, month


def normalize_hs(raw: object) -> str:
    hs_code = str(raw).strip()
    if re.fullmatch(r"\d+(\.0+)?", hs_code):
        return str(int(float(hs_code)))
    return hs_code


def empty_amount_bucket() -> dict[str, Any]:
    return {
        "sum_of_usd": Decimal("0"),
        "trade_count": 0,
        "row_count": 0,
        "product_desc_zh": None,
        "product_desc_en": None,
    }


def add_amount(
    bucket: dict[str, Any],
    amount: Decimal,
    trade_count: int,
    desc_zh: str | None = None,
    desc_en: str | None = None,
) -> None:
    bucket["sum_of_usd"] += amount
    bucket["trade_count"] += trade_count
    bucket["row_count"] += 1
    if desc_zh and not bucket.get("product_desc_zh"):
        bucket["product_desc_zh"] = desc_zh
    if desc_en and not bucket.get("product_desc_en"):
        bucket["product_desc_en"] = desc_en
