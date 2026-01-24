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
    try:
        result = db.execute(text(query))
        rows = result.fetchall()
        
        # 转换为字典列表 - 使用 row._mapping (SQLAlchemy 2.0)
        categories = []
        for row in rows:
            if hasattr(row, '_mapping'):
                cat_dict = dict(row._mapping)
            elif hasattr(row, '_asdict'):
                cat_dict = row._asdict()
            else:
                cat_dict = {}
                for i, col in enumerate(result.keys()):
                    cat_dict[col] = row[i]
            categories.append(cat_dict)
        
        return categories
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(e)}")

