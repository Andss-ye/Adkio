# Adkio — Diagnóstico: signup falla en Railway (“Failed to fetch”)

> **Fecha:** 21 Jul 2026 (actualizado 22 Jul 2026)  
> **Proyecto Railway:** `zucchini-reflection`  
> **Cuenta:** `adkiojulian@gmail.com`  
> **Estado:** RESUELTO — signup/login 200 contra Supabase. IPv6 egress staged (`true`) pendiente de accept-deploy.

---

## Resumen ejecutivo

Crear cuenta (o login) desde el frontend muestra **“Failed to fetch”**.  
El frontend y el CORS están bien. El request **sí llega** al backend.  
El backend responde **500** porque **no puede resolver por DNS el host de `SUPABASE_URL`**.

Causa directa en logs:

```text
httpx.ConnectError: [Errno -2] Name or service not known
```

en `POST /auth/signup` al llamar `get_account_by_email()` → cliente Supabase/PostgREST.

---

## URLs de deploy

| Servicio | Dominio público | Estado deploy |
|---|---|---|
| Frontend | https://web-production-9f9d1.up.railway.app | SUCCESS, always-on |
| Backend | https://adkio-backend-production.up.railway.app | SUCCESS, online |
| Health | https://adkio-backend-production.up.railway.app/health | `200` `{"status":"ok",...}` |
| Raíz backend `/` | — | `404` esperado (no hay ruta `/`; es API) |

IDs Railway (referencia):

- Project: `ce717aae-b15c-41b7-9622-0e5eb1101854`
- Env production: `c1bbd443-c86e-4398-b067-416ae6caa4cb`
- Adkio-Backend: `559c9976-9b99-4683-95cc-084bc9d4b3bc`
- Adkio-Frontend: `5e1fc990-46c5-4e27-b513-cdefa4a7d716`

---

## Flujo del error

```text
Browser (Frontend SPA)
  │  POST /auth/signup
  ▼
Backend FastAPI  ──CORS OK──► recibe request
  │
  │  auth/router.py → get_account_by_email()
  │  accounts.py → supabase client → PostgREST
  ▼
DNS lookup de host(SUPABASE_URL)
  │
  ✗  Errno -2 Name or service not known
  │
  ▼
Excepción no controlada → HTTP 500
  │
  ▼
Browser a veces muestra "Failed to fetch"
(en crash ASGI los headers CORS pueden no llegar bien)
```

---

## Evidencia en logs (Railway MCP)

### HTTP (backend)

```text
OPTIONS /auth/signup → 200
POST    /auth/signup → 500
POST    /auth/login  → 500
GET     /health      → 200
GET     /            → 404   (normal)
```

### Stack relevante

```text
File "/app/backend/auth/router.py", line 109, in signup
    if get_account_by_email(email):
File "/app/backend/db/accounts.py", line 36, in get_account_by_email
    .execute()
...
httpx.ConnectError: [Errno -2] Name or service not known
```

### Qué sí está bien

| Check | Resultado |
|---|---|
| Frontend apunta al backend | `VITE_BACKEND_URL=https://adkio-backend-production.up.railway.app` (bakeado en el JS) |
| CORS preflight | `Access-Control-Allow-Origin: https://web-production-9f9d1.up.railway.app` |
| Dockerfile front/back | `/frontend/Dockerfile` y `/backend/Dockerfile` correctos |
| Cron en frontend | Removido; servicio always-on |
| `.env` dentro de la imagen | No existe (`/app/.env` ausente); vars vienen de Railway |

---

## Causas raíz (ordenadas por evidencia)

### 1. Hostname de `SUPABASE_URL` inválido / no resuelve (más probable)

El error es **DNS**, no auth de Supabase (no hay 401/404 de PostgREST).

La URL documentada en `.env.production.example` era:

```text
https://aphrujuaklsytbnhcthm.supabase.co
```

Ese host **no resolvía** en DNS público (NXDOMAIN) al momento del diagnóstico.  
Si Railway tiene esa misma URL (o cualquier ref vieja/typo/placeholder), el redeploy **no arregla nada**.

**Nota:** el trailing slash **no** es la causa. `Errno -2` es fallo de resolución de nombre, no de path HTTP.

### 2. Hipótesis secundaria: egress IPv6 deshabilitado en Railway

En el contenedor del backend:

```text
/etc/resolv.conf → nameserver fd12::10   (solo IPv6)
ipv6EgressEnabled: false
```

Eso también puede impedir DNS externo y producir el mismo `Name or service not known`, incluso con un host válido. Es un posible agravante de red Railway; no reemplaza verificar que el host de Supabase exista.

---

## Qué NO es el problema

- Frontend mal buildado o `VITE_BACKEND_URL` apuntando a localhost  
- Servicios “al revés” (ya corregido en deploy anterior)  
- Slash final en `SUPABASE_URL` como causa del 500 actual  
- Backend caído (`/health` responde ok)  
- Falta de ruta `/` en el backend (404 esperado)

---

## Cómo verificar / arreglar

### Paso A — Validar `SUPABASE_URL` real

1. Supabase Dashboard → **Settings → API → Project URL**.
2. En Railway → **Adkio-Backend → Variables → `SUPABASE_URL`**: debe ser exactamente ese host.
3. Probar DNS fuera de Railway:

```bash
dig +short <tu-proyecto>.supabase.co
# o
curl -I https://<tu-proyecto>.supabase.co
```

Si no resuelve → corregir la variable y redeploy del backend.

Confirmar también (mismo proyecto):

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

### Paso B — Si el host sí resuelve y sigue el error

En Railway → Adkio-Backend → networking/settings:

- Habilitar **IPv6 egress** (`ipv6EgressEnabled: true`)
- Redeploy

### Paso C — Criterio de éxito

```bash
curl -sS -X POST https://adkio-backend-production.up.railway.app/auth/signup \
  -H "Origin: https://web-production-9f9d1.up.railway.app" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'
```

Esperado: **200/201** con tokens (o **409** si el email ya existe), **nunca** 500 por DNS.

En el UI: signup/login sin “Failed to fetch”.

---

## Contexto de fixes previos (ya aplicados)

Antes de este bug de signup se corrigió la config de Railway:

| Item | Antes | Después |
|---|---|---|
| Frontend Dockerfile | `/backend/Dockerfile` + `uvicorn` | `/frontend/Dockerfile` + `serve` |
| Frontend cron | `0 0 * * *` (0 réplicas) | sin cron, always-on |
| Backend dominio público | ausente / confuso | `adkio-backend-production.up.railway.app` |
| `ALLOWED_ORIGINS` | desalineado | URL del frontend público |
| `VITE_BACKEND_URL` | incompleto | URL del backend público |

Eso dejó la app **accesible**. El signup sigue roto por **conectividad DNS a Supabase**.

---

## Referencias de código

- Signup: `backend/auth/router.py` → `POST /auth/signup`
- Cliente DB: `backend/db/accounts.py` → `get_account_by_email`
- Supabase client: `backend/db/supabase_client.py` → `_get_client()`
- Front auth: `frontend/src/lib/auth.ts` → `signup()` / `apiFetch`

---

## Próximo paso recomendado

1. Confirmar en Railway el **host exacto** de `SUPABASE_URL` (sin keys).  
2. Si es inválido → pegar Project URL actual de Supabase + redeploy.  
3. Si es válido → habilitar IPv6 egress + redeploy.  
4. Re-probar `POST /auth/signup` y el flujo en el browser.
