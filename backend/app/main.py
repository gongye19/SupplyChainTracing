from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .routes import categories, transactions, companies, locations, chat, monthly_company_flows, hs_code_categories, country_locations

app = FastAPI(title="Supply Chain API", version="1.0.0")

# CORS配置 - 支持多域名（开发和生产环境）
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3001,http://localhost:3000,https://supply-chain-tracing.vercel.app")
# 支持逗号分隔的多个域名
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

# Vercel 预览域名的正则表达式模式（支持所有 supply-chain-tracing 的预览域名）
vercel_origin_regex = r"https://supply-chain-tracing(-[a-z0-9]+)?\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=vercel_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(companies.router, prefix="/api/companies", tags=["companies"])
app.include_router(locations.router, prefix="/api/locations", tags=["locations"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(monthly_company_flows.router, prefix="/api/monthly-company-flows", tags=["monthly-company-flows"])
app.include_router(hs_code_categories.router, prefix="/api/hs-code-categories", tags=["hs-code-categories"])
app.include_router(country_locations.router, prefix="/api/country-locations", tags=["country-locations"])

@app.get("/")
def root():
    return {"message": "Supply Chain API", "version": "1.0.0"}

@app.get("/api/health")
def health():
    return {"status": "healthy"}

