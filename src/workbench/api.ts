export const API_BASE = String((import.meta.env as any).VITE_COMMERCIAL_API_BASE_URL || 'https://107-173-144-109.nip.io:8443').replace(/\/+$/, '');
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function request(path: string, token = '', body?: unknown) {
  let response: Response;
  try {
    response = await fetch(API_BASE + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  } catch { throw new ApiError('连接暂时中断，请检查网络后重试', 0); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || '服务暂时不可用，请稍后重试', response.status);
  return data;
}
