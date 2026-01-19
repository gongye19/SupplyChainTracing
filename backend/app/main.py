from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .routes import categories, transactions, companies, locations, chat

app = FastAPI(title="Supply Chain API", version="1.0.0")

# CORS配置 - 支持多域名（开发和生产环境）
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3001,http://localhost:3000")
# 支持逗号分隔的多个域名
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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

@app.get("/")
def root():
    return {"message": "Supply Chain API", "version": "1.0.0"}

@app.get("/api/health")
def health():
    return {"status": "healthy"}

