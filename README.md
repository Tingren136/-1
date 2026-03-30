# 鞋履概念生成向导（Web Shoe Generator）

这是一个基于 Next.js + BullMQ + Redis 的鞋履概念生成向导原型。
当前接口默认使用 mock，后续可平滑替换为真实模型与对象存储服务。

## 功能概览

- Step 1：草图生成
  - 根据鞋型、材质、纹理、颜色模板生成英文 prompt。
  - 入队后由 Step1 Worker 生成草图 URL。
- Step 2：中文提示词生成
  - 基于 Step1 草图与饰品类型（项链/手环/耳环）生成中文分析与提示词。
- Step 3：概念图生成
  - 基于 Step2 中文提示词生成概念图 URL。
- Session 状态管理
  - 所有步骤状态写入 Redis，前端通过 status API 轮询。

## 技术栈

- 前端与 API：Next.js App Router（TypeScript）
- 任务队列：BullMQ
- 状态存储：Redis（ioredis）
- 工作进程：Node.js + ts-node

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动 Redis（示例）

```bash
docker run --name webshoe-redis -p 6379:6379 -d redis:7
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

最少需要：

```env
REDIS_URL=redis://localhost:6379
```

### 4. 启动 Web

```bash
pnpm --filter web dev
# 或
pnpm dev
```

默认访问：`http://localhost:3000`

### 5. 启动 Worker（队列消费端）

```bash
pnpm ts-node --project workers/tsconfig.json workers/index.ts
```

说明：Worker 会同时消费 Step1/Step2/Step3 队列并把结果回写 Redis。

## 环境变量

`.env.example` 已包含基础字段：

- `REDIS_URL`：Redis 连接地址（必填）
- `OBJECT_STORAGE_BUCKET`：对象存储桶（真实接入时使用）
- `COMFY_API_KEY` / `RUNNINGHUB_API_KEY`：RunningHub 鉴权密钥（二选一，建议直接配 `RUNNINGHUB_API_KEY`）
- `RUNNINGHUB_APP_ID`：RunningHub AI 应用 ID（Step1 必填）
- `GEMINI_API_KEY`、`JIMENG_API_KEY`、`TENCENT_API_KEY`：其它模型密钥

常用可选项：

- `REDIS_SESSION_TTL`：会话过期秒数，默认 `86400`
- `COMFYUI_MOCK`：默认 mock（不设或非 `0` 视为 mock）
- `GEMINI_MOCK`：默认 mock
- `JIMENG_MOCK`：默认 mock
- `TENCENT3D_MOCK`：默认 mock
- `OBJECT_STORAGE_MOCK`：默认 mock

可选 mock URL：

- `COMFYUI_MOCK_BASE_URL`
- `JIMENG_MOCK_BASE_URL`
- `TENCENT3D_MOCK_BASE_URL`
- `OBJECT_STORAGE_PUBLIC_BASE_URL`

即梦真实接口参数（当 `JIMENG_MOCK=0` 时生效）：

- `JIMENG_API_BASE_URL`（默认 `https://ark.cn-beijing.volces.com/api/v3`）
- `JIMENG_API_GENERATE_PATH`（默认 `/images/generations`）
- `JIMENG_API_BLEND_PATH`
- `JIMENG_API_QUERY_PATH`（支持 `{taskId}` 占位符）
- `JIMENG_API_TIMEOUT_MS`
- `JIMENG_API_POLL_INTERVAL_MS`
- `JIMENG_MODEL`（默认 `doubao-seedream-5-0-260128`）
- `JIMENG_IMAGE_SIZE`（默认 `2K`）
- `JIMENG_RESPONSE_FORMAT`（默认 `url`）
- `JIMENG_WATERMARK`（`1` 开启，`0` 关闭）

RunningHub（Step1）真实接口参数（当 `COMFYUI_MOCK=0` 时生效）：

- `RUNNINGHUB_API_BASE_URL`（默认 `https://www.runninghub.cn`）
- `RUNNINGHUB_APP_ID`
- `RUNNINGHUB_NODE_ID`（默认 `64`）
- `RUNNINGHUB_FIELD_NAME`（默认 `text`）
- `RUNNINGHUB_INSTANCE_TYPE`（默认 `default`）
- `RUNNINGHUB_USE_PERSONAL_QUEUE`（默认 `false`）
- `RUNNINGHUB_RETAIN_SECONDS`
- `RUNNINGHUB_TIMEOUT_MS`
- `RUNNINGHUB_POLL_INTERVAL_MS`

腾讯 3D 真实接口参数（当 `TENCENT3D_MOCK=0` 时生效）：

