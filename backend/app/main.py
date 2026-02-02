from fastapi import FastAPI, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
import os
import re

from .routes import categories, transactions, companies, locations, chat, monthly_company_flows, hs_code_categories, country_locations as port_locations_route, country_locations_compat, shipments, country_trade_stats
from .database import get_db

app = FastAPI(title="Supply Chain API", version="1.0.0")

# CORS配置 - 支持多域名（开发和生产环境）
# 从环境变量读取，如果没有设置则使用空列表（生产环境必须设置）
cors_origins_str = os.getenv("CORS_ORIGINS", "")
# 支持逗号分隔的多个域名
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

# Vercel 预览域名的正则表达式模式（支持所有 supply-chain-tracing 的预览域名）
# 匹配：supply-chain-tracing.vercel.app, supply-chain-tracing-git-main.vercel.app, supply-chain-tracing-*.vercel.app 等
# 更宽松的正则，匹配所有可能的 Vercel 预览域名格式
vercel_origin_regex = r"https://supply-chain-tracing(-[a-z0-9-]+)?\.vercel\.app"

# 调试：打印 CORS 配置
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
        expose_headers=["*"],
    )
else:
    # 如果没有配置 allow_origins，只使用正则表达式
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=vercel_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

# 全局异常处理器 - 确保所有错误响应都包含 CORS 头
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """处理 HTTP 异常，确保包含 CORS 头"""
    origin = request.headers.get("origin")
    
    # 检查 origin 是否匹配允许的域名
    is_allowed = False
    if origin:
        # 检查精确匹配
        if origin in cors_origins:
            is_allowed = True
        # 检查正则匹配
        elif re.match(vercel_origin_regex, origin):
            is_allowed = True
    
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )
    
    # 添加 CORS 头
    if is_allowed and origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """处理验证异常，确保包含 CORS 头"""
    origin = request.headers.get("origin")
    
    is_allowed = False
    if origin:
        if origin in cors_origins:
            is_allowed = True
        elif re.match(vercel_origin_regex, origin):
            is_allowed = True
    
    response = JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()}
    )
    
    if is_allowed and origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """处理所有其他异常，确保包含 CORS 头"""
    import traceback
    origin = request.headers.get("origin")
    
    is_allowed = False
    if origin:
        if origin in cors_origins:
            is_allowed = True
        elif re.match(vercel_origin_regex, origin):
            is_allowed = True
    
    error_detail = str(exc)
    print(f"[ERROR] 未处理的异常: {error_detail}")
    print(traceback.format_exc())
    
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "内部服务器错误", "error": error_detail}
    )
    
    if is_allowed and origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

# CORS 调试中间件（可选，用于调试）
class CORSDebugMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        if origin:
            is_allowed = origin in cors_origins or (re.match(vercel_origin_regex, origin) if vercel_origin_regex else False)
            print(f"[CORS Debug] Origin: {origin}, Allowed: {is_allowed}")
        
        response = await call_next(request)
        return response

# 添加 CORS 调试中间件（仅在需要时启用）
# app.add_middleware(CORSDebugMiddleware)

# 注册路由
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(companies.router, prefix="/api/companies", tags=["companies"])
app.include_router(locations.router, prefix="/api/locations", tags=["locations"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(monthly_company_flows.router, prefix="/api/monthly-company-flows", tags=["monthly-company-flows"])
app.include_router(shipments.router, prefix="/api/shipments", tags=["shipments"])
app.include_router(hs_code_categories.router, prefix="/api/hs-code-categories", tags=["hs-code-categories"])
app.include_router(port_locations_route.router, prefix="/api/port-locations", tags=["port-locations"])
# 向后兼容：保留 country-locations 路由（从 port_locations 表提取国家信息）
app.include_router(country_locations_compat.router, prefix="/api/country-locations", tags=["country-locations"])
app.include_router(country_trade_stats.router, prefix="/api/country-trade-stats", tags=["country-trade-stats"])

@app.get("/")
def root():
    return {"message": "Supply Chain API", "version": "1.0.0"}

@app.get("/api/health")
def health():
    return {"status": "healthy"}

@app.get("/api/debug/cors")
def debug_cors(request: Request):
    """调试端点：查看 CORS 配置"""
    origin = request.headers.get("origin", "无")
    is_allowed = False
    match_type = None
    
    if origin != "无":
        if origin in cors_origins:
            is_allowed = True
            match_type = "精确匹配"
        elif re.match(vercel_origin_regex, origin):
            is_allowed = True
            match_type = "正则匹配"
    
    return {
        "cors_origins": cors_origins,
        "vercel_origin_regex": vercel_origin_regex,
        "cors_origins_env": os.getenv("CORS_ORIGINS", "未设置"),
        "current_origin": origin,
        "is_allowed": is_allowed,
        "match_type": match_type
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
            AND table_name IN ('monthly_company_flows', 'hs_code_categories', 'port_locations', 'shipments_raw')
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

