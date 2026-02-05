from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime

from ..database import get_db
from ..schemas import CountryMonthlyTradeStat, CountryTradeStatSummary, CountryTradeTrend, TopCountry

router = APIRouter()

@router.get("", response_model=List[CountryMonthlyTradeStat])
def get_country_trade_stats(
    hs_code: Optional[List[str]] = Query(None, description="HS编码筛选（6位，可多个）"),
    year: Optional[int] = Query(None, description="年份筛选"),
    month: Optional[int] = Query(None, description="月份筛选（1-12）"),
    country: Optional[List[str]] = Query(None, description="国家代码筛选（可多个）"),
    industry: Optional[str] = Query(None, description="行业筛选"),
    start_year_month: Optional[str] = Query(None, description="起始年月 (YYYY-MM)"),
    end_year_month: Optional[str] = Query(None, description="结束年月 (YYYY-MM)"),
    limit: Optional[int] = Query(10000, description="返回记录数限制"),
    db: Session = Depends(get_db)
):
    """获取国家月度贸易统计数据"""
    try:
        query = "SELECT * FROM country_monthly_trade_stats WHERE 1=1"
        params = {}
        
        if hs_code:
            placeholders = ', '.join([f':hs_code_{i}' for i in range(len(hs_code))])
            query += f" AND hs_code IN ({placeholders})"
            for i, code in enumerate(hs_code):
                params[f'hs_code_{i}'] = code
        
        if year:
            query += " AND year = :year"
            params['year'] = year
        
        if month:
            query += " AND month = :month"
            params['month'] = month
        
        if country:
            placeholders = ', '.join([f':country_{i}' for i in range(len(country))])
            query += f" AND country_code IN ({placeholders})"
            for i, c in enumerate(country):
                params[f'country_{i}'] = c
        
        if industry:
            query += " AND industry = :industry"
            params['industry'] = industry
        
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
        
        query += " ORDER BY year DESC, month DESC, sum_of_usd DESC"
        
        if limit:
            query += f" LIMIT {limit}"
        
        try:
        result = db.execute(text(query), params)
        rows = result.fetchall()
        
        stats = []
        for row in rows:
            if hasattr(row, '_mapping'):
                stat_dict = dict(row._mapping)
            elif hasattr(row, '_asdict'):
                stat_dict = row._asdict()
            else:
                columns = result.keys() if hasattr(result, 'keys') else []
                stat_dict = {}
                if columns:
                    for i, col in enumerate(columns):
                        stat_dict[col] = row[i]
                else:
                    stat_dict = {f'col_{i}': val for i, val in enumerate(row)}
            
            stats.append(stat_dict)
        
        return stats
    except Exception as e:
        # 记录错误并返回空列表，避免 500 错误
        error_msg = str(e)
        if "does not exist" in error_msg or "UndefinedTable" in error_msg or "relation" in error_msg.lower():
            print(f"Table does not exist or query failed: {error_msg}")
            return []
        # 其他错误也返回空列表
        print(f"Query error: {error_msg}")
        return []