- `TENCENT3D_API_BASE_URL`（默认 `https://api.ai3d.cloud.tencent.com`）
- `TENCENT3D_API_SUBMIT_PATH`（默认 `/v1/ai3d/submit`）
- `TENCENT3D_API_QUERY_PATH`（默认 `/v1/ai3d/query`）
- `TENCENT3D_MODEL`（默认 `3.0`）
- `TENCENT3D_API_TIMEOUT_MS`
- `TENCENT3D_API_POLL_INTERVAL_MS`

## API（当前默认 mock）

### 1) 创建会话

`POST /api/session`

响应示例：

```json
{
  "sessionId": "<uuid>"
}
```

### 2) 查询会话

`GET /api/session/:id`

响应示例：

```json
{
  "sessionId": "<uuid>",
  "state": {
    "currentStep": 1,
    "step1": { "imageUrl": "...", "prompt": "..." }
  }
}
```

### 3) Step 1 草图生成

`POST /api/steps/1`

请求示例：

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
    "customColorPhrase": ""
  }
}
```

响应示例：

```json
{
  "status": "queued",
  "jobId": "<id>",
  "prompt": "..."
}
```

状态查询：`GET /api/steps/1/status?sessionId=<uuid>`

- pending：

```json
{ "status": "pending" }
```

- done：

```json
{
  "status": "done",
  "result": {
    "imageUrl": "...",
    "prompt": "..."
  }
}
```

### 4) Step 2 中文提示词生成

`POST /api/steps/2`

请求示例：

```json
{
  "sessionId": "<uuid>",
  "accessoryTag": "项链",
  "step1ImageUrl": "https://example.com/step1.png"
}
```

说明：`step1ImageUrl` 可省略，后端会从 session 的 step1 结果中回读。

响应示例：

```json
{
  "status": "queued",
  "jobId": "<id>"
}
```

状态查询：`GET /api/steps/2/status?sessionId=<uuid>`

- pending：

```json
{ "status": "pending" }
```

- done：

```json
{
  "status": "done",
  "result": {
    "analysisCn": "...",
    "promptCn": "..."
  }
}
```

### 5) Step 3 概念图生成

`POST /api/steps/3`

请求示例：

```json
{
  "sessionId": "<uuid>",
  "promptCn": "简洁利落的鞋履设计，比例匀称..."
}
```

说明：`promptCn` 可省略，后端会从 session 的 step2 结果中回读。

响应示例：

```json
{
  "status": "queued",
  "jobId": "<id>"
}
```

状态查询：`GET /api/steps/3/status?sessionId=<uuid>`

- pending：

```json
{ "status": "pending" }
```

- done：

```json
{
  "status": "done",
  "result": {
    "imageUrl": "...",
    "promptCn": "..."
  }
}
```

### 6) 上传签名（mock）

`POST /api/assets/upload`

响应示例：

```json
{
  "uploadUrl": "https://example.com/mock-assets/upload/<key>",
  "assetUrl": "https://example.com/mock-assets/<key>",
  "mock": true
}
```

当 `OBJECT_STORAGE_MOCK=0` 且未实现真实签名逻辑时，会返回 `501 upload_not_configured`。

## 队列与 Worker 流程

- API 路由入队：
  - Step1 -> `step1` queue
  - Step2 -> `step2` queue
  - Step3 -> `step3` queue
- Worker 消费：`workers/index.ts` 同时启动 3 个 worker。
- 结果回写：worker 完成后写入 Redis 对应 session 字段（`step1`、`step2`、`step3`）。

## 目录结构

```text
apps/web            Next.js 前端与 API 路由
config/             业务配置 JSON（材质/颜色模板等）
packages/clients    模型客户端（当前默认 mock）
packages/config     Step1 prompt 组装逻辑
packages/workflow   队列定义与 Redis session 封装
workers/            BullMQ worker 进程
jobs/               预留目录
scripts/            预留目录
tests/              测试目录（当前仅占位）
```

## 常见问题

- `next` 命令不存在
  - 请使用 `pnpm --filter web dev` 或 `pnpm dev`，不要直接运行 `next dev`。
- 3000 端口被占用
  - Next 会自动切换到 3001，或手动释放 3000 端口。
- 接口一直 `pending`
  - 先确认 Redis 与 Worker 是否都已启动。
- 想接入真实 API
  - 将 mock 开关改为 `0`，并实现 `packages/clients/*` 与上传签名逻辑。

## 版本管理建议

推荐采用分支工作流：

- `main`：稳定可用版本
- 功能分支：`feature/<name>`
- 修复分支：`fix/<name>`

每次改动保持小步提交，便于回看“每一代”版本变化。
