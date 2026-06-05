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
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok || data?.success === false) {
    throw new ApiError(data?.message || `API error: ${path} (${response.status})`, response.status);
  }
  return (data && Object.prototype.hasOwnProperty.call(data, 'result') ? data.result : data) as T;
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
