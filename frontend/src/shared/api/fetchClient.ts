const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

// ── Token Storage (Memory only — no localStorage) ───────────────────

const STORAGE_KEY_ACCESS = 'pms_access_token';
const STORAGE_KEY_REFRESH = 'pms_refresh_token';

export function setStoredTokens(access: string, refresh?: string): void {
  sessionStorage.setItem(STORAGE_KEY_ACCESS, access);
  if (refresh) sessionStorage.setItem(STORAGE_KEY_REFRESH, refresh);
}

export function clearStoredTokens(): void {
  sessionStorage.removeItem(STORAGE_KEY_ACCESS);
  sessionStorage.removeItem(STORAGE_KEY_REFRESH);
}

export function getStoredAccessToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY_ACCESS);
}

/** @public - Public utility for token refresh orchestration (used by auth context and service worker) */
export function getStoredRefreshToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY_REFRESH);
}

// ── Callback registration (set by AuthContext) ───────────────────────

let onAuthFailure: (() => void) | null = null;
let onRetryRefresh: (() => Promise<string | null>) | null = null;

export function registerAuthCallbacks(
  onLogout: () => void,
  onRefresh: () => Promise<string | null>,
): void {
  onAuthFailure = onLogout;
  onRetryRefresh = onRefresh;
}

// ── Error Types ─────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
  status: number;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly details?: Record<string, string>;
  readonly status: number;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.code = error.code;
    this.details = error.details;
    this.status = error.status;
  }
}

function createApiError(status: number, errorData: unknown): ApiRequestError {
  const data = errorData as Record<string, unknown> | null;
  const errorObj = data?.error as Record<string, unknown> | undefined;
  const detail = data?.detail;
  let message: string;
  let code: string;
  let details: Record<string, string> | undefined;

  if (errorObj) {
    code = typeof errorObj.code === 'string' ? errorObj.code : `SYS-${status}`;
    message = typeof errorObj.message === 'string' ? errorObj.message : 'An unexpected error occurred';
    details = errorObj.details as Record<string, string> | undefined;
  } else if (typeof detail === 'string') {
    code = `SYS-${status}`;
    message = detail;
  } else if (Array.isArray(detail)) {
    code = `SYS-${status}`;
    message = detail.map((d: unknown) => (d as Record<string, unknown>)?.msg ?? String(d)).join('; ');
    details = { validation_errors: JSON.stringify(detail) };
  } else {
    code = `SYS-${status}`;
    message = 'An unexpected error occurred';
  }

  return new ApiRequestError({ code, message, details, status });
}

// ── Refresh Token Logic ────────────────────────────────────────────

async function attemptTokenRefresh(): Promise<string | null> {
  if (!onRetryRefresh) return null;
  try {
    return await onRetryRefresh();
  } catch {
    return null;
  }
}

// ── Main Fetch Wrapper ─────────────────────────────────────────────

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options;
  const url = `${BASE_URL}${endpoint}`;

  const requestHeaders = new Headers(fetchOptions.headers);
  requestHeaders.set('Content-Type', 'application/json');
  requestHeaders.set('X-Request-ID', crypto.randomUUID());

  const token = getStoredAccessToken();
  if (!skipAuth && token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  let requestBody: string | undefined;
  if (fetchOptions.body !== undefined) {
    requestBody = typeof fetchOptions.body === 'string'
      ? fetchOptions.body
      : JSON.stringify(fetchOptions.body);
  }

  let response = await fetch(url, {
    method: fetchOptions.method ?? 'GET',
    credentials: 'include',
    headers: requestHeaders,
    body: requestBody,
  });

  // ── 401 Handling: Refresh → Retry once ─────────────────────────
  if (
    response.status === 401 &&
    !skipAuth &&
    !requestHeaders.has('X-Retry')
  ) {
    const newToken = await attemptTokenRefresh();
    if (newToken) {
      setStoredTokens(newToken);
      requestHeaders.set('Authorization', `Bearer ${newToken}`);
      requestHeaders.set('X-Retry', 'true');

      response = await fetch(url, {
        method: fetchOptions.method ?? 'GET',
        credentials: 'include',
        headers: requestHeaders,
        body: requestBody,
      });
    } else {
      onAuthFailure?.();
      throw new ApiRequestError({
        code: 'AUTH_SESSION_EXPIRED',
        message: 'Session expired — please log in again',
        status: 401,
      });
    }
  }

  // ── Error Mapping ──────────────────────────────────────────────
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw createApiError(response.status, errorData);
  }

  // ── Handle 204 No Content ──────────────────────────────────────
  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}