from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional

from ..database import get_db
from ..schemas import MonthlyCompanyFlow

router = APIRouter()

@router.get("", response_model=List[MonthlyCompanyFlow])
def get_monthly_company_flows(
    start_year_month: Optional[str] = Query(None, description="起始年月 (YYYY-MM)"),
    end_year_month: Optional[str] = Query(None, description="结束年月 (YYYY-MM)"),
    country: Optional[List[str]] = Query(None, description="国家筛选（可多个）"),
    company: Optional[List[str]] = Query(None, description="公司名称筛选（可多个）"),
    category_id: Optional[List[str]] = Query(None, description="HS Code 品类ID筛选（可多个）"),
    db: Session = Depends(get_db)
):
    """获取月度公司流量数据"""
    query = "SELECT * FROM monthly_company_flows WHERE 1=1"
    params = {}
    
    if start_year_month:
        query += " AND year_month >= :start_year_month"
        params['start_year_month'] = start_year_month
    
    if end_year_month:
        query += " AND year_month <= :end_year_month"
        params['end_year_month'] = end_year_month
    
    if country:
        placeholders = ', '.join([f':country_{i}' for i in range(len(country))])
        query += f" AND (origin_country IN ({placeholders}) OR destination_country IN ({placeholders}))"
        for i, c in enumerate(country):
            params[f'country_{i}'] = c
    
    if company:
        placeholders = ', '.join([f':company_{i}' for i in range(len(company))])
        query += f" AND (exporter_name IN ({placeholders}) OR importer_name IN ({placeholders}))"
        for i, c in enumerate(company):
            params[f'company_{i}'] = c
    
    if category_id:
        # 需要通过 hs_code_categories 表关联查询
        placeholders = ', '.join([f':cat_{i}' for i in range(len(category_id))])
        base_query = """
            SELECT DISTINCT m.* FROM monthly_company_flows m
            CROSS JOIN LATERAL unnest(string_to_array(m.hs_codes, ',')) AS hs_code_val
            JOIN hs_code_categories h ON LEFT(TRIM(hs_code_val), 2) = h.hs_code
            WHERE h.category_id IN ({})
        """.format(placeholders)
        
        params = {f'cat_{i}': c for i, c in enumerate(category_id)}
        
        # 添加其他筛选条件
        if start_year_month:
            base_query += " AND m.year_month >= :start_year_month"
            params['start_year_month'] = start_year_month
        if end_year_month:
            base_query += " AND m.year_month <= :end_year_month"
            params['end_year_month'] = end_year_month
        if country:
            placeholders_country = ', '.join([f':country_{i}' for i in range(len(country))])
            base_query += f" AND (m.origin_country IN ({placeholders_country}) OR m.destination_country IN ({placeholders_country}))"
            for i, c in enumerate(country):
                params[f'country_{i}'] = c
        if company:
            placeholders_company = ', '.join([f':company_{i}' for i in range(len(company))])
            base_query += f" AND (m.exporter_name IN ({placeholders_company}) OR m.importer_name IN ({placeholders_company}))"
            for i, c in enumerate(company):
                params[f'company_{i}'] = c
        
        query = base_query
    
    query += " ORDER BY year_month DESC, total_value_usd DESC"
    
    result = db.execute(text(query), params)
    rows = result.fetchall()
    
    # 转换为字典列表
    columns = result.keys()
    flows = []
    for row in rows:
        flow_dict = dict(zip(columns, row))
        flows.append(flow_dict)
    
    return flows

