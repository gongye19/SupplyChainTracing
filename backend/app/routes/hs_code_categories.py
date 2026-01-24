from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from ..database import get_db
from ..schemas import HSCodeCategory

router = APIRouter()

@router.get("", response_model=List[HSCodeCategory])
def get_hs_code_categories(db: Session = Depends(get_db)):
    """获取所有 HS Code 品类"""
    query = "SELECT * FROM hs_code_categories ORDER BY hs_code"
    result = db.execute(text(query))
    rows = result.fetchall()
    
    # 转换为字典列表
    columns = result.keys()
    categories = []
    for row in rows:
        cat_dict = dict(zip(columns, row))
        categories.append(cat_dict)
    
    return categories

