# 1.0.2 验证记录

## 根因证据

从 GitHub Actions Run #12 下载实际 1.0.1 安装包并提取应用，以其自带 Electron 和原 app.asar.unpacked/dist/server.cjs 启动后端，复现 `Error: Cannot find module 'vite'`，后端退出码 1。

原 server.ts 顶层导入 Vite，即使 NODE_ENV=production 也会加载；Vite 同时列在 dependencies 与 devDependencies，旧安装产物的后端解析不到该模块。主进程对子进程退出仅打印日志，仍轮询 30 秒，因此用户最终看到 Local server startup timeout。更早 1.0.0 还把 app.asar 当成 cwd。

## 改动

- 正常源码版本管理替代 CI 解码 ZIP 和字符串热补丁。
- 后端导出启动函数；Electron 主进程直接挂载；Vite 改为仅开发环境动态加载。
- 动态 loopback 端口、专用 health、生产资源绝对路径、退出清理。
- userData 日志、IPC 配置保存、safeStorage 加密密钥、前端启动前加载配置。
- 增加类型依赖、测试、锁文件、CI 和 AGENTS.md。

## 本地结果（Windows 10，Node 24.17.0，Electron 37.10.3）

- npm install：通过。
- npm run typecheck：通过（修复原项目缺少 React 类型依赖）。
- npm test：4 项通过，覆盖端口、health、静态资源、非法请求、端口占用、缺失资源、关闭连接、配置加密、双模型与 visualFacts 模拟服务回归。
- npm run build：通过。
- npm run desktop:pack：Windows x64 NSIS 成功，生成 EXE、latest.yml、blockmap。
- 打包程序启动/重启：通过。应用与 userData 路径含中文和空格；实际加载 React、preload IPC 与后端；系统加密配置跨重启保留；退出关闭端口。
- NSIS /S /currentuser 实际安装：退出码 0；中文空格安装目录两次启动验证通过。NSIS /D 参数必须最后且不加引号，测试启动器已按此处理。
- 启动失败注入：移除测试应用后端后，确认错误写入 userData/logs/startup.log，并以退出码 1 结束；修复 Electron app.quit 不采用 process.exitCode 的问题。

## 尚需外部条件的验证

- 真实 Ollama 已完成 qwen2.5vl:3b 图片识别（约 42 秒）→ visualFacts → qwen3:4b 脚本生成（约 22 秒），均 HTTP 200，得到 5 个分镜。此验证证明流程可用，不代表模型事实识别完全准确；例如图标材质被模型误判为塑料。
- 真实云端 API 生成质量、速度、额度：尚未使用用户密钥验证。
- 旧版本升级到 1.0.2 的在线更新下载与安装：尚未发布正式 Release，私有仓库更新权限也需配置。
- 正式代码签名、SmartScreen 信誉和其他 Windows 设备：本轮未验证。

CI 状态与最终 commit/PR 在交付消息提供，不能用本地通过代替 CI 结果。
