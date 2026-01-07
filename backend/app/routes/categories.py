from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import Category
from ..schemas import Category as CategorySchema

router = APIRouter()

@router.get("", response_model=List[CategorySchema])
def get_categories(
    active_only: bool = Query(True, description="只返回启用的品类"),
    db: Session = Depends(get_db)
):
    """获取所有品类列表"""
    query = db.query(Category)
    if active_only:
        query = query.filter(Category.is_active == True)
    categories = query.order_by(Category.sort_order).all()
    return categories

@router.get("/{category_id}", response_model=CategorySchema)
def get_category(category_id: str, db: Session = Depends(get_db)):
    """获取单个品类信息"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Category not found")
    return category

