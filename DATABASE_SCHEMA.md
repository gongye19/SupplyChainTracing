# 数据库表结构文档

## 概述

本系统使用 4 个核心表来管理供应链数据：

1. **categories** - 物料/品类表
2. **companies** - 公司表
3. **locations** - 位置表（统一存储国家和城市位置）
4. **transactions** - 交易表

---

## 1. categories 表（物料表）

### 用途
存储产品品类信息，用于分类交易记录。

### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(50) | PRIMARY KEY | 品类ID |
| name | VARCHAR(100) | UNIQUE, NOT NULL | 品类名称（唯一） |
| display_name | VARCHAR(100) | NOT NULL | 显示名称 |
| color | VARCHAR(7) | NOT NULL | 颜色代码（用于地图显示） |
| icon | VARCHAR(50) | | 图标名称 |
| description | TEXT | | 描述 |
| sort_order | INTEGER | DEFAULT 0 | 排序顺序 |
| is_active | BOOLEAN | DEFAULT TRUE | 是否激活 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

### 示例数据
- Equipment (设备)
- Raw Material (原材料)
- Logic (逻辑芯片)
- Memory (存储芯片)

---

## 2. companies 表（公司表）

### 用途
存储公司基本信息，包括公司名称、所在国家、城市等。

### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(50) | PRIMARY KEY | 公司ID |
| name | VARCHAR(200) | NOT NULL | 公司名称 |
| country_code | VARCHAR(3) | NOT NULL | 国家代码（ISO 3位代码） |
| country_name | VARCHAR(100) | NOT NULL | 国家名称 |
| city | VARCHAR(100) | NOT NULL | 城市名称 |
| type | VARCHAR(20) | NOT NULL, CHECK | 公司类型：'importer', 'exporter', 'both' |
| industry | VARCHAR(100) | | 行业 |
| website | VARCHAR(255) | | 网站 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

### 约束
- `type` 字段只能是：'importer'（进口商）、'exporter'（出口商）、'both'（两者）

### 索引
- `idx_companies_country` - 按国家代码
- `idx_companies_city` - 按国家代码和城市（复合索引）
- `idx_companies_type` - 按公司类型

---

## 3. locations 表（位置表）

### 用途
统一存储所有位置信息，包括国家位置和城市位置。作为地理数据字典，供公司和交易记录引用。

### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(100) | PRIMARY KEY | 位置ID（国家代码或 国家代码_城市名） |
| type | VARCHAR(20) | NOT NULL, CHECK | 位置类型：'country'（国家）或 'city'（城市） |
| country_code | VARCHAR(3) | NOT NULL | 国家代码 |
| country_name | VARCHAR(100) | NOT NULL | 国家名称 |
| city | VARCHAR(100) | | 城市名称（type='city' 时必填，type='country' 时为 NULL） |
| latitude | DECIMAL(10, 7) | NOT NULL | 纬度 |
| longitude | DECIMAL(10, 7) | NOT NULL | 经度 |
| region | VARCHAR(50) | | 区域（如：East Asia, Western Europe） |
| continent | VARCHAR(50) | | 大洲（如：Asia, Europe） |
| address | TEXT | | 详细地址（可选） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

### 约束
- `type` 字段只能是：'country'（国家）或 'city'（城市）
- `(country_code, city)` 唯一约束：同一国家的同一城市只能有一条记录
- 国家位置：`type='country'` 时，`city` 必须为 NULL
- 城市位置：`type='city'` 时，`city` 必须不为 NULL

### 索引
- `idx_locations_type` - 按位置类型
- `idx_locations_country_code` - 按国家代码
- `idx_locations_country_city` - 按国家代码和城市（复合索引）
- `idx_locations_location` - 按经纬度（用于地理查询）
- `idx_locations_type_country` - 按类型和国家代码（复合索引）

### 数据示例

**国家位置：**
```
id: 'TW', type: 'country', country_code: 'TW', country_name: 'Taiwan', 
city: NULL, latitude: 25.0330, longitude: 121.5654
```

**城市位置：**
```
id: 'TW_Taipei', type: 'city', country_code: 'TW', country_name: 'Taiwan',
city: 'Taipei', latitude: 25.0330, longitude: 121.5654
```

### 关联关系
- 公司通过 `companies.country_code` 和 `companies.city` 关联到 `locations` 表
- 查询公司位置时：优先查找城市位置（`type='city'`），如果不存在则回退到国家位置（`type='country'`）

