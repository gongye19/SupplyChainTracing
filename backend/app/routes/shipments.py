from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime

from ..database import get_db
from ..schemas import Shipment

router = APIRouter()

@router.get("", response_model=List[Shipment])
def get_shipments(
    start_date: Optional[str] = Query(None, description="起始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    country: Optional[List[str]] = Query(None, description="国家筛选（可多个，国家名称）"),
    company: Optional[List[str]] = Query(None, description="公司名称筛选（可多个）"),
    hs_code_prefix: Optional[List[str]] = Query(None, description="HS Code 2位大类筛选（可多个，如 42, 54, 62）"),
    hs_code_suffix: Optional[List[str]] = Query(None, description="HS Code 2位小类筛选（可多个，如 04, 07, 05），需配合大类使用"),
    hs_code: Optional[List[str]] = Query(None, description="完整 HS Code 4位筛选（可多个，如 4204, 5407）"),
    limit: Optional[int] = Query(10000, description="返回记录数限制（默认10000）"),
    db: Session = Depends(get_db)
):
    """获取原始交易数据（从 shipments_raw 表）"""
    query = "SELECT * FROM shipments_raw WHERE 1=1"
    params = {}
    
    # 日期筛选
    if start_date:
        query += " AND date >= :start_date"
        params['start_date'] = start_date
    if end_date:
        query += " AND date <= :end_date"
        params['end_date'] = end_date
    
    # 国家筛选
    if country:
        placeholders = ', '.join([f':country_{i}' for i in range(len(country))])
        query += f" AND (country_of_origin IN ({placeholders}) OR destination_country IN ({placeholders}))"
        for i, c in enumerate(country):
            params[f'country_{i}'] = c
    
    # 公司筛选
    if company:
        placeholders = ', '.join([f':company_{i}' for i in range(len(company))])
        query += f" AND (exporter_name IN ({placeholders}) OR importer_name IN ({placeholders}))"
        for i, c in enumerate(company):
            params[f'company_{i}'] = c
    
    # HS Code 筛选（优先级：完整4位 > 大类+小类 > 大类）
    if hs_code:
        # 完整4位 HS Code 筛选
        placeholders = ', '.join([f':hs_code_{i}' for i in range(len(hs_code))])
        query += f" AND hs_code IN ({placeholders})"
        for i, c in enumerate(hs_code):
            params[f'hs_code_{i}'] = c
    elif hs_code_prefix and hs_code_suffix:
        # 大类 + 小类组合筛选
        # 生成所有可能的组合
        combinations = []
        for prefix in hs_code_prefix:
            for suffix in hs_code_suffix:
                combinations.append(f"{prefix}{suffix}")
        if combinations:
            placeholders = ', '.join([f':hs_combo_{i}' for i in range(len(combinations))])
            query += f" AND hs_code IN ({placeholders})"
            for i, combo in enumerate(combinations):
                params[f'hs_combo_{i}'] = combo
    elif hs_code_prefix:
        # 只按大类筛选（前2位）
        placeholders = ', '.join([f':hs_prefix_{i}' for i in range(len(hs_code_prefix))])
        query += f" AND LEFT(hs_code, 2) IN ({placeholders})"
        for i, prefix in enumerate(hs_code_prefix):
            params[f'hs_prefix_{i}'] = prefix
    elif hs_code_suffix:
        # 只按小类筛选（后2位）- 不推荐单独使用，但支持
        placeholders = ', '.join([f':hs_suffix_{i}' for i in range(len(hs_code_suffix))])
        query += f" AND RIGHT(hs_code, 2) IN ({placeholders})"
        for i, suffix in enumerate(hs_code_suffix):
            params[f'hs_suffix_{i}'] = suffix
    
    # 添加排序和限制
    query += " ORDER BY date DESC, total_value_usd DESC"
    if limit:
        query += f" LIMIT :limit"
        params['limit'] = limit
    
    result = db.execute(text(query), params)
    rows = result.fetchall()
    
    # 转换为字典列表
    shipments = []
    for row in rows:
        shipment_dict = {
            'date': row.date.strftime('%Y-%m-%d') if row.date else None,
            'importer_name': row.importer_name,
            'exporter_name': row.exporter_name,
            'hs_code': row.hs_code,
            'product_english': row.product_english,
            'product_description': row.product_description,
            'weight_kg': float(row.weight_kg) if row.weight_kg else None,
            'quantity': float(row.quantity) if row.quantity else None,
            'quantity_unit': row.quantity_unit,
            'total_value_usd': float(row.total_value_usd) if row.total_value_usd else None,
            'unit_price_per_kg': float(row.unit_price_per_kg) if row.unit_price_per_kg else None,
            'unit_price_per_item': float(row.unit_price_per_item) if row.unit_price_per_item else None,
            'country_of_origin': row.country_of_origin,
            'destination_country': row.destination_country,
            'port_of_departure': row.port_of_departure,
            'port_of_arrival': row.port_of_arrival,
            'import_export': row.import_export,
            'transport_mode': row.transport_mode,
            'trade_term': row.trade_term,
        }
        shipments.append(shipment_dict)
    
    return shipments

