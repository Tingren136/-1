# AI 交接手册（Handoff）

## 1. 先读这三份文档

1. `docs/project/PROJECT_STATUS.md`
2. `docs/project/PROJECT_LOG.md`
3. `README.md`

## 2. 项目启动命令

```bash
npm install --workspaces --include-workspace-root
npm run dev --workspace apps/web
pnpm ts-node --project workers/tsconfig.json workers/index.ts
```

## 3. 核心验证命令

```bash
npm run lint --workspace apps/web
npm run build --workspace apps/web
npm test
npm run test:e2e
```

## 4. 关键路径（代码）

- 前端向导：`apps/web/src/app/wizard/page.tsx`
- 样式：`apps/web/src/app/wizard/wizard.module.css`
- Step API：`apps/web/src/app/api/steps/*`
- 队列定义：`packages/workflow/queues.ts`
- Worker：`workers/jobs/step1.ts` ~ `step6.ts`
- 客户端：
  - `packages/clients/comfyui.ts`
  - `packages/clients/gemini.ts`
  - `packages/clients/jimeng.ts`
  - `packages/clients/tencent3d.ts`

## 5. 接口约定（当前）

### 5.1 RunningHub（Step1）

- 提交：`POST /openapi/v2/run/ai-app/{RUNNINGHUB_APP_ID}`
- 查询：`POST /openapi/v2/query`
- 鉴权：`Authorization: Bearer <RUNNINGHUB_API_KEY>`
- 关键入参：`nodeInfoList`（默认 nodeId=64, fieldName=text）

### 5.2 即梦/Ark（Step3/4）

- 生成：默认 `/images/generations`
- 融合：默认 `/v1/blend`
- 查询（若返回 taskId）：默认 `/v1/tasks/{taskId}`
- 鉴权：`Authorization: Bearer <JIMENG_API_KEY>`

### 5.3 腾讯混元 3D（Step6）

- 提交：`POST /v1/ai3d/submit`
- 查询：`POST /v1/ai3d/query`，body 带 `JobId`
- 鉴权：`Authorization: <TENCENT_API_KEY>`

## 6. 进行中目标

1. 用户提供真实 key 后，跑全链路真接口联调并固化结果。
2. 补 Step2 的 Gemini 真实调用。
3. 把上传接口从 mock 改为真实对象存储签名。

## 7. 约束与原则

- 默认不破坏 mock：任何真实接口改造都必须保留 mock 回退。
- 每次改动都先跑最少 `build + test`。
- 影响上下文的决策（字段映射、超时策略）必须更新本手册与状态快照。
