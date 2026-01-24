#!/usr/bin/env python3
"""
导入预处理表到 Railway 数据库
"""

import csv
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres:MWXAjkGpQgosJuCgIPcRdudhiyAiXCRl@crossover.proxy.rlwy.net:42314/railway"

def clear_tables(engine):
    """清空数据库中的所有表"""
    print("清空数据库中的所有表...")
    
    with engine.begin() as conn:
        result = conn.execute(text("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        """))
        tables = [row[0] for row in result]
        
        if not tables:
            print("  ℹ 数据库中没有表\n")
            return
        
        print(f"  找到 {len(tables)} 个表，开始删除...")
        for table in tables:
            conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
        print("  ✓ 所有表已删除\n")

def create_tables(engine):
    """创建4个表"""
    print("创建数据库表...")
    
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS shipments_raw (
                date DATE, importer_name VARCHAR(200), exporter_name VARCHAR(200),
                hs_code VARCHAR(10), product_english VARCHAR(200), product_description TEXT,
                weight_kg NUMERIC(15, 2), quantity NUMERIC(15, 2), quantity_unit VARCHAR(50),
                total_value_usd NUMERIC(20, 2), unit_price_per_kg NUMERIC(15, 2),
                unit_price_per_item NUMERIC(15, 2), country_of_origin VARCHAR(100),
                destination_country VARCHAR(100), port_of_departure VARCHAR(100),
                port_of_arrival VARCHAR(100), import_export VARCHAR(20),
                transport_mode VARCHAR(50), trade_term VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS monthly_company_flows (
                year_month VARCHAR(7) NOT NULL, exporter_name VARCHAR(200) NOT NULL,
                importer_name VARCHAR(200) NOT NULL, origin_country VARCHAR(100) NOT NULL,
                destination_country VARCHAR(100) NOT NULL, hs_codes TEXT,
                transport_mode VARCHAR(50), trade_term VARCHAR(50),
                transaction_count INTEGER NOT NULL, total_value_usd NUMERIC(20, 2) NOT NULL,
                total_weight_kg NUMERIC(15, 2), total_quantity NUMERIC(15, 2),
                first_transaction_date DATE, last_transaction_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (year_month, exporter_name, importer_name)
            );
        """))
        
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS hs_code_categories (
                hs_code VARCHAR(10) PRIMARY KEY, chapter_name VARCHAR(200) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS country_locations (
                country_code VARCHAR(3) PRIMARY KEY, country_name VARCHAR(100) NOT NULL UNIQUE,
                latitude NUMERIC(10, 7) NOT NULL, longitude NUMERIC(10, 7) NOT NULL,
                region VARCHAR(50), continent VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_monthly_flows_year_month ON monthly_company_flows(year_month);
            CREATE INDEX IF NOT EXISTS idx_monthly_flows_exporter ON monthly_company_flows(exporter_name);
            CREATE INDEX IF NOT EXISTS idx_monthly_flows_importer ON monthly_company_flows(importer_name);
            CREATE INDEX IF NOT EXISTS idx_monthly_flows_origin_country ON monthly_company_flows(origin_country);
            CREATE INDEX IF NOT EXISTS idx_monthly_flows_dest_country ON monthly_company_flows(destination_country);
            CREATE INDEX IF NOT EXISTS idx_country_locations_name ON country_locations(country_name);
        """))
    
    print("✓ 表结构创建完成\n")

