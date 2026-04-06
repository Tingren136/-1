# 本地地址与路径速查（Windows）

## 1) 主项目目录（当前使用）

- 项目根目录：`D:\cc project\新建文件夹 (2)\-1`
- 前端向导页面源码：`D:\cc project\新建文件夹 (2)\-1\apps\web\src\app\wizard\page.tsx`
- Step1 客户端（RunningHub）：`D:\cc project\新建文件夹 (2)\-1\packages\clients\comfyui.ts`
- Worker 入口：`D:\cc project\新建文件夹 (2)\-1\workers\index.ts`

## 2) 本地访问地址

- 首页：`http://localhost:3000`
- 向导页：`http://localhost:3000/wizard`
- 会话创建接口：`POST http://localhost:3000/api/session`
- Step1 状态接口：`GET http://localhost:3000/api/steps/1/status?sessionId=<sessionId>`

## 3) 环境变量文件位置

- 前端/接口实际读取：`D:\cc project\新建文件夹 (2)\-1\apps\web\.env.local`
- 模板文件：`D:\cc project\新建文件夹 (2)\-1\.env.example`

说明：`REDIS_URL` 必须配置在 `apps/web/.env.local`，否则会出现“会话初始化失败”。

## 4) 运行日志与临时文件（默认在项目根目录）

- 开发日志（临时）：`.dev.log`
- Worker 日志（临时）：`.worker-real-*.log`、`.worker.log`

这些是临时调试文件，不建议提交到 Git。

## 5) 历史目录（避免混用）

- 历史副本：`H:\1.论文参考\个人论文所有文件\网页生成项目\-1`

说明：当前开发统一使用 `D:\cc project\新建文件夹 (2)\-1`。  
如果两个目录同时启动 `next dev`，会导致你看到“页面和代码对不上”的问题。
