from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..utils.db_helpers import is_missing_table_error


TABLE = "country_origin_trade_stats"


@dataclass(frozen=True)
class TradeFilters:
    hs_code: Optional[list[str]] = None
    hs_code_prefix: Optional[list[str]] = None
    year: Optional[int] = None
    month: Optional[int] = None
    country: Optional[list[str]] = None
    start_year_month: Optional[str] = None
    end_year_month: Optional[str] = None
    trade_direction: Optional[str] = "all"


def normalize_direction(value: Optional[str]) -> str:
    return value if value in {"import", "export", "all"} else "all"


def country_col(trade_direction: Optional[str]) -> str | None:
    direction = normalize_direction(trade_direction)
    if direction == "import":
        return "destination_country_code"
    if direction == "export":
        return "origin_country_code"
    return None


def apply_filters(query: str, params: dict, filters: TradeFilters) -> tuple[str, dict]:
    if filters.hs_code:
        ph = ", ".join([f":hs_{i}" for i in range(len(filters.hs_code))])
        query += f" AND hs_code IN ({ph})"
        for i, code in enumerate(filters.hs_code):
            params[f"hs_{i}"] = code

    if filters.hs_code_prefix:
        conds = []
        for i, prefix in enumerate(filters.hs_code_prefix):
            params[f"hsp_{i}"] = f"{prefix}%"
            conds.append(f"hs_code LIKE :hsp_{i}")
        query += f" AND ({' OR '.join(conds)})"

    if filters.year is not None:
        query += " AND year = :year"
        params["year"] = filters.year
    if filters.month is not None:
        query += " AND month = :month"
        params["month"] = filters.month

    if filters.country:
        ph = ", ".join([f":ctry_{i}" for i in range(len(filters.country))])
        col = country_col(filters.trade_direction)
        if col:
            query += f" AND {col} IN ({ph})"
        else:
            query += f" AND (origin_country_code IN ({ph}) OR destination_country_code IN ({ph}))"
        for i, code in enumerate(filters.country):
            params[f"ctry_{i}"] = code

    if filters.start_year_month:
        y, m = filters.start_year_month.split("-")
        query += " AND (year > :sy OR (year = :sy AND month >= :sm))"
        params["sy"], params["sm"] = int(y), int(m)
    if filters.end_year_month:
        y, m = filters.end_year_month.split("-")
        query += " AND (year < :ey OR (year = :ey AND month <= :em))"
        params["ey"], params["em"] = int(y), int(m)

    return query, params


def execute_safe(db: Session, query: str, params: dict, fallback):
    try:
        return db.execute(text(query), params)
    except Exception as exc:
        if is_missing_table_error(exc):
            return fallback
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {exc}") from exc


def metric_sql(metric: Optional[str]) -> tuple[str, str, str, str]:
    metric_key = "trade_count" if metric == "trade_count" else "trade_value"
    share_numerator = "SUM(trade_count)" if metric_key == "trade_count" else "SUM(sum_of_usd)"
    share_denominator = "SUM(SUM(trade_count)) OVER()" if metric_key == "trade_count" else "SUM(SUM(sum_of_usd)) OVER()"
    order_metric = "trade_count" if metric_key == "trade_count" else "sum_of_usd"
    return metric_key, share_numerator, share_denominator, order_metric
