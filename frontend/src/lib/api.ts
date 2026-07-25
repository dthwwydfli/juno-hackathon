const base = () => (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000';

export function apiBaseUrl(): string {
  return base();
}

export function pdfOrigin(): string {
  const o = (import.meta.env.VITE_PUBLIC_PDF_ORIGIN as string | undefined)?.trim();
  return (o || base()).replace(/\/$/, '');
}

export function apiUserId(): string {
  return (import.meta.env.VITE_USER_ID as string | undefined)?.trim() || 'demo';
}

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface HealthResponse {
  status: string;
  meddata_configured?: boolean;
  app_db_ok?: boolean;
}

export async function checkApiHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health', { timeoutMs: 8_000 });
}

export function formatApiReachabilityError(cause: unknown): string {
  const api = apiBaseUrl();
  if (cause instanceof ApiError && cause.status === 408) {
    return `Server at ${api} did not respond in time. Open ${api}/health in your browser.`;
  }
  const msg = cause instanceof Error ? cause.message : String(cause);
  if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
    return `Cannot reach the API at ${api}. Open ${api}/health and ensure the backend is running (uvicorn app.main:app --reload --port 8000 --app-dir . from backend/).`;
  }
  return msg;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { userId?: string; timeoutMs?: number } = {},
): Promise<T> {
  const { userId, headers: initHeaders, timeoutMs, ...rest } = init;
  const headers = new Headers(initHeaders);
  headers.set('X-User-Id', userId ?? apiUserId());
  if (rest.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : undefined;
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
      ...rest,
      headers,
      signal: controller ? controller.signal : rest.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError('Request timed out', 408);
    }
    throw e;
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
  const text = await res.text();
  let data: unknown = text;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : res.statusText || 'Request failed';
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}
