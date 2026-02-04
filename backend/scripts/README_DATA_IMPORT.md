# 数据导入指南

## 数据源说明

### 1. CountryOfOrigin 数据（交易流向数据）
- **位置**: `data/SemiConductor/CountryOfOrigin/`
- **用途**: 主地图视图（Map View）- 显示国家对之间的贸易流向
- **结构**: `{原产国代码: {目的地国家代码: [统计数据]}}`
- **文件名**: `{hs_code}_{year}_{month}.json`（如 `854231_2021_01.json`）
- **导入脚本**: `import_country_origin.py`
- **目标表**: `country_origin_trade_stats`
- **过滤规则**: 自动过滤 `weight=0`、`quantity=0`、`countryCode="N/A"` 的数据

### 2. country_monthly_industry_data 数据（国家统计数据）
- **位置**: `data/country_monthly_industry_data/SemiConductor/`
- **用途**: Country Statistics 视图 - 显示各国的总体贸易统计
- **结构**: `{月份: [国家统计数据]}`（只有国家代码，无原产国-目的地国家关系）
- **文件名**: `{hs_code}_{year}.json`（如 `854231_2021.json`）
- **导入脚本**: `import_country_trade_stats.py`
- **目标表**: `country_monthly_trade_stats`

## 清理和导入步骤

### 方式一：使用自动化脚本（推荐）

```bash
cd backend/scripts
chmod +x clean_and_import_all.sh
./clean_and_import_all.sh
```

### 方式二：手动执行

#### 1. 清理旧数据

```bash
cd backend/scripts
python3 clean_old_tables.py
```

这会：
- 删除旧表：`shipments_raw`, `monthly_company_flows`, `hs_code_categories`, `port_locations`
- 清空新表：`country_origin_trade_stats`, `country_monthly_trade_stats`

#### 2. 导入 CountryOfOrigin 数据（主地图视图）

```bash
cd backend/scripts
python3 import_country_origin.py --clear
```

这会：
- 创建 `country_origin_trade_stats` 表
- 导入 `data/SemiConductor/CountryOfOrigin/` 目录下的所有 JSON 文件
- 自动过滤无效数据（weight=0, quantity=0, countryCode="N/A"）

#### 3. 导入 country_monthly_industry_data 数据（Country Statistics 视图）

```bash
cd backend/scripts
python3 import_country_trade_stats.py --clear
```

这会：
- 创建 `country_monthly_trade_stats` 表
- 导入 `data/country_monthly_industry_data/SemiConductor/` 目录下的所有 JSON 文件

## 环境变量配置

如果使用本地数据库（Docker Compose）：
```bash
export DATABASE_URL="postgresql://postgres:123456@localhost:5433/supplychain"
```

如果使用 Railway 数据库：
```bash
export DATABASE_URL="postgresql://postgres:密码@主机:端口/数据库名"
```

## 验证导入结果

```bash
# 检查数据量
python3 -c "
from sqlalchemy import create_engine, text
import os
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:123456@localhost:5433/supplychain')
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    result = conn.execute(text('SELECT COUNT(*) FROM country_origin_trade_stats'))
    print(f'country_origin_trade_stats: {result.scalar():,} 条记录')
    result = conn.execute(text('SELECT COUNT(*) FROM country_monthly_trade_stats'))
    print(f'country_monthly_trade_stats: {result.scalar():,} 条记录')
"
```

## 已删除的旧脚本

以下脚本已不再使用，已从代码库中删除：
- `preprocess_tables.py` - 预处理 CSV 数据
- `import_processed_tables.py` - 导入预处理后的 CSV 数据

## 注意事项

1. **数据过滤**: CountryOfOrigin 数据导入时会自动过滤无效数据
2. **数据量**: 两批数据都比较大，导入可能需要一些时间
3. **数据库空间**: 确保数据库有足够的存储空间
4. **备份**: 在生产环境操作前，建议先备份数据库

