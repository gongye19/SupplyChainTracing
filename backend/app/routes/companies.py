from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional

from ..database import get_db
from ..schemas import CompanyDashboardResponse, CompanySearchResult
from ..utils.db_helpers import is_missing_table_error, rows_to_dicts

router = APIRouter()


def _date_filter(where: str, params: dict, start_year_month: Optional[str], end_year_month: Optional[str]) -> tuple[str, dict]:
    if start_year_month:
        y, m = start_year_month.split("-")
        where += " AND (year > :sy OR (year = :sy AND month >= :sm))"
        params["sy"], params["sm"] = int(y), int(m)
    if end_year_month:
        y, m = end_year_month.split("-")
        where += " AND (year < :ey OR (year = :ey AND month <= :em))"
        params["ey"], params["em"] = int(y), int(m)
    return where, params


def _hs_filter(where: str, params: dict, hs_code: Optional[List[str]], hs_code_prefix: Optional[List[str]]) -> tuple[str, dict]:
    if hs_code:
        ph = ", ".join(f":hs_{i}" for i in range(len(hs_code)))
        where += f" AND hs_code IN ({ph})"
        for i, code in enumerate(hs_code):
            params[f"hs_{i}"] = code
    elif hs_code_prefix:
        conds = []
        for i, prefix in enumerate(hs_code_prefix):
            params[f"hsp_{i}"] = f"{prefix}%"
            conds.append(f"hs_code LIKE :hsp_{i}")
        where += f" AND ({' OR '.join(conds)})"
    return where, params


def _safe(db: Session, query: str, params: dict, fallback):
    try:
        return db.execute(text(query), params)
    except Exception as exc:
        if is_missing_table_error(exc):
            return fallback
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {exc}")


