# Supply Chain Intelligence Platform

全球供应链智能可视化平台，专注于半导体行业的供应链数据可视化与分析。

## 项目结构

```
supplychain/
├── docker-compose.yml          # 顶层Docker Compose配置
├── data/                       # 数据文件目录
│   └── synthetic_data.csv     # 交易数据CSV
├── backend/                    # 后端服务
│   ├── app/                    # FastAPI应用
│   ├── scripts/                # 脚本目录
│   │   └── import_data_local.py # 数据导入脚本（宿主机版本）
│   ├── Dockerfile
│   └── init.sql                # 数据库初始化脚本
├── frontend/                   # 前端应用
│   ├── components/            # React组件
│   ├── services/              # API服务
│   └── Dockerfile
└── database/                   # 数据库数据目录
    ├── data/                  # PostgreSQL数据
    └── pgadmin/               # PgAdmin数据
```

## 快速开始

### 方式一：手动启动（推荐）

#### 1. 启动数据库（仅启动数据库服务）

```bash
docker-compose up -d db
```

等待数据库完全启动（健康检查通过，约10-30秒）。

#### 2. 导入数据（在宿主机运行）

确保已安装Python依赖：

```bash
cd backend
pip install -r requirements.txt
```

运行导入脚本：

```bash
python scripts/import_data_local.py
```

或者指定CSV路径：

```bash
DATABASE_URL=postgresql://postgres:123456@localhost:5433/supplychain \
python scripts/import_data_local.py
```

#### 3. 启动所有服务

```bash
docker-compose up -d
```

这将启动：
- PostgreSQL 数据库 (端口 5433)
- FastAPI 后端服务 (端口 8000)
- React 前端服务 (端口 3000)
- PgAdmin (端口 5051)

### 4. 访问服务

- **前端应用**: http://localhost:3001
- **API文档**: http://localhost:8001/docs
- **PgAdmin**: http://localhost:5051
  - Email: `admin@example.com`
  - Password: `admin`

## 开发模式

### 后端开发

后端代码通过volume挂载，修改代码后会自动重载。

```bash
# 查看后端日志
docker-compose logs -f backend

# 重启后端服务
docker-compose restart backend
```

### 前端开发

前端代码通过volume挂载，修改代码后会自动重载。

```bash
# 查看前端日志
docker-compose logs -f frontend

# 重启前端服务
docker-compose restart frontend
```

## 数据管理

### 重新导入数据

```bash
# 停止服务（可选，仅停止数据库即可）
docker-compose stop backend frontend

# 清空数据库（可选）
docker-compose exec db psql -U postgres -d supplychain -c "TRUNCATE TABLE transactions, companies CASCADE;"

# 重新导入
python backend/scripts/import_data_local.py
```

### 查看数据库

```bash
# 使用psql
docker-compose exec db psql -U postgres -d supplychain

# 或使用PgAdmin Web界面
# http://localhost:5051
```

## 环境变量

### 后端

在 `docker-compose.yml` 中配置：
- `DATABASE_URL`: 数据库连接字符串
- `CORS_ORIGINS`: 允许的CORS源

### 前端

在 `docker-compose.yml` 中配置：
- `VITE_API_URL`: 后端API地址（默认: http://localhost:8000）

## 停止服务

```bash
# 停止所有服务
docker-compose down

# 停止并删除数据卷（谨慎使用）
docker-compose down -v
```

## 故障排除

### 数据库连接失败

确保数据库已完全启动：

```bash
docker-compose ps db
# 应该显示 "healthy"
```

### 导入数据失败

检查数据库是否可访问：

```bash
docker-compose exec db pg_isready -U postgres
```

检查CSV文件路径是否正确。

### 前端无法连接后端

检查后端服务是否运行：

```bash
curl http://localhost:8001/api/health
```

检查CORS配置是否正确。

## 技术栈

- **前端**: React 19 + TypeScript + Vite + D3.js + Recharts
- **后端**: FastAPI + SQLAlchemy + PostgreSQL
- **部署**: Docker + Docker Compose

