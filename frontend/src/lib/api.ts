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

/**
 * Normaliza el `detail` de un error de FastAPI a un string legible.
 *
 * FastAPI devuelve `detail` como string en HTTPException, pero como un ARRAY de
 * objetos `[{loc, msg, type}]` en errores de validación de Pydantic (422). Si se
 * hace `new Error(detail)` con un array/objeto, el `.message` queda como
 * "[object Object]". Esta función cubre los tres casos.
 */
export function errorMessageFromDetail(detail: unknown, status?: number): string {
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) =>
        d && typeof d === "object" && "msg" in d
          ? String((d as { msg: unknown }).msg)
          : typeof d === "string"
            ? d
            : ""
      )
      .filter(Boolean);
    if (msgs.length) return msgs.join(" · ");
  }

  if (detail && typeof detail === "object") {
    const o = detail as Record<string, unknown>;
    if (typeof o.msg === "string") return o.msg;
    if (typeof o.detail === "string") return o.detail;
  }

  return status ? `Error ${status}` : "Error desconocido";
}

/** Lee un Response fallido y devuelve un mensaje de error legible. */
export async function parseErrorResponse(resp: Response): Promise<string> {
  const body = await resp.json().catch(() => null);
  const detail =
    body && typeof body === "object" && "detail" in body
      ? (body as { detail: unknown }).detail
      : body;
  return errorMessageFromDetail(detail, resp.status);
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
