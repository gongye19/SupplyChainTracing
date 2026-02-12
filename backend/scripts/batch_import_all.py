#!/usr/bin/env python3
"""
批量导入所有数据到 Railway 数据库
快速批量导入 CountryOfOrigin 和 country_monthly_industry_data 数据
"""

import json
import sys
import os
from pathlib import Path
from sqlalchemy import create_engine, text
from datetime import datetime

# 数据库连接（Railway 数据库）
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    os.getenv(
        "DATABASE_PUBLIC_URL",
        "postgresql://postgres:MWXAjkGpQgosJuCgIPcRdudhiyAiXCRl@crossover.proxy.rlwy.net:42314/railway"
    )
)

# 批量大小（增大以提高速度）
BATCH_SIZE = 5000

def create_tables(engine):
    """创建所有需要的表"""
    print("=" * 60)
    print("创建数据库表...")
    print("=" * 60)
    
    with engine.begin() as conn:
        # 创建 country_origin_trade_stats 表
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS country_origin_trade_stats (
                id VARCHAR(150) PRIMARY KEY,
                hs_code VARCHAR(6) NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                origin_country_code VARCHAR(3) NOT NULL,
                destination_country_code VARCHAR(3) NOT NULL,
                industry VARCHAR(50),
                
                weight DECIMAL(20, 2),
                quantity DECIMAL(20, 2),
                sum_of_usd DECIMAL(20, 2),
                weight_avg_price DECIMAL(15, 4),
                quantity_avg_price DECIMAL(15, 4),
                trade_count INTEGER,
                amount_share_pct DECIMAL(10, 8),
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                CONSTRAINT uq_hs_year_month_origin_dest UNIQUE (hs_code, year, month, origin_country_code, destination_country_code)
            )
        """))
        
        # 创建 country_monthly_trade_stats 表
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS country_monthly_trade_stats (
                id VARCHAR(100) PRIMARY KEY,
                hs_code VARCHAR(6) NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                country_code VARCHAR(3) NOT NULL,
                industry VARCHAR(50),
                
                weight DECIMAL(20, 2),
                quantity DECIMAL(20, 2),
                sum_of_usd DECIMAL(20, 2),
                weight_avg_price DECIMAL(15, 4),
                quantity_avg_price DECIMAL(15, 4),
                trade_count INTEGER,
                amount_share_pct DECIMAL(10, 8),
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                CONSTRAINT uq_hs_year_month_country UNIQUE (hs_code, year, month, country_code)
            )
        """))
        
        # 创建索引
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cots_hs_code ON country_origin_trade_stats(hs_code);
            CREATE INDEX IF NOT EXISTS idx_cots_year_month ON country_origin_trade_stats(year, month);
            CREATE INDEX IF NOT EXISTS idx_cots_origin_country ON country_origin_trade_stats(origin_country_code);
            CREATE INDEX IF NOT EXISTS idx_cots_dest_country ON country_origin_trade_stats(destination_country_code);
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cmts_hs_code ON country_monthly_trade_stats(hs_code);
            CREATE INDEX IF NOT EXISTS idx_cmts_year_month ON country_monthly_trade_stats(year, month);
            CREATE INDEX IF NOT EXISTS idx_cmts_country ON country_monthly_trade_stats(country_code);
        """))
    
    print("✓ 表创建完成\n")

def clear_tables(engine):
    """清空表数据"""
    print("=" * 60)
    print("清空表数据...")
    print("=" * 60)
    
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE country_origin_trade_stats"))
        conn.execute(text("TRUNCATE TABLE country_monthly_trade_stats"))
    
    print("✓ 表已清空\n")

def should_filter_record(data):
    """判断是否应该过滤记录"""
    weight = data.get('weight')
    quantity = data.get('quantity')
    country_code = data.get('countryCode')
    
    # 统一过滤条件：
    # - weight = 0
    # - quantity = 0
    # - countryCode = 'N/A'
    if weight == 0 or quantity == 0 or country_code == 'N/A':
        return True
    return False

def batch_insert_origin_stats(engine, batch):
    """批量插入 country_origin_trade_stats"""
    if not batch:
        return 0
    
    columns = [
        'id', 'hs_code', 'year', 'month', 'origin_country_code', 'destination_country_code',
        'industry', 'weight', 'quantity', 'sum_of_usd', 'weight_avg_price',
        'quantity_avg_price', 'trade_count', 'amount_share_pct'
    ]
    
    columns_str = ', '.join([f'"{c}"' for c in columns])
    values_clauses = []
    all_params = {}
    
    for idx, record in enumerate(batch):
        placeholders = ', '.join([f':{c}_{idx}' for c in columns])
        values_clauses.append(f'({placeholders})')
        for col in columns:
            all_params[f'{col}_{idx}'] = record.get(col)
    
    sql = f"""
        INSERT INTO country_origin_trade_stats ({columns_str})
        VALUES {', '.join(values_clauses)}
        ON CONFLICT (hs_code, year, month, origin_country_code, destination_country_code)
        DO UPDATE SET
            industry = EXCLUDED.industry,
            weight = EXCLUDED.weight,
            quantity = EXCLUDED.quantity,
            sum_of_usd = EXCLUDED.sum_of_usd,
            weight_avg_price = EXCLUDED.weight_avg_price,
            quantity_avg_price = EXCLUDED.quantity_avg_price,
            trade_count = EXCLUDED.trade_count,
            amount_share_pct = EXCLUDED.amount_share_pct,
            updated_at = CURRENT_TIMESTAMP
    """
    
    with engine.begin() as conn:
        conn.execute(text(sql), all_params)
    
    return len(batch)

def batch_insert_monthly_stats(engine, batch):
    """批量插入 country_monthly_trade_stats"""
    if not batch:
        return 0
    
    columns = [
        'id', 'hs_code', 'year', 'month', 'country_code', 'industry',
        'weight', 'quantity', 'sum_of_usd', 'weight_avg_price',
        'quantity_avg_price', 'trade_count', 'amount_share_pct'
    ]
    
    columns_str = ', '.join([f'"{c}"' for c in columns])
    values_clauses = []
    all_params = {}
    
    for idx, record in enumerate(batch):
        placeholders = ', '.join([f':{c}_{idx}' for c in columns])
        values_clauses.append(f'({placeholders})')
        for col in columns:
            all_params[f'{col}_{idx}'] = record.get(col)
    
    sql = f"""
        INSERT INTO country_monthly_trade_stats ({columns_str})
        VALUES {', '.join(values_clauses)}
        ON CONFLICT (hs_code, year, month, country_code)
        DO UPDATE SET
            industry = EXCLUDED.industry,
            weight = EXCLUDED.weight,
            quantity = EXCLUDED.quantity,
            sum_of_usd = EXCLUDED.sum_of_usd,
            weight_avg_price = EXCLUDED.weight_avg_price,
            quantity_avg_price = EXCLUDED.quantity_avg_price,
            trade_count = EXCLUDED.trade_count,
            amount_share_pct = EXCLUDED.amount_share_pct,
            updated_at = CURRENT_TIMESTAMP
    """
    
    with engine.begin() as conn:
        conn.execute(text(sql), all_params)
    
    return len(batch)

def import_country_origin_data(engine, data_dir: Path):
    """导入 CountryOfOrigin 数据"""
    print("=" * 60)
    print("导入 CountryOfOrigin 数据")
    print("=" * 60)
    
    json_files = sorted(data_dir.glob("*.json"))
    if not json_files:
        print(f"❌ 未找到 JSON 文件: {data_dir}")
        return 0
    
    print(f"找到 {len(json_files)} 个文件\n")
    
    total_imported = 0
    total_filtered = 0
    
    for json_file in json_files:
        print(f"处理 {json_file.name}...", end=" ", flush=True)
        start_time = datetime.now()
        
        # 解析文件名: {hs_code}_{year}_{month}.json
        filename = json_file.stem
        parts = filename.split('_')
        if len(parts) < 3:
            print("⚠ 文件名格式错误，跳过")
            continue
        
        hs_code = parts[0]
        year = int(parts[1])
        month = int(parts[2])
        industry = "SemiConductor"
        
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            print(f"⚠ JSON 解析失败: {e}")
            continue
        
        batch = []
        imported = 0
        filtered = 0
        
        # 遍历数据结构: {原产国: {目的地国家: [统计数据]}}
        for origin_country_code, dest_countries_data in data.items():
            if not origin_country_code or origin_country_code == 'N/A':
                continue
            
            for dest_country_code, stats_list in dest_countries_data.items():
                if not dest_country_code or dest_country_code == 'N/A':
                    continue
                
                for stat_data in stats_list:
                    if should_filter_record(stat_data):
                        filtered += 1
                        continue
                    
                    country_code = stat_data.get('countryCode', origin_country_code)
                    if country_code == 'N/A':
                        filtered += 1
                        continue
                    
                    stat_id = f"{hs_code}_{year}_{month:02d}_{origin_country_code}_{dest_country_code}"
                    
                    stat_record = {
                        'id': stat_id,
                        'hs_code': hs_code,
                        'year': year,
                        'month': month,
                        'origin_country_code': origin_country_code,
                        'destination_country_code': dest_country_code,
                        'industry': industry,
                        'weight': stat_data.get('weight'),
                        'quantity': stat_data.get('quantity'),
                        'sum_of_usd': stat_data.get('sumOfUSD'),
                        'weight_avg_price': stat_data.get('weightAvgPrice'),
                        'quantity_avg_price': stat_data.get('quantityAvgPrice'),
                        'trade_count': int(stat_data.get('tradeCount', 0)) if stat_data.get('tradeCount') else None,
                        'amount_share_pct': stat_data.get('amountSharePct', 0.0),
                    }
                    
                    batch.append(stat_record)
                    
                    if len(batch) >= BATCH_SIZE:
                        imported += batch_insert_origin_stats(engine, batch)
                        batch = []
        
        # 插入剩余数据
        if batch:
            imported += batch_insert_origin_stats(engine, batch)
        
        elapsed = (datetime.now() - start_time).total_seconds()
        print(f"✓ {imported} 条记录 ({filtered} 条已过滤) [{elapsed:.1f}s]")
        
        total_imported += imported
        total_filtered += filtered
    
    print(f"\n总计: {total_imported} 条记录，{total_filtered} 条已过滤\n")
    return total_imported

def import_monthly_data(engine, data_dir: Path):
    """导入 country_monthly_industry_data 数据"""
    print("=" * 60)
    print("导入 country_monthly_industry_data 数据")
    print("=" * 60)
    
    json_files = sorted(data_dir.glob("*.json"))
    if not json_files:
        print(f"❌ 未找到 JSON 文件: {data_dir}")
        return 0
    
    print(f"找到 {len(json_files)} 个文件\n")
    
    total_imported = 0
    
    for json_file in json_files:
        print(f"处理 {json_file.name}...", end=" ", flush=True)
        start_time = datetime.now()
        
        # 解析文件名: {hs_code}_{year}.json
        filename = json_file.stem
        parts = filename.split('_')
        if len(parts) < 2:
            print("⚠ 文件名格式错误，跳过")
            continue
        
        hs_code = parts[0]
        year = int(parts[1])
        industry = "SemiConductor"
        
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            print(f"⚠ JSON 解析失败: {e}")
            continue
        
        batch = []
        imported = 0
        
        # 遍历月份数据: {月份: [国家统计数据]}
        for month_str, country_list in data.items():
            if not month_str.isdigit() or len(month_str) != 2:
                continue
            
            month = int(month_str)
            
            for country_data in country_list:
                country_code = country_data.get('countryCode', '')
                if not country_code or country_code == 'N/A':
                    continue
                
                stat_id = f"{hs_code}_{year}_{month:02d}_{country_code}"
                
                stat_record = {
                    'id': stat_id,
                    'hs_code': hs_code,
                    'year': year,
                    'month': month,
                    'country_code': country_code,
                    'industry': industry,
                    'weight': country_data.get('weight'),
                    'quantity': country_data.get('quantity'),
                    'sum_of_usd': country_data.get('sumOfUSD'),
                    'weight_avg_price': country_data.get('weightAvgPrice'),
                    'quantity_avg_price': country_data.get('quantityAvgPrice'),
                    'trade_count': int(country_data.get('tradeCount', 0)) if country_data.get('tradeCount') else None,
                    'amount_share_pct': country_data.get('amountSharePct', 0.0),
                }
                
                batch.append(stat_record)
                
                if len(batch) >= BATCH_SIZE:
                    imported += batch_insert_monthly_stats(engine, batch)
                    batch = []
        
        # 插入剩余数据
        if batch:
            imported += batch_insert_monthly_stats(engine, batch)
        
        elapsed = (datetime.now() - start_time).total_seconds()
        print(f"✓ {imported} 条记录 [{elapsed:.1f}s]")
        
        total_imported += imported
    
    print(f"\n总计: {total_imported} 条记录\n")
    return total_imported

def main():
    clear_first = '--clear' in sys.argv
    
    print("=" * 60)
    print("批量导入数据到 Railway 数据库")
    print("=" * 60)
    print(f"批量大小: {BATCH_SIZE}")
    if clear_first:
        print("模式: 清空后重新导入\n")
    else:
        print("模式: 增量导入（冲突时更新）\n")
    
    # 获取项目根目录
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    
    # 数据目录
    country_origin_dir = project_root / "data" / "SemiConductor" / "CountryOfOrigin"
    monthly_data_dir = project_root / "data" / "country_monthly_industry_data" / "SemiConductor"
    
    # 连接数据库
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✓ 数据库连接成功\n")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        sys.exit(1)
    
    # 创建表
    create_tables(engine)
    
    # 清空表（如果需要）
    if clear_first:
        clear_tables(engine)
    
    # 导入数据
    start_time = datetime.now()
    
    # 1. 导入 CountryOfOrigin 数据
    origin_count = import_country_origin_data(engine, country_origin_dir)
    
    # 2. 导入 country_monthly_industry_data 数据
    monthly_count = import_monthly_data(engine, monthly_data_dir)
    
    total_time = (datetime.now() - start_time).total_seconds()
    
    # 显示统计
    print("=" * 60)
    print("导入完成！")
    print("=" * 60)
    print(f"CountryOfOrigin 数据: {origin_count:,} 条记录")
    print(f"country_monthly_industry_data 数据: {monthly_count:,} 条记录")
    print(f"总耗时: {total_time:.1f} 秒")
    print(f"平均速度: {(origin_count + monthly_count) / total_time:.0f} 条/秒\n")
    
    # 显示数据库统计
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM country_origin_trade_stats"))
        print(f"数据库 country_origin_trade_stats: {result.scalar():,} 条记录")
        
        result = conn.execute(text("SELECT COUNT(*) FROM country_monthly_trade_stats"))
        print(f"数据库 country_monthly_trade_stats: {result.scalar():,} 条记录")

if __name__ == "__main__":
    main()

