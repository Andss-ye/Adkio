const BACKEND =
  (import.meta as { env?: { VITE_BACKEND_URL?: string } }).env?.VITE_BACKEND_URL ??
  "http://localhost:8000";

const API_KEY =
  (import.meta as { env?: { VITE_API_KEY?: string } }).env?.VITE_API_KEY ?? "";

function authHeaders(): HeadersInit {
  return API_KEY ? { "X-API-Key": API_KEY } : {};
}

export function apiUrl(path: string): string {
  return `${BACKEND}${path}`;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });
}

export { BACKEND };
