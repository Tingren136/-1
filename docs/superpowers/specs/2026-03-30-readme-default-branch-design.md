# 仓库 README 与默认分支调整设计（2026-03-30）

## 1. 目标
- 在新仓库根目录提供一份完整中文 README，便于他人打开即能理解、启动并体验鞋履概念生成向导。
- 将默认分支从 `master` 调整为 `main`，与现代 Git 习惯一致。

## 2. 范围
**包含：**
- 根目录新增 `README.md`（详细版）：简介、功能概览、快速开始、环境变量、API 说明、目录结构、常见问题。
- 本地分支改名为 `main` 并推送。
- 提供 GitHub 网页端设置默认分支的指引（如需可代操作说明）。

**不包含：**
- 业务逻辑/接口行为改动。
- UI/功能新增或重构。

## 3. README 内容结构
### 3.1 简介与功能概览
- 项目用途：鞋履概念生成向导（Step1~3）。
- 模拟/真实接口说明：当前为 mock，真实接入需替换客户端实现与关闭 mock。

### 3.2 快速开始
- 安装依赖（pnpm workspace）。
- 启动 Web（Next.js）。
- 启动 Worker（BullMQ + Redis）。
- Redis 运行说明（示例 docker 命令）。

### 3.3 环境变量
- 对齐 `.env.example` 必填项（REDIS_URL 等）。
- 额外说明 mock 开关（COMFYUI_MOCK / GEMINI_MOCK / JIMENG_MOCK / OBJECT_STORAGE_MOCK）。

### 3.4 API 说明
- Session：`POST /api/session`、`GET /api/session/:id`。
- Step1：`POST /api/steps/1`、`GET /api/steps/1/status`。
- Step2：`POST /api/steps/2`、`GET /api/steps/2/status`。
- Step3：`POST /api/steps/3`、`GET /api/steps/3/status`。
- 上传：`POST /api/assets/upload`（mock 签名）。
- 每个 API 给出最小请求/响应示例与关键字段说明。

### 3.5 目录结构
- `apps/web`、`packages/*`、`workers/`、`config/`、`jobs/`、`tests/` 等说明。

### 3.6 常见问题
- 端口占用、next 命令不可用、BullMQ 依赖 Redis 等。

## 4. 默认分支调整
- 本地分支重命名：`git branch -m master main`。
- 推送并设置上游：`git push -u origin main`。
- GitHub 设置默认分支为 `main`。
- 可选：删除远端 `master`（如需要）。

## 5. 成功标准
- README 在 GitHub 首页即可阅读，中文清晰、可直接复制命令启动。
- API 与 Worker/队列关系解释到位。
- 仓库默认分支为 `main`，新克隆默认落到 `main`。
