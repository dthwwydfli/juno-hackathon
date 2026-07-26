const base = () => (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000';

export function apiBaseUrl(): string {
  return base();
}

export function pdfOrigin(): string {
  const o = (import.meta.env.VITE_PUBLIC_PDF_ORIGIN as string | undefined)?.trim();
  return (o || base()).replace(/\/$/, '');
}

const DEFAULT_APP_ORIGIN = 'https://pocketary.vercel.app';

/** Origin for GP-facing share links (QR). Prefer env when generating links from local dev. */
export function appOrigin(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_APP_ORIGIN as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return DEFAULT_APP_ORIGIN;
}

export function apiUserId(): string {
  return (import.meta.env.VITE_USER_ID as string | undefined)?.trim() || 'demo';
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** localtunnel (*.loca.lt) returns HTTP 511 until the reminder is bypassed in a browser. */
export function isLocaltunnelHost(url: string): boolean {
  const host = hostnameOf(url);
  return host !== null && host.endsWith('.loca.lt');
}

export function localtunnel511Message(api = apiBaseUrl()): string {
  return `The API tunnel needs a one-time unlock. Open ${api}/health in a new tab, complete the localtunnel prompt, then reload this app. For demos, prefer ngrok or Cloudflare Tunnel instead of loca.lt.`;
}

/** Required for browser fetch() to reach uvicorn through localtunnel. */
export function applyLocaltunnelBypassHeaders(headers: Headers, requestUrl: string): void {
  if (isLocaltunnelHost(requestUrl)) {
    headers.set('Bypass-Tunnel-Reminder', 'true');
  }
}

/** fetch() to API or PDF URLs with localtunnel bypass when needed. */
export async function fetchApiUrl(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  applyLocaltunnelBypassHeaders(headers, url);
  return fetch(url, { ...init, headers });
}

function apiErrorMessage(res: Response, data: unknown): string {
  if (res.status === 511) {
    return localtunnel511Message();
  }
  if (typeof data === 'object' && data && 'detail' in data) {
    return String((data as { detail: unknown }).detail);
  }
  return res.statusText || 'Request failed';
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
  if (cause instanceof ApiError && cause.status === 511) {
    return cause.message;
  }
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
  const requestUrl = `${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  applyLocaltunnelBypassHeaders(headers, requestUrl);
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : undefined;
  let res: Response;
  try {
    res = await fetch(requestUrl, {
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
    throw new ApiError(apiErrorMessage(res, data), res.status, data);
  }
  return data as T;
}
