from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Literal, Optional, List

class HSCodeCategory(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hs_code: str
    chapter_name: str

# ── 核心 Schema：国家贸易配对数据 ──────────────────────────────────

class Shipment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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

class PortLocation(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    port_name: str
    country_code: str
    country_name: str
    latitude: float
    longitude: float
    region: Optional[str] = None
    continent: Optional[str] = None

class CountryLocation(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    country_code: str
    country_name: str
    latitude: float
    longitude: float
    region: Optional[str] = None
    continent: Optional[str] = None

# ── 国家贸易统计（从 pair 表聚合后的结果） ──────────────────────

class CountryMonthlyTradeStat(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hs_code: str
    year: int
    month: int
    country_code: str
    sum_of_usd: float
    trade_count: int

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


# ── Lightweight chat worker protocol ─────────────────────────────────

ChatJobStatus = Literal["queued", "running", "completed", "failed"]


class ChatMessagePayload(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=20_000)


class ChatJobCreate(BaseModel):
    message: str = Field(min_length=1, max_length=10_000)
    history: List[ChatMessagePayload] = Field(default_factory=list, max_length=20)


class ChatDirectResponse(BaseModel):
    response: str


class ChatJobResponse(BaseModel):
    job_id: str
    status: ChatJobStatus
    message: str
    history: List[ChatMessagePayload] = Field(default_factory=list)
    answer: Optional[str] = None
    error_message: Optional[str] = None
    worker_id: Optional[str] = None
    lease_expires_at: Optional[datetime] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    updated_at: datetime


class ChatJobSystemStatus(BaseModel):
    enabled: bool
    message: str


class ChatJobClaimRequest(BaseModel):
    worker_id: str = Field(min_length=1, max_length=255)


class ChatJobCompleteRequest(ChatJobClaimRequest):
    answer: str = Field(min_length=1, max_length=100_000)


class ChatJobFailureRequest(ChatJobClaimRequest):
    error_message: str = Field(min_length=1, max_length=8_000)


# ── Insight Factory job protocol ──────────────────────────────────────

InsightJobStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


class InsightJobSystemStatus(BaseModel):
    enabled: bool
    default_dataset_version: Optional[str] = None
    message: str


class InsightJobCreate(BaseModel):
    research_question: str = Field(min_length=10, max_length=4000)
    dataset_version: Optional[str] = Field(default=None, min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._-]+$")
    target_step: Literal[5] = 5
    stream_count: int = Field(default=2, ge=1, le=6)
    requested_by: Optional[str] = Field(default=None, max_length=255)


class InsightJobResponse(BaseModel):
    job_id: str
    status: InsightJobStatus
    research_question: str
    dataset_version: str
    target_step: int
    stream_count: int
    requested_by: Optional[str] = None
    worker_id: Optional[str] = None
    lease_expires_at: Optional[datetime] = None
    heartbeat_at: Optional[datetime] = None
    current_step: int = 0
    cancel_requested: bool = False
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    updated_at: datetime


class InsightReportResponse(BaseModel):
    job_id: str
    dataset_version: str
    factory_version: str
    executive_summary: Optional[str] = None
    report_markdown: str
    report_html: str
    created_at: datetime
    updated_at: datetime


class InsightJobClaimRequest(BaseModel):
    worker_id: str = Field(min_length=1, max_length=255)


class InsightJobHeartbeatRequest(InsightJobClaimRequest):
    current_step: int = Field(default=0, ge=0, le=5)


class InsightJobCompleteRequest(InsightJobClaimRequest):
    dataset_version: str = Field(min_length=1, max_length=128)
    factory_version: str = Field(min_length=1, max_length=128)
    report_markdown: str = Field(min_length=1, max_length=5_000_000)
    executive_summary: str = Field(default="", max_length=500_000)
    report_html: str = Field(min_length=1, max_length=5_000_000)


class InsightJobFailureRequest(InsightJobClaimRequest):
    error_message: Optional[str] = Field(default=None, max_length=8000)
    message: Optional[str] = Field(default=None, max_length=8000)
