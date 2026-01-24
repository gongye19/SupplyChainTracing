from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .routes import categories, transactions, companies, locations, chat, monthly_company_flows, hs_code_categories, country_locations

app = FastAPI(title="Supply Chain API", version="1.0.0")

# CORS配置 - 支持多域名（开发和生产环境）
# 从环境变量读取，如果没有设置则使用空列表（生产环境必须设置）
cors_origins_str = os.getenv("CORS_ORIGINS", "")
# 支持逗号分隔的多个域名
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

# Vercel 预览域名的正则表达式模式（支持所有 supply-chain-tracing 的预览域名）
# 匹配：supply-chain-tracing.vercel.app, supply-chain-tracing-git-main.vercel.app, supply-chain-tracing-git-*.vercel.app 等
vercel_origin_regex = r"https://supply-chain-tracing(-git-[a-z0-9-]+)?\.vercel\.app"

# 调试：打印 CORS 配置（仅在开发环境）
if os.getenv("ENVIRONMENT") != "production":
    print(f"[CORS] 允许的域名列表: {cors_origins}")
    print(f"[CORS] Vercel 正则表达式: {vercel_origin_regex}")

# 配置 CORS：如果 cors_origins 为空，只使用正则表达式
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=vercel_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # 如果没有配置 allow_origins，只使用正则表达式
    app.add_middleware(
        CORSMiddleware,
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

@app.get("/api/debug/cors")
def debug_cors():
    """调试端点：查看 CORS 配置"""
    return {
        "cors_origins": cors_origins,
        "vercel_origin_regex": vercel_origin_regex,
        "cors_origins_env": os.getenv("CORS_ORIGINS", "未设置")
    }

@app.get("/api/debug/db")
def debug_db(db: Session = Depends(get_db)):
    """调试端点：测试数据库连接和表是否存在"""
    from sqlalchemy import text
    try:
        # 检查表是否存在
        result = db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('monthly_company_flows', 'hs_code_categories', 'country_locations', 'shipments_raw')
            ORDER BY table_name
        """))
        tables = [row[0] for row in result.fetchall()]
        
        # 检查 monthly_company_flows 表的记录数
        count = 0
        if 'monthly_company_flows' in tables:
            result = db.execute(text("SELECT COUNT(*) FROM monthly_company_flows"))
            count = result.scalar()
        
        return {
            "status": "connected",
            "tables_found": tables,
            "monthly_company_flows_count": count
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

