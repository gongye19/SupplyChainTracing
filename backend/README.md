# Supply Chain Backend

供应链数据可视化系统的后端服务。

## 技术栈

- FastAPI - Web框架
- PostgreSQL - 数据库
- SQLAlchemy - ORM
- Docker & Docker Compose - 容器化部署

## 快速开始

### 1. 启动服务

```bash
cd backend
docker-compose up -d
```

这将启动：
- PostgreSQL 数据库 (端口 5433)
- FastAPI 后端服务 (端口 8000)
- PgAdmin (端口 5051)

### 2. 导入数据

数据库初始化时会自动创建表结构和品类种子数据。

导入交易数据：

```bash
# 进入后端容器
docker exec -it supplychain_backend bash

# 运行导入脚本
python scripts/import_data.py
```

或者从宿主机运行：

```bash
docker exec -it supplychain_backend python scripts/import_data.py
```

### 3. 访问服务

- API 文档: http://localhost:8000/docs
- PgAdmin: http://localhost:5051
  - Email: admin@example.com
  - Password: admin

## API 端点

### 品类
- `GET /api/categories` - 获取所有品类
- `GET /api/categories/{id}` - 获取单个品类

### 交易
- `GET /api/transactions` - 查询交易记录（支持筛选和分页）
- `GET /api/transactions/stats` - 获取统计信息

### 公司
- `GET /api/companies` - 获取公司列表
- `GET /api/companies/{id}` - 获取单个公司

### 位置
- `GET /api/locations` - 获取位置列表（支持按类型和国家筛选）
- `GET /api/locations/countries` - 获取所有国家位置
- `GET /api/locations/cities` - 获取所有城市位置
- `GET /api/locations/{id}` - 获取单个位置
- `GET /api/locations/country/{code}/city/{city}` - 根据国家和城市获取位置

## 环境变量

在 `docker-compose.yml` 中配置：
- `DATABASE_URL` - 数据库连接字符串
- `CORS_ORIGINS` - 允许的CORS源

## 数据库结构

系统使用 4 个核心表：
- `categories` - 物料品类表
- `companies` - 公司表（包含城市字段）
- `locations` - 位置表（统一存储国家和城市位置）
- `transactions` - 交易表

详细结构见 `DATABASE_SCHEMA.md` 和 `init.sql`。