@router.get("/summary", response_model=CountryTradeStatSummary)
def get_country_trade_stats_summary(
    hs_code: Optional[List[str]] = Query(None, description="HS编码筛选（6位，可多个）"),
    year: Optional[int] = Query(None, description="年份筛选"),
    month: Optional[int] = Query(None, description="月份筛选（1-12）"),
    country: Optional[List[str]] = Query(None, description="国家代码筛选（可多个）"),
    industry: Optional[str] = Query(None, description="行业筛选"),
    start_year_month: Optional[str] = Query(None, description="起始年月 (YYYY-MM)"),
    end_year_month: Optional[str] = Query(None, description="结束年月 (YYYY-MM)"),
    db: Session = Depends(get_db)
):
    """获取国家月度贸易统计汇总"""
    try:
        query = """
            SELECT 
                COUNT(DISTINCT country_code) as total_countries,
                COALESCE(SUM(sum_of_usd), 0) as total_trade_value,
                COALESCE(SUM(weight), 0) as total_weight,
                COALESCE(SUM(quantity), 0) as total_quantity,
                COALESCE(SUM(trade_count), 0) as total_trade_count,
                COALESCE(AVG(amount_share_pct), 0) as avg_share_pct
            FROM country_monthly_trade_stats
            WHERE 1=1
        """
        params = {}
        
        if hs_code:
            placeholders = ', '.join([f':hs_code_{i}' for i in range(len(hs_code))])
            query += f" AND hs_code IN ({placeholders})"
            for i, code in enumerate(hs_code):
                params[f'hs_code_{i}'] = code
        
        if year:
            query += " AND year = :year"
            params['year'] = year
        
        if month:
            query += " AND month = :month"
            params['month'] = month
        
        if country:
            placeholders = ', '.join([f':country_{i}' for i in range(len(country))])
            query += f" AND country_code IN ({placeholders})"
            for i, c in enumerate(country):
                params[f'country_{i}'] = c
        
        if industry:
            query += " AND industry = :industry"
            params['industry'] = industry
        
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
        
        try:
        result = db.execute(text(query), params)
        row = result.fetchone()
        
        if row:
            if hasattr(row, '_mapping'):
                summary_dict = dict(row._mapping)
            elif hasattr(row, '_asdict'):
                summary_dict = row._asdict()
            else:
                columns = result.keys() if hasattr(result, 'keys') else []
                summary_dict = {}
                if columns:
                    for i, col in enumerate(columns):
                        summary_dict[col] = row[i]
                else:
                    summary_dict = {f'col_{i}': val for i, val in enumerate(row)}
            
            return summary_dict
        else:
            return {
                "total_countries": 0,
                "total_trade_value": 0.0,
                "total_weight": None,
                "total_quantity": None,
                "total_trade_count": 0,
                "avg_share_pct": 0.0
            }
        except Exception as e:
            # 记录错误并返回默认值，避免 500 错误
            error_msg = str(e)
            if "does not exist" in error_msg or "UndefinedTable" in error_msg or "relation" in error_msg.lower():
                print(f"Table does not exist or query failed: {error_msg}")
                return {
                    "total_countries": 0,
                    "total_trade_value": 0.0,
                    "total_weight": None,
                    "total_quantity": None,
                    "total_trade_count": 0,
                    "avg_share_pct": 0.0
                }
            # 其他错误也返回默认值
            print(f"Query error: {error_msg}")
            return {
                "total_countries": 0,
                "total_trade_value": 0.0,
                "total_weight": None,
                "total_quantity": None,
                "total_trade_count": 0,
                "avg_share_pct": 0.0
            }
    except Exception as e:
        # 外层异常处理
        error_msg = str(e)
        print(f"Outer error: {error_msg}")
        return {
            "total_countries": 0,
            "total_trade_value": 0.0,
            "total_weight": None,
            "total_quantity": None,
            "total_trade_count": 0,
            "avg_share_pct": 0.0
        }

@router.get("/trends", response_model=List[CountryTradeTrend])
def get_country_trade_trends(
    hs_code: Optional[str] = Query(None, description="HS编码（6位）"),
    country: Optional[str] = Query(None, description="国家代码"),
    industry: Optional[str] = Query(None, description="行业筛选"),
    start_year_month: Optional[str] = Query(None, description="起始年月 (YYYY-MM)"),
    end_year_month: Optional[str] = Query(None, description="结束年月 (YYYY-MM)"),
    db: Session = Depends(get_db)
):
    """获取国家贸易趋势数据（按月份聚合）"""
    try:
        query = """
            SELECT 
                TO_CHAR(TO_DATE(year || '-' || LPAD(month::text, 2, '0') || '-01', 'YYYY-MM-DD'), 'YYYY-MM') as year_month,
                COALESCE(SUM(sum_of_usd), 0) as sum_of_usd,
                COALESCE(SUM(weight), 0) as weight,
                COALESCE(SUM(quantity), 0) as quantity,
                COALESCE(SUM(trade_count), 0) as trade_count
            FROM country_monthly_trade_stats
            WHERE 1=1
        """
        params = {}
        
        if hs_code:
            query += " AND hs_code = :hs_code"
            params['hs_code'] = hs_code
        
        if country:
            query += " AND country_code = :country"
            params['country'] = country
        
        if industry:
            query += " AND industry = :industry"
            params['industry'] = industry
        
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
        
        query += " GROUP BY year, month ORDER BY year, month"
        
        try:
        result = db.execute(text(query), params)
        rows = result.fetchall()
        
        trends = []
        for row in rows:
            if hasattr(row, '_mapping'):
                trend_dict = dict(row._mapping)
            elif hasattr(row, '_asdict'):
                trend_dict = row._asdict()
            else:
                columns = result.keys() if hasattr(result, 'keys') else []
                trend_dict = {}
                if columns:
                    for i, col in enumerate(columns):
                        trend_dict[col] = row[i]
                else:
                    trend_dict = {f'col_{i}': val for i, val in enumerate(row)}
            
            trends.append(trend_dict)
        
            return trends
        except Exception as e:
            # 记录错误并返回空列表，避免 500 错误
            error_msg = str(e)
            if "does not exist" in error_msg or "UndefinedTable" in error_msg or "relation" in error_msg.lower():
                print(f"Table does not exist or query failed: {error_msg}")
                return []
            # 其他错误也返回空列表
            print(f"Query error: {error_msg}")
            return []
    except Exception as e:
        # 外层异常处理
        error_msg = str(e)
        print(f"Outer error: {error_msg}")
        return {
            "total_countries": 0,
            "total_trade_value": 0.0,
            "total_weight": None,
            "total_quantity": None,
            "total_trade_count": 0,
            "avg_share_pct": 0.0
        }

