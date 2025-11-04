# HiPet Backend Service (Bun + Fastify)

统一后端服务，代理 AI Agent 流式接口并提供业务API与硬件接口占位。

## 开发

```bash
# 进入目录
cd backend-service

# 复制环境变量
cp .env.example .env

# 安装依赖（需要已安装 Bun）
bun install

# 启动开发
bun run dev
```

## 环境变量

- PORT: 默认 8000
- HOST: 默认 0.0.0.0
- AGENT_SERVICE_URL: Python agent-service 地址，默认 http://localhost:8001
- DATABASE_URL: PostgreSQL 连接串
- REDIS_URL: Redis 地址

## 路由

- GET /health/        健康检查
- GET /health/ready   就绪检查
- POST /chat/stream   代理到 agent-service 的 SSE 聊天
- GET  /chat/agents   说明指向 agent-service
- /hardware/*         硬件相关占位接口（仅日志）

## 部署

- Docker 容器化，配合云上 RDS(PostgreSQL) 与 ElastiCache(Redis)
- 生产环境建议通过负载均衡暴露 8000 端口


## Sessions API (会话化存储)

- POST /sessions/start: { userId, petId, title? } -> { sessionId }
- POST /sessions/append: { sessionId, messages: [{ role, content, meta? }] }
- POST /sessions/end: { sessionId, summary?, title? } -> 持久化 transcript
- GET  /sessions?userId&petId&status&take: 会话列表
- GET  /sessions/:id: 会话详情（含 transcript/summary ）

### 流式聊天与采样（后端代理自动追加）
- POST /chat/stream 请求体可携带 sessionId
- 代理会自动采样三类事件追加到会话缓存：router / transfer / specialist
- 前端只需在会话开始时拿到 sessionId 并在流式调用携带即可
- 会话结束时调用 /sessions/end 写入 Postgres

### 前端时序建议
1) start -> 获取 sessionId
2) chat/stream 携带 sessionId 展示SSE
3) 用户结束或超时 -> end，页面显示会话总结
