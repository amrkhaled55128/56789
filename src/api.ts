const TOKEN_KEY = 'vet_clinic_token';
const REFRESH_TOKEN_KEY = 'vet_clinic_refresh_token';
const USER_KEY = 'vet_clinic_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setSession(token: string, refreshToken?: string, user?: any): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getCurrentUser(): any {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const fullUrl = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401 && !path.includes('/auth/login')) {
    clearSession();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: 'تعذر الاتصال بالخادم الرئيسي' }));
    throw new Error(data.message ?? 'حدث خطأ غير متوقع');
  }

  if (response.status === 204) return undefined as T;

  const resJson = await response.json();
  // Unwrap NestJS TransformInterceptor response `{ data: ... }` if present
  if (resJson && typeof resJson === 'object' && 'data' in resJson) {
    return resJson.data as T;
  }
  return resJson as T;
}
