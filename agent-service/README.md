# HiPet - 智能宠物健康管理平台

## 项目架构

本项目采用微服务架构，包含以下服务：

- **agent-service**: AI Agent 服务，处理各种智能对话和决策
- **backend-service**: 后端 API 服务，处理业务逻辑和数据管理
- **frontend**: 前端应用（待开发）

## 开发顺序

采用自下而上的开发方式：
1. 先开发 agent-service（AI Agent 核心）
2. 再开发 backend-service（业务逻辑）
3. 最后开发 frontend（用户界面）

## Agent 服务架构

包含以下 Agent：
- **Router Agent**: 总管家·分流器
- **Doctor Agent**: 健康顾问·科普/分诊
- **Nutritionist Agent**: 营养顾问
- **Trainer Agent**: 训练/行为顾问
- **ExplainData Agent**: 数据解释·MVP核心工具
- **SimpleFAQ Agent**: 简易FAQ查找器
- **Avatar Agent**: 数字形象需求澄清

## 技术栈

- **Agent Service**: Python + FastAPI + Pydantic
- **Backend Service**: Python + FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: Next.js + TypeScript + Tailwind CSS + shadcn/ui



