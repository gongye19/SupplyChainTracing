#!/usr/bin/env python3
"""
导入 CountryOfOrigin 数据到数据库
从 data/SemiConductor/CountryOfOrigin 目录读取JSON文件
过滤条件：weight=0 或 quantity=0 或 countryCode="N/A" 的数据将被跳过
"""

import json
import sys
import os
from pathlib import Path
from sqlalchemy import create_engine, text

def create_table(engine):
    """创建国家原产地贸易统计表"""
    print("创建数据库表...")
    
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS country_origin_trade_stats (
                id VARCHAR(150) PRIMARY KEY,
                hs_code VARCHAR(6) NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                origin_country_code VARCHAR(3) NOT NULL,
                destination_country_code VARCHAR(3) NOT NULL,
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
                
                CONSTRAINT uq_hs_year_month_origin_dest UNIQUE (hs_code, year, month, origin_country_code, destination_country_code)
            );
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_cots_hs_code ON country_origin_trade_stats(hs_code);
            CREATE INDEX IF NOT EXISTS idx_cots_year_month ON country_origin_trade_stats(year, month);
            CREATE INDEX IF NOT EXISTS idx_cots_origin_country ON country_origin_trade_stats(origin_country_code);
            CREATE INDEX IF NOT EXISTS idx_cots_dest_country ON country_origin_trade_stats(destination_country_code);
            CREATE INDEX IF NOT EXISTS idx_cots_industry ON country_origin_trade_stats(industry);
            CREATE INDEX IF NOT EXISTS idx_cots_hs_year ON country_origin_trade_stats(hs_code, year);
            CREATE INDEX IF NOT EXISTS idx_cots_year_month_origin ON country_origin_trade_stats(year, month, origin_country_code);
            CREATE INDEX IF NOT EXISTS idx_cots_year_month_dest ON country_origin_trade_stats(year, month, destination_country_code);
        """))
    
    print("✓ 表结构创建完成\n")

def clear_table(engine):
    """清空表数据"""
    print("清空 country_origin_trade_stats 表...")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE country_origin_trade_stats"))
    print("  ✓ 表已清空\n")

def should_filter_record(stat_data: dict) -> bool:
    """判断是否应该过滤掉这条记录"""
    weight = stat_data.get('weight', 0)
    quantity = stat_data.get('quantity', 0)
    country_code = stat_data.get('countryCode', '')
    
    # 过滤条件：weight=0 或 quantity=0 或 countryCode="N/A"
    if weight == 0 or quantity == 0 or country_code == 'N/A':
        return True
    return False

def import_json_file(engine, json_path: Path, batch_size: int = 1000):
    """从JSON文件导入数据"""
    if not json_path.exists():
        print(f"  ⚠ 跳过: {json_path.name} 不存在")
        return 0
    
    print(f"  导入 {json_path.name}...")
    
    # 解析文件名: {hs_code}_{year}_{month}.json
    filename = json_path.stem
    parts = filename.split('_')
    if len(parts) < 3:
        print(f"  ⚠ 文件名格式错误: {filename}，期望格式: hs_code_year_month.json")
        return 0
    
    hs_code = parts[0]
    year = int(parts[1])
    month = int(parts[2])
    
    # 获取行业（从父目录的父目录名，如 SemiConductor）
    industry = json_path.parent.parent.name if json_path.parent.parent.name else 'SemiConductor'
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"  ⚠ JSON解析失败: {e}")
        return 0
    
    imported = 0
    filtered = 0
    batch = []
    
    # 遍历原产国（第一层）
    for origin_country_code, dest_countries in data.items():
        # 跳过原产国为 N/A 的情况
        if origin_country_code == 'N/A':
            continue
        
        # 遍历目的地国家（第二层）
        if not isinstance(dest_countries, dict):
            continue
            
        for dest_country_code, stats_list in dest_countries.items():
            # 跳过目的地国家为 N/A 的情况
            if dest_country_code == 'N/A':
                continue
            
            # 遍历统计数组（第三层）
            if not isinstance(stats_list, list):
                continue
                
            for stat_data in stats_list:
                # 过滤条件检查
                if should_filter_record(stat_data):
                    filtered += 1
                    continue
                
                # 获取 countryCode（可能是原产国代码）
                country_code = stat_data.get('countryCode', origin_country_code)
                if country_code == 'N/A':
                    filtered += 1
                    continue
                
                # 生成唯一ID
                stat_id = f"{hs_code}_{year}_{month:02d}_{origin_country_code}_{dest_country_code}"
                
                # 准备数据
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
                
                if len(batch) >= batch_size:
                    imported += _batch_insert(engine, batch)
                    batch = []
    
    # 插入剩余数据
    if batch:
        imported += _batch_insert(engine, batch)
    
    print(f"  ✓ 成功导入 {imported} 条记录，过滤 {filtered} 条无效记录")
    return imported

def _batch_insert(engine, batch: list):
    """批量插入数据"""
    if not batch:
        return 0
    
    columns = [
        'id', 'hs_code', 'year', 'month', 'origin_country_code', 'destination_country_code',
        'industry', 'weight', 'quantity', 'sum_of_usd', 'weight_avg_price',
        'quantity_avg_price', 'trade_count', 'amount_share_pct'
    ]
    
    values_clauses = []
    all_params = {}
    
    for idx, record in enumerate(batch):
        placeholders = ', '.join([f':{col}_{idx}' for col in columns])
        values_clauses.append(f'({placeholders})')
        for col in columns:
            all_params[f'{col}_{idx}'] = record.get(col)
    
    columns_str = ', '.join([f'"{col}"' for col in columns])
    sql = f"""
        INSERT INTO country_origin_trade_stats ({columns_str})
        VALUES {', '.join(values_clauses)}
        ON CONFLICT (hs_code, year, month, origin_country_code, destination_country_code)
        DO UPDATE SET
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
        print(f"  ⚠ 批量插入失败: {e}")
        return 0

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    
    # 数据目录
    data_dir = project_root / "data" / "SemiConductor" / "CountryOfOrigin"
    
    # 数据库连接
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:123456@localhost:5433/supplychain"
    )
    
    clear_first = '--clear' in sys.argv
    
    print("=" * 60)
    print("导入 CountryOfOrigin 数据到数据库")
    print("=" * 60)
    if clear_first:
        print("⚠ 模式: 清空后重新导入\n")
    else:
        print("模式: 增量导入（冲突时更新）\n")
    
    engine = create_engine(database_url, pool_pre_ping=True)
    
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
        print(f"❌ 错误: 数据目录不存在: {data_dir}")
        sys.exit(1)
    
    # 获取所有 JSON 文件
    json_files = sorted(data_dir.glob("*.json"))
    
    if not json_files:
        print(f"❌ 错误: 在 {data_dir} 中未找到 JSON 文件")
        sys.exit(1)
    
    print(f"找到 {len(json_files)} 个 JSON 文件\n")
    print("开始导入数据...\n")
    
    total_imported = 0
    total_filtered = 0
    
    for json_file in json_files:
        count = import_json_file(engine, json_file)
        total_imported += count
        print()
    
    print("=" * 60)
    print("导入完成!")
    print(f"总共导入: {total_imported} 条记录\n")
    
    # 显示统计信息
    print("数据库统计:")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM country_origin_trade_stats"))
        print(f"  country_origin_trade_stats: {result.scalar()} 条记录")
        
        result = conn.execute(text("""
            SELECT 
                COUNT(DISTINCT hs_code) as hs_codes,
                COUNT(DISTINCT origin_country_code) as origin_countries,
                COUNT(DISTINCT destination_country_code) as dest_countries,
                MIN(year) as min_year,
                MAX(year) as max_year
            FROM country_origin_trade_stats
        """))
        row = result.fetchone()
        if row:
            print(f"  HS编码数量: {row[0]}")
            print(f"  原产国数量: {row[1]}")
            print(f"  目的地国家数量: {row[2]}")
            print(f"  年份范围: {row[3]} - {row[4]}")

