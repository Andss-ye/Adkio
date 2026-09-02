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

// ── Meta ad accounts (ADK-23) ──────────────────────────────────────────────
//
// Shape aligned to Andrew's ADK-7 `platform_assets` (ad_account only):
//   external_id · name · is_selected
//
// ADK-14 (Freddy) is still Backlog / blocked by ADK-7 — there is no list/select
// endpoint in this tree. These helpers MUST NOT invent URLs. When ADK-14 lands
// in main, swap the bodies to apiFetch against the real routes and drop the
// localStorage mock. Page / Instagram are out of ADK-23 (pending refactor).

export type MetaAdAccount = {
  external_id: string;
  name: string;
  is_selected: boolean;
};

const MOCK_SELECTED_KEY = "adkio.mock.meta.ad_account_id";

/** PYME with 3 ad accounts — the ADK-23 mock case. */
const MOCK_META_AD_ACCOUNTS: ReadonlyArray<Omit<MetaAdAccount, "is_selected">> = [
  { external_id: "act_269458954399128", name: "Los Andes Café — Principal" },
  { external_id: "act_184729301847562", name: "Los Andes Café — Agencia 2024" },
  { external_id: "act_391028475610293", name: "Los Andes Café — Retargeting" },
];

function mockDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storedSelectedId(): string {
  const stored = localStorage.getItem(MOCK_SELECTED_KEY);
  if (stored && MOCK_META_AD_ACCOUNTS.some((a) => a.external_id === stored)) {
    return stored;
  }
  return MOCK_META_AD_ACCOUNTS[0].external_id;
}

export async function listMetaAdAccounts(): Promise<MetaAdAccount[]> {
  await mockDelay(350);
  const selectedId = storedSelectedId();
  return MOCK_META_AD_ACCOUNTS.map((account) => ({
    ...account,
    is_selected: account.external_id === selectedId,
  }));
}

export async function selectMetaAdAccount(externalId: string): Promise<void> {
  await mockDelay(120);
  if (!MOCK_META_AD_ACCOUNTS.some((a) => a.external_id === externalId)) {
    throw new Error("Esa ad account no está en la lista.");
  }
  localStorage.setItem(MOCK_SELECTED_KEY, externalId);
}
