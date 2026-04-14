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
        query = """
            SELECT DISTINCT hs_code
            FROM country_origin_trade_stats
            WHERE hs_code IS NOT NULL AND hs_code <> ''
            ORDER BY hs_code
        """
        result = db.execute(text(query))
        rows = rows_to_dicts(result, result.fetchall())
        # 兼容前端响应模型：补齐 chapter_name
        return [
            {
                "hs_code": row["hs_code"],
                "chapter_name": f"HS {row['hs_code'][:2]}",
            }
            for row in rows
        ]
    except Exception as e:
        if is_missing_table_error(e):
            return []
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(e)}")

