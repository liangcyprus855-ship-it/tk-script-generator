# TK Script Generator project rules

- Maintain application source directly in this repository. Never edit base64 archives or patch source in CI. The legacy source_parts archive is historical only.
- Next release is 1.0.3. Keep package version, health response, release notes and installer expectations aligned.
- Preserve React UI, Ollama/cloud adapters, separate vision/script models, visualFacts and existing prompts/business behavior.
- Electron must call the exported backend startServer in its main process. Do not spawn Node or Electron to run the backend.
- Bind loopback only; use port 0, await listening and /api/health before opening the window. Close the HTTP server on quit.
- Resolve production assets from app.getAppPath(), never cwd. Import Vite only in explicit development mode.
- Persist model settings beneath userData through IPC. Encrypt API keys using Electron safeStorage; never log keys or commit credentials.
- Log startup failures under userData/logs. Test Chinese and space paths, packaged startup, and shutdown.
- Run npm install, npm run typecheck, npm test, npm run build, npm run desktop:pack and the packaged smoke check. Fix failures before marking complete.
- CI must run install → typecheck → test → build → NSIS installer → smoke check → artifact. Report live provider and auto-update checks separately if credentials/releases are unavailable.
