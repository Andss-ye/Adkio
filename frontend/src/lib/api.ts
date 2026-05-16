const BACKEND =
  (import.meta as { env?: { VITE_BACKEND_URL?: string } }).env?.VITE_BACKEND_URL ??
  "http://localhost:8000";

const API_KEY =
  (import.meta as { env?: { VITE_API_KEY?: string } }).env?.VITE_API_KEY ?? "";

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  if (API_KEY) headers["X-API-Key"] = API_KEY;

  // Bearer token desde localStorage (auth.ts). Import perezoso para evitar
  // ciclo: auth.ts → api.ts → auth.ts.
  const access = localStorage.getItem("adkio.access_token");
  if (access) headers["Authorization"] = `Bearer ${access}`;

  return headers;
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