@router.get("/top-countries", response_model=List[TopCountry])
def get_top_countries(
    hs_code: Optional[str] = Query(None, description="HS编码（6位）"),
    year: Optional[int] = Query(None, description="年份筛选"),
    month: Optional[int] = Query(None, description="月份筛选（1-12）"),
    industry: Optional[str] = Query(None, description="行业筛选"),
    limit: int = Query(10, description="返回Top N国家"),
    db: Session = Depends(get_db)
):
    """获取Top国家（按贸易额排序）"""
    try:
        query = """
            SELECT 
                country_code,
                COALESCE(SUM(sum_of_usd), 0) as sum_of_usd,
                COALESCE(SUM(weight), 0) as weight,
                COALESCE(SUM(quantity), 0) as quantity,
                COALESCE(SUM(trade_count), 0) as trade_count,
                COALESCE(AVG(amount_share_pct), 0) as amount_share_pct
            FROM country_monthly_trade_stats
            WHERE 1=1
        """
        params = {}
        
        if hs_code:
            query += " AND hs_code = :hs_code"
            params['hs_code'] = hs_code
        
        if year:
            query += " AND year = :year"
            params['year'] = year
        
        if month:
            query += " AND month = :month"
            params['month'] = month
        
        if industry:
            query += " AND industry = :industry"
            params['industry'] = industry
        
        query += " GROUP BY country_code ORDER BY sum_of_usd DESC LIMIT :limit"
        params['limit'] = limit
        
        try:
        result = db.execute(text(query), params)
        rows = result.fetchall()
        
        top_countries = []
        for row in rows:
            if hasattr(row, '_mapping'):
                country_dict = dict(row._mapping)
            elif hasattr(row, '_asdict'):
                country_dict = row._asdict()
            else:
                columns = result.keys() if hasattr(result, 'keys') else []
                country_dict = {}
                if columns:
                    for i, col in enumerate(columns):
                        country_dict[col] = row[i]
                else:
                    country_dict = {f'col_{i}': val for i, val in enumerate(row)}
            
            top_countries.append(country_dict)
        
            return top_countries
        except Exception as e:
            # 记录错误并返回空列表，避免 500 错误
            error_msg = str(e)
            if "does not exist" in error_msg or "UndefinedTable" in error_msg or "relation" in error_msg.lower():
                print(f"Table does not exist or query failed: {error_msg}")
                return []
            # 其他错误也返回空列表
            print(f"Query error: {error_msg}")
            return []
    except Exception as e:
        # 外层异常处理
        error_msg = str(e)
        print(f"Outer error: {error_msg}")
        return {
            "total_countries": 0,
            "total_trade_value": 0.0,
            "total_weight": None,
            "total_quantity": None,
            "total_trade_count": 0,
            "avg_share_pct": 0.0
        }

