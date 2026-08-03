const TOKEN_KEY = 'vet_clinic_token';
const REFRESH_TOKEN_KEY = 'vet_clinic_refresh_token';
const USER_KEY = 'vet_clinic_user';
const REQUEST_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setSession(token: string, refreshToken?: string, user?: unknown): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getCurrentUser(): unknown {
  const user = localStorage.getItem(USER_KEY);
  if (!user) return null;
  try {
    return JSON.parse(user);
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

let refreshRequest: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshRequest) {
    refreshRequest = fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json();
        const data = payload?.data ?? payload;
        if (!data?.accessToken) return null;
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        return data.accessToken as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

function redirectToLogin(): void {
  clearSession();
  if (window.location.pathname !== '/login') window.location.assign('/login');
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const rawMessage = payload?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join('، ')
      : rawMessage || 'حدث خطأ غير متوقع. حاول مرة أخرى.';
    throw new ApiError(message, response.status, payload);
  }
  return (payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload) as T;
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const fullUrl = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const token = getToken();

  try {
    const response = await fetch(fullUrl, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (response.status === 401 && retry && !path.includes('/auth/')) {
      const newToken = await refreshAccessToken();
      if (newToken) return api<T>(path, options, false);
      redirectToLogin();
    }

    return await parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('استغرق الاتصال وقتًا أطول من المتوقع. تحقق من الشبكة وحاول مجددًا.', 408);
    }
    throw new ApiError('تعذر الاتصال بالخادم. تحقق من تشغيل النظام والشبكة المحلية.', 0, error);
  } finally {
    window.clearTimeout(timeout);
  }
}
