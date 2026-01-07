#!/bin/bash

echo "=== 检查数据库数据 ==="

# 检查数据库连接
echo "1. 检查数据库连接..."
docker-compose exec -T db psql -U postgres -d supplychain -c "SELECT version();" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ 数据库连接正常"
else
    echo "   ✗ 数据库连接失败"
    exit 1
fi

# 检查品类数据
echo "2. 检查品类数据..."
CATEGORY_COUNT=$(docker-compose exec -T db psql -U postgres -d supplychain -t -c "SELECT COUNT(*) FROM categories;" 2>/dev/null | tr -d ' ')
echo "   品类数量: $CATEGORY_COUNT"
if [ "$CATEGORY_COUNT" != "0" ] && [ ! -z "$CATEGORY_COUNT" ]; then
    docker-compose exec -T db psql -U postgres -d supplychain -c "SELECT id, display_name FROM categories;"
else
    echo "   ⚠ 没有品类数据"
fi

# 检查国家数据
echo ""
echo "3. 检查国家数据..."
COUNTRY_COUNT=$(docker-compose exec -T db psql -U postgres -d supplychain -t -c "SELECT COUNT(*) FROM country_locations;" 2>/dev/null | tr -d ' ')
echo "   国家数量: $COUNTRY_COUNT"
if [ "$COUNTRY_COUNT" != "0" ] && [ ! -z "$COUNTRY_COUNT" ]; then
    docker-compose exec -T db psql -U postgres -d supplychain -c "SELECT country_code, country_name FROM country_locations LIMIT 10;"
else
    echo "   ⚠ 没有国家数据"
fi

# 检查交易数据
echo ""
echo "4. 检查交易数据..."
TRANSACTION_COUNT=$(docker-compose exec -T db psql -U postgres -d supplychain -t -c "SELECT COUNT(*) FROM transactions;" 2>/dev/null | tr -d ' ')
echo "   交易数量: $TRANSACTION_COUNT"
if [ "$TRANSACTION_COUNT" != "0" ] && [ ! -z "$TRANSACTION_COUNT" ]; then
    docker-compose exec -T db psql -U postgres -d supplychain -c "SELECT id, material, category_id, total_value FROM transactions LIMIT 5;"
else
    echo "   ⚠ 没有交易数据，需要导入数据"
    echo "   运行: python backend/scripts/import_data_local.py"
fi

# 检查公司数据
echo ""
echo "5. 检查公司数据..."
COMPANY_COUNT=$(docker-compose exec -T db psql -U postgres -d supplychain -t -c "SELECT COUNT(*) FROM companies;" 2>/dev/null | tr -d ' ')
echo "   公司数量: $COMPANY_COUNT"
if [ "$COMPANY_COUNT" != "0" ] && [ ! -z "$COMPANY_COUNT" ]; then
    docker-compose exec -T db psql -U postgres -d supplychain -c "SELECT id, name, country_code FROM companies LIMIT 5;"
else
    echo "   ⚠ 没有公司数据"
fi

echo ""
echo "=== 检查完成 ==="

