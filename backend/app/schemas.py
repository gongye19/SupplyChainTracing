from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Category Schemas
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

# Company Schemas
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

# Location Schemas
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

# Company with Location (for API responses)
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

# Transaction Schemas
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

# Transaction with related data (for API responses)
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

# Pagination
class PaginationInfo(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int

class TransactionListResponse(BaseModel):
    transactions: List[TransactionResponse]
    pagination: PaginationInfo

# Stats Schemas
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

# Monthly Company Flow Schemas
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

# HS Code Category Schemas
class HSCodeCategory(BaseModel):
    hs_code: str
    chapter_name: str
    
    class Config:
        from_attributes = True

# Shipment Schema (from shipments_raw table)
class Shipment(BaseModel):
    date: str  # YYYY-MM-DD
    importer_name: str
    exporter_name: str
    hs_code: str  # 4位 HS Code
    product_english: Optional[str] = None
    product_description: Optional[str] = None
    weight_kg: Optional[float] = None
    quantity: Optional[float] = None
    quantity_unit: Optional[str] = None
    total_value_usd: Optional[float] = None
    unit_price_per_kg: Optional[float] = None
    unit_price_per_item: Optional[float] = None
    country_of_origin: str
    destination_country: str
    port_of_departure: Optional[str] = None
    port_of_arrival: Optional[str] = None
    import_export: Optional[str] = None
    transport_mode: Optional[str] = None
    trade_term: Optional[str] = None
    
    class Config:
        from_attributes = True

# Country Location Schemas
class CountryLocation(BaseModel):
    country_code: str
    country_name: str
    latitude: float
    longitude: float
    region: Optional[str] = None
    continent: Optional[str] = None
    
    class Config:
        from_attributes = True