@router.get("/search", response_model=List[CompanySearchResult])
def search_companies(
    q: Optional[str] = Query(None),
    country: Optional[List[str]] = Query(None),
    hs_code: Optional[List[str]] = Query(None),
    hs_code_prefix: Optional[List[str]] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    params: dict = {"limit": limit}
    where = " WHERE 1=1"
    keyword = (q or "").strip()
    if keyword:
        where += " AND s.name ILIKE :keyword"
        params["keyword"] = f"%{keyword}%"

    if country:
        ph = ", ".join(f":country_{i}" for i in range(len(country)))
        where += f" AND s.country_code IN ({ph})"
        for i, code in enumerate(country):
            params[f"country_{i}"] = code

    hs_exists_where = " WHERE h.company_name = s.name"
    hs_exists_where, params = _hs_filter(hs_exists_where, params, hs_code, hs_code_prefix)
    if hs_code or hs_code_prefix:
        where += f" AND EXISTS (SELECT 1 FROM company_hs_trade_stats h{hs_exists_where})"

    query = f"""
        SELECT s.name, s.country_code, s.role, s.total_trade_value, s.trade_count
        FROM company_search_stats s
        {where}
        ORDER BY total_trade_value DESC, trade_count DESC
        LIMIT :limit
    """
    result = _safe(db, query, params, fallback=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


@router.get("/filters")
def get_company_filters(db: Session = Depends(get_db)):
    countries_query = """
        SELECT country_code, COALESCE(SUM(total_trade_value), 0) AS total_trade_value
        FROM company_search_stats
        WHERE country_code IS NOT NULL
        GROUP BY country_code
        ORDER BY total_trade_value DESC
    """
    hs_query = """
        SELECT
            LEFT(hs_code, 2) AS hs_prefix,
            COALESCE(SUM(sum_of_usd), 0) AS total_trade_value,
            COALESCE(SUM(trade_count), 0) AS trade_count
        FROM company_hs_trade_stats
        GROUP BY LEFT(hs_code, 2)
        ORDER BY total_trade_value DESC
    """
    countries_result = _safe(db, countries_query, {}, fallback=[])
    hs_result = _safe(db, hs_query, {}, fallback=[])
    return {
        "countries": rows_to_dicts(countries_result, countries_result.fetchall()) if countries_result != [] else [],
        "hs_categories": rows_to_dicts(hs_result, hs_result.fetchall()) if hs_result != [] else [],
    }


@router.get("/dashboard", response_model=CompanyDashboardResponse)
def get_company_dashboard(
    name: str = Query(..., min_length=1),
    start_year_month: Optional[str] = Query(None),
    end_year_month: Optional[str] = Query(None),
    hs_code: Optional[List[str]] = Query(None),
    hs_code_prefix: Optional[List[str]] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    company_name = name.strip()
    params: dict = {"name": company_name, "limit": limit}

    monthly_where = " WHERE company_name = :name"
    monthly_where, params = _date_filter(monthly_where, params, start_year_month, end_year_month)

    summary_query = f"""
        WITH base AS (
            SELECT *
            FROM company_monthly_trade_stats
            {monthly_where}
        )
        SELECT
            COALESCE(SUM(sum_of_usd), 0) AS total_trade_value,
            COALESCE(SUM(trade_count), 0) AS total_trade_count,
            COALESCE(SUM(CASE WHEN role = 'importer' THEN sum_of_usd ELSE 0 END), 0) AS import_trade_value,
            COALESCE(SUM(CASE WHEN role = 'exporter' THEN sum_of_usd ELSE 0 END), 0) AS export_trade_value,
            CASE
                WHEN COUNT(DISTINCT role) > 1 THEN 'both'
                ELSE COALESCE(MIN(role), 'unknown')
            END AS role,
            (
                SELECT country_code
                FROM base
                WHERE country_code IS NOT NULL
                GROUP BY country_code
                ORDER BY SUM(sum_of_usd) DESC
                LIMIT 1
            ) AS country_code
        FROM base
    """
    result = _safe(db, summary_query, params, fallback=None)
    if result is None:
        raise HTTPException(status_code=404, detail="公司数据不可用")
    row = result.fetchone()
    if not row or (row.total_trade_count or 0) == 0:
        raise HTTPException(status_code=404, detail="未找到公司")
    summary = dict(row._mapping)

    hs_params = {"name": company_name, "limit": limit}
    hs_where = " WHERE company_name = :name"
    hs_where, hs_params = _hs_filter(hs_where, hs_params, hs_code, hs_code_prefix)
    categories_query = f"""
        WITH agg AS (
            SELECT
                hs_code,
                MAX(product_desc_en) AS product_desc_en,
                COALESCE(SUM(sum_of_usd), 0) AS sum_of_usd,
                COALESCE(SUM(trade_count), 0) AS trade_count
            FROM company_hs_trade_stats
            {hs_where}
            GROUP BY hs_code
        )
        SELECT
            hs_code,
            COALESCE('HS ' || hs_code || ' · ' || NULLIF(product_desc_en, ''), 'HS ' || hs_code) AS label,
            sum_of_usd,
            trade_count,
            CASE WHEN SUM(sum_of_usd) OVER() = 0 THEN 0
                 ELSE sum_of_usd / SUM(sum_of_usd) OVER()
            END AS share_pct
        FROM agg
        ORDER BY sum_of_usd DESC, trade_count DESC
        LIMIT :limit
    """

    suppliers_query = """
        WITH agg AS (
            SELECT
                counterparty_name AS company,
                counterparty_country_code AS country_code,
                COALESCE(SUM(sum_of_usd), 0) AS sum_of_usd,
                COALESCE(SUM(trade_count), 0) AS trade_count
            FROM company_counterparty_trade_stats
            WHERE company_name = :name AND role = 'importer'
            GROUP BY counterparty_name, counterparty_country_code
        )
        SELECT
            ROW_NUMBER() OVER (ORDER BY sum_of_usd DESC, trade_count DESC) AS rank,
            company,
            country_code,
            sum_of_usd,
            trade_count,
            CASE WHEN SUM(sum_of_usd) OVER() = 0 THEN 0
                 ELSE sum_of_usd / SUM(sum_of_usd) OVER()
            END AS share_pct
        FROM agg
        ORDER BY rank
        LIMIT :limit
    """

    customers_query = """
        WITH agg AS (
            SELECT
                counterparty_name AS company,
                counterparty_country_code AS country_code,
                COALESCE(SUM(sum_of_usd), 0) AS sum_of_usd,
                COALESCE(SUM(trade_count), 0) AS trade_count
            FROM company_counterparty_trade_stats
            WHERE company_name = :name AND role = 'exporter'
            GROUP BY counterparty_name, counterparty_country_code
        )
        SELECT
            ROW_NUMBER() OVER (ORDER BY sum_of_usd DESC, trade_count DESC) AS rank,
            company,
            country_code,
            sum_of_usd,
            trade_count,
            CASE WHEN SUM(sum_of_usd) OVER() = 0 THEN 0
                 ELSE sum_of_usd / SUM(sum_of_usd) OVER()
            END AS share_pct
        FROM agg
        ORDER BY rank
        LIMIT :limit
    """

    trends_query = f"""
        SELECT
            TO_CHAR(TO_DATE(year || '-' || LPAD(month::text, 2, '0') || '-01', 'YYYY-MM-DD'), 'YYYY-MM') AS year_month,
            COALESCE(SUM(sum_of_usd), 0) AS sum_of_usd,
            COALESCE(SUM(trade_count), 0) AS trade_count
        FROM company_monthly_trade_stats
        {monthly_where}
        GROUP BY year, month
        ORDER BY year, month
    """

    result = _safe(db, categories_query, hs_params, fallback=[])
    categories = rows_to_dicts(result, result.fetchall()) if result != [] else []
    result = _safe(db, suppliers_query, {"name": company_name, "limit": limit}, fallback=[])
    suppliers = rows_to_dicts(result, result.fetchall()) if result != [] else []
    result = _safe(db, customers_query, {"name": company_name, "limit": limit}, fallback=[])
    customers = rows_to_dicts(result, result.fetchall()) if result != [] else []
    result = _safe(db, trends_query, params, fallback=[])
    trends = rows_to_dicts(result, result.fetchall()) if result != [] else []

    return {
        "name": company_name,
        "country_code": summary.get("country_code"),
        "role": summary.get("role") or "unknown",
        "total_trade_value": float(summary.get("total_trade_value") or 0),
        "total_trade_count": int(summary.get("total_trade_count") or 0),
        "import_trade_value": float(summary.get("import_trade_value") or 0),
        "export_trade_value": float(summary.get("export_trade_value") or 0),
        "categories": categories,
        "top_suppliers": suppliers,
        "top_customers": customers,
        "trends": trends,
    }
