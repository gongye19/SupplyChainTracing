from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional

from ..database import get_db
from ..schemas import CompanyDashboardResponse, CompanySearchResult
from ..utils.db_helpers import is_missing_table_error, rows_to_dicts

router = APIRouter()

TABLE = "company_trade_flows"


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
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    keyword = f"%{q.strip()}%"
    query = """
        WITH names AS (
            SELECT
                importer_name AS name,
                importer_country_code AS country_code,
                'importer' AS role,
                COALESCE(SUM(amount_usd), 0) AS total_trade_value,
                COALESCE(SUM(trade_count), 0) AS trade_count
            FROM company_trade_flows
            WHERE importer_name IS NOT NULL AND importer_name ILIKE :keyword
            GROUP BY importer_name, importer_country_code
            UNION ALL
            SELECT
                exporter_name AS name,
                COALESCE(exporter_country_code, export_side_country_code) AS country_code,
                'exporter' AS role,
                COALESCE(SUM(amount_usd), 0) AS total_trade_value,
                COALESCE(SUM(trade_count), 0) AS trade_count
            FROM company_trade_flows
            WHERE exporter_name IS NOT NULL AND exporter_name ILIKE :keyword
            GROUP BY exporter_name, COALESCE(exporter_country_code, export_side_country_code)
        ),
        merged AS (
            SELECT
                name,
                country_code,
                CASE
                    WHEN COUNT(DISTINCT role) > 1 THEN 'both'
                    ELSE MIN(role)
                END AS role,
                SUM(total_trade_value) AS total_trade_value,
                SUM(trade_count) AS trade_count
            FROM names
            GROUP BY name, country_code
        )
        SELECT name, country_code, role, total_trade_value, trade_count
        FROM merged
        ORDER BY total_trade_value DESC, trade_count DESC
        LIMIT :limit
    """
    result = _safe(db, query, {"keyword": keyword, "limit": limit}, fallback=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


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
    where = " WHERE (importer_name = :name OR exporter_name = :name)"
    where, params = _date_filter(where, params, start_year_month, end_year_month)
    where, params = _hs_filter(where, params, hs_code, hs_code_prefix)

    summary_query = f"""
        WITH base AS (
            SELECT * FROM {TABLE}{where}
        ),
        role_counts AS (
            SELECT 'importer' AS role WHERE EXISTS (SELECT 1 FROM base WHERE importer_name = :name)
            UNION ALL
            SELECT 'exporter' AS role WHERE EXISTS (SELECT 1 FROM base WHERE exporter_name = :name)
        ),
        country_votes AS (
            SELECT importer_country_code AS country_code, COUNT(*) AS n
            FROM base WHERE importer_name = :name AND importer_country_code IS NOT NULL
            GROUP BY importer_country_code
            UNION ALL
            SELECT COALESCE(exporter_country_code, export_side_country_code) AS country_code, COUNT(*) AS n
            FROM base
            WHERE exporter_name = :name AND COALESCE(exporter_country_code, export_side_country_code) IS NOT NULL
            GROUP BY COALESCE(exporter_country_code, export_side_country_code)
        )
        SELECT
            COALESCE(SUM(amount_usd), 0) AS total_trade_value,
            COALESCE(SUM(trade_count), 0) AS total_trade_count,
            COALESCE(SUM(CASE WHEN importer_name = :name THEN amount_usd ELSE 0 END), 0) AS import_trade_value,
            COALESCE(SUM(CASE WHEN exporter_name = :name THEN amount_usd ELSE 0 END), 0) AS export_trade_value,
            (
                SELECT CASE
                    WHEN COUNT(DISTINCT role) > 1 THEN 'both'
                    ELSE COALESCE(MIN(role), 'unknown')
                END
                FROM role_counts
            ) AS role,
            (
                SELECT country_code
                FROM country_votes
                GROUP BY country_code
                ORDER BY SUM(n) DESC
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

    categories_query = f"""
        WITH base AS (
            SELECT * FROM {TABLE}{where}
        ),
        agg AS (
            SELECT
                hs_code,
                MAX(product_desc_en) AS product_desc_en,
                COALESCE(SUM(amount_usd), 0) AS sum_of_usd,
                COALESCE(SUM(trade_count), 0) AS trade_count
            FROM base
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

    suppliers_query = f"""
        WITH base AS (
            SELECT * FROM {TABLE}{where} AND importer_name = :name AND exporter_name IS NOT NULL
        ),
        agg AS (
            SELECT
                exporter_name AS company,
                COALESCE(exporter_country_code, export_side_country_code) AS country_code,
                COALESCE(SUM(amount_usd), 0) AS sum_of_usd,
                COALESCE(SUM(trade_count), 0) AS trade_count
            FROM base
            GROUP BY exporter_name, COALESCE(exporter_country_code, export_side_country_code)
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

    customers_query = f"""
        WITH base AS (
            SELECT * FROM {TABLE}{where} AND exporter_name = :name AND importer_name IS NOT NULL
        ),
        agg AS (
            SELECT
                importer_name AS company,
                importer_country_code AS country_code,
                COALESCE(SUM(amount_usd), 0) AS sum_of_usd,
                COALESCE(SUM(trade_count), 0) AS trade_count
            FROM base
            GROUP BY importer_name, importer_country_code
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
            COALESCE(SUM(amount_usd), 0) AS sum_of_usd,
            COALESCE(SUM(trade_count), 0) AS trade_count
        FROM {TABLE}{where}
        GROUP BY year, month
        ORDER BY year, month
    """

    result = _safe(db, categories_query, params, fallback=[])
    categories = rows_to_dicts(result, result.fetchall()) if result != [] else []
    result = _safe(db, suppliers_query, params, fallback=[])
    suppliers = rows_to_dicts(result, result.fetchall()) if result != [] else []
    result = _safe(db, customers_query, params, fallback=[])
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
