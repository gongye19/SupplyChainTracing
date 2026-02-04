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
    start_year_month: Optional[str] = Query(None, description="起始年月 (YYYY-MM)"),
    end_year_month: Optional[str] = Query(None, description="结束年月 (YYYY-MM)"),
    country: Optional[List[str]] = Query(None, description="国家筛选（可多个，国家代码，如 CN, US, JP）"),
    hs_code_prefix: Optional[List[str]] = Query(None, description="HS Code 2位大类筛选（可多个，如 85, 84）"),
    hs_code: Optional[List[str]] = Query(None, description="完整 HS Code 6位筛选（可多个，如 854231）"),
    industry: Optional[str] = Query(None, description="行业筛选（如 SemiConductor）"),
    limit: Optional[int] = Query(10000, description="返回记录数限制（默认10000）"),
    db: Session = Depends(get_db)
):
    """获取国家原产地贸易统计数据（从 country_origin_trade_stats 表）"""
    try:
        # 首先检查表是否存在（使用更安全的方式）
        try:
            check_table = db.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'country_origin_trade_stats'
                )
            """))
            table_exists = check_table.scalar()
        except Exception as check_error:
            # 如果检查表存在性时出错，也认为表不存在
            print(f"Error checking table existence: {check_error}")
            table_exists = False
        
        if not table_exists:
            # 表不存在，返回空列表
            print("Table country_origin_trade_stats does not exist, returning empty list")
            return []
        
        query = "SELECT * FROM country_origin_trade_stats WHERE 1=1"
        params = {}
        
        # 年月筛选
        if start_year_month:
            year_val, month_val = start_year_month.split('-')
            query += " AND (year > :start_year OR (year = :start_year AND month >= :start_month))"
            params['start_year'] = int(year_val)
            params['start_month'] = int(month_val)
        
        if end_year_month:
            year_val, month_val = end_year_month.split('-')
            query += " AND (year < :end_year OR (year = :end_year AND month <= :end_month))"
            params['end_year'] = int(year_val)
            params['end_month'] = int(month_val)
        
        # 国家筛选（原产国或目的地国家）
        if country:
            placeholders = ', '.join([f':country_{i}' for i in range(len(country))])
            query += f" AND (origin_country_code IN ({placeholders}) OR destination_country_code IN ({placeholders}))"
            for i, c in enumerate(country):
                params[f'country_{i}'] = c
        
        # HS Code 筛选（优先级：完整6位 > 大类）
        if hs_code:
            # 完整6位 HS Code 筛选
            placeholders = ', '.join([f':hs_code_{i}' for i in range(len(hs_code))])
            query += f" AND hs_code IN ({placeholders})"
            for i, c in enumerate(hs_code):
                params[f'hs_code_{i}'] = c
        elif hs_code_prefix:
            # 只按大类筛选（前2位）- 使用 PostgreSQL 的 SUBSTRING 函数
            placeholders = ', '.join([f':hs_prefix_{i}' for i in range(len(hs_code_prefix))])
            query += f" AND SUBSTRING(hs_code, 1, 2) IN ({placeholders})"
            for i, prefix in enumerate(hs_code_prefix):
                params[f'hs_prefix_{i}'] = prefix
        
        # 行业筛选
        if industry:
            query += " AND industry = :industry"
            params['industry'] = industry
        
        # 添加排序和限制
        query += " ORDER BY year DESC, month DESC, sum_of_usd DESC"
        if limit:
            query += f" LIMIT :limit"
            params['limit'] = limit
        
        try:
            result = db.execute(text(query), params)
            rows = result.fetchall()
        except Exception as query_error:
            # 如果查询出错（可能是表不存在），记录错误并返回空列表
            error_msg = str(query_error)
            if "does not exist" in error_msg or "UndefinedTable" in error_msg or "relation" in error_msg.lower():
                print(f"Table does not exist or query failed: {error_msg}")
                return []
            # 其他查询错误也返回空列表
            print(f"Query error: {error_msg}")
            return []
        
        # 转换为字典列表（适配新的 Schema）
        shipments = []
        for row in rows:
            # 生成日期字符串（用于向后兼容）
            date_str = f"{row.year}-{row.month:02d}-01"
            
            shipment_dict = {
                'year': row.year,
                'month': row.month,
                'hs_code': row.hs_code,
                'industry': row.industry,
                'origin_country_code': row.origin_country_code,
                'destination_country_code': row.destination_country_code,
                'weight': float(row.weight) if row.weight else None,
                'quantity': float(row.quantity) if row.quantity else None,
                'total_value_usd': float(row.sum_of_usd) if row.sum_of_usd else None,
                'weight_avg_price': float(row.weight_avg_price) if row.weight_avg_price else None,
                'quantity_avg_price': float(row.quantity_avg_price) if row.quantity_avg_price else None,
                'trade_count': int(row.trade_count) if row.trade_count else 0,
                'amount_share_pct': float(row.amount_share_pct) if row.amount_share_pct else None,
                # 向后兼容字段（从代码映射，这里先设为代码，前端可以进一步映射）
                'country_of_origin': row.origin_country_code,
                'destination_country': row.destination_country_code,
                'date': date_str,
            }
            shipments.append(shipment_dict)
        
        return shipments
    except Exception as e:
        # 记录错误并返回空列表，避免 500 错误
        import traceback
        print(f"Error in get_shipments: {str(e)}")
        print(traceback.format_exc())
        # 返回空列表而不是抛出异常
        return []

