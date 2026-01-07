from sqlalchemy import Column, String, Numeric, Integer, Boolean, Text, ForeignKey, CheckConstraint, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    color = Column(String(7), nullable=False)
    icon = Column(String(50))
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    transactions = relationship("Transaction", back_populates="category")

class Company(Base):
    __tablename__ = "companies"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(200), nullable=False)
    country_code = Column(String(3), nullable=False)
    country_name = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False)
    industry = Column(String(100))
    website = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint("type IN ('importer', 'exporter', 'both')", name="check_company_type"),
    )
    
    exported_transactions = relationship("Transaction", foreign_keys="Transaction.exporter_company_id", back_populates="exporter_company")
    imported_transactions = relationship("Transaction", foreign_keys="Transaction.importer_company_id", back_populates="importer_company")

class Location(Base):
    __tablename__ = "locations"
    
    id = Column(String(100), primary_key=True)
    type = Column(String(20), nullable=False)
    country_code = Column(String(3), nullable=False)
    country_name = Column(String(100), nullable=False)
    city = Column(String(100))
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    region = Column(String(50))
    continent = Column(String(50))
    address = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint("type IN ('country', 'city')", name="check_location_type"),
    )

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(String(50), primary_key=True)
    exporter_company_id = Column(String(50), ForeignKey("companies.id", ondelete="SET NULL"))
    importer_company_id = Column(String(50), ForeignKey("companies.id", ondelete="SET NULL"))
    origin_country_code = Column(String(3), nullable=False)
    origin_country_name = Column(String(100), nullable=False)
    destination_country_code = Column(String(3), nullable=False)
    destination_country_name = Column(String(100), nullable=False)
    material = Column(String(200), nullable=False)
    category_id = Column(String(50), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Numeric(15, 2), nullable=False)
    unit = Column(String(50))
    price = Column(Numeric(15, 2), nullable=False)
    total_value = Column(Numeric(20, 2), nullable=False)
    transaction_date = Column(TIMESTAMP, nullable=False)
    status = Column(String(20), default="completed")
    notes = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint("status IN ('completed', 'in-transit', 'pending', 'cancelled')", name="check_transaction_status"),
    )
    
    category = relationship("Category", back_populates="transactions")
    exporter_company = relationship("Company", foreign_keys=[exporter_company_id], back_populates="exported_transactions")
    importer_company = relationship("Company", foreign_keys=[importer_company_id], back_populates="imported_transactions")

