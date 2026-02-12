# 数据导入指南（单入口）

当前仅保留一个导入入口文件：

- `backend/scripts/batch_import_all.py`

## 使用方式

### 全量重建导入（推荐）

`--clear` 会在导入前清理数据库：

- 删除旧链路表：`shipments_raw`、`monthly_company_flows`、`hs_code_categories`、`port_locations`、`transactions`、`companies`、`locations`、`categories`
- 删除并重建目标表：`country_origin_trade_stats`、`country_monthly_trade_stats`

```bash
cd backend
python3 scripts/batch_import_all.py --clear
```

### 增量导入

```bash
cd backend
python3 scripts/batch_import_all.py
```

## 数据源

- `data/SemiConductor/CountryOfOrigin/*.json` -> `country_origin_trade_stats`
- `data/country_monthly_industry_data/SemiConductor/*.json` -> `country_monthly_trade_stats`

## 过滤规则（CountryOfOrigin）

- `weight == 0` 或 `quantity == 0` 或 `countryCode == 'N/A'` 会被过滤

## 环境变量

优先级：

1. `DATABASE_URL`
2. `DATABASE_PUBLIC_URL`
3. 脚本内置默认 Railway 地址

