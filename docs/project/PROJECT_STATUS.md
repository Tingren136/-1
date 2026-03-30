# 项目状态快照（2026-03-30）

## 1. 仓库与版本

- 仓库地址：`https://github.com/Tingren136/-1.git`
- 默认分支：`main`
- 当前提交：`3a5b090`
- 目标：鞋履概念生成向导（Web + API + Queue Worker）

## 2. 当前完成范围

### 2.1 前端向导

- 已完成页面：`/wizard`
- 已完成步骤：Step1、Step2、Step3、Step4、Step6
- 交互能力：
  - Step1 颜色模式（单色/主辅色）
  - Step2 饰品标签选择
  - Step4 用户照片 URL 输入 + mock 上传地址生成
  - Step6 3D 结果链接展示（GLB/OBJ/前后视图）

### 2.2 API 路由

- Session：
  - `POST /api/session`
  - `GET /api/session/[id]`
- Assets：
  - `POST /api/assets/upload`（当前签名逻辑是 mock）
- Steps：
  - `POST /api/steps/1` + `GET /api/steps/1/status`
  - `POST /api/steps/2` + `GET /api/steps/2/status`
  - `POST /api/steps/3` + `GET /api/steps/3/status`
  - `POST /api/steps/4` + `GET /api/steps/4/status`
  - `POST /api/steps/6` + `GET /api/steps/6/status`

### 2.3 队列与 Worker

- 已有 queue：`step1`、`step2`、`step3`、`step4`、`step6`
- 已有 worker：`workers/jobs/step1.ts` ~ `step6.ts`（不含 step5）
- Session 结果写回 Redis：已打通

### 2.4 客户端接入状态

- Step1（Comfy/RunningHub）：
  - `COMFYUI_MOCK=1` 走 mock
  - `COMFYUI_MOCK=0` 走 RunningHub `run/query` 真实链路
- Step2（Gemini）：当前默认 mock（已可用）
- Step3/4（即梦）：
  - `JIMENG_MOCK=1` 走 mock
  - `JIMENG_MOCK=0` 支持真实调用与轮询
- Step6（腾讯混元 3D）：
  - `TENCENT3D_MOCK=1` 走 mock
  - `TENCENT3D_MOCK=0` 支持 `submit/query` 真实调用

## 3. 最近验证结果（2026-03-30）

- `npm run lint --workspace apps/web`：通过（仅 `<img>` warnings）
- `npm run build --workspace apps/web`：通过
- `npm test`：通过（Vitest）
- `npm run test:e2e`：通过（Playwright）

## 4. 当前已知未完成/待增强项

1. Step2 真实 Gemini 接口尚未切为生产调用（目前 mock 可跑通）。
2. `/api/assets/upload` 仍是 mock 签名逻辑，未接真实对象存储签名。
3. Step6 前端目前展示下载链接，尚未嵌入真实 3D 模型预览组件。
4. 真接口联调尚未进行（缺真实 key 与账户配额验证）。

## 5. 真接口联调所需最小配置

- Redis：`REDIS_URL`
- RunningHub Step1：`RUNNINGHUB_API_KEY`（或 `COMFY_API_KEY`）、`RUNNINGHUB_APP_ID`、`COMFYUI_MOCK=0`
- 即梦 Step3/4：`JIMENG_API_KEY`、`JIMENG_MOCK=0`
- 腾讯 Step6：`TENCENT_API_KEY`、`TENCENT3D_MOCK=0`

## 6. 建议下一步（优先级）

1. 做一次“真接口全链路联调”（Step1 -> 2 -> 3 -> 4 -> 6）。
2. 补 Step2（Gemini）真实调用版本与错误重试策略。
3. 对 Step6 增加模型预览组件（如 model-viewer）。
4. 将上传接口从 mock 改为真实对象存储签名。
