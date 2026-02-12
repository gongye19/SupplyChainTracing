#!/bin/bash
# 清理旧数据并导入新数据的脚本

set -e

echo "=========================================="
echo "清理旧数据并批量导入新数据"
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

# 执行清理和批量导入（统一入口）
echo "1. 清理旧表和旧数据..."
cd "$BACKEND_DIR"
DATABASE_URL="$DATABASE_URL" python3 scripts/clean_old_tables.py || {
    echo "❌ 清理旧表失败"
    exit 1
}

echo ""
echo "2. 批量导入 CountryOfOrigin + country_monthly_industry_data..."
DATABASE_URL="$DATABASE_URL" python3 scripts/batch_import_all.py --clear || {
    echo "❌ 批量导入失败"
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

