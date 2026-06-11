from pydantic import BaseModel, Field
from typing import Optional, List

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


# ── 公司级看板 ────────────────────────────────────────────────

class CompanySearchResult(BaseModel):
    name: str
    brand_name: Optional[str] = None
    country_code: Optional[str] = None
    country_count: int = 0
    role: str
    category_labels: List[str] = Field(default_factory=list)
    total_trade_value: float
    trade_count: int


class CompanyCategoryStat(BaseModel):
    hs_code: str
    label: str
    sum_of_usd: float
    trade_count: int
    share_pct: float


class CompanyRankItem(BaseModel):
    rank: int
    company: str
    brand_name: Optional[str] = None
    country_code: Optional[str] = None
    sum_of_usd: float
    trade_count: int
    share_pct: float


class CompanyTrendPoint(BaseModel):
    year_month: str
    sum_of_usd: float
    trade_count: int


class CompanyDashboardResponse(BaseModel):
    name: str
    brand_name: Optional[str] = None
    country_code: Optional[str] = None
    country_count: int = 0
    role: str
    category_labels: List[str] = Field(default_factory=list)
    total_trade_value: float
    total_trade_count: int
    import_trade_value: float
    export_trade_value: float
    categories: List[CompanyCategoryStat]
    top_suppliers: List[CompanyRankItem]
    top_customers: List[CompanyRankItem]
    trends: List[CompanyTrendPoint]


# ── Future insight agent extension point ───────────────────────────────

class InsightAgentStatus(BaseModel):
    enabled: bool
    name: str
    supported_sources: List[str]
    message: str


class InsightAgentPreviewRequest(BaseModel):
    brands: List[str] = Field(default_factory=list)
    start_year_month: Optional[str] = None
    end_year_month: Optional[str] = None
    include_news: bool = True
    include_trade: bool = True


class InsightAgentPreviewResponse(BaseModel):
    enabled: bool
    message: str
    requested_brands: List[str] = Field(default_factory=list)
