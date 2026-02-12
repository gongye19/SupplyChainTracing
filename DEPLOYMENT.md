# 部署配置说明

## Vercel 前端部署配置

### 环境变量设置

在 Vercel 项目设置中，需要配置以下环境变量：

1. **VITE_API_URL** - 后端 API 地址
   - 如果后端部署在 Railway: `https://your-railway-app.railway.app`
   - 如果后端部署在其他地方: `https://your-backend-url.com`
   - 本地开发: `http://localhost:8001`

### 设置步骤

1. 登录 Vercel Dashboard
2. 选择你的项目
3. 进入 Settings > Environment Variables
4. 添加环境变量：
   - **Key**: `VITE_API_URL`
   - **Value**: 你的后端 API URL（例如：`https://your-railway-app.railway.app`）
   - **Environment**: Production, Preview, Development（全选）

5. 重新部署项目

## Railway 后端部署配置

### 环境变量设置

在 Railway 项目设置中，需要配置以下环境变量：

1. **CORS_ORIGINS** - 允许的前端域名（逗号分隔）
   ```
   https://supply-chain-tracing.vercel.app,https://supply-chain-tracing-git-main.vercel.app
   ```
   
   或者使用通配符（已在代码中配置）：
   - 代码中已配置支持所有 `supply-chain-tracing*.vercel.app` 域名

2. **DATABASE_URL** - 数据库连接字符串（Railway 会自动提供）

### 检查后端是否运行

访问后端健康检查端点：
```
https://your-railway-app.railway.app/api/health
```

应该返回：
```json
{"status": "healthy"}
```

## 故障排查

### 前端显示 "Failed to fetch" 错误

1. **检查后端是否运行**
   - 访问后端健康检查端点
   - 检查 Railway 部署日志

2. **检查环境变量**
   - 确认 Vercel 中设置了 `VITE_API_URL`
   - 确认值是正确的后端 URL（包含 `https://`）

3. **检查 CORS 配置**
   - 确认后端 `CORS_ORIGINS` 包含前端域名
   - 检查后端日志中的 CORS 错误

4. **检查网络连接**
   - 打开浏览器开发者工具 > Network 标签
   - 查看 API 请求是否发送
   - 查看请求的 URL 是否正确

### 常见问题

**Q: 前端显示 "无法连接到后端服务"**
A: 检查 `VITE_API_URL` 环境变量是否正确设置，以及后端服务是否正常运行。

**Q: CORS 错误**
A: 确保后端 `CORS_ORIGINS` 环境变量包含前端域名，或者使用代码中已配置的 Vercel 域名正则表达式。

**Q: 数据加载失败**
A: 
1. 检查数据库是否已导入数据（运行 `python backend/scripts/batch_import_all.py --clear`）
2. 检查后端日志查看具体错误
3. 检查 API 端点是否正确

