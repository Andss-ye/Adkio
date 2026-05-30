/**
 * Cliente de auth — guarda tokens en localStorage y los inyecta en apiFetch.
 *
 * Se integra con backend/auth/router.py:
 *   POST /auth/signup    -> {access_token, refresh_token, account}
 *   POST /auth/login
 *   POST /auth/refresh
 *   GET  /auth/me  (Bearer)
 */
import { apiFetch, parseErrorResponse } from './api';

const ACCESS_KEY = 'adkio.access_token';
const REFRESH_KEY = 'adkio.refresh_token';
const ACCOUNT_KEY = 'adkio.account';

export type Account = {
  id: string;
  email: string;
  plan: 'starter' | 'growth' | 'scale';
};

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  account: Account;
};

export function getAccessToken(): string {
  return localStorage.getItem(ACCESS_KEY) ?? '';
}

export function getAccount(): Account | null {
  const raw = localStorage.getItem(ACCOUNT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Account;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return Boolean(getAccessToken());
}

function persist(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(tokens.account));
}

export function logout(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ACCOUNT_KEY);
}

async function postJson<T>(path: string, body: object): Promise<T> {
  const resp = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(await parseErrorResponse(resp));
  }
  return (await resp.json()) as T;
}

export async function signup(email: string, password: string): Promise<Account> {
  const t = await postJson<AuthTokens>('/auth/signup', { email, password });
  persist(t);
  return t.account;
}

export async function login(email: string, password: string): Promise<Account> {
  const t = await postJson<AuthTokens>('/auth/login', { email, password });
  persist(t);
  return t.account;
}

export async function refresh(): Promise<boolean> {
  const refresh_token = localStorage.getItem(REFRESH_KEY);
  if (!refresh_token) return false;
  try {
    const t = await postJson<AuthTokens>('/auth/refresh', { refresh_token });
    persist(t);
    return true;
  } catch {
    logout();
    return false;
  }
}
