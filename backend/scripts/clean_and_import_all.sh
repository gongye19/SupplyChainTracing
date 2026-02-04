#!/bin/bash
# 清理旧数据并导入新数据的脚本

set -e

echo "=========================================="
echo "清理旧数据并导入新数据"
echo "=========================================="
echo ""

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

# 数据库连接（Railway 数据库）
# 优先使用环境变量，如果没有则使用 Railway 公网地址
DATABASE_URL="${DATABASE_URL:-${DATABASE_PUBLIC_URL:-postgresql://postgres:MWXAjkGpQgosJuCgIPcRdudhiyAiXCRl@crossover.proxy.rlwy.net:42314/railway}}"

echo "数据库连接: ${DATABASE_URL}"
echo ""

# 检查数据库连接
echo "1. 检查数据库连接..."
python3 -c "
from sqlalchemy import create_engine, text
import sys
engine = create_engine('${DATABASE_URL}', pool_pre_ping=True)
try:
    with engine.connect() as conn:
        conn.execute(text('SELECT 1'))
    print('✓ 数据库连接成功')
except Exception as e:
    print(f'❌ 数据库连接失败: {e}')
    sys.exit(1)
" || exit 1

echo ""

# 删除旧表
echo "2. 删除旧的数据表..."
python3 -c "
from sqlalchemy import create_engine, text
engine = create_engine('${DATABASE_URL}', pool_pre_ping=True)
with engine.begin() as conn:
    # 删除旧表（如果存在）
    tables_to_drop = [
        'shipments_raw',
        'monthly_company_flows',
        'hs_code_categories',
        'port_locations'
    ]
    for table in tables_to_drop:
        try:
            conn.execute(text(f'DROP TABLE IF EXISTS {table} CASCADE'))
            print(f'  ✓ 删除表: {table}')
        except Exception as e:
            print(f'  ⚠ 删除表 {table} 失败: {e}')
print('✓ 旧表删除完成')
"

echo ""

# 清空新表（如果存在）
echo "3. 清空新表数据..."
python3 -c "
from sqlalchemy import create_engine, text
engine = create_engine('${DATABASE_URL}', pool_pre_ping=True)
with engine.begin() as conn:
    tables_to_clear = [
        'country_origin_trade_stats',
        'country_monthly_trade_stats'
    ]
    for table in tables_to_clear:
        try:
            conn.execute(text(f'TRUNCATE TABLE {table}'))
            print(f'  ✓ 清空表: {table}')
        except Exception as e:
            print(f'  ⚠ 清空表 {table} 失败（可能表不存在，稍后会创建）: {e}')
print('✓ 表清空完成')
"

echo ""

# 导入 CountryOfOrigin 数据
echo "4. 导入 CountryOfOrigin 数据（用于主地图视图）..."
cd "$BACKEND_DIR"
python3 scripts/import_country_origin.py --clear || {
    echo "❌ CountryOfOrigin 数据导入失败"
    exit 1
}

echo ""

# 导入 country_monthly_industry_data 数据
echo "5. 导入 country_monthly_industry_data 数据（用于 Country Statistics 视图）..."
cd "$BACKEND_DIR"
python3 scripts/import_country_trade_stats.py --clear || {
    echo "❌ country_monthly_industry_data 数据导入失败"
    exit 1
}

echo ""
echo "=========================================="
echo "✓ 所有数据导入完成！"
echo "=========================================="
echo ""
echo "数据统计:"
python3 -c "
from sqlalchemy import create_engine, text
engine = create_engine('${DATABASE_URL}', pool_pre_ping=True)
with engine.connect() as conn:
    # 统计 country_origin_trade_stats
    result = conn.execute(text('SELECT COUNT(*) FROM country_origin_trade_stats'))
    count1 = result.scalar()
    print(f'  country_origin_trade_stats: {count1:,} 条记录')
    
    # 统计 country_monthly_trade_stats
    result = conn.execute(text('SELECT COUNT(*) FROM country_monthly_trade_stats'))
    count2 = result.scalar()
    print(f'  country_monthly_trade_stats: {count2:,} 条记录')
"

