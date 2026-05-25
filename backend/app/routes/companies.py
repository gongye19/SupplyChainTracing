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


def _ranking_sql(metric: Optional[str]) -> tuple[str, str, str]:
    if metric == "trade_count":
        return "trade_count", "sum_of_usd", "SUM(trade_count) OVER()"
    return "sum_of_usd", "trade_count", "SUM(sum_of_usd) OVER()"


def _has_column(db: Session, table_name: str, column_name: str) -> bool:
    result = db.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :table_name
                  AND column_name = :column_name
            )
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    )
    return bool(result.scalar())


@router.get("/search", response_model=List[CompanySearchResult])
def search_companies(
    q: Optional[str] = Query(None),
    brand: Optional[List[str]] = Query(None),
    country: Optional[List[str]] = Query(None),
    hs_code: Optional[List[str]] = Query(None),
    hs_code_prefix: Optional[List[str]] = Query(None),
    role: Optional[str] = Query(None),
    metric: Optional[str] = Query("trade_value"),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    has_brand = _has_column(db, "company_search_stats", "brand_name")
    brand_select = "s.brand_name" if has_brand else "NULL::text"
    params: dict = {"limit": limit}
    where = " WHERE 1=1"
    keyword = (q or "").strip()
    if keyword:
        if has_brand:
            where += " AND (s.name ILIKE :keyword OR s.brand_name ILIKE :keyword)"
        else:
            where += " AND s.name ILIKE :keyword"
        params["keyword"] = f"%{keyword}%"

    if brand and has_brand:
        ph = ", ".join(f":brand_{i}" for i in range(len(brand)))
        where += f" AND s.brand_name IN ({ph})"
        for i, value in enumerate(brand):
            params[f"brand_{i}"] = value

    if country:
        ph = ", ".join(f":country_{i}" for i in range(len(country)))
        where += f" AND s.country_code IN ({ph})"
        for i, code in enumerate(country):
            params[f"country_{i}"] = code

    if role == "importer":
        where += " AND s.role IN ('importer', 'both')"
    elif role == "exporter":
        where += " AND s.role IN ('exporter', 'both')"
    elif role == "both":
        where += " AND s.role = 'both'"

    hs_exists_where = " WHERE h.company_name = s.name AND h.country_code IS NOT DISTINCT FROM s.country_code"
    hs_exists_where, params = _hs_filter(hs_exists_where, params, hs_code, hs_code_prefix)
    if hs_code or hs_code_prefix:
        where += f" AND EXISTS (SELECT 1 FROM company_hs_trade_stats h{hs_exists_where})"

    order_col = "trade_count" if metric == "trade_count" else "total_trade_value"
    secondary_col = "total_trade_value" if order_col == "trade_count" else "trade_count"

    query = f"""
        SELECT
            s.name,
            NULLIF({brand_select}, '') AS brand_name,
            s.country_code,
            CASE WHEN s.country_code IS NULL THEN 0 ELSE 1 END AS country_count,
            s.role,
            COALESCE(s.total_trade_value, 0) AS total_trade_value,
            COALESCE(s.trade_count, 0) AS trade_count
        FROM company_search_stats s
        {where}
        ORDER BY s.{order_col} DESC, s.{secondary_col} DESC, s.name, s.country_code
        LIMIT :limit
    """
    result = _safe(db, query, params, fallback=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


@router.get("/filters")
def get_company_filters(db: Session = Depends(get_db)):
    has_brand = _has_column(db, "company_search_stats", "brand_name")
    brands_query = """
        SELECT brand_name, COALESCE(SUM(total_trade_value), 0) AS total_trade_value
        FROM company_search_stats
        WHERE NULLIF(brand_name, '') IS NOT NULL
        GROUP BY brand_name
        ORDER BY LOWER(brand_name)
    """ if has_brand else "SELECT NULL::text AS brand_name, 0::numeric AS total_trade_value WHERE FALSE"
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
    brands_result = _safe(db, brands_query, {}, fallback=[])
    countries_result = _safe(db, countries_query, {}, fallback=[])
    hs_result = _safe(db, hs_query, {}, fallback=[])
    return {
        "brands": rows_to_dicts(brands_result, brands_result.fetchall()) if brands_result != [] else [],
        "countries": rows_to_dicts(countries_result, countries_result.fetchall()) if countries_result != [] else [],
        "hs_categories": rows_to_dicts(hs_result, hs_result.fetchall()) if hs_result != [] else [],
    }


@router.get("/dashboard", response_model=CompanyDashboardResponse)
def get_company_dashboard(
    name: str = Query(..., min_length=1),
    country_code: Optional[str] = Query(None),
    start_year_month: Optional[str] = Query(None),
    end_year_month: Optional[str] = Query(None),
    hs_code: Optional[List[str]] = Query(None),
    hs_code_prefix: Optional[List[str]] = Query(None),
    metric: Optional[str] = Query("trade_value"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    company_name = name.strip()
    company_country = country_code.strip().upper() if country_code else None
    company_country_clause = " AND country_code = :country_code" if company_country else ""
    has_brand = _has_column(db, "company_search_stats", "brand_name")
    brand_query = f"""
        SELECT NULLIF(MAX(brand_name), '') AS brand_name
        FROM company_search_stats
        WHERE name = :name{company_country_clause}
    """ if has_brand else "SELECT NULL::text AS brand_name"
    params: dict = {"name": company_name, "limit": limit}
    if company_country:
        params["country_code"] = company_country

    monthly_where = " WHERE company_name = :name"
    if company_country:
        monthly_where += " AND country_code = :country_code"
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
            ) AS country_code,
            COUNT(DISTINCT country_code) FILTER (WHERE country_code IS NOT NULL) AS country_count
        FROM base
    """
    result = _safe(db, summary_query, params, fallback=None)
    if result is None:
        raise HTTPException(status_code=404, detail="公司数据不可用")
    row = result.fetchone()
    if not row or (row.total_trade_count or 0) == 0:
        raise HTTPException(status_code=404, detail="未找到公司")
    summary = dict(row._mapping)
    brand_params = {"name": company_name}
    if company_country:
        brand_params["country_code"] = company_country
    brand_result = _safe(db, brand_query, brand_params, fallback=None)
    brand_row = brand_result.fetchone() if brand_result is not None else None
    brand_name = brand_row.brand_name if brand_row is not None else None

    hs_params = {"name": company_name, "limit": limit}
    hs_where = " WHERE company_name = :name"
    if company_country:
        hs_params["country_code"] = company_country
        hs_where += " AND country_code = :country_code"
    hs_where, hs_params = _hs_filter(hs_where, hs_params, hs_code, hs_code_prefix)
    order_metric, secondary_metric, share_denominator = _ranking_sql(metric)
    counterparty_params = {"name": company_name, "limit": limit}
    importer_counterparty_where = "company_name = :name AND role = 'importer'"
    exporter_counterparty_where = "company_name = :name AND role = 'exporter'"
    if company_country:
        counterparty_params["country_code"] = company_country
        importer_counterparty_where += " AND country_code = :country_code"
        exporter_counterparty_where += " AND country_code = :country_code"

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
            CASE WHEN {share_denominator} = 0 THEN 0
                 ELSE {order_metric}::numeric / {share_denominator}
            END AS share_pct
        FROM agg
        ORDER BY {order_metric} DESC, {secondary_metric} DESC
    """

    brand_lookup_cte = """
        brand_lookup AS (
            SELECT name, NULLIF(MAX(brand_name), '') AS brand_name
            FROM company_search_stats
            GROUP BY name
        ),
    """ if has_brand else """
        brand_lookup AS (
            SELECT NULL::text AS name, NULL::text AS brand_name
            WHERE FALSE
        ),
    """

    suppliers_query = f"""
        WITH {brand_lookup_cte}
        agg AS (
            SELECT
                counterparty_name AS company,
                counterparty_country_code AS country_code,
                COALESCE(SUM(sum_of_usd), 0) AS sum_of_usd,
                COALESCE(SUM(trade_count), 0) AS trade_count
            FROM company_counterparty_trade_stats
            WHERE {importer_counterparty_where}
            GROUP BY counterparty_name, counterparty_country_code
        )
        SELECT
            ROW_NUMBER() OVER (ORDER BY a.{order_metric} DESC, a.{secondary_metric} DESC, a.company, a.country_code) AS rank,
            a.company,
            bl.brand_name,
            a.country_code,
            a.sum_of_usd,
            a.trade_count,
            CASE WHEN SUM(a.{order_metric}) OVER() = 0 THEN 0
                 ELSE a.{order_metric}::numeric / SUM(a.{order_metric}) OVER()
            END AS share_pct
        FROM agg a
        LEFT JOIN brand_lookup bl ON bl.name = a.company
        ORDER BY rank
        LIMIT :limit
    """

    customers_query = f"""
        WITH {brand_lookup_cte}
        agg AS (
            SELECT
                counterparty_name AS company,
                counterparty_country_code AS country_code,
                COALESCE(SUM(sum_of_usd), 0) AS sum_of_usd,
                COALESCE(SUM(trade_count), 0) AS trade_count
            FROM company_counterparty_trade_stats
            WHERE {exporter_counterparty_where}
            GROUP BY counterparty_name, counterparty_country_code
        )
        SELECT
            ROW_NUMBER() OVER (ORDER BY a.{order_metric} DESC, a.{secondary_metric} DESC, a.company, a.country_code) AS rank,
            a.company,
            bl.brand_name,
            a.country_code,
            a.sum_of_usd,
            a.trade_count,
            CASE WHEN SUM(a.{order_metric}) OVER() = 0 THEN 0
                 ELSE a.{order_metric}::numeric / SUM(a.{order_metric}) OVER()
            END AS share_pct
        FROM agg a
        LEFT JOIN brand_lookup bl ON bl.name = a.company
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
    result = _safe(db, suppliers_query, counterparty_params, fallback=[])
    suppliers = rows_to_dicts(result, result.fetchall()) if result != [] else []
    result = _safe(db, customers_query, counterparty_params, fallback=[])
    customers = rows_to_dicts(result, result.fetchall()) if result != [] else []
    result = _safe(db, trends_query, params, fallback=[])
    trends = rows_to_dicts(result, result.fetchall()) if result != [] else []

    return {
        "name": company_name,
        "brand_name": brand_name,
        "country_code": summary.get("country_code"),
        "country_count": int(summary.get("country_count") or 0),
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
