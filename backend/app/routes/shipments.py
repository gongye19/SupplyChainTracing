from fastapi import APIRouter, Depends, Query
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional

from ..database import get_db
from ..schemas import Shipment
from ..utils.db_helpers import is_missing_table_error
from ..utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)

TABLE = "country_origin_trade_stats"


@router.get("", response_model=List[Shipment])
def get_shipments(
    start_year_month: Optional[str] = Query(None, description="起始年月 (YYYY-MM)"),
    end_year_month: Optional[str] = Query(None, description="结束年月 (YYYY-MM)"),
    country: Optional[List[str]] = Query(None, description="国家代码筛选（可多个）"),
    trade_direction: Optional[str] = Query("all", description="进出口方向: import/export/all"),
    hs_code_prefix: Optional[List[str]] = Query(None, description="HS Code 2位大类筛选"),
    hs_code: Optional[List[str]] = Query(None, description="完整 HS Code 6位筛选"),
    limit: Optional[int] = Query(10000, description="返回记录数限制"),
    db: Session = Depends(get_db),
):
    """获取国家对贸易配对数据（从 country_origin_trade_stats 表）"""
    try:
        query = f"""
            SELECT
                year,
                month,
                hs_code,
                origin_country_code,
                destination_country_code,
                sum_of_usd AS total_value_usd,
                trade_count,
                origin_country_code AS country_of_origin,
                destination_country_code AS destination_country,
                TO_CHAR(TO_DATE(year || '-' || LPAD(month::text, 2, '0') || '-01', 'YYYY-MM-DD'), 'YYYY-MM-DD') AS date
            FROM {TABLE}
            WHERE 1=1
        """
        params = {}

        if start_year_month:
            y, m = start_year_month.split("-")
            query += " AND (year > :sy OR (year = :sy AND month >= :sm))"
            params["sy"], params["sm"] = int(y), int(m)

        if end_year_month:
            y, m = end_year_month.split("-")
            query += " AND (year < :ey OR (year = :ey AND month <= :em))"
            params["ey"], params["em"] = int(y), int(m)

        if country:
            ph = ", ".join([f":c_{i}" for i in range(len(country))])
            if trade_direction == "import":
                query += f" AND destination_country_code IN ({ph})"
            elif trade_direction == "export":
                query += f" AND origin_country_code IN ({ph})"
            else:
                query += f" AND (origin_country_code IN ({ph}) OR destination_country_code IN ({ph}))"
            for i, c in enumerate(country):
                params[f"c_{i}"] = c

        if hs_code:
            ph = ", ".join([f":hs_{i}" for i in range(len(hs_code))])
            query += f" AND hs_code IN ({ph})"
            for i, c in enumerate(hs_code):
                params[f"hs_{i}"] = c
        elif hs_code_prefix:
            conds = []
            for i, p in enumerate(hs_code_prefix):
                params[f"hsp_{i}"] = f"{p}%"
                conds.append(f"hs_code LIKE :hsp_{i}")
            query += f" AND ({' OR '.join(conds)})"

        if limit:
            query += " LIMIT :lim"
            params["lim"] = limit

        result = db.execute(text(query), params)
        rows = result.fetchall()

        shipments = []
        for row in rows:
            shipments.append({
                "year": row.year,
                "month": row.month,
                "hs_code": row.hs_code,
                "origin_country_code": row.origin_country_code,
                "destination_country_code": row.destination_country_code,
                "total_value_usd": float(row.total_value_usd) if row.total_value_usd else None,
                "trade_count": int(row.trade_count) if row.trade_count else 0,
                "country_of_origin": row.origin_country_code,
                "destination_country": row.destination_country_code,
                "date": row.date,
            })
        return shipments
    except Exception as e:
        if is_missing_table_error(e):
            logger.warning("country_origin_trade_stats not available: %s", e)
            return []
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(e)}")
