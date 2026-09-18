export const API_BASE = String((import.meta.env as any).VITE_COMMERCIAL_API_BASE_URL || 'https://107-173-144-109.nip.io:8443').replace(/\/+$/, '');
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
interface RequestOptions {
  /** Only use this for idempotent or server-deduplicated requests. */
  retryOnNetwork?: number;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function request(path: string, token = '', body?: unknown, options: RequestOptions = {}) {
  const maxAttempts = 1 + Math.max(0, Math.min(3, options.retryOnNetwork ?? 0));
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(API_BASE + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new ApiError(data.error || '服务暂时不可用，请稍后重试', response.status);
      return data;
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError || attempt >= maxAttempts) break;
      await wait(attempt * 900);
    }
  }
  if (lastError instanceof ApiError) throw lastError;
  throw new ApiError(maxAttempts > 1 ? '服务器连接不稳定，已自动重试仍未成功，请稍后再试' : '连接暂时中断，请检查网络后重试', 0);
}
