import { Component, type ErrorInfo, type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">界面发生异常，但程序没有退出</h1>
            <p className="mt-2 text-sm text-slate-600">通常是某个模型返回的数据结构不完整。刷新页面即可继续使用；请把下面的错误发给我定位。</p>
            <pre className="mt-4 rounded-lg bg-slate-950 p-4 text-xs text-rose-200 overflow-auto whitespace-pre-wrap">{this.state.error.message}</pre>
            <button
              className="mt-4 h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium"
              onClick={() => window.location.reload()}
            >
              刷新应用
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

async function bootstrap() {
const initialSettings = import.meta.env.MODE === 'commercial' ? {} : await window.tkDesktop?.loadSettings() || {};
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App initialSettings={initialSettings} />
    </ErrorBoundary>
  </StrictMode>,
);

}
bootstrap().catch(error => { document.getElementById('root')!.textContent = '配置读取失败，请检查 userData 中的 settings.json：' + error.message; });
