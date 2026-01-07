from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime
import math

from ..database import get_db
from ..models import Transaction, Category, Company
from ..schemas import (
    TransactionResponse, 
    TransactionListResponse, 
    PaginationInfo,
    StatsResponse,
    CategoryBreakdown,
    TopRoute
)

router = APIRouter()

def build_transaction_response(transaction: Transaction) -> TransactionResponse:
    """构建交易响应对象，包含关联数据"""
    category = transaction.category
    exporter_company = transaction.exporter_company
    importer_company = transaction.importer_company
    
    return TransactionResponse(
        id=transaction.id,
        exporter_company_id=transaction.exporter_company_id,
        exporter_company_name=exporter_company.name if exporter_company else None,
        exporter_country_code=transaction.origin_country_code,
        exporter_country_name=transaction.origin_country_name,
        importer_company_id=transaction.importer_company_id,
        importer_company_name=importer_company.name if importer_company else None,
        importer_country_code=transaction.destination_country_code,
        importer_country_name=transaction.destination_country_name,
        material=transaction.material,
        category_id=category.id,
        category_name=category.display_name,
        category_color=category.color,
        quantity=float(transaction.quantity),
        unit=transaction.unit,
        price=float(transaction.price),
        total_value=float(transaction.total_value),
        transaction_date=transaction.transaction_date,
        status=transaction.status,
        notes=transaction.notes
    )

@router.get("", response_model=TransactionListResponse)
def get_transactions(
    start_date: Optional[str] = Query(None, description="开始日期 (ISO format)"),
    end_date: Optional[str] = Query(None, description="结束日期 (ISO format)"),
    origin_country: Optional[List[str]] = Query(None, description="起点国家代码（可多个）"),
    destination_country: Optional[str] = Query(None, description="终点国家代码"),
    category_id: Optional[List[str]] = Query(None, description="品类ID（可多个）"),
    company_id: Optional[str] = Query(None, description="公司ID（出口商或进口商）"),
    min_value: Optional[float] = Query(None, description="最小交易额"),
    max_value: Optional[float] = Query(None, description="最大交易额"),
    status: Optional[str] = Query(None, description="状态（可多个，逗号分隔）"),
    page: int = Query(1, ge=1, description="页码"),
    limit: int = Query(100, ge=1, le=1000, description="每页数量"),
    db: Session = Depends(get_db)
):
    """查询交易记录"""
    query = db.query(Transaction)
    
    # 应用筛选条件
    if start_date:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        query = query.filter(Transaction.transaction_date >= start_dt)
    if end_date:
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        query = query.filter(Transaction.transaction_date <= end_dt)
    if origin_country:
        # 支持多个起点国家，或者起点或终点匹配任一国家
        query = query.filter(
            or_(
                Transaction.origin_country_code.in_(origin_country),
                Transaction.destination_country_code.in_(origin_country)
            )
        )
    if destination_country:
        query = query.filter(Transaction.destination_country_code == destination_country)
    if category_id:
        # 支持多个品类ID
        query = query.filter(Transaction.category_id.in_(category_id))
    if company_id:
        query = query.filter(
            or_(
                Transaction.exporter_company_id == company_id,
                Transaction.importer_company_id == company_id
            )
        )
    if min_value is not None:
        query = query.filter(Transaction.total_value >= min_value)
    if max_value is not None:
        query = query.filter(Transaction.total_value <= max_value)
    if status:
        status_list = [s.strip() for s in status.split(',')]
        query = query.filter(Transaction.status.in_(status_list))
    
    # 获取总数
    total = query.count()
    
    # 分页
    offset = (page - 1) * limit
    transactions = query.order_by(Transaction.transaction_date.desc()).offset(offset).limit(limit).all()
    
    # 构建响应
    transaction_responses = [build_transaction_response(t) for t in transactions]
    
    total_pages = math.ceil(total / limit) if total > 0 else 0
    
    return TransactionListResponse(
        transactions=transaction_responses,
        pagination=PaginationInfo(
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )
    )

