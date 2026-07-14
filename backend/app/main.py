from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import os
import re

from .routes import chat_jobs, hs_code_categories, country_locations as port_locations_route, country_locations_compat, shipments, country_trade_stats, companies, insight_jobs
from .utils.logger import get_logger

app = FastAPI(title="Supply Chain API", version="1.0.0")
logger = get_logger(__name__)

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
logger.info("[CORS] allow_origins=%s", cors_origins)
logger.info("[CORS] allow_origin_regex=%s", vercel_origin_regex)

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
    origin = request.headers.get("origin")
    
    is_allowed = False
    if origin:
        if origin in cors_origins:
            is_allowed = True
        elif re.match(vercel_origin_regex, origin):
            is_allowed = True
    
    logger.exception("[ERROR] 未处理的异常")
    
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "内部服务器错误"}
    )
    
    if is_allowed and origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

# 注册路由（仅保留当前数据链路使用的接口）
app.include_router(chat_jobs.router, prefix="/api/chat-jobs", tags=["chat-jobs"])
app.include_router(chat_jobs.internal_router, prefix="/api/internal/chat-jobs", tags=["internal-chat-jobs"])
app.include_router(shipments.router, prefix="/api/shipments", tags=["shipments"])
app.include_router(hs_code_categories.router, prefix="/api/hs-code-categories", tags=["hs-code-categories"])
app.include_router(port_locations_route.router, prefix="/api/port-locations", tags=["port-locations"])
# 向后兼容：保留 country-locations 路由（从 port_locations 表提取国家信息）
app.include_router(country_locations_compat.router, prefix="/api/country-locations", tags=["country-locations"])
app.include_router(country_trade_stats.router, prefix="/api/country-trade-stats", tags=["country-trade-stats"])
app.include_router(companies.router, prefix="/api/companies", tags=["companies"])
app.include_router(insight_jobs.router, prefix="/api/insight-jobs", tags=["insight-jobs"])
app.include_router(insight_jobs.internal_router, prefix="/api/internal/insight-jobs", tags=["internal-insight-jobs"])

@app.get("/")
def root():
    return {"message": "Supply Chain API", "version": "1.0.0"}

@app.get("/api/health")
def health():
    return {"status": "healthy"}
