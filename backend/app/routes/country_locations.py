from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional

from ..database import get_db
from ..schemas import PortLocation, CountryLocation
from ..utils.db_helpers import is_missing_table_error, rows_to_dicts

router = APIRouter()

@router.get("", response_model=List[PortLocation])
def get_port_locations(
    country_code: Optional[str] = Query(None, description="按国家代码筛选"),
    db: Session = Depends(get_db)
):
    """获取所有港口位置"""
    try:
        if country_code:
            query = "SELECT * FROM port_locations WHERE country_code = :country_code ORDER BY port_name"
            params = {"country_code": country_code}
        else:
            query = "SELECT * FROM port_locations ORDER BY country_name, port_name"
            params = {}
        
        result = db.execute(text(query), params)
        return rows_to_dicts(result, result.fetchall())
    except Exception as e:
        if is_missing_table_error(e):
            return []
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(e)}")

# 向后兼容：提供 country-locations 端点（从 port_locations 表中提取唯一的国家信息）
@router.get("/countries", response_model=List[CountryLocation])
def get_country_locations_from_ports(db: Session = Depends(get_db)):
    """从港口位置表中提取唯一的国家信息（向后兼容）"""
    try:
        query = """
            SELECT DISTINCT ON (country_code)
                country_code,
                country_name,
                latitude,
                longitude,
                region,
                continent
            FROM port_locations
            ORDER BY country_code, country_name
        """
        result = db.execute(text(query))
        return rows_to_dicts(result, result.fetchall())
    except Exception as e:
        if is_missing_table_error(e):
            return []
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(e)}")

