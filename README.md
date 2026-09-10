# TK Script Generator 1.0.2

TK 跨境带货脚本生成器，React + Express + Electron Windows 桌面项目。

## 开发与验证

使用 Node.js 22 LTS。应用源码现在直接位于仓库根目录；历史 source_parts 和 ZIP 只保留溯源，不参与构建。

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run desktop:pack
node scripts/smoke.cjs
```

`npm run dev` 启动 Web 开发服务。`npm run desktop:dev` 先构建后以 Electron 开发模式启动，Vite 仅在明确的开发模式加载。`npm start` 启动构建后的独立 Web 服务。

## 桌面架构

Electron main → require(dist/server.cjs).startServer → 127.0.0.1:0 → 实际监听地址 → /api/health → BrowserWindow。

生产资源从 app.getAppPath()/dist 读取，不依赖 cwd、外部 Node 或 app.asar.unpacked 后端子进程。退出时关闭 HTTP server 和活动连接。

双模型配置通过 preload IPC 保存到 app.getPath('userData')/settings.json，API Key 使用 Electron safeStorage 的系统加密。配置不依赖每次变化的端口。启动与关闭日志写入 userData/logs/startup.log。不能解密或配置损坏时显示错误，不静默覆盖。

Ollama、云端 API、独立视觉/脚本模型、visualFacts、React UI 和业务提示词保留。模型连接需要用户本地 Ollama 或有效服务商配置。

## Windows 交付

安装包位于 release/TK-Script-Generator-Setup-1.0.2.exe，附带 latest.yml 和 blockmap。GitHub Actions 执行 install → typecheck → test → build → NSIS → packaged smoke → artifact。

`node scripts/smoke.cjs` 自动复制打包程序到中文空格路径，验证界面、IPC、健康检查、系统加密配置、重启和关闭端口。传入已安装目录可验证实际安装结果：`node scripts/smoke.cjs '安装目录'`。

GitHub 自动更新通道保留，但私有仓库的终端用户更新访问、正式签名和从旧版本下载更新需独立验证。构建成功不代表已发布 Release。

完整工程规则见 AGENTS.md，验证记录见 VALIDATION.md。
