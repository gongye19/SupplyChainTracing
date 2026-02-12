# Database Schema And Data Flow

本文档说明当前项目数据库结构、字段定义、数据导入来源与目标、以及后端 API 的读取路径。

## 1) 当前数据库使用概览

当前前端主功能主要依赖两张聚合表：

- `country_origin_trade_stats`（主 Trade Map 交易流向）
- `country_monthly_trade_stats`（Country Statistics 统计分析）

另外有两类“兼容接口”会尝试读取旧表（表不存在时返回空数组）：

- `hs_code_categories`
- `port_locations`

## 2) 核心表结构（当前主流程）

### 2.1 `country_origin_trade_stats`

用途：主地图（Trade Map）国家到国家流向数据源。

字段：

- `id` `VARCHAR(150)` 主键
- `hs_code` `VARCHAR(6)` 非空
- `year` `INTEGER` 非空
- `month` `INTEGER` 非空
- `origin_country_code` `VARCHAR(3)` 非空
- `destination_country_code` `VARCHAR(3)` 非空
- `industry` `VARCHAR(50)`
- `weight` `DECIMAL(20,2)`
- `quantity` `DECIMAL(20,2)`
- `sum_of_usd` `DECIMAL(20,2)`
- `weight_avg_price` `DECIMAL(15,4)`
- `quantity_avg_price` `DECIMAL(15,4)`
- `trade_count` `INTEGER`
- `amount_share_pct` `DECIMAL(10,8)`
- `created_at` `TIMESTAMP` 默认 `CURRENT_TIMESTAMP`
- `updated_at` `TIMESTAMP` 默认 `CURRENT_TIMESTAMP`

约束/索引：

- 唯一约束：`(hs_code, year, month, origin_country_code, destination_country_code)`
- 常用索引：`hs_code`、`year/month`、`origin_country_code`、`destination_country_code`、`industry`

---

### 2.2 `country_monthly_trade_stats`

用途：Country Statistics 页面统计/趋势/国家排行数据源。

字段：

- `id` `VARCHAR(100)` 主键
- `hs_code` `VARCHAR(6)` 非空
- `year` `INTEGER` 非空
- `month` `INTEGER` 非空
- `country_code` `VARCHAR(3)` 非空
- `industry` `VARCHAR(50)`
- `weight` `DECIMAL(20,2)`
- `quantity` `DECIMAL(20,2)`
- `sum_of_usd` `DECIMAL(20,2)`
- `weight_avg_price` `DECIMAL(15,4)`
- `quantity_avg_price` `DECIMAL(15,4)`
- `trade_count` `INTEGER`
- `amount_share_pct` `DECIMAL(10,8)`
- `created_at` `TIMESTAMP` 默认 `CURRENT_TIMESTAMP`
- `updated_at` `TIMESTAMP` 默认 `CURRENT_TIMESTAMP`

约束/索引：

- 唯一约束：`(hs_code, year, month, country_code)`
- 常用索引：`hs_code`、`year/month`、`country_code`、`industry`

## 3) 兼容/旧表（可不存在）

这些表当前不是新数据主链路，但兼容 API 仍会尝试读取：

- `hs_code_categories`
- `port_locations`

对应路由已做异常保护：若表不存在，返回空数组，避免 500。

## 4) 数据从哪里导入到哪里

## 4.1 CountryOfOrigin -> `country_origin_trade_stats`

来源目录：

- `data/SemiConductor/CountryOfOrigin/*.json`

文件名规则：

- `{hs_code}_{year}_{month}.json`，示例：`854231_2021_03.json`

导入脚本：

- `backend/scripts/import_country_origin.py`
- 或统一批量脚本 `backend/scripts/batch_import_all.py`

映射关系（JSON -> 表）：

- 文件名 `hs_code/year/month` -> 表字段 `hs_code/year/month`
- 第一层键（原产国） -> `origin_country_code`
- 第二层键（目的国） -> `destination_country_code`
- `weight` -> `weight`
- `quantity` -> `quantity`
- `sumOfUSD` -> `sum_of_usd`
- `weightAvgPrice` -> `weight_avg_price`
- `quantityAvgPrice` -> `quantity_avg_price`
- `tradeCount` -> `trade_count`
- `amountSharePct` -> `amount_share_pct`

