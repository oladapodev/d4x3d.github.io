export const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export function jsonResponse(body: unknown, status = 200, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      'cache-control': 'no-store',
      ...init.headers,
    },
    ...init,
  });
}

export function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader
    .split(';')
    .map((p) => p.trim())
    .map((p) => p.split('='));

  for (const [key, value] of parts) {
    if (key === name) {
      return decodeURIComponent(value ?? '');
    }
  }
  return null;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number, options: { path?: string; secure?: boolean; sameSite?: string } = {}) {
  const { path = '/', secure = true, sameSite = 'Lax' } = options;
  const base = `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; SameSite=${sameSite}; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`;
  return secure ? `${base}; Secure` : base;
}

export function deleteCookie(name: string, path = '/') {
  return `${name}=; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export async function readJsonBody<T = unknown>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {} as T;
  }
  const text = await request.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invalid JSON payload');
  }
}
