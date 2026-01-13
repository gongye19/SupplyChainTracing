FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# 复制requirements并安装Python依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY app/ ./app/

# 暴露端口
EXPOSE 8000

# 启动命令（生产环境，去掉 --reload）
# 使用环境变量 PORT（Railway 会自动设置），如果没有则默认 8000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

