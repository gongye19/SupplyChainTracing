from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from ..database import get_db
from ..schemas import CountryLocation
from ..utils.db_helpers import is_missing_table_error, rows_to_dicts
from ..utils.country_coordinates import locations_for_codes

router = APIRouter()

@router.get("", response_model=List[CountryLocation])
def get_country_locations(db: Session = Depends(get_db)):
    """从港口位置表中提取唯一的国家信息（向后兼容 /api/country-locations）"""
    try:
        query = """
            SELECT 
                country_code,
                country_name,
                latitude,
                longitude,
                region,
                continent
            FROM port_locations
            GROUP BY country_code, country_name, latitude, longitude, region, continent
            ORDER BY country_name
        """
        result = db.execute(text(query))
        return rows_to_dicts(result, result.fetchall())
    except Exception as e:
        if is_missing_table_error(e):
            db.rollback()
            codes_query = """
                SELECT origin_country_code AS country_code FROM country_origin_trade_stats
                UNION
                SELECT destination_country_code AS country_code FROM country_origin_trade_stats
            """
            result = db.execute(text(codes_query))
            codes = [row.country_code for row in result.fetchall() if row.country_code]
            return locations_for_codes(codes)
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(e)}")
