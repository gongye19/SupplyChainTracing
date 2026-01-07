#!/bin/bash

echo "=== Supply Chain Platform 启动脚本 ==="

# 1. 启动数据库
echo "1. 启动数据库服务..."
docker-compose up -d db

# 2. 等待数据库就绪
echo "2. 等待数据库就绪..."
until docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
  echo "   等待数据库启动..."
  sleep 2
done
echo "   ✓ 数据库已就绪"

# 3. 检查是否需要导入数据
echo "3. 检查数据..."
TRANSACTION_COUNT=$(docker-compose exec -T db psql -U postgres -d supplychain -t -c "SELECT COUNT(*) FROM transactions;" 2>/dev/null | tr -d ' ')

if [ -z "$TRANSACTION_COUNT" ] || [ "$TRANSACTION_COUNT" = "0" ]; then
  echo "   数据库为空，需要导入数据"
  echo "   请运行: python backend/scripts/import_data_local.py"
  echo ""
  read -p "   是否现在导入数据? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   正在导入数据..."
    cd backend
    python scripts/import_data_local.py
    cd ..
    echo "   ✓ 数据导入完成"
  else
    echo "   跳过数据导入，你可以稍后运行: python backend/scripts/import_data_local.py"
  fi
else
  echo "   ✓ 数据库已有 $TRANSACTION_COUNT 条交易记录"
fi

# 4. 启动所有服务
echo "4. 启动所有服务..."
docker-compose up -d

echo ""
echo "=== 启动完成 ==="
echo ""
echo "访问地址:"
echo "  - 前端应用: http://localhost:3001"
echo "  - API文档:  http://localhost:8001/docs"
echo "  - PgAdmin:   http://localhost:5051"
echo ""
echo "查看日志: docker-compose logs -f"
echo "停止服务: docker-compose down"

