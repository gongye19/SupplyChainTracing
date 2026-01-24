from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from ..database import get_db
from ..schemas import CountryLocation

router = APIRouter()

@router.get("", response_model=List[CountryLocation])
def get_country_locations(db: Session = Depends(get_db)):
    """获取所有国家位置"""
    query = "SELECT * FROM country_locations ORDER BY country_name"
    try:
        result = db.execute(text(query))
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

