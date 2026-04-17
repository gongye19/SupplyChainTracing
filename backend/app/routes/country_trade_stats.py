from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional

from ..database import get_db
from ..schemas import (
    CountryMonthlyTradeStat,
    CountryTradeStatSummary,
    CountryTradeTrend,
    TopCountry,
    CountryQuarterTop,
    CountryAggregate,
    CountryQuarterAggregate,
    HSAggregate,
    HSQuarterAggregate,
)
from ..utils.db_helpers import is_missing_table_error, rows_to_dicts

router = APIRouter()

TABLE = "country_origin_trade_stats"


def _apply_filters(
    query: str,
    params: dict,
    *,
    hs_code: Optional[List[str]] = None,
    hs_code_prefix: Optional[List[str]] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    country: Optional[List[str]] = None,
    start_year_month: Optional[str] = None,
    end_year_month: Optional[str] = None,
    trade_direction: Optional[str] = None,
) -> tuple[str, dict]:
    """在 WHERE 子句中追加通用过滤条件。"""
    if hs_code:
        ph = ", ".join([f":hs_{i}" for i in range(len(hs_code))])
        query += f" AND hs_code IN ({ph})"
        for i, c in enumerate(hs_code):
            params[f"hs_{i}"] = c

    if hs_code_prefix:
        conds = []
        for i, p in enumerate(hs_code_prefix):
            params[f"hsp_{i}"] = f"{p}%"
            conds.append(f"hs_code LIKE :hsp_{i}")
        query += f" AND ({' OR '.join(conds)})"

    if year is not None:
        query += " AND year = :year"
        params["year"] = year
    if month is not None:
        query += " AND month = :month"
        params["month"] = month

    if country:
        ph = ", ".join([f":ctry_{i}" for i in range(len(country))])
        if trade_direction == "import":
            col = "destination_country_code"
        elif trade_direction == "export":
            col = "origin_country_code"
        else:
            col = None
        if col:
            query += f" AND {col} IN ({ph})"
        else:
            query += f" AND (origin_country_code IN ({ph}) OR destination_country_code IN ({ph}))"
        for i, c in enumerate(country):
            params[f"ctry_{i}"] = c

    if start_year_month:
        y, m = start_year_month.split("-")
        query += " AND (year > :sy OR (year = :sy AND month >= :sm))"
        params["sy"], params["sm"] = int(y), int(m)
    if end_year_month:
        y, m = end_year_month.split("-")
        query += " AND (year < :ey OR (year = :ey AND month <= :em))"
        params["ey"], params["em"] = int(y), int(m)

    return query, params


def _safe(db: Session, query: str, params: dict, fallback):
    try:
        return db.execute(text(query), params)
    except Exception as exc:
        if is_missing_table_error(exc):
            return fallback
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {exc}")


def _country_col(td: Optional[str]):
    if td == "import":
        return "destination_country_code"
    if td == "export":
        return "origin_country_code"
    return None


# ── 主查询：按国家聚合 ─────────────────────────────────────────

