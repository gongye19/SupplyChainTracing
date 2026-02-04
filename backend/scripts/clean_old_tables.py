#!/usr/bin/env python3
"""
清理旧的数据表和导入脚本
删除 shipments_raw 相关的表和旧脚本
"""

import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# 数据库连接（Railway 数据库）
# 优先使用环境变量，如果没有则使用 Railway 公网地址
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    os.getenv(
        "DATABASE_PUBLIC_URL",
        "postgresql://postgres:MWXAjkGpQgosJuCgIPcRdudhiyAiXCRl@crossover.proxy.rlwy.net:42314/railway"
    )
)

def clean_old_tables():
    """删除旧的数据表"""
    print("=" * 60)
    print("清理旧的数据表")
    print("=" * 60)
    print()
    
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✓ 数据库连接成功\n")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        sys.exit(1)
    
    # 要删除的旧表
    old_tables = [
        'shipments_raw',
        'monthly_company_flows',
        'hs_code_categories',
        'port_locations'
    ]
    
    print("删除旧表...")
    with engine.begin() as conn:
        for table in old_tables:
            try:
                # 检查表是否存在
                result = conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = '{table}'
                    )
                """))
                exists = result.scalar()
                
                if exists:
                    conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
                    print(f"  ✓ 删除表: {table}")
                else:
                    print(f"  ℹ 表不存在，跳过: {table}")
            except Exception as e:
                print(f"  ⚠ 删除表 {table} 时出错: {e}")
    
    print("\n✓ 旧表清理完成\n")

def clean_old_data_tables():
    """清空新表数据（如果已存在）"""
    print("清空新表数据（如果已存在）...")
    
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    
    new_tables = [
        'country_origin_trade_stats',
        'country_monthly_trade_stats'
    ]
    
    with engine.begin() as conn:
        for table in new_tables:
            try:
                # 检查表是否存在
                result = conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = '{table}'
                    )
                """))
                exists = result.scalar()
                
                if exists:
                    conn.execute(text(f'TRUNCATE TABLE {table}'))
                    print(f"  ✓ 清空表: {table}")
                else:
                    print(f"  ℹ 表不存在，稍后会创建: {table}")
            except Exception as e:
                print(f"  ⚠ 清空表 {table} 时出错: {e}")
    
    print("✓ 新表数据清空完成\n")

if __name__ == "__main__":
    clean_old_tables()
    clean_old_data_tables()
    
    print("=" * 60)
    print("清理完成！")
    print("=" * 60)
    print()
    print("下一步：")
    print("1. 运行: python backend/scripts/import_country_origin.py --clear")
    print("2. 运行: python backend/scripts/import_country_trade_stats.py --clear")

