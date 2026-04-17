from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# ── 旧版 Schema（保留，但不再有对应数据表） ──

class CategoryBase(BaseModel):
    id: str
    name: str
    display_name: str
    color: str
    icon: Optional[str] = None
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True

class Category(CategoryBase):
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class CompanyBase(BaseModel):
    id: str
    name: str
    country_code: str
    country_name: str
    city: str
    type: str
    industry: Optional[str] = None
    website: Optional[str] = None

class Company(CompanyBase):
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class LocationBase(BaseModel):
    id: str
    type: str
    country_code: str
    country_name: str
    city: Optional[str] = None
    latitude: float
    longitude: float
    region: Optional[str] = None
    continent: Optional[str] = None
    address: Optional[str] = None

class Location(LocationBase):
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class CompanyWithLocation(BaseModel):
    id: str
    name: str
    country_code: str
    country_name: str
    city: str
    type: str
    industry: Optional[str] = None
    website: Optional[str] = None
    latitude: float
    longitude: float
    region: Optional[str] = None
    continent: Optional[str] = None
    class Config:
        from_attributes = True

class TransactionBase(BaseModel):
    id: str
    exporter_company_id: Optional[str] = None
    importer_company_id: Optional[str] = None
    origin_country_code: str
    origin_country_name: str
    destination_country_code: str
    destination_country_name: str
    material: str
    category_id: str
    quantity: float
    unit: Optional[str] = None
    price: float
    total_value: float
    transaction_date: datetime
    status: str = "completed"
    notes: Optional[str] = None

class Transaction(TransactionBase):
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class TransactionResponse(BaseModel):
    id: str
    exporter_company_id: Optional[str] = None
    exporter_company_name: Optional[str] = None
    exporter_country_code: str
    exporter_country_name: str
    importer_company_id: Optional[str] = None
    importer_company_name: Optional[str] = None
    importer_country_code: str
    importer_country_name: str
    material: str
    category_id: str
    category_name: str
    category_color: str
    quantity: float
    unit: Optional[str] = None
    price: float
    total_value: float
    transaction_date: datetime
    status: str
    notes: Optional[str] = None
    class Config:
        from_attributes = True

class PaginationInfo(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int

class TransactionListResponse(BaseModel):
    transactions: List[TransactionResponse]
    pagination: PaginationInfo

class CategoryBreakdown(BaseModel):
    category_id: str
    category_name: str
    count: int
    total_value: float

class TopRoute(BaseModel):
    origin_country: str
    destination_country: str
    transaction_count: int
    total_value: float

class StatsResponse(BaseModel):
    total_transactions: int
    total_value: float
    active_countries: int
    active_companies: int
    category_breakdown: List[CategoryBreakdown]
    top_routes: List[TopRoute]

class MonthlyCompanyFlow(BaseModel):
    year_month: str
    exporter_name: str
    importer_name: str
    origin_country: str
    destination_country: str
    hs_codes: Optional[str] = None
    transport_mode: Optional[str] = None
    trade_term: Optional[str] = None
    transaction_count: int
    total_value_usd: float
    total_weight_kg: Optional[float] = None
    total_quantity: Optional[float] = None
    first_transaction_date: Optional[str] = None
    last_transaction_date: Optional[str] = None
    class Config:
        from_attributes = True

class HSCodeCategory(BaseModel):
    hs_code: str
    chapter_name: str
    class Config:
        from_attributes = True

# ── 核心 Schema：国家贸易配对数据 ──────────────────────────────────

class Shipment(BaseModel):
    year: int
    month: int
    hs_code: str
    origin_country_code: str
    destination_country_code: str
    total_value_usd: Optional[float] = None
    trade_count: int
    # 向后兼容字段
    country_of_origin: Optional[str] = None
    destination_country: Optional[str] = None
    date: Optional[str] = None
    class Config:
        from_attributes = True

class PortLocation(BaseModel):
    port_name: str
    country_code: str
    country_name: str
    latitude: float
    longitude: float
    region: Optional[str] = None
    continent: Optional[str] = None
    class Config:
        from_attributes = True

class CountryLocation(BaseModel):
    country_code: str
    country_name: str
    latitude: float
    longitude: float
    region: Optional[str] = None
    continent: Optional[str] = None
    class Config:
        from_attributes = True

# ── 国家贸易统计（从 pair 表聚合后的结果） ──────────────────────

class CountryMonthlyTradeStat(BaseModel):
    hs_code: str
    year: int
    month: int
    country_code: str
    sum_of_usd: float
    trade_count: int
    class Config:
        from_attributes = True

class CountryTradeStatSummary(BaseModel):
    total_countries: int
    total_trade_value: float
    total_trade_count: int
    avg_share_pct: float = 0.0

class CountryTradeTrend(BaseModel):
    year_month: str
    sum_of_usd: float
    trade_count: int

class TopCountry(BaseModel):
    country_code: str
    sum_of_usd: float
    trade_count: int
    amount_share_pct: float

class CountryQuarterTop(BaseModel):
    year: int
    quarter: int
    country_code: str
    sum_of_usd: float
    trade_count: int

class CountryAggregate(BaseModel):
    country_code: str
    sum_of_usd: float
    trade_count: int

class CountryQuarterAggregate(BaseModel):
    year: int
    quarter: int
    country_code: str
    sum_of_usd: float
    trade_count: int

class HSAggregate(BaseModel):
    hs_code: str
    sum_of_usd: float
    trade_count: int

class HSQuarterAggregate(BaseModel):
    year: int
    quarter: int
    hs_code: str
    sum_of_usd: float
    trade_count: int