def import_table_from_csv(engine, table_name: str, csv_path: Path):
    """从CSV文件导入数据到表"""
    if not csv_path.exists():
        print(f"  ⚠ 跳过: {csv_path.name} 不存在")
        return 0
    
    print(f"  导入 {csv_path.name} → {table_name}...")
    
    # CSV 列名到数据库列名的映射（仅用于 shipments_raw）
    csv_to_db_mapping = {
        'Date': 'date',
        'Importer Name': 'importer_name',
        'Exporter Name': 'exporter_name',
        'HS Code': 'hs_code',
        'Product (English)': 'product_english',
        'Product Description': 'product_description',
        'Weight (kg)': 'weight_kg',
        'Quantity': 'quantity',
        'Quantity Unit': 'quantity_unit',
        'Total Value (USD)': 'total_value_usd',
        'Unit Price per kg (USD)': 'unit_price_per_kg',
        'Unit Price per item (USD)': 'unit_price_per_item',
        'Country of Origin': 'country_of_origin',
        'Destination Country': 'destination_country',
        'Port of Departure': 'port_of_departure',
        'Port of Arrival': 'port_of_arrival',
        'Import/Export': 'import_export',
        'Transport Mode': 'transport_mode',
        'Trade Term (Incoterm)': 'trade_term',
    }
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    if not rows:
        print(f"  ⚠ {csv_path.name} 为空")
        return 0
    
    csv_fieldnames = list(rows[0].keys())
    
    # 对于 shipments_raw，使用映射后的列名；其他表直接使用 CSV 列名
    if table_name == 'shipments_raw':
        db_fieldnames = [csv_to_db_mapping.get(f, f.lower().replace(' ', '_')) for f in csv_fieldnames]
    else:
        db_fieldnames = csv_fieldnames
    
    imported = 0
    
    with engine.begin() as conn:
        for row in rows:
            try:
                # 构建值字典：对于 shipments_raw，使用映射；其他表直接使用
                if table_name == 'shipments_raw':
                    values = {db_fieldnames[i]: (row.get(csv_fieldnames[i], '') or None) 
                             for i in range(len(csv_fieldnames))}
                else:
                    values = {f: (row.get(f, '') or None) for f in csv_fieldnames}
                
                # 构建 SQL：列名用双引号包裹（处理可能的空格）
                columns = ', '.join([f'"{f}"' for f in db_fieldnames])
                placeholders = ', '.join([f':{f}' for f in db_fieldnames])
                
                if table_name == 'monthly_company_flows':
                    update_clause = ', '.join([f'"{f}" = EXCLUDED."{f}"' for f in db_fieldnames if f != 'created_at'])
                    sql = f"""
                        INSERT INTO {table_name} ({columns})
                        VALUES ({placeholders})
                        ON CONFLICT (year_month, exporter_name, importer_name) 
                        DO UPDATE SET {update_clause}
                    """
                elif table_name in ['hs_code_categories', 'country_locations']:
                    update_clause = ', '.join([f'"{f}" = EXCLUDED."{f}"' for f in db_fieldnames if f not in ['created_at', db_fieldnames[0]]])
                    sql = f"""
                        INSERT INTO {table_name} ({columns})
                        VALUES ({placeholders})
                        ON CONFLICT ({db_fieldnames[0]}) 
                        DO UPDATE SET {update_clause}, updated_at = CURRENT_TIMESTAMP
                    """
                else:
                    sql = f'INSERT INTO {table_name} ({columns}) VALUES ({placeholders})'
                
                conn.execute(text(sql), values)
                imported += 1
            except Exception as e:
                print(f"  ⚠ 导入记录失败: {e}")
                continue
    
    print(f"  ✓ 成功导入 {imported} 条记录")
    return imported

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    processed_tables_dir = project_root / "processed_tables"
    clear_first = '--clear' in sys.argv
    
    print("=" * 60)
    print("导入预处理表到 Railway 数据库")
    print("=" * 60)
    if clear_first:
        print("⚠ 模式: 清空后重新导入\n")
    else:
        print("模式: 增量导入\n")
    
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✓ 数据库连接成功\n")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        sys.exit(1)
    
    if clear_first:
        clear_tables(engine)
    
    create_tables(engine)
    
    if not processed_tables_dir.exists():
        print(f"❌ 错误: 目录不存在: {processed_tables_dir}")
        sys.exit(1)
    
    print("开始导入数据...\n")
    
    total_imported = 0
    for table_name, csv_file in [
        ('shipments_raw', 'shipments_raw.csv'),
        ('monthly_company_flows', 'monthly_company_flows.csv'),
        ('hs_code_categories', 'hs_code_categories.csv'),
        ('country_locations', 'country_locations.csv'),
    ]:
        print(f"表: {table_name}")
        count = import_table_from_csv(engine, table_name, processed_tables_dir / csv_file)
        total_imported += count
        print()
    
    print("=" * 60)
    print("导入完成!")
    print(f"总共导入: {total_imported} 条记录\n")
    
    print("各表记录数:")
    with engine.connect() as conn:
        for table in ['shipments_raw', 'monthly_company_flows', 'hs_code_categories', 'country_locations']:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            print(f"  {table}: {result.scalar()} 条")
