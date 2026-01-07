from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import Location
from ..schemas import Location as LocationSchema

router = APIRouter()

@router.get("", response_model=List[LocationSchema])
def get_locations(
    type: Optional[str] = Query(None, description="位置类型: country, city"),
    country_code: Optional[str] = Query(None, description="按国家代码筛选"),
    db: Session = Depends(get_db)
):
    """获取位置列表"""
    query = db.query(Location)
    
    if type:
        query = query.filter(Location.type == type)
    if country_code:
        query = query.filter(Location.country_code == country_code)
    
    locations = query.order_by(Location.country_name, Location.city).all()
    return locations

@router.get("/countries", response_model=List[LocationSchema])
def get_countries(db: Session = Depends(get_db)):
    """获取所有国家位置"""
    countries = db.query(Location).filter(
        Location.type == 'country'
    ).order_by(Location.country_name).all()
    return countries

@router.get("/cities", response_model=List[LocationSchema])
def get_cities(
    country_code: Optional[str] = Query(None, description="按国家代码筛选"),
    db: Session = Depends(get_db)
):
    """获取所有城市位置"""
    query = db.query(Location).filter(Location.type == 'city')
    
    if country_code:
        query = query.filter(Location.country_code == country_code)
    
    cities = query.order_by(Location.country_name, Location.city).all()
    return cities

@router.get("/{location_id}", response_model=LocationSchema)
def get_location(location_id: str, db: Session = Depends(get_db)):
    """获取单个位置信息"""
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Location not found")
    return location

@router.get("/country/{country_code}/city/{city}", response_model=LocationSchema)
def get_city_location(
    country_code: str,
    city: str,
    db: Session = Depends(get_db)
):
    """根据国家代码和城市名称获取位置"""
    location = db.query(Location).filter(
        Location.country_code == country_code,
        Location.city == city,
        Location.type == 'city'
    ).first()
    
    if not location:
        # 如果城市位置不存在，返回国家位置作为回退
        location = db.query(Location).filter(
            Location.country_code == country_code,
            Location.type == 'country'
        ).first()
        
        if not location:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Location not found")
    
    return location

