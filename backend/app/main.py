from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .routes import categories, transactions, companies, locations

app = FastAPI(title="Supply Chain API", version="1.0.0")

# CORS配置
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3001").split(",")
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

@app.get("/")
def root():
    return {"message": "Supply Chain API", "version": "1.0.0"}

@app.get("/api/health")
def health():
    return {"status": "healthy"}

