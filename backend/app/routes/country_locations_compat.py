from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from ..database import get_db
from ..schemas import CountryLocation
from ..utils.db_helpers import is_missing_table_error, rows_to_dicts

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
            return []
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(e)}")