@router.get("", response_model=List[CountryMonthlyTradeStat])
def get_country_trade_stats(
    hs_code: Optional[List[str]] = Query(None),
    hs_code_prefix: Optional[List[str]] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    country: Optional[List[str]] = Query(None),
    trade_direction: Optional[str] = Query("all"),
    start_year_month: Optional[str] = Query(None),
    end_year_month: Optional[str] = Query(None),
    limit: Optional[int] = Query(10000),
    db: Session = Depends(get_db),
):
    td = trade_direction or "all"
    params: dict = {}

    if td == "all":
        # UNION ALL: 每条记录在 origin 和 destination 侧各算一次
        base_where = " WHERE 1=1"
        base_where, params = _apply_filters(
            base_where, params,
            hs_code=hs_code, hs_code_prefix=hs_code_prefix,
            year=year, month=month, country=country,
            start_year_month=start_year_month, end_year_month=end_year_month,
            trade_direction=td,
        )
        query = f"""
            SELECT
                hs_code, year, month, country_code,
                SUM(sum_of_usd)::numeric AS sum_of_usd,
                SUM(trade_count)::bigint AS trade_count
            FROM (
                SELECT hs_code, year, month, origin_country_code AS country_code,
                       sum_of_usd, trade_count FROM {TABLE}{base_where}
                UNION ALL
                SELECT hs_code, year, month, destination_country_code AS country_code,
                       sum_of_usd, trade_count FROM {TABLE}{base_where}
            ) sub
            GROUP BY hs_code, year, month, country_code
            ORDER BY year DESC, month DESC, sum_of_usd DESC
        """
    else:
        cc = _country_col(td)
        query = f"""
            SELECT
                hs_code, year, month, {cc} AS country_code,
                SUM(sum_of_usd)::numeric AS sum_of_usd,
                SUM(trade_count)::bigint AS trade_count
            FROM {TABLE} WHERE 1=1
        """
        query, params = _apply_filters(
            query, params,
            hs_code=hs_code, hs_code_prefix=hs_code_prefix,
            year=year, month=month, country=country,
            start_year_month=start_year_month, end_year_month=end_year_month,
            trade_direction=td,
        )
        query += f" GROUP BY hs_code, year, month, {cc}"
        query += " ORDER BY year DESC, month DESC, sum_of_usd DESC"

    if limit:
        query += " LIMIT :lim"
        params["lim"] = limit

    result = _safe(db, query, params, fallback=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


# ── 汇总 ────────────────────────────────────────────────────────

@router.get("/summary", response_model=CountryTradeStatSummary)
def get_summary(
    hs_code: Optional[List[str]] = Query(None),
    hs_code_prefix: Optional[List[str]] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    country: Optional[List[str]] = Query(None),
    trade_direction: Optional[str] = Query("all"),
    start_year_month: Optional[str] = Query(None),
    end_year_month: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    td = trade_direction or "all"
    default = {
        "total_countries": 0,
        "total_trade_value": 0.0,
        "total_trade_count": 0,
        "avg_share_pct": 0.0,
    }
    params: dict = {}

    if td == "all":
        base_where = " WHERE 1=1"
        base_where, params = _apply_filters(
            base_where, params,
            hs_code=hs_code, hs_code_prefix=hs_code_prefix,
            year=year, month=month, country=country,
            start_year_month=start_year_month, end_year_month=end_year_month,
            trade_direction=td,
        )
        query = f"""
            SELECT
                COUNT(DISTINCT country_code) AS total_countries,
                COALESCE(SUM(sum_of_usd), 0) AS total_trade_value,
                COALESCE(SUM(trade_count), 0) AS total_trade_count,
                0 AS avg_share_pct
            FROM (
                SELECT origin_country_code AS country_code, sum_of_usd, trade_count
                FROM {TABLE}{base_where}
                UNION ALL
                SELECT destination_country_code AS country_code, sum_of_usd, trade_count
                FROM {TABLE}{base_where}
            ) sub
        """
    else:
        cc = _country_col(td)
        query = f"""
            SELECT
                COUNT(DISTINCT {cc}) AS total_countries,
                COALESCE(SUM(sum_of_usd), 0) AS total_trade_value,
                COALESCE(SUM(trade_count), 0) AS total_trade_count,
                0 AS avg_share_pct
            FROM {TABLE} WHERE 1=1
        """
        query, params = _apply_filters(
            query, params,
            hs_code=hs_code, hs_code_prefix=hs_code_prefix,
            year=year, month=month, country=country,
            start_year_month=start_year_month, end_year_month=end_year_month,
            trade_direction=td,
        )

    result = _safe(db, query, params, fallback=None)
    if result is None:
        return default
    row = result.fetchone()
    if not row:
        return default
    d = dict(row._mapping) if hasattr(row, "_mapping") else default
    return d


# ── 趋势 ────────────────────────────────────────────────────────

@router.get("/trends", response_model=List[CountryTradeTrend])
def get_trends(
    hs_code: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    trade_direction: Optional[str] = Query("all"),
    start_year_month: Optional[str] = Query(None),
    end_year_month: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    td = trade_direction or "all"
    params: dict = {}

    if td == "all" and country:
        where = f" WHERE (origin_country_code = :country OR destination_country_code = :country)"
        params["country"] = country
    elif td == "import":
        where = f" WHERE destination_country_code = :country" if country else " WHERE 1=1"
        if country:
            params["country"] = country
    elif td == "export":
        where = f" WHERE origin_country_code = :country" if country else " WHERE 1=1"
        if country:
            params["country"] = country
    else:
        where = " WHERE 1=1"

    if hs_code:
        where += " AND hs_code = :hs_code"
        params["hs_code"] = hs_code
    if start_year_month:
        y, m = start_year_month.split("-")
        where += " AND (year > :sy OR (year = :sy AND month >= :sm))"
        params["sy"], params["sm"] = int(y), int(m)
    if end_year_month:
        y, m = end_year_month.split("-")
        where += " AND (year < :ey OR (year = :ey AND month <= :em))"
        params["ey"], params["em"] = int(y), int(m)

    query = f"""
        SELECT
            TO_CHAR(TO_DATE(year || '-' || LPAD(month::text, 2, '0') || '-01', 'YYYY-MM-DD'), 'YYYY-MM') AS year_month,
            COALESCE(SUM(sum_of_usd), 0) AS sum_of_usd,
            COALESCE(SUM(trade_count), 0) AS trade_count
        FROM {TABLE}{where}
        GROUP BY year, month ORDER BY year, month
    """

    result = _safe(db, query, params, fallback=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


# ── Top 国家 ────────────────────────────────────────────────────

@router.get("/top-countries", response_model=List[TopCountry])
def get_top_countries(
    hs_code: Optional[List[str]] = Query(None),
    hs_code_prefix: Optional[List[str]] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    country: Optional[List[str]] = Query(None),
    trade_direction: Optional[str] = Query("all"),
    start_year_month: Optional[str] = Query(None),
    end_year_month: Optional[str] = Query(None),
    metric: Optional[str] = Query("trade_value"),
    limit: int = Query(10),
    db: Session = Depends(get_db),
):
    td = trade_direction or "all"
    metric_key = "trade_count" if metric == "trade_count" else "trade_value"
    params: dict = {}
    share_numerator = "SUM(trade_count)" if metric_key == "trade_count" else "SUM(sum_of_usd)"
    share_denominator = "SUM(SUM(trade_count)) OVER()" if metric_key == "trade_count" else "SUM(SUM(sum_of_usd)) OVER()"
    order_metric = "trade_count" if metric_key == "trade_count" else "sum_of_usd"

    if td == "all":
        base_where = " WHERE 1=1"
        base_where, params = _apply_filters(
            base_where, params,
            hs_code=hs_code, hs_code_prefix=hs_code_prefix,
            year=year, month=month, country=country,
            start_year_month=start_year_month, end_year_month=end_year_month,
            trade_direction=td,
        )
        query = f"""
            SELECT
                country_code,
                SUM(sum_of_usd) AS sum_of_usd,
                SUM(trade_count) AS trade_count,
                CASE WHEN {share_denominator} = 0 THEN 0
                     ELSE {share_numerator} / {share_denominator}
                END AS amount_share_pct
            FROM (
                SELECT origin_country_code AS country_code, sum_of_usd, trade_count
                FROM {TABLE}{base_where}
                UNION ALL
                SELECT destination_country_code AS country_code, sum_of_usd, trade_count
                FROM {TABLE}{base_where}
            ) sub
            GROUP BY country_code
            ORDER BY {order_metric} DESC
            LIMIT :lim
        """
    else:
        cc = _country_col(td)
        query = f"""
            SELECT
                {cc} AS country_code,
                SUM(sum_of_usd) AS sum_of_usd,
                SUM(trade_count) AS trade_count,
                CASE WHEN {share_denominator} = 0 THEN 0
                     ELSE {share_numerator} / {share_denominator}
                END AS amount_share_pct
            FROM {TABLE} WHERE 1=1
        """
        query, params = _apply_filters(
            query, params,
            hs_code=hs_code, hs_code_prefix=hs_code_prefix,
            year=year, month=month, country=country,
            start_year_month=start_year_month, end_year_month=end_year_month,
            trade_direction=td,
        )
        query += f" GROUP BY {cc} ORDER BY {order_metric} DESC LIMIT :lim"

    params["lim"] = limit

    result = _safe(db, query, params, fallback=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


@router.get("/top-countries-quarterly", response_model=List[CountryQuarterTop])
def get_top_countries_quarterly(
    hs_code: Optional[List[str]] = Query(None),
    hs_code_prefix: Optional[List[str]] = Query(None),
    country: Optional[List[str]] = Query(None),
    trade_direction: Optional[str] = Query("all"),
    start_year_month: Optional[str] = Query(None),
    end_year_month: Optional[str] = Query(None),
    metric: Optional[str] = Query("trade_value"),
    limit: int = Query(10),
    db: Session = Depends(get_db),
):
    td = trade_direction or "all"
    metric_key = "trade_count" if metric == "trade_count" else "trade_value"
    order_expr = "trade_count" if metric_key == "trade_count" else "sum_of_usd"
    params: dict = {"lim": limit}

    if td == "all":
        base_where = " WHERE 1=1"
        base_where, params = _apply_filters(
            base_where, params,
            hs_code=hs_code, hs_code_prefix=hs_code_prefix,
            country=country,
            start_year_month=start_year_month, end_year_month=end_year_month,
            trade_direction=td,
        )
        query = f"""
            WITH base AS (
                SELECT
                    year,
                    ((month - 1) / 3 + 1) AS quarter,
                    country_code,
                    SUM(sum_of_usd) AS sum_of_usd,
                    SUM(trade_count) AS trade_count
                FROM (
                    SELECT year, month, origin_country_code AS country_code, sum_of_usd, trade_count
                    FROM {TABLE}{base_where}
                    UNION ALL
                    SELECT year, month, destination_country_code AS country_code, sum_of_usd, trade_count
                    FROM {TABLE}{base_where}
                ) merged
                GROUP BY year, quarter, country_code
            ),
            ranked AS (
                SELECT
                    year,
                    quarter,
                    country_code,
                    sum_of_usd,
                    trade_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY year, quarter
                        ORDER BY {order_expr} DESC
                    ) AS rn
                FROM base
            )
            SELECT
                year,
                quarter,
                country_code,
                sum_of_usd,
                trade_count
            FROM ranked
            WHERE rn <= :lim
            ORDER BY year, quarter, rn
        """
    else:
        cc = _country_col(td)
        where = f" WHERE 1=1"
        where, params = _apply_filters(
            where, params,
            hs_code=hs_code, hs_code_prefix=hs_code_prefix,
            country=country,
            start_year_month=start_year_month, end_year_month=end_year_month,
            trade_direction=td,
        )
        query = f"""
            WITH base AS (
                SELECT
                    year,
                    ((month - 1) / 3 + 1) AS quarter,
                    {cc} AS country_code,
                    SUM(sum_of_usd) AS sum_of_usd,
                    SUM(trade_count) AS trade_count
                FROM {TABLE}{where}
                GROUP BY year, quarter, {cc}
            ),
            ranked AS (
                SELECT
                    year,
                    quarter,
                    country_code,
                    sum_of_usd,
                    trade_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY year, quarter
                        ORDER BY {order_expr} DESC
                    ) AS rn
                FROM base
            )
            SELECT
                year,
                quarter,
                country_code,
                sum_of_usd,
                trade_count
            FROM ranked
            WHERE rn <= :lim
            ORDER BY year, quarter, rn
        """

    result = _safe(db, query, params, fallback=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


@router.get("/country-aggregate", response_model=List[CountryAggregate])
def get_country_aggregate(
    hs_code: Optional[List[str]] = Query(None),
    hs_code_prefix: Optional[List[str]] = Query(None),
    country: Optional[List[str]] = Query(None),
    trade_direction: Optional[str] = Query("all"),
    start_year_month: Optional[str] = Query(None),
    end_year_month: Optional[str] = Query(None),
    limit: int = Query(300),
    db: Session = Depends(get_db),
):
    td = trade_direction or "all"
    params: dict = {"lim": limit}
    if td == "all":
        base_where = " WHERE 1=1"
        base_where, params = _apply_filters(
            base_where, params,
            hs_code=hs_code, hs_code_prefix=hs_code_prefix,
            country=country,
            start_year_month=start_year_month, end_year_month=end_year_month,
            trade_direction=td,
        )
        query = f"""
            SELECT
                country_code,
                SUM(sum_of_usd) AS sum_of_usd,
                SUM(trade_count) AS trade_count
            FROM (
                SELECT origin_country_code AS country_code, sum_of_usd, trade_count
                FROM {TABLE}{base_where}
                UNION ALL
                SELECT destination_country_code AS country_code, sum_of_usd, trade_count
                FROM {TABLE}{base_where}
            ) sub
            GROUP BY country_code
            ORDER BY sum_of_usd DESC
            LIMIT :lim
        """
    else:
        cc = _country_col(td)
        where = " WHERE 1=1"
        where, params = _apply_filters(
            where, params,
            hs_code=hs_code, hs_code_prefix=hs_code_prefix,
            country=country,
            start_year_month=start_year_month, end_year_month=end_year_month,
            trade_direction=td,
        )
        query = f"""
            SELECT
                {cc} AS country_code,
                SUM(sum_of_usd) AS sum_of_usd,
                SUM(trade_count) AS trade_count
            FROM {TABLE}{where}
            GROUP BY {cc}
            ORDER BY sum_of_usd DESC
            LIMIT :lim
        """
    result = _safe(db, query, params, fallback=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


@router.get("/country-quarterly", response_model=List[CountryQuarterAggregate])
def get_country_quarterly(
    hs_code: Optional[List[str]] = Query(None),
    hs_code_prefix: Optional[List[str]] = Query(None),
    country: Optional[List[str]] = Query(None),
    trade_direction: Optional[str] = Query("all"),
    start_year_month: Optional[str] = Query(None),
    end_year_month: Optional[str] = Query(None),
    limit: int = Query(4000),
    db: Session = Depends(get_db),
):
    td = trade_direction or "all"
    params: dict = {"lim": limit}
    if td == "all":
        base_where = " WHERE 1=1"
        base_where, params = _apply_filters(
            base_where, params,
            hs_code=hs_code, hs_code_prefix=hs_code_prefix,
            country=country,
            start_year_month=start_year_month, end_year_month=end_year_month,
            trade_direction=td,
        )
        query = f"""
            SELECT
                year,
                ((month - 1) / 3 + 1) AS quarter,
                country_code,
                SUM(sum_of_usd) AS sum_of_usd,
                SUM(trade_count) AS trade_count
            FROM (
                SELECT year, month, origin_country_code AS country_code, sum_of_usd, trade_count
                FROM {TABLE}{base_where}
                UNION ALL
                SELECT year, month, destination_country_code AS country_code, sum_of_usd, trade_count
                FROM {TABLE}{base_where}
            ) sub
            GROUP BY year, quarter, country_code
            ORDER BY year, quarter, sum_of_usd DESC
            LIMIT :lim
        """
    else:
        cc = _country_col(td)
        where = " WHERE 1=1"
        where, params = _apply_filters(
            where, params,
            hs_code=hs_code, hs_code_prefix=hs_code_prefix,
            country=country,
            start_year_month=start_year_month, end_year_month=end_year_month,
            trade_direction=td,
        )
        query = f"""
            SELECT
                year,
                ((month - 1) / 3 + 1) AS quarter,
                {cc} AS country_code,
                SUM(sum_of_usd) AS sum_of_usd,
                SUM(trade_count) AS trade_count
            FROM {TABLE}{where}
            GROUP BY year, quarter, {cc}
            ORDER BY year, quarter, sum_of_usd DESC
            LIMIT :lim
        """
    result = _safe(db, query, params, fallback=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


@router.get("/hs-aggregate", response_model=List[HSAggregate])
def get_hs_aggregate(
    hs_code: Optional[List[str]] = Query(None),
    hs_code_prefix: Optional[List[str]] = Query(None),
    country: Optional[List[str]] = Query(None),
    trade_direction: Optional[str] = Query("all"),
    start_year_month: Optional[str] = Query(None),
    end_year_month: Optional[str] = Query(None),
    limit: int = Query(200),
    db: Session = Depends(get_db),
):
    td = trade_direction or "all"
    params: dict = {"lim": limit}
    where = " WHERE 1=1"
    where, params = _apply_filters(
        where, params,
        hs_code=hs_code, hs_code_prefix=hs_code_prefix,
        country=country,
        start_year_month=start_year_month, end_year_month=end_year_month,
        trade_direction=td,
    )
    query = f"""
        SELECT
            hs_code,
            SUM(sum_of_usd) AS sum_of_usd,
            SUM(trade_count) AS trade_count
        FROM {TABLE}{where}
        GROUP BY hs_code
        ORDER BY sum_of_usd DESC
        LIMIT :lim
    """
    result = _safe(db, query, params, fallback=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


@router.get("/hs-quarterly", response_model=List[HSQuarterAggregate])
def get_hs_quarterly(
    hs_code: Optional[List[str]] = Query(None),
    hs_code_prefix: Optional[List[str]] = Query(None),
    country: Optional[List[str]] = Query(None),
    trade_direction: Optional[str] = Query("all"),
    start_year_month: Optional[str] = Query(None),
    end_year_month: Optional[str] = Query(None),
    limit: int = Query(4000),
    db: Session = Depends(get_db),
):
    td = trade_direction or "all"
    params: dict = {"lim": limit}
    where = " WHERE 1=1"
    where, params = _apply_filters(
        where, params,
        hs_code=hs_code, hs_code_prefix=hs_code_prefix,
        country=country,
        start_year_month=start_year_month, end_year_month=end_year_month,
        trade_direction=td,
    )
    query = f"""
        SELECT
            year,
            ((month - 1) / 3 + 1) AS quarter,
            hs_code,
            SUM(sum_of_usd) AS sum_of_usd,
            SUM(trade_count) AS trade_count
        FROM {TABLE}{where}
        GROUP BY year, quarter, hs_code
        ORDER BY year, quarter, sum_of_usd DESC
        LIMIT :lim
    """
    result = _safe(db, query, params, fallback=[])
    if result == []:
        return []
    return rows_to_dicts(result, result.fetchall())


# ── 可用 HS Code 列表 ──────────────────────────────────────────

@router.get("/hs-codes", response_model=List[str])
def get_available_hs_codes(db: Session = Depends(get_db)):
    query = f"""
        SELECT DISTINCT hs_code FROM {TABLE}
        WHERE hs_code IS NOT NULL AND hs_code <> ''
        ORDER BY hs_code
    """
    result = _safe(db, query, params={}, fallback=[])
    if result == []:
        return []
    return [row[0] for row in result.fetchall()]
