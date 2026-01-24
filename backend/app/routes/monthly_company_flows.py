from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import date, datetime

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
    hs_code: Optional[List[str]] = Query(None, description="HS Code 2位大类筛选（可多个，如 42, 54, 62）"),
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
    
    # 支持按 HS Code 2位大类筛选（优先于 category_id）
    if hs_code:
        # 直接按 HS Code 前2位筛选
        placeholders = ', '.join([f':hs_code_{i}' for i in range(len(hs_code))])
        base_query = """
            SELECT DISTINCT m.* FROM monthly_company_flows m
            CROSS JOIN LATERAL unnest(string_to_array(m.hs_codes, ',')) AS hs_code_val
            WHERE LEFT(TRIM(hs_code_val), 2) IN ({})
        """.format(placeholders)
        
        params = {f'hs_code_{i}': c for i, c in enumerate(hs_code)}
        
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
    elif category_id:
        # 需要通过 hs_code_categories 表关联查询（按品类ID筛选）
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
    
    # 根据查询类型添加正确的 ORDER BY
    if hs_code or category_id:
        query += " ORDER BY m.year_month DESC, m.total_value_usd DESC"
    else:
        query += " ORDER BY year_month DESC, total_value_usd DESC"
    
    try:
        result = db.execute(text(query), params)
        rows = result.fetchall()
        
        # 转换为字典列表 - 使用 row._mapping 或 row._asdict() (SQLAlchemy 2.0)
        flows = []
        for row in rows:
            # SQLAlchemy 2.0 支持 _mapping 属性
            if hasattr(row, '_mapping'):
                flow_dict = dict(row._mapping)
            elif hasattr(row, '_asdict'):
                flow_dict = row._asdict()
            else:
                # 回退方案：手动构建字典
                try:
                    # 尝试获取列名
                    columns = result.keys() if hasattr(result, 'keys') else []
                    flow_dict = {}
                    if columns:
                        for i, col in enumerate(columns):
                            flow_dict[col] = row[i]
                    else:
                        # 如果无法获取列名，使用索引
                        flow_dict = {f'col_{i}': val for i, val in enumerate(row)}
                except:
                    # 最后的回退：使用枚举
                    flow_dict = {f'col_{i}': val for i, val in enumerate(row)}
            
            # 转换日期字段为字符串（如果存在）
            if 'first_transaction_date' in flow_dict and flow_dict['first_transaction_date'] is not None:
                if isinstance(flow_dict['first_transaction_date'], (date, datetime)):
                    flow_dict['first_transaction_date'] = flow_dict['first_transaction_date'].strftime('%Y-%m-%d')
            
            if 'last_transaction_date' in flow_dict and flow_dict['last_transaction_date'] is not None:
                if isinstance(flow_dict['last_transaction_date'], (date, datetime)):
                    flow_dict['last_transaction_date'] = flow_dict['last_transaction_date'].strftime('%Y-%m-%d')
            
            flows.append(flow_dict)
        
        return flows
    except Exception as e:
        import traceback
        error_detail = f"数据库查询错误: {str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_detail}")  # 打印到日志
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"数据库查询错误: {str(e)}")

