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
- 调试抓样本：设 `RUNNINGHUB_CAPTURE_SUBMIT=1` 后，submit 响应会落盘到 `logs/runninghub-submit-samples.ndjson`（用于对比成功/失败原始 JSON）

### 5.2 即梦/Ark（Step3/4）

- 生成：默认 `/images/generations`
- 融合：默认 `/images/generations`（以 `images` 传入参考图）
- 查询（若返回 taskId）：默认 `/v1/tasks/{taskId}`
- 鉴权：`Authorization: Bearer <JIMENG_API_KEY>`

### 5.2b Gemini（Step2）

- 调用：`POST /v1beta/models/{GEMINI_MODEL}:generateContent`
- 鉴权：`X-Goog-Api-Key: <GEMINI_API_KEY>`
- 输入：先下载 Step1 图（URL），再以 `inline_data(base64)` 携带图片
- Step2 Prompt 可自定义：优先读 `GEMINI_PROMPT_TEMPLATE`，其次 `GEMINI_PROMPT_FILE`，再其次 `.local/step2-agent-prompt.txt`
- 支持占位符：`{accessoryTag}`、`{step1Prompt}`
- 输出：要求模型返回 JSON：`{"analysisCn":"...","promptCn":"..."}`
- 重试：对 `408/429/5xx` 与网络错误做指数退避重试（`GEMINI_MAX_RETRIES` + `GEMINI_RETRY_DELAY_MS`）

### 5.3 腾讯混元 3D（Step6）

- 提交：`POST /v1/ai3d/submit`
- 查询：`POST /v1/ai3d/query`，body 带 `JobId`
- 鉴权：`Authorization: <TENCENT_API_KEY>`
- 提交模板：
  - 文生 3D：`{ "Prompt": "..." }`
  - 单图生 3D：`{ "ImageUrl": "..." }`（图生默认不再传 `Prompt`）
  - 单图 + 多视角补充：`{ "ImageUrl": "...", "MultiViewImages": [{ "ViewType": "back", "ViewImageUrl": "..." }] }`
- 实测（2026-03-31）：`api.ai3d.cloud.tencent.com/v1/ai3d/submit` 要求 `Prompt/ImageBase64/ImageUrl` 至少其一；仅传 `MultiViewImages` 会被判空。
- 查询状态语义：`WAIT`/`RUN` 继续轮询，`FAIL` 结束并读取 `ErrorCode/ErrorMessage`，`DONE` 结束并读取 `ResultFile3Ds`
- 当前多视角推荐提交方式：`ImageUrl` 放主图，`MultiViewImages` 放补充视角（默认 `back`，可用水平翻转图）

### 5.4 Step 状态接口（Step2/4/6）

- 状态接口统一返回：`pending` / `running` / `failed` / `done`
- Worker 失败时会写入：`stepXError = { message, at, jobId }`
- 重新提交任务时会清理旧结果与旧错误，并将 `stepXStatus` 置为 `running`

## 6. 进行中目标

1. 用户提供真实 key 后，跑全链路真接口联调并固化结果。
2. 把上传接口从 mock 改为真实对象存储签名。

## 7. 约束与原则

- 默认不破坏 mock：任何真实接口改造都必须保留 mock 回退。
- 每次改动都先跑最少 `build + test`。
- 影响上下文的决策（字段映射、超时策略）必须更新本手册与状态快照。
