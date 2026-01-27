from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional

from ..database import get_db
from ..schemas import PortLocation, CountryLocation

router = APIRouter()

@router.get("", response_model=List[PortLocation])
def get_port_locations(
    country_code: Optional[str] = Query(None, description="按国家代码筛选"),
    db: Session = Depends(get_db)
):
    """获取所有港口位置"""
    if country_code:
        query = "SELECT * FROM port_locations WHERE country_code = :country_code ORDER BY port_name"
        params = {"country_code": country_code}
    else:
        query = "SELECT * FROM port_locations ORDER BY country_name, port_name"
        params = {}
    
    try:
        result = db.execute(text(query), params)
        rows = result.fetchall()
        
        # 转换为字典列表 - 使用 row._mapping (SQLAlchemy 2.0)
        locations = []
        for row in rows:
            if hasattr(row, '_mapping'):
                loc_dict = dict(row._mapping)
            elif hasattr(row, '_asdict'):
                loc_dict = row._asdict()
            else:
                loc_dict = {}
                for i, col in enumerate(result.keys()):
                    loc_dict[col] = row[i]
            locations.append(loc_dict)
        
        return locations
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(e)}")

# 向后兼容：提供 country-locations 端点（从 port_locations 表中提取唯一的国家信息）
@router.get("/countries", response_model=List[CountryLocation])
def get_country_locations_from_ports(db: Session = Depends(get_db)):
    """从港口位置表中提取唯一的国家信息（向后兼容）"""
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
    try:
        result = db.execute(text(query))
        rows = result.fetchall()
        
        # 转换为字典列表
        locations = []
        for row in rows:
            if hasattr(row, '_mapping'):
                loc_dict = dict(row._mapping)
            elif hasattr(row, '_asdict'):
                loc_dict = row._asdict()
            else:
                loc_dict = {}
                for i, col in enumerate(result.keys()):
                    loc_dict[col] = row[i]
            locations.append(loc_dict)
        
        return locations
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(e)}")

