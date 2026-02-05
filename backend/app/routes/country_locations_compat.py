from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from ..database import get_db
from ..schemas import CountryLocation

router = APIRouter()

@router.get("", response_model=List[CountryLocation])
def get_country_locations(db: Session = Depends(get_db)):
    """从港口位置表中提取唯一的国家信息（向后兼容 /api/country-locations）"""
    try:
        # 检查表是否存在
        check_table = db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'port_locations'
            )
        """))
        table_exists = check_table.scalar() if check_table else False
        
        if not table_exists:
            # 表不存在，返回空列表
            print("Table port_locations does not exist, returning empty list")
            return []
        
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
        # 记录错误并返回空列表，避免 500 错误
        error_msg = str(e)
        if "does not exist" in error_msg or "UndefinedTable" in error_msg or "relation" in error_msg.lower():
            print(f"Table does not exist or query failed: {error_msg}")
            return []
        # 其他错误也返回空列表
        print(f"Query error: {error_msg}")
        return []

