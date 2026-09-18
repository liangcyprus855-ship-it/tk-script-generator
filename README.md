# TK Script Generator

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

每次把代码推送到 `master` 后，GitHub Actions 会自动完成检查、构建 Windows EXE，并发布到 GitHub Releases。每个版本包含：

- `TK-Script-Generator-Setup-版本号.exe`：Windows 安装包
- `latest.yml` 和 `.blockmap`：应用自动更新所需文件
- GitHub 自动生成的源码压缩包：对应本次版本代码

用户安装只需要三步：

1. 打开仓库的 [Releases](https://github.com/liangcyprus855-ship-it/tk-script-generator/releases) 页面。
2. 进入最新版本，下载名称以 `Setup-` 开头的 `.exe` 文件。
3. 双击安装包，按提示完成安装；以后打开应用时，有新版本会自动提示更新。

开发者发布新版本时，只需修改 `package.json` 的 `version`，同步更新 `release-notes.md`，提交并推送到 `master`。构建或测试失败时不会发布安装包。

`node scripts/smoke.cjs` 自动复制打包程序到中文空格路径，验证界面、IPC、健康检查、系统加密配置、重启和关闭端口。传入已安装目录可验证实际安装结果：`node scripts/smoke.cjs '安装目录'`。

GitHub Actions 会在构建和测试全部通过后自动创建或更新同版本 Release，因此仓库页面会同时提供源码和 EXE 安装包。

完整工程规则见 AGENTS.md，验证记录见 VALIDATION.md。
