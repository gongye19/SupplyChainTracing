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
    hs_code_prefix: Optional[List[str]] = Query(None, description="HS Code 2位大类筛选"),
    hs_code: Optional[List[str]] = Query(None, description="完整 HS Code 6位筛选"),
    limit: Optional[int] = Query(10000, description="返回记录数限制"),
    db: Session = Depends(get_db),
):
    """获取国家对贸易配对数据（从 country_origin_trade_stats 表）"""
    try:
        query = f"SELECT * FROM {TABLE} WHERE 1=1"
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
            query += f" AND (origin_country_code IN ({ph}) OR destination_country_code IN ({ph}))"
            for i, c in enumerate(country):
                params[f"c_{i}"] = c

        if hs_code:
            ph = ", ".join([f":hs_{i}" for i in range(len(hs_code))])
            query += f" AND hs_code IN ({ph})"
            for i, c in enumerate(hs_code):
                params[f"hs_{i}"] = c
        elif hs_code_prefix:
            ph = ", ".join([f":hsp_{i}" for i in range(len(hs_code_prefix))])
            query += f" AND SUBSTRING(hs_code, 1, 2) IN ({ph})"
            for i, p in enumerate(hs_code_prefix):
                params[f"hsp_{i}"] = p

        query += " ORDER BY year DESC, month DESC, sum_of_usd DESC"
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
                "total_value_usd": float(row.sum_of_usd) if row.sum_of_usd else None,
                "trade_count": int(row.trade_count) if row.trade_count else 0,
                "country_of_origin": row.origin_country_code,
                "destination_country": row.destination_country_code,
                "date": f"{row.year}-{row.month:02d}-01",
            })
        return shipments
    except Exception as e:
        if is_missing_table_error(e):
            logger.warning("country_origin_trade_stats not available: %s", e)
            return []
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(e)}")
