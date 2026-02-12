from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional

from ..database import get_db
from ..schemas import CountryMonthlyTradeStat, CountryTradeStatSummary, CountryTradeTrend, TopCountry
from ..utils.db_helpers import is_missing_table_error, rows_to_dicts

router = APIRouter()


def _apply_common_filters(
    query: str,
    params: dict,
    hs_code: Optional[List[str]] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    country: Optional[List[str]] = None,
    industry: Optional[str] = None,
    start_year_month: Optional[str] = None,
    end_year_month: Optional[str] = None,
) -> tuple[str, dict]:
    if hs_code:
        placeholders = ", ".join([f":hs_code_{i}" for i in range(len(hs_code))])
        query += f" AND hs_code IN ({placeholders})"
        for i, code in enumerate(hs_code):
            params[f"hs_code_{i}"] = code

    if year:
        query += " AND year = :year"
        params["year"] = year

    if month:
        query += " AND month = :month"
        params["month"] = month

    if country:
        placeholders = ", ".join([f":country_{i}" for i in range(len(country))])
        query += f" AND country_code IN ({placeholders})"
        for i, value in enumerate(country):
            params[f"country_{i}"] = value

    if industry:
        query += " AND industry = :industry"
        params["industry"] = industry

    if start_year_month:
        year_val, month_val = start_year_month.split("-")
        query += " AND (year > :start_year OR (year = :start_year AND month >= :start_month))"
        params["start_year"] = int(year_val)
        params["start_month"] = int(month_val)

    if end_year_month:
        year_val, month_val = end_year_month.split("-")
        query += " AND (year < :end_year OR (year = :end_year AND month <= :end_month))"
        params["end_year"] = int(year_val)
        params["end_month"] = int(month_val)

    return query, params


def _safe_query(db: Session, query: str, params: dict, default_value):
    try:
        result = db.execute(text(query), params)
        return result
    except Exception as exc:
        if is_missing_table_error(exc):
            return default_value
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(exc)}")


