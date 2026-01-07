from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from ..database import get_db
from ..models import Company, Location
from ..schemas import Company as CompanySchema, CompanyWithLocation

router = APIRouter()

@router.get("", response_model=List[CompanySchema])
def get_companies(
    country_code: Optional[str] = Query(None, description="按国家代码筛选"),
    city: Optional[str] = Query(None, description="按城市筛选"),
    type: Optional[str] = Query(None, description="按类型筛选: importer, exporter, both"),
    search: Optional[str] = Query(None, description="公司名称搜索"),
    db: Session = Depends(get_db)
):
    """获取公司列表"""
    query = db.query(Company)
    
    if country_code:
        query = query.filter(Company.country_code == country_code)
    if city:
        query = query.filter(Company.city == city)
    if type:
        query = query.filter(Company.type == type)
    if search:
        query = query.filter(Company.name.ilike(f"%{search}%"))
    
    companies = query.order_by(Company.name).all()
    return companies

@router.get("/with-locations", response_model=List[CompanyWithLocation])
def get_companies_with_locations(
    country_code: Optional[str] = Query(None, description="按国家代码筛选"),
    city: Optional[str] = Query(None, description="按城市筛选"),
    type: Optional[str] = Query(None, description="按类型筛选: importer, exporter, both"),
    db: Session = Depends(get_db)
):
    """获取公司列表（包含位置信息）"""
    query = db.query(Company)
    
    if country_code:
        query = query.filter(Company.country_code == country_code)
    if city:
        query = query.filter(Company.city == city)
    if type:
        query = query.filter(Company.type == type)
    
    companies = query.order_by(Company.name).all()
    
    # 为每个公司获取位置信息
    result = []
    for company in companies:
        # 优先查找城市位置
        location = db.query(Location).filter(
            Location.country_code == company.country_code,
            Location.city == company.city,
            Location.type == 'city'
        ).first()
        
        # 如果城市位置不存在，回退到国家位置
        if not location:
            location = db.query(Location).filter(
                Location.country_code == company.country_code,
                Location.type == 'country'
            ).first()
        
        if location:
            result.append(CompanyWithLocation(
                id=company.id,
                name=company.name,
                country_code=company.country_code,
                country_name=company.country_name,
                city=company.city,
                type=company.type,
                industry=company.industry,
                website=company.website,
                latitude=float(location.latitude),
                longitude=float(location.longitude),
                region=location.region,
                continent=location.continent
            ))
    
    return result

@router.get("/{company_id}", response_model=CompanySchema)
def get_company(company_id: str, db: Session = Depends(get_db)):
    """获取单个公司信息"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Company not found")
    return company

@router.get("/{company_id}/location", response_model=CompanyWithLocation)
def get_company_with_location(company_id: str, db: Session = Depends(get_db)):
    """获取公司信息及其位置"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Company not found")
    
    # 优先查找城市位置
    location = db.query(Location).filter(
        Location.country_code == company.country_code,
        Location.city == company.city,
        Location.type == 'city'
    ).first()
    
    # 如果城市位置不存在，回退到国家位置
    if not location:
        location = db.query(Location).filter(
            Location.country_code == company.country_code,
            Location.type == 'country'
        ).first()
    
    if not location:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Location not found for company")
    
    return CompanyWithLocation(
        id=company.id,
        name=company.name,
        country_code=company.country_code,
        country_name=company.country_name,
        city=company.city,
        type=company.type,
        industry=company.industry,
        website=company.website,
        latitude=float(location.latitude),
        longitude=float(location.longitude),
        region=location.region,
        continent=location.continent
    )

