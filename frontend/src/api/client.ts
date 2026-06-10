export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = {
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers || {})
  };
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers
    });
  } catch {
    throw new ApiError('通信に失敗しました。端末の接続状態を確認してください。', 0);
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError('サーバーから不正な応答を受信しました。', response.status);
  }
  const body = data as { success?: boolean; message?: string; status?: number } | null;
  if (!response.ok || body?.success === false) {
    const fallback = response.status >= 500
      ? 'サーバー処理に失敗しました。しばらくしてから再実行してください。'
      : '操作を完了できませんでした。';
    const message = body?.message && !body.message.includes('Failed to run JavaScript') ? body.message : fallback;
    throw new ApiError(message, body?.status || response.status);
  }
  const record = data as Record<string, unknown> | null;
  return (record && Object.prototype.hasOwnProperty.call(record, 'result') ? record.result : data) as T;
}

export function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value));
  });
  const query = search.toString();
  return request<T>(`${path}${query ? `?${query}` : ''}`);
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}