@router.get("", response_model=List[CountryMonthlyTradeStat])
def get_country_trade_stats(
    hs_code: Optional[List[str]] = Query(None, description="HS编码筛选（6位，可多个）"),
    year: Optional[int] = Query(None, description="年份筛选"),
    month: Optional[int] = Query(None, description="月份筛选（1-12）"),
    country: Optional[List[str]] = Query(None, description="国家代码筛选（可多个）"),
    industry: Optional[str] = Query(None, description="行业筛选"),
    start_year_month: Optional[str] = Query(None, description="起始年月 (YYYY-MM)"),
    end_year_month: Optional[str] = Query(None, description="结束年月 (YYYY-MM)"),
    limit: Optional[int] = Query(10000, description="返回记录数限制"),
    db: Session = Depends(get_db),
):
    query = "SELECT * FROM country_monthly_trade_stats WHERE 1=1"
    params: dict = {}
    query, params = _apply_common_filters(
        query,
        params,
        hs_code=hs_code,
        year=year,
        month=month,
        country=country,
        industry=industry,
        start_year_month=start_year_month,
        end_year_month=end_year_month,
    )
    query += " ORDER BY year DESC, month DESC, sum_of_usd DESC"
    if limit:
        query += " LIMIT :limit"
        params["limit"] = limit

    result = _safe_query(db, query, params, default_value=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


@router.get("/summary", response_model=CountryTradeStatSummary)
def get_country_trade_stats_summary(
    hs_code: Optional[List[str]] = Query(None, description="HS编码筛选（6位，可多个）"),
    year: Optional[int] = Query(None, description="年份筛选"),
    month: Optional[int] = Query(None, description="月份筛选（1-12）"),
    country: Optional[List[str]] = Query(None, description="国家代码筛选（可多个）"),
    industry: Optional[str] = Query(None, description="行业筛选"),
    start_year_month: Optional[str] = Query(None, description="起始年月 (YYYY-MM)"),
    end_year_month: Optional[str] = Query(None, description="结束年月 (YYYY-MM)"),
    db: Session = Depends(get_db),
):
    query = """
        SELECT
            COUNT(DISTINCT country_code) AS total_countries,
            COALESCE(SUM(sum_of_usd), 0) AS total_trade_value,
            COALESCE(SUM(weight), 0) AS total_weight,
            COALESCE(SUM(quantity), 0) AS total_quantity,
            COALESCE(SUM(trade_count), 0) AS total_trade_count,
            COALESCE(AVG(amount_share_pct), 0) AS avg_share_pct
        FROM country_monthly_trade_stats
        WHERE 1=1
    """
    params: dict = {}
    query, params = _apply_common_filters(
        query,
        params,
        hs_code=hs_code,
        year=year,
        month=month,
        country=country,
        industry=industry,
        start_year_month=start_year_month,
        end_year_month=end_year_month,
    )

    default_summary = {
        "total_countries": 0,
        "total_trade_value": 0.0,
        "total_weight": None,
        "total_quantity": None,
        "total_trade_count": 0,
        "avg_share_pct": 0.0,
    }
    result = _safe_query(db, query, params, default_value=None)
    if result is None:
        return default_summary
    row = result.fetchone()
    if not row:
        return default_summary
    if hasattr(row, "_mapping"):
        return dict(row._mapping)
    if hasattr(row, "_asdict"):
        return row._asdict()
    return default_summary


@router.get("/trends", response_model=List[CountryTradeTrend])
def get_country_trade_trends(
    hs_code: Optional[str] = Query(None, description="HS编码（6位）"),
    country: Optional[str] = Query(None, description="国家代码"),
    industry: Optional[str] = Query(None, description="行业筛选"),
    start_year_month: Optional[str] = Query(None, description="起始年月 (YYYY-MM)"),
    end_year_month: Optional[str] = Query(None, description="结束年月 (YYYY-MM)"),
    db: Session = Depends(get_db),
):
    query = """
        SELECT
            TO_CHAR(TO_DATE(year || '-' || LPAD(month::text, 2, '0') || '-01', 'YYYY-MM-DD'), 'YYYY-MM') AS year_month,
            COALESCE(SUM(sum_of_usd), 0) AS sum_of_usd,
            COALESCE(SUM(weight), 0) AS weight,
            COALESCE(SUM(quantity), 0) AS quantity,
            COALESCE(SUM(trade_count), 0) AS trade_count
        FROM country_monthly_trade_stats
        WHERE 1=1
    """
    params: dict = {}
    if hs_code:
        query += " AND hs_code = :hs_code"
        params["hs_code"] = hs_code
    if country:
        query += " AND country_code = :country"
        params["country"] = country
    if industry:
        query += " AND industry = :industry"
        params["industry"] = industry
    if start_year_month:
        year_val, month_val = start_year_month.split("-")
        query += " AND (year > :start_year OR (year = :start_year AND month >= :start_month))"
        params["start_year"] = int(year_val)
        params["start_month"] = int(month_val)
    if end_year_month:
        year_val, month_val = end_year_month.split("-")
        query += " AND (year < :end_year OR (year = :end_year AND month <= :end_month))"
        params["end_year"] = int(year_val)
        params["end_month"] = int(month_val)
    query += " GROUP BY year, month ORDER BY year, month"

    result = _safe_query(db, query, params, default_value=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


@router.get("/top-countries", response_model=List[TopCountry])
def get_top_countries(
    hs_code: Optional[str] = Query(None, description="HS编码（6位）"),
    year: Optional[int] = Query(None, description="年份筛选"),
    month: Optional[int] = Query(None, description="月份筛选（1-12）"),
    industry: Optional[str] = Query(None, description="行业筛选"),
    limit: int = Query(10, description="返回Top N国家"),
    db: Session = Depends(get_db),
):
    query = """
        SELECT
            country_code,
            COALESCE(SUM(sum_of_usd), 0) AS sum_of_usd,
            COALESCE(SUM(weight), 0) AS weight,
            COALESCE(SUM(quantity), 0) AS quantity,
            COALESCE(SUM(trade_count), 0) AS trade_count,
            COALESCE(AVG(amount_share_pct), 0) AS amount_share_pct
        FROM country_monthly_trade_stats
        WHERE 1=1
    """
    params: dict = {}
    if hs_code:
        query += " AND hs_code = :hs_code"
        params["hs_code"] = hs_code
    if year:
        query += " AND year = :year"
        params["year"] = year
    if month:
        query += " AND month = :month"
        params["month"] = month
    if industry:
        query += " AND industry = :industry"
        params["industry"] = industry

    query += " GROUP BY country_code ORDER BY sum_of_usd DESC LIMIT :limit"
    params["limit"] = limit

    result = _safe_query(db, query, params, default_value=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())

