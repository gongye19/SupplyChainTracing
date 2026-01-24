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
    result = db.execute(text(query))
    rows = result.fetchall()
    
    # 转换为字典列表
    columns = result.keys()
    locations = []
    for row in rows:
        loc_dict = dict(zip(columns, row))
        locations.append(loc_dict)
    
    return locations