过滤规则（`import_country_origin.py`）：

- `weight == 0` 或 `quantity == 0` 或 `countryCode == 'N/A'` 过滤
- 原产国/目的国代码为 `N/A` 过滤

写入策略：

- `ON CONFLICT (...) DO UPDATE` 增量更新

---

## 4.2 country_monthly_industry_data -> `country_monthly_trade_stats`

来源目录：

- `data/country_monthly_industry_data/SemiConductor/*.json`

文件名规则：

- `{hs_code}_{year}.json`，示例：`848610_2022.json`

导入脚本：

- `backend/scripts/import_country_trade_stats.py`
- 或统一批量脚本 `backend/scripts/batch_import_all.py`

映射关系（JSON -> 表）：

- 文件名 `hs_code/year` + 月份键 `01..12` -> `hs_code/year/month`
- `countryCode` -> `country_code`
- `weight` -> `weight`
- `quantity` -> `quantity`
- `sumOfUSD` -> `sum_of_usd`
- `weightAvgPrice` -> `weight_avg_price`
- `quantityAvgPrice` -> `quantity_avg_price`
- `tradeCount` -> `trade_count`
- `amountSharePct` -> `amount_share_pct`

过滤规则：

- `countryCode` 为空或 `N/A` 跳过

写入策略：

- `ON CONFLICT (...) DO UPDATE` 增量更新

## 5) API 读取哪些表

### 5.1 主地图相关

- `GET /api/shipments` -> 读取 `country_origin_trade_stats`

支持过滤：

- `start_year_month/end_year_month`
- `country`（匹配 origin 或 destination，必须传国家代码/ISO3）
- `hs_code` 或 `hs_code_prefix`
- `industry`

---

### 5.2 Country Statistics 相关

- `GET /api/country-trade-stats` -> `country_monthly_trade_stats`
- `GET /api/country-trade-stats/summary` -> `country_monthly_trade_stats`（聚合）
- `GET /api/country-trade-stats/trends` -> `country_monthly_trade_stats`（按月趋势）
- `GET /api/country-trade-stats/top-countries` -> `country_monthly_trade_stats`（国家排行）

---

### 5.3 兼容接口（表可不存在）

- `GET /api/hs-code-categories` -> `hs_code_categories`
- `GET /api/port-locations` -> `port_locations`
- `GET /api/port-locations/countries` -> `port_locations`
- `GET /api/country-locations` -> `port_locations`

> 若上述旧表不存在，接口返回空数组。
> 仅“表不存在”会返回空；其他数据库异常会返回 500，便于定位问题。

## 6) 清理与重建

清理旧表脚本：

- `backend/scripts/clean_old_tables.py`

会删除旧表：

- `shipments_raw`
- `monthly_company_flows`
- `hs_code_categories`
- `port_locations`

并可清空新表：

- `country_origin_trade_stats`
- `country_monthly_trade_stats`

## 7) 一键批量导入建议

推荐使用：

- `backend/scripts/batch_import_all.py`

特点：

- 自动建表
- 可选 `--clear` 清空后重导
- 批量写入（默认较大 batch）
- 同时导入两类新数据
- 与 `import_country_origin.py` 使用相同过滤规则（`weight=0` 或 `quantity=0` 或 `countryCode='N/A'` 过滤）

## 8) 注意事项

- `backend/app/main.py` 已不再注册历史路由（`/api/transactions`、`/api/companies`、`/api/locations`、`/api/monthly-company-flows`）。
- `backend/init.sql` 中仍包含部分历史业务表定义（`categories/companies/locations/transactions` 等）；这些并非当前新数据主链路的核心依赖。
- 当前前端在 `hs_code_categories/port_locations` 返回空时，已有降级逻辑（会从 `shipments` 动态补齐部分展示信息）。