@router.get("/stats", response_model=StatsResponse)
def get_transaction_stats(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    origin_country: Optional[str] = Query(None),
    destination_country: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    company_id: Optional[str] = Query(None),
    min_value: Optional[float] = Query(None),
    max_value: Optional[float] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """获取交易统计信息"""
    query = db.query(Transaction)
    
    # 应用相同的筛选条件
    if start_date:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        query = query.filter(Transaction.transaction_date >= start_dt)
    if end_date:
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        query = query.filter(Transaction.transaction_date <= end_dt)
    if origin_country:
        query = query.filter(Transaction.origin_country_code == origin_country)
    if destination_country:
        query = query.filter(Transaction.destination_country_code == destination_country)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if company_id:
        query = query.filter(
            or_(
                Transaction.exporter_company_id == company_id,
                Transaction.importer_company_id == company_id
            )
        )
    if min_value is not None:
        query = query.filter(Transaction.total_value >= min_value)
    if max_value is not None:
        query = query.filter(Transaction.total_value <= max_value)
    if status:
        status_list = [s.strip() for s in status.split(',')]
        query = query.filter(Transaction.status.in_(status_list))
    
    # 基础统计
    total_transactions = query.count()
    total_value_result = query.with_entities(func.sum(Transaction.total_value)).scalar()
    total_value = float(total_value_result) if total_value_result else 0.0
    
    # 活跃国家数
    origin_countries = query.with_entities(Transaction.origin_country_code).distinct().count()
    dest_countries = query.with_entities(Transaction.destination_country_code).distinct().count()
    active_countries = len(set(
        [r[0] for r in query.with_entities(Transaction.origin_country_code).distinct().all()] +
        [r[0] for r in query.with_entities(Transaction.destination_country_code).distinct().all()]
    ))
    
    # 活跃公司数
    exporter_companies = query.with_entities(Transaction.exporter_company_id).filter(
        Transaction.exporter_company_id.isnot(None)
    ).distinct().count()
    importer_companies = query.with_entities(Transaction.importer_company_id).filter(
        Transaction.importer_company_id.isnot(None)
    ).distinct().count()
    active_companies = len(set(
        [r[0] for r in query.with_entities(Transaction.exporter_company_id).filter(
            Transaction.exporter_company_id.isnot(None)
        ).distinct().all()] +
        [r[0] for r in query.with_entities(Transaction.importer_company_id).filter(
            Transaction.importer_company_id.isnot(None)
        ).distinct().all()]
    ))
    
    # 品类分解
    category_stats = db.query(
        Category.id,
        Category.display_name,
        func.count(Transaction.id).label('count'),
        func.sum(Transaction.total_value).label('total_value')
    ).join(Transaction, Category.id == Transaction.category_id).group_by(
        Category.id, Category.display_name
    ).all()
    
    category_breakdown = [
        CategoryBreakdown(
            category_id=stat[0],
            category_name=stat[1],
            count=stat[2],
            total_value=float(stat[3]) if stat[3] else 0.0
        )
        for stat in category_stats
    ]
    
    # Top Routes
    route_stats = query.with_entities(
        Transaction.origin_country_code,
        Transaction.destination_country_code,
        func.count(Transaction.id).label('count'),
        func.sum(Transaction.total_value).label('total_value')
    ).group_by(
        Transaction.origin_country_code,
        Transaction.destination_country_code
    ).order_by(func.sum(Transaction.total_value).desc()).limit(10).all()
    
    top_routes = [
        TopRoute(
            origin_country=route[0],
            destination_country=route[1],
            transaction_count=route[2],
            total_value=float(route[3]) if route[3] else 0.0
        )
        for route in route_stats
    ]
    
    return StatsResponse(
        total_transactions=total_transactions,
        total_value=total_value,
        active_countries=active_countries,
        active_companies=active_companies,
        category_breakdown=category_breakdown,
        top_routes=top_routes
    )

