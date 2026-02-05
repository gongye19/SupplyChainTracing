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
    try:
        # 检查表是否存在
        check_table = db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'hs_code_categories'
            )
        """))
        table_exists = check_table.scalar() if check_table else False
        
        if not table_exists:
            # 表不存在，返回空列表
            print("Table hs_code_categories does not exist, returning empty list")
            return []
        
        query = "SELECT * FROM hs_code_categories ORDER BY hs_code"
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
        # 记录错误并返回空列表，避免 500 错误
        error_msg = str(e)
        if "does not exist" in error_msg or "UndefinedTable" in error_msg or "relation" in error_msg.lower():
            print(f"Table does not exist or query failed: {error_msg}")
            return []
        # 其他错误也返回空列表
        print(f"Query error: {error_msg}")
        return []

