#!/usr/bin/env python3
"""
导入国家月度贸易统计数据到 Railway 数据库
从 data/country_monthly_industry_data 目录读取JSON文件
"""

import json
import sys
import os
from pathlib import Path
from sqlalchemy import create_engine, text

# 数据库连接（从环境变量读取，如果没有则使用默认值）
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:123456@localhost:5433/supplychain"
)

def create_table(engine):
    """创建国家月度贸易统计表"""
    print("创建数据库表...")
    
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS country_monthly_trade_stats (
                id VARCHAR(100) PRIMARY KEY,
                hs_code VARCHAR(6) NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                country_code VARCHAR(3) NOT NULL,
                industry VARCHAR(50),
                
                -- 统计数据
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
            );
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cmts_hs_code ON country_monthly_trade_stats(hs_code);
            CREATE INDEX IF NOT EXISTS idx_cmts_year_month ON country_monthly_trade_stats(year, month);
            CREATE INDEX IF NOT EXISTS idx_cmts_country ON country_monthly_trade_stats(country_code);
            CREATE INDEX IF NOT EXISTS idx_cmts_industry ON country_monthly_trade_stats(industry);
            CREATE INDEX IF NOT EXISTS idx_cmts_hs_year ON country_monthly_trade_stats(hs_code, year);
            CREATE INDEX IF NOT EXISTS idx_cmts_year_month_country ON country_monthly_trade_stats(year, month, country_code);
        """))
    
    print("✓ 表结构创建完成\n")

def clear_table(engine):
    """清空表数据"""
    print("清空 country_monthly_trade_stats 表...")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE country_monthly_trade_stats"))
    print("  ✓ 表已清空\n")

def import_json_file(engine, json_path: Path, batch_size: int = 1000):
    """从JSON文件导入数据"""
    if not json_path.exists():
        print(f"  ⚠ 跳过: {json_path.name} 不存在")
        return 0
    
    print(f"  导入 {json_path.name}...")
    
    # 解析文件名: {hs_code}_{year}.json
    filename = json_path.stem
    parts = filename.split('_')
    if len(parts) < 2:
        print(f"  ⚠ 文件名格式错误: {filename}")
        return 0
    
    hs_code = parts[0]
    year = int(parts[1])
    
    # 获取行业（从父目录名）
    industry = json_path.parent.name
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"  ⚠ JSON解析失败: {e}")
        return 0
    
    imported = 0
    batch = []
    
    # 遍历月份数据 (01-12)
    for month_str, country_list in data.items():
        if not month_str.isdigit() or len(month_str) != 2:
            continue
        
        month = int(month_str)
        
        # 遍历每个国家的数据
        for country_data in country_list:
            country_code = country_data.get('countryCode', '')
            if not country_code or country_code == 'N/A':
                continue
            
            # 生成唯一ID
            stat_id = f"{hs_code}_{year}_{month:02d}_{country_code}"
            
            # 准备数据
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
            
            if len(batch) >= batch_size:
                imported += _batch_insert(engine, batch)
                batch = []
    
    # 插入剩余数据
    if batch:
        imported += _batch_insert(engine, batch)
    
    print(f"  ✓ 成功导入 {imported} 条记录")
    return imported

def _batch_insert(engine, batch: list):
    """批量插入数据"""
    if not batch:
        return 0
    
    columns = [
        'id', 'hs_code', 'year', 'month', 'country_code', 'industry',
        'weight', 'quantity', 'sum_of_usd', 'weight_avg_price',
        'quantity_avg_price', 'trade_count', 'amount_share_pct'
    ]
    
    columns_str = ', '.join([f'"{c}"' for c in columns])
    
    # 构建批量插入 SQL
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
    
    try:
        with engine.begin() as conn:
            conn.execute(text(sql), all_params)
        return len(batch)
    except Exception as e:
        print(f"  ⚠ 批量插入失败，改为逐行插入: {e}")
        # 如果批量插入失败，尝试逐行插入
        imported = 0
        placeholders = ', '.join([f':{c}' for c in columns])
        sql_single = f"""
            INSERT INTO country_monthly_trade_stats ({columns_str})
            VALUES ({placeholders})
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
            for record in batch:
                try:
                    conn.execute(text(sql_single), record)
                    imported += 1
                except Exception as e2:
                    print(f"  ⚠ 单行插入失败: {e2}")
                    continue
        return imported

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    data_dir = project_root / "data" / "country_monthly_industry_data"
    clear_first = '--clear' in sys.argv
    
    print("=" * 60)
    print("导入国家月度贸易统计数据到 Railway 数据库")
    print("=" * 60)
    if clear_first:
        print("⚠ 模式: 清空后重新导入\n")
    else:
        print("模式: 增量导入（ON CONFLICT UPDATE）\n")
    
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✓ 数据库连接成功\n")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        sys.exit(1)
    
    create_table(engine)
    
    if clear_first:
        clear_table(engine)
    
    if not data_dir.exists():
        print(f"❌ 错误: 目录不存在: {data_dir}")
        sys.exit(1)
    
    print("开始导入数据...\n")
    
    total_imported = 0
    
    # 遍历所有行业目录
    for industry_dir in data_dir.iterdir():
        if not industry_dir.is_dir():
            continue
        
        industry = industry_dir.name
        print(f"行业: {industry}")
        
        # 遍历该行业下的所有JSON文件
        json_files = list(industry_dir.glob("*.json"))
        if not json_files:
            print(f"  ⚠ 未找到JSON文件")
            continue
        
        for json_file in sorted(json_files):
            count = import_json_file(engine, json_file)
            total_imported += count
        
        print()
    
    print("=" * 60)
    print("导入完成!")
    print(f"总共导入: {total_imported} 条记录\n")
    
    print("表记录数:")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM country_monthly_trade_stats"))
        print(f"  country_monthly_trade_stats: {result.scalar()} 条")

