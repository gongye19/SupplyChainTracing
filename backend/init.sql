-- 创建品类表
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL,
    icon VARCHAR(50),
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建公司表
CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    country_name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('importer', 'exporter', 'both')),
    industry VARCHAR(100),
    website VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建位置表（统一存储国家和城市位置）
CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(100) PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('country', 'city')),
    country_code VARCHAR(3) NOT NULL,
    country_name VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    region VARCHAR(50),
    continent VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_location_country_city UNIQUE (country_code, city)
);

-- 创建交易表
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    exporter_company_id VARCHAR(50) REFERENCES companies(id) ON DELETE SET NULL,
    importer_company_id VARCHAR(50) REFERENCES companies(id) ON DELETE SET NULL,
    origin_country_code VARCHAR(3) NOT NULL,
    origin_country_name VARCHAR(100) NOT NULL,
    destination_country_code VARCHAR(3) NOT NULL,
    destination_country_name VARCHAR(100) NOT NULL,
    material VARCHAR(200) NOT NULL,
    category_id VARCHAR(50) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    quantity DECIMAL(15, 2) NOT NULL,
    unit VARCHAR(50),
    price DECIMAL(15, 2) NOT NULL,
    total_value DECIMAL(20, 2) NOT NULL,
    transaction_date TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'in-transit', 'pending', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country_code);
CREATE INDEX IF NOT EXISTS idx_companies_city ON companies(country_code, city);
CREATE INDEX IF NOT EXISTS idx_companies_type ON companies(type);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(type);
CREATE INDEX IF NOT EXISTS idx_locations_country_code ON locations(country_code);
CREATE INDEX IF NOT EXISTS idx_locations_country_city ON locations(country_code, city);
CREATE INDEX IF NOT EXISTS idx_locations_location ON locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_locations_type_country ON locations(type, country_code);
CREATE INDEX IF NOT EXISTS idx_transaction_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transaction_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_origin_country ON transactions(origin_country_code);
CREATE INDEX IF NOT EXISTS idx_transaction_destination_country ON transactions(destination_country_code);
CREATE INDEX IF NOT EXISTS idx_transaction_exporter_company ON transactions(exporter_company_id);
CREATE INDEX IF NOT EXISTS idx_transaction_importer_company ON transactions(importer_company_id);
CREATE INDEX IF NOT EXISTS idx_transaction_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transaction_total_value ON transactions(total_value);
CREATE INDEX IF NOT EXISTS idx_date_category ON transactions(transaction_date, category_id);
CREATE INDEX IF NOT EXISTS idx_country_pair ON transactions(origin_country_code, destination_country_code);

-- 插入品类种子数据
INSERT INTO categories (id, name, display_name, color, icon, sort_order) VALUES
('equipment', 'Equipment', '设备', '#5856D6', 'settings', 1),
('raw_material', 'Raw Material', '原材料', '#30B0C7', 'package', 2),
('logic', 'Logic', '逻辑芯片', '#007AFF', 'cpu', 3),
('memory', 'Memory', '存储', '#FF9500', 'database', 4)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- 插入位置数据（国家和城市）
-- 国家位置（type = 'country', city = NULL）
INSERT INTO locations (id, type, country_code, country_name, city, latitude, longitude, region, continent) VALUES
('TW', 'country', 'TW', 'Taiwan', NULL, 25.0330, 121.5654, 'East Asia', 'Asia'),
('KR', 'country', 'KR', 'South Korea', NULL, 37.5665, 126.9780, 'East Asia', 'Asia'),
('US', 'country', 'US', 'United States', NULL, 38.9072, -77.0369, 'North America', 'North America'),
('NL', 'country', 'NL', 'Netherlands', NULL, 52.3676, 4.9041, 'Western Europe', 'Europe'),
('CN', 'country', 'CN', 'China', NULL, 39.9042, 116.4074, 'East Asia', 'Asia'),
('DE', 'country', 'DE', 'Germany', NULL, 52.5200, 13.4050, 'Central Europe', 'Europe'),
('JP', 'country', 'JP', 'Japan', NULL, 35.6762, 139.6503, 'East Asia', 'Asia')
ON CONFLICT (country_code, city) DO NOTHING;

-- 城市位置（type = 'city'）
INSERT INTO locations (id, type, country_code, country_name, city, latitude, longitude, region, continent) VALUES
('TW_Taipei', 'city', 'TW', 'Taiwan', 'Taipei', 25.0330, 121.5654, 'East Asia', 'Asia'),
('TW_Hsinchu', 'city', 'TW', 'Taiwan', 'Hsinchu', 24.8036, 120.9686, 'East Asia', 'Asia'),
('KR_Seoul', 'city', 'KR', 'South Korea', 'Seoul', 37.5665, 126.9780, 'East Asia', 'Asia'),
('US_Cupertino', 'city', 'US', 'United States', 'Cupertino', 37.3230, -122.0322, 'North America', 'North America'),
('US_NewYork', 'city', 'US', 'United States', 'New York', 40.7128, -74.0060, 'North America', 'North America'),
('US_SanFrancisco', 'city', 'US', 'United States', 'San Francisco', 37.7749, -122.4194, 'North America', 'North America'),
('CN_Beijing', 'city', 'CN', 'China', 'Beijing', 39.9042, 116.4074, 'East Asia', 'Asia'),
('CN_Shanghai', 'city', 'CN', 'China', 'Shanghai', 31.2304, 121.4737, 'East Asia', 'Asia'),
('CN_Shenzhen', 'city', 'CN', 'China', 'Shenzhen', 22.5431, 114.0579, 'East Asia', 'Asia'),
('DE_Berlin', 'city', 'DE', 'Germany', 'Berlin', 52.5200, 13.4050, 'Central Europe', 'Europe'),
('DE_Munich', 'city', 'DE', 'Germany', 'Munich', 48.1351, 11.5820, 'Central Europe', 'Europe'),
('JP_Tokyo', 'city', 'JP', 'Japan', 'Tokyo', 35.6762, 139.6503, 'East Asia', 'Asia'),
('NL_Amsterdam', 'city', 'NL', 'Netherlands', 'Amsterdam', 52.3676, 4.9041, 'Western Europe', 'Europe')
ON CONFLICT (country_code, city) DO NOTHING;

-- 创建国家月度贸易统计表
CREATE TABLE IF NOT EXISTS country_monthly_trade_stats (
    id VARCHAR(100) PRIMARY KEY,
    hs_code VARCHAR(6) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    industry VARCHAR(50),
    
    -- 统计数据
    weight DECIMAL(20, 2),
    quantity DECIMAL(20, 2),
    sum_of_usd DECIMAL(20, 2),
    weight_avg_price DECIMAL(15, 4),
    quantity_avg_price DECIMAL(15, 4),
    trade_count INTEGER,
    amount_share_pct DECIMAL(10, 8),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_hs_year_month_country UNIQUE (hs_code, year, month, country_code)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_cmts_hs_code ON country_monthly_trade_stats(hs_code);
CREATE INDEX IF NOT EXISTS idx_cmts_year_month ON country_monthly_trade_stats(year, month);
CREATE INDEX IF NOT EXISTS idx_cmts_country ON country_monthly_trade_stats(country_code);
CREATE INDEX IF NOT EXISTS idx_cmts_industry ON country_monthly_trade_stats(industry);
CREATE INDEX IF NOT EXISTS idx_cmts_hs_year ON country_monthly_trade_stats(hs_code, year);
CREATE INDEX IF NOT EXISTS idx_cmts_year_month_country ON country_monthly_trade_stats(year, month, country_code);

