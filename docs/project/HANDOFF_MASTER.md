# 项目总交接（MASTER）

> 本文件是给“新 AI 接手”用的单一入口。  
> 若其它文档与本文件有差异，以本文件为准。

## 1. 当前快照

- 仓库：`https://github.com/Tingren136/-1.git`
- 分支：`main`
- 最新提交：`f08b136`
- 本地主目录：`D:\cc project\新建文件夹 (2)\-1`
- 时间基线：2026-04-06（北京时间）

## 2. 新 AI 必须先读什么（顺序）

1. 本文件：`docs/project/HANDOFF_MASTER.md`
2. 项目说明：`README.md`
3. 本机私有说明：`.local/README.txt`
4. 本机真实运行参数：`.local/runtime.env`（只读，不提交）

## 3. 关键规则（防止反复沟通）

1. 代码结构和接口说明看 `README.md`，**实际运行参数一律以 `.local/runtime.env` 为准**。
2. 不要再向用户索要 key；本机 key 已在 `.local/runtime.env`。
3. `.local/`、`logs/`、任何密钥不得提交到 GitHub。
4. 每次改动至少验证：
   - `pnpm test -- tests/config/prompt.spec.ts`（或相关最小测试）
   - `pnpm --filter web build`

## 4. 启动与访问（Windows）

项目根目录：

- `D:\cc project\新建文件夹 (2)\-1`

启动命令（PowerShell）：

```powershell
powershell -ExecutionPolicy Bypass -File "D:\cc project\新建文件夹 (2)\-1\.local\start-web.ps1"
powershell -ExecutionPolicy Bypass -File "D:\cc project\新建文件夹 (2)\-1\.local\start-worker.ps1"
```

访问地址：

- 向导页：`http://localhost:3000/wizard`

## 5. 流程总览（已打通）

- Step1：草图生成（RunningHub）
- Step2：中文提示词（Gemini）
- Step3：概念图（即梦 Ark）
- Step4：用户图融合（即梦 Ark 多图）
- Step6：多视图 3D（腾讯混元 3D）

队列：

- `step1`、`step2`、`step3`、`step4`、`step6`

Worker 入口：

- `workers/index.ts`

## 6. 关键实现与文件地图

前端向导：

- `apps/web/src/app/wizard/page.tsx`
- `apps/web/src/app/wizard/wizard.module.css`

API 路由：

- Step1：`apps/web/src/app/api/steps/1/*`
- Step2：`apps/web/src/app/api/steps/2/*`
- Step3：`apps/web/src/app/api/steps/3/*`
- Step4：`apps/web/src/app/api/steps/4/*`
- Step6：`apps/web/src/app/api/steps/6/*`
- 资源上传：`apps/web/src/app/api/assets/upload/route.ts`
- 资源代理：`apps/web/src/app/api/assets/proxy/route.ts`

模型客户端：

- RunningHub：`packages/clients/comfyui.ts`
- Gemini：`packages/clients/gemini.ts`
- 即梦：`packages/clients/jimeng.ts`
- 腾讯3D：`packages/clients/tencent3d.ts`

流程/会话：

- Redis 封装：`packages/workflow/redis.ts`
- 队列定义：`packages/workflow/queues.ts`
- Step6 取图策略：`packages/workflow/step6.ts`
- Step6 翻转图：`packages/workflow/image.ts`

Step1 Prompt 组装：

- `packages/config/step1.ts`
- `config/step1-material-config.json`

## 7. 近期关键变更（必须知道）

1. Step6 前视图选择逻辑已修：
   - 默认优先 Step3，再回退 Step4；
   - 可用 `STEP6_FRONT_SOURCE=step3|step4` 覆盖。
2. Step6 后视图自动生成：
   - 前视图做水平翻转后上传，作为补充 `back` 视角。
3. Step6 3D 预览跨域问题已修：
   - 前端 `model-viewer` 改走同源代理 `/api/assets/proxy`，避免 CORS 导致只显示缩略图。
4. Step4 长链接溢出已修：
   - 文本块支持换行，不再撑破卡片布局。
5. Step1 颜色映射 bug 已修：
   - `primary/secondary` 与 `colorA/colorB` 兼容映射，釉面陶颜色能正确进入提示词。
6. 已新增“导出静态报告 HTML”按钮：
   - 生成单文件静态 HTML（UTF-8，内联样式），避免浏览器“另存网页”产生乱码背景。

## 8. 已知“看似矛盾”与正确理解

### A. README 写“默认 mock”，但本机是实时接口

- 这是正常分层：
  - `README` 讲仓库默认模板（可跑 mock）；
  - `.local/runtime.env` 是这台机器的真实运行配置。

### B. `.env.example` 和 `.local/runtime.env` 字段不完全一致

- 也是正常：
  - `.env.example` 是模板；
  - `.local/runtime.env` 可包含本机额外变量（如 `IMAGE_FLIP_MOCK`）。

### C. Step6 偶尔只看到图片不动

- 常见原因：
  1. GLB 链接过期（签名时效）；
  2. Worker 没跑；
  3. 代理接口不可用。
- 先检查：
  - Worker 进程是否在跑；
  - 重新执行一次 Step6 生成新链接；
  - `/api/assets/proxy` 是否正常返回。

## 9. 最小排查清单（新 AI 出手前）

1. `git status` 必须先看，确认是否干净。
2. 如果用户说“卡住”：
   - 看 worker 是否在跑；
   - 看 queue 有无 `waiting/active`；
   - 看 Redis 里 `stepXStatus/stepXError`。
3. 如果用户说“效果不对”：
   - 先确认输入源是否对（尤其 Step4 图一/图二顺序、Step6 前视图来源）。
4. 改完后必须执行：
   - 最小测试
   - `pnpm --filter web build`

## 10. 提交规范（本项目约定）

1. 允许提交：代码、测试、README/docs。
2. 禁止提交：`.local/*`、任何密钥、日志敏感内容。
3. 提交后回传给用户：
   - commit hash
   - 变更摘要
   - 是否已通过 build/test

## 11. 给新 AI 的一段固定开场（可直接复制）

```text
请先读取并遵循 docs/project/HANDOFF_MASTER.md。
然后读取 README.md、.local/README.txt、.local/runtime.env（只读，不提交）。
不要再问我要 key。先启动 web 和 worker，确认 /wizard 可访问后再开始处理任务。
```

