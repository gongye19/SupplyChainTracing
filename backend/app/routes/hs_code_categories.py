from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from ..database import get_db
from ..schemas import HSCodeCategory
from ..utils.db_helpers import is_missing_table_error, rows_to_dicts

router = APIRouter()

@router.get("", response_model=List[HSCodeCategory])
def get_hs_code_categories(db: Session = Depends(get_db)):
    """获取所有 HS Code 品类"""
    try:
        query = "SELECT * FROM hs_code_categories ORDER BY hs_code"
        result = db.execute(text(query))
        return rows_to_dicts(result, result.fetchall())
    except Exception as e:
        if is_missing_table_error(e):
            return []
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(e)}")

