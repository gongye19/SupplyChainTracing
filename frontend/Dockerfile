# 多阶段构建：构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package.json ./

# 安装依赖
RUN npm install

# 复制应用代码
COPY . .

# 构建生产版本（需要设置 VITE_API_URL 环境变量）
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# 生产阶段：使用 nginx 服务静态文件
FROM nginx:alpine

# 复制构建产物到 nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置（如果存在）
COPY nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || true

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]

