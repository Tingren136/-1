# 项目里程碑日志（自动维护）

> 目的：让后续 AI 仅查看仓库即可理解“做到哪里、每一步做了什么、下一步该做什么”。

## 2026-03-30

- `b6c2b60` 初始化独立项目仓库（web-shoe-generator）
- `6dd39af` 补设计文档（README + 默认分支）
- `60deb51` 补执行计划文档
- `58de2ef` 新增根 README（中文完整说明）
- 分支调整：默认分支已改为 `main`，远端 `master` 已删除
- `adc905b` 完成 Step4 + Step6 API/Queue/Worker/UI 主链路
- `a72a6c6` 补齐单测与 E2E（Vitest + Playwright）
- `9582fee` Step4/Step6 客户端增加真实接口可配置调用能力
- `3a5b090` 按 `api查询表.md` 对齐 RunningHub / 即梦 / 腾讯混元关键协议

## 2026-03-31

- 未提交：Step6 腾讯 3D 直连参数收敛为官方最小模板，区分文生/单图生/多视图生三种提交模式，查询收敛为 `JobId`，并新增提交/查询关键字段日志（不打印密钥）
- 未提交：补齐 `Response.Error.Code/Message` 解析；记录实测现象：当前 `api.ai3d.cloud.tencent.com` 端点将 `MultiViewImages` 单独提交判为无效输入（要求 `Prompt/ImageBase64/ImageUrl` 之一）
- 未提交：Step6 多视角提交改为“`ImageUrl` 主图 + `MultiViewImages(back)` 补充视角”混合模式，默认补充视角类型为 `back`
- 未提交：Step2/4/6 增加任务状态闭环（`running/succeeded/failed`）与错误落库，状态 API 支持 `failed/running`，前端轮询可正确停止失败任务
- 未提交：向导页新增“提交后生成”双阶段交互（Step1/2）、步骤导航与“下一步”、满意/不满意反馈、Step6 页面内 GLB 预览
- 未提交：向导页补齐“参数变更即失效”机制（Step1 参数或 Step2 饰品修改后自动清空下游结果并提示重新提交），避免沿用旧结果
- 未提交：修复 `model-viewer` 在 Next.js 16 + React 19 下的 JSX 类型声明，`next build` 已通过 TypeScript 阶段（当前仅受 `REDIS_URL` 缺失影响）
- 本地验证：`npm test` 通过；`npm run lint --workspace apps/web` 通过（仅 `img` 优化 warning）；`npm run build --workspace apps/web` 失败（缺少 `REDIS_URL` 环境变量）

## 2026-04-01

- 未提交：Step2 `packages/clients/gemini.ts` 新增 Gemini 真接口链路（图片下载 + `generateContent` + JSON 解析），保留 mock 回退
- 未提交：Step2 新增指数退避重试策略（`GEMINI_MAX_RETRIES`、`GEMINI_RETRY_DELAY_MS`、`GEMINI_TIMEOUT_MS`）
- 未提交：补齐 Step2 真接口单测 `tests/workflow/gemini.real.spec.ts`（缺 key、成功路径、503 后重试成功）
- 未提交：Step1 `packages/clients/comfyui.ts` 兼容 RunningHub `code=0,data=...` 返回体（支持 `data` 为 JSON 字符串或直接 taskId 字符串）
- 未提交：新增 Step1 调试抓样本开关 `RUNNINGHUB_CAPTURE_SUBMIT`，可将 submit 原始响应写入 `logs/runninghub-submit-samples.ndjson`
- 未提交：补齐 Step1 真接口解析单测 `tests/workflow/comfyui.real.spec.ts`（stringified data / direct task id）
- 未提交：同步更新 `.env.example`、`README.md`、`docs/project/PROJECT_STATUS.md`、`docs/project/AI_HANDOFF.md`
- 本地验证：`pnpm test tests/workflow/gemini.real.spec.ts` 通过；`pnpm test tests/workflow/comfyui.real.spec.ts` 通过；`pnpm test` 通过；`pnpm lint` 通过（仅 `img` warning）；`REDIS_URL=redis://localhost:6379 pnpm build` 通过

## 日志维护规则

1. 每次 push 到 `main`，都在本文件追加一条“提交号 + 变更摘要 + 影响范围”。
2. 若变更涉及接口字段，必须同步更新 `docs/project/AI_HANDOFF.md` 的“接口约定”章节。
3. 若变更影响可运行性，必须记录验证命令与结果。
