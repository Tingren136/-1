# README + Default Branch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a comprehensive Chinese README at the repo root and switch the default branch from `master` to `main`.

**Architecture:** Keep code unchanged; only add documentation and adjust Git branch metadata. README explains the existing API/worker flow and how to run the system with Redis and mock clients.

**Tech Stack:** Next.js (App Router), Node.js, pnpm workspaces, BullMQ + Redis.

---

### Task 1: Create root README (Chinese, detailed)

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README content**

```markdown
# 鞋履概念生成向导（Web Shoe Generator）

这是一个基于 Next.js + BullMQ + Redis 的鞋履概念生成向导原型。当前接口为 **mock**，后续可替换为真实模型/存储服务。

## 功能概览

- Step 1：草图生成（基于鞋型/材质/纹理/颜色模板生成提示词，产出草图 URL）
- Step 2：中文提示词（基于草图 + 饰品类型生成中文描述与提示词）
- Step 3：概念图生成（基于中文提示词生成概念图 URL）
- 会话状态（Session）统一落 Redis，前端通过状态接口轮询

## 快速开始

### 1) 安装依赖

```bash
pnpm install
```

### 2) 启动 Redis（示例）

```bash
docker run --name webshoe-redis -p 6379:6379 -d redis:7
```

### 3) 配置环境变量

```bash
cp .env.example .env.local
```

确保 `.env.local` 中至少包含：

```
REDIS_URL=redis://localhost:6379
```

### 4) 启动 Web

```bash
pnpm --filter web dev
# 或使用快捷脚本
pnpm dev
```

默认访问：`http://localhost:3000`

### 5) 启动 Worker（处理队列任务）

```bash
pnpm ts-node --project workers/tsconfig.json workers/index.ts
```

> 说明：Worker 会消费 Step1/2/3 队列并写入 Redis 结果。

## 环境变量说明

`.env.example` 中已列出基础变量：

- `REDIS_URL`：Redis 连接地址（必填）
- `OBJECT_STORAGE_BUCKET`：对象存储桶名（真实接入时使用）
- `COMFY_API_KEY` / `GEMINI_API_KEY` / `JIMENG_API_KEY`：真实模型接入时使用
- `TENCENT_API_KEY` / `RUNNINGHUB_APP_ID`：预留

**Mock 开关（可选）：**

- `COMFYUI_MOCK`：默认 mock（不设置或非 0 即 mock）
- `GEMINI_MOCK`：默认 mock
- `JIMENG_MOCK`：默认 mock
- `OBJECT_STORAGE_MOCK`：默认 mock

**Mock 地址（可选）：**

- `COMFYUI_MOCK_BASE_URL`
- `JIMENG_MOCK_BASE_URL`
- `OBJECT_STORAGE_PUBLIC_BASE_URL`

**其它：**

- `REDIS_SESSION_TTL`：会话 TTL（秒），默认 86400

## API 说明（当前为 mock）

### 1) 创建会话

`POST /api/session`

响应：

```json
{ "sessionId": "<uuid>" }
```

### 2) 查询会话

`GET /api/session/:id`

响应：

```json
{ "sessionId": "<uuid>", "state": { ... } }
```

### 3) Step 1 生成草图

`POST /api/steps/1`

请求：

```json
{
  "sessionId": "<uuid>",
  "input": {
    "shoeShapeId": "classic_round",
    "materialId": "leather",
    "textureIds": ["smooth"],
    "colorSelection": {
      "single": "象牙白"
    },
    "customColorPhrase": "（可选）自定义颜色短语"
  }
}
```

响应：

```json
{ "status": "queued", "jobId": "<id>", "prompt": "..." }
```

状态查询：`GET /api/steps/1/status?sessionId=<uuid>`

```json
{ "status": "pending" }
```

或

```json
{ "status": "done", "result": { "imageUrl": "...", "prompt": "..." } }
```

### 4) Step 2 生成中文提示词

`POST /api/steps/2`

请求：

```json
{
  "sessionId": "<uuid>",
  "accessoryTag": "项链",
  "step1ImageUrl": "（可选）草图 URL"
}
```

响应：

```json
{ "status": "queued", "jobId": "<id>" }
```

状态查询：`GET /api/steps/2/status?sessionId=<uuid>`

```json
{ "status": "pending" }
```

或

```json
{ "status": "done", "result": { "analysisCn": "...", "promptCn": "..." } }
```

### 5) Step 3 生成概念图

`POST /api/steps/3`

请求：

```json
{
  "sessionId": "<uuid>",
  "promptCn": "（可选）中文提示词"
}
```

响应：

```json
{ "status": "queued", "jobId": "<id>" }
```

状态查询：`GET /api/steps/3/status?sessionId=<uuid>`

```json
{ "status": "pending" }
```

或

```json
{ "status": "done", "result": { "imageUrl": "...", "promptCn": "..." } }
```

### 6) 上传签名（mock）

`POST /api/assets/upload`

响应（mock）：

```json
{
  "uploadUrl": "https://example.com/mock-assets/upload/<key>",
  "assetUrl": "https://example.com/mock-assets/<key>",
  "mock": true
}
```

当 `OBJECT_STORAGE_MOCK=0` 时，返回 501（提示尚未接入真实对象存储签名）。

## 目录结构

```
apps/web            # Next.js 前端与 API 路由
packages/clients    # 模型调用客户端（当前 mock）
packages/config     # Step1 材质/颜色模板配置
packages/workflow   # 队列与 Redis 会话封装
workers/            # BullMQ Worker 消费端
config/             # JSON 配置（材质/颜色模板等）
jobs/               # 预留任务目录
scripts/            # 预留脚本目录
tests/              # 测试目录（预留）
```

## 常见问题

- **`next` 命令不存在**：请使用 `pnpm --filter web dev` 或 `pnpm dev`。
- **端口占用**：3000 被占用时，Next 会自动切换到 3001。
- **Step 一直 pending**：请确认 Redis 与 Worker 是否启动。
- **真实 API 接入**：将 mock 开关设为 `0` 并替换 `packages/clients/*` 的实现。
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add root readme"
```

### Task 2: Switch default branch to `main`

**Files:**
- No code changes; git branch operations only.

- [ ] **Step 1: Rename local branch**

```bash
git branch -m master main
```

Expected: local branch name becomes `main`.

- [ ] **Step 2: Push and set upstream**

```bash
git push -u origin main
```

Expected: `main` branch created on remote and set as upstream.

- [ ] **Step 3: (Optional) Delete old remote branch**

```bash
git push origin --delete master
```

Expected: remote `master` removed if no longer needed.

- [ ] **Step 4: Set GitHub default branch**

Manual (GitHub UI): Settings → Branches → Default branch → select `main`.
```