---

## 4. transactions 表（交易表）

### 用途
存储供应链交易记录，包括出口商、进口商、物料、数量、价格等信息。

### 表结构

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(50) | PRIMARY KEY | 交易ID |
| exporter_company_id | VARCHAR(50) | FK, NULL | 出口公司ID（外键到 companies.id） |
| importer_company_id | VARCHAR(50) | FK, NULL | 进口公司ID（外键到 companies.id） |
| origin_country_code | VARCHAR(3) | NOT NULL | 起点国家代码 |
| origin_country_name | VARCHAR(100) | NOT NULL | 起点国家名称 |
| destination_country_code | VARCHAR(3) | NOT NULL | 终点国家代码 |
| destination_country_name | VARCHAR(100) | NOT NULL | 终点国家名称 |
| material | VARCHAR(200) | NOT NULL | 材料名称 |
| category_id | VARCHAR(50) | FK, NOT NULL | 品类ID（外键到 categories.id） |
| quantity | DECIMAL(15, 2) | NOT NULL | 数量 |
| unit | VARCHAR(50) | | 单位 |
| price | DECIMAL(15, 2) | NOT NULL | 单价 |
| total_value | DECIMAL(20, 2) | NOT NULL | 总价值 |
| transaction_date | TIMESTAMP | NOT NULL | 交易日期 |
| status | VARCHAR(20) | DEFAULT 'completed', CHECK | 状态：'completed', 'in-transit', 'pending', 'cancelled' |
| notes | TEXT | | 备注 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

### 约束
- `status` 字段只能是：'completed'（已完成）、'in-transit'（运输中）、'pending'（待处理）、'cancelled'（已取消）
- `exporter_company_id` 和 `importer_company_id` 可以为 NULL（如果公司信息缺失）
- `category_id` 不能为 NULL（必须关联到品类）

### 外键关系
- `exporter_company_id` → `companies.id` (ON DELETE SET NULL)
- `importer_company_id` → `companies.id` (ON DELETE SET NULL)
- `category_id` → `categories.id` (ON DELETE RESTRICT)

### 索引
- `idx_transaction_date` - 按交易日期
- `idx_transaction_category` - 按品类
- `idx_transaction_origin_country` - 按起点国家
- `idx_transaction_destination_country` - 按终点国家
- `idx_transaction_exporter_company` - 按出口公司
- `idx_transaction_importer_company` - 按进口公司
- `idx_transaction_status` - 按状态
- `idx_transaction_total_value` - 按总价值
- `idx_date_category` - 按日期和品类（复合索引）
- `idx_country_pair` - 按起点和终点国家（复合索引）

---

## 表关系图

```
categories (1) ──< (N) transactions
companies (1) ──< (N) transactions (exporter_company_id)
companies (1) ──< (N) transactions (importer_company_id)
locations (1) ──< (N) companies (通过 country_code + city 关联)
```

## 查询示例

### 查询公司及其位置
```sql
SELECT 
    c.id,
    c.name,
    c.city,
    l.latitude,
    l.longitude
FROM companies c
LEFT JOIN locations l ON l.country_code = c.country_code 
    AND l.city = c.city 
    AND l.type = 'city'
WHERE c.id = 'company_id';
```

### 查询交易记录（包含公司信息）
```sql
SELECT 
    t.id,
    t.material,
    t.total_value,
    exporter.name AS exporter_name,
    importer.name AS importer_name,
    cat.display_name AS category_name
FROM transactions t
LEFT JOIN companies exporter ON exporter.id = t.exporter_company_id
LEFT JOIN companies importer ON importer.id = t.importer_company_id
LEFT JOIN categories cat ON cat.id = t.category_id
WHERE t.transaction_date >= '2024-01-01';
```

---

## 注意事项

1. **位置查询策略**：
   - 查询公司位置时，优先使用城市位置（`type='city'`）
   - 如果城市位置不存在，回退到国家位置（`type='country'`）

2. **数据完整性**：
   - 所有公司必须有 `city` 字段
   - 所有位置必须有对应的 `locations` 记录（至少是国家位置）

3. **性能优化**：
   - 使用复合索引优化常用查询（如：国家+城市、日期+品类）
   - 位置查询使用空间索引（latitude, longitude）

