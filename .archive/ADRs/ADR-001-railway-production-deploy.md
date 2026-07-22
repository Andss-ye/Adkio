# ADR-001 — Deploy de producción en Railway (front + back) con Supabase externo

| Campo | Valor |
|---|---|
| **Estado** | Aceptado / Implementado |
| **Fecha** | 2026-07-21 |
| **Última actualización** | 2026-07-22 |
| **Decisores** | Equipo Adkio |
| **Relacionados** | `.archive/docs/DEPLOY_VIABILITY.md`, `.archive/docs/RAILWAY_SIGNUP_DNS_FAILURE.md` |

---

## Contexto

Adkio es un SPA (Vite + React) + API FastAPI con SSE largo (`POST /campaign`, 20–90s), Postgres en Supabase, y auth multitenant propia (`/auth/signup`, `/auth/login`) que habla con PostgREST vía `SUPABASE_URL` + service role.

La evaluación en `DEPLOY_VIABILITY.md` recomendaba **Vercel (front) + Railway (back) + Supabase**. Para el deploy real del pitch se eligió un camino más corto: **ambos servicios en un solo proyecto Railway**, con Dockerfiles del repo y variables de entorno inyectadas por Railway (sin `.env` en la imagen).

Al poner la app en línea aparecieron dos clases de fallos:

1. **Misconfiguración de servicios** — Dockerfile/cron/dominios cruzados entre front y back.
2. **Signup/login rotos** — el browser mostraba “Failed to fetch”; el backend devolvía **500** por `httpx.ConnectError: [Errno -2] Name or service not known` al resolver el host de `SUPABASE_URL`.

Había que fijar una topología de producción estable y reglas operativas para que el backend pueda alcanzar Supabase de forma fiable.

---

## Decisión

### 1. Topología de producción

Un proyecto Railway (`zucchini-reflection`) con **dos servicios always-on**:

| Servicio | Build | Runtime | Dominio público |
|---|---|---|---|
| **Adkio-Backend** | `/backend/Dockerfile` | `uvicorn` en `$PORT` | `https://adkio-backend-production.up.railway.app` |
| **Adkio-Frontend** | `/frontend/Dockerfile` | `serve` del build estático | `https://web-production-9f9d1.up.railway.app` |

Supabase permanece **fuera** de Railway (DB gestionada). El LLM (Claude vía Anthropic) y las APIs de ads también son externos.

```
Browser
  │
  ├─ SPA ──► Adkio-Frontend (Railway, static)
  │
  └─ API ──► Adkio-Backend (Railway, FastAPI + SSE)
                │
                ├─► Supabase (Postgres / PostgREST)
                ├─► Anthropic (Claude)
                └─► Meta / TikTok / Google (ads)
```

### 2. Contrato de variables entre servicios

| Variable | Dónde | Regla |
|---|---|---|
| `VITE_BACKEND_URL` | Frontend (build-time) | URL pública HTTPS del backend, sin slash final |
| `ALLOWED_ORIGINS` | Backend | Origen exacto del frontend público |
| `SUPABASE_URL` | Backend | Project URL real de Supabase Settings → API; debe resolver por DNS |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | Backend | Del mismo proyecto Supabase |
| `JWT_SECRET`, `PLATFORM_TOKENS_ENC_KEY` | Backend | Secretos generados; sin ellos auth/connect fallan |

Las variables viven en Railway Variables, no en la imagen Docker.

### 3. Correcciones de configuración Railway (aplicadas)

| Item | Antes | Después |
|---|---|---|
| Frontend Dockerfile | `/backend/Dockerfile` + uvicorn | `/frontend/Dockerfile` + `serve` |
| Frontend cron | `0 0 * * *` (0 réplicas) | sin cron, always-on |
| Dominio backend | ausente / confuso | `adkio-backend-production.up.railway.app` |
| `ALLOWED_ORIGINS` | desalineado | URL del frontend público |
| `VITE_BACKEND_URL` | incompleto / localhost | URL del backend público |

### 4. Conectividad backend → Supabase

**Causa del 500 en signup/login:** fallo de DNS del host de `SUPABASE_URL` (no era CORS ni un bug del frontend).

Reglas adoptadas:

1. **`SUPABASE_URL` debe ser un hostname que resuelva** (validar con `dig` / `curl` antes de redeploy). Placeholders (`xxxxxxxxxxxx.supabase.co`) o refs NXDOMAIN producen exactamente `Errno -2`.
2. **Habilitar IPv6 egress en Adkio-Backend** (`ipv6EgressEnabled: true`). El contenedor usa `nameserver fd12::10` (solo IPv6); con egress IPv6 en `false`, el mismo error DNS puede aparecer aunque el host sea válido.
3. Criterio de aceptación: `POST /auth/signup` y `POST /auth/login` → **200/201/409**, nunca 500 por DNS.

---

## Consecuencias

### Positivas

- Un solo proveedor PaaS para front + back → menos wiring de DNS/CORS en el pitch.
- SSE largo soportado (proceso persistente, no serverless de timeout corto).
- Auth end-to-end verificada: signup/login **200** contra Supabase desde el backend de producción.
- Diagnóstico reproducible documentado; el síntoma “Failed to fetch” en el browser se interpreta primero como **500 del backend / DNS a Supabase**, no como CORS genérico.

### Negativas / trade-offs

- Se desvía del combo #1 de viabilidad (Vercel CDN para el SPA). El front en Railway no tiene el edge CDN de Vercel; aceptable para demo/early prod bajo el techo de costo.
- Dos servicios en Railway duplican config de dominio y variables de origen; un error de Dockerfile/cron vuelve a cruzar front y back.
- Dependencia de DNS/egress de Railway hacia Supabase: hay que tratar `ipv6EgressEnabled` y la validez de `SUPABASE_URL` como parte del runbook de deploy.
- Secrets solo visibles en el dashboard Railway; el agent MCP no puede auditar el valor plaintext de `SUPABASE_URL` (solo presencia).

### No se decide aquí

- Migrar el frontend a Vercel/Cloudflare Pages.
- Cambiar de Supabase a otra DB.
- Habilitar Supabase Auth nativo (Adkio usa JWT propio + tabla `accounts`).
- Multi-región / scaling automático más allá de 1 réplica en `sfo`.

---

## Verificación

```bash
# Health
curl -sS https://adkio-backend-production.up.railway.app/health

# Signup (esperado 200/201 o 409)
curl -sS -X POST https://adkio-backend-production.up.railway.app/auth/signup \
  -H "Origin: https://web-production-9f9d1.up.railway.app" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'
```

IDs Railway de referencia:

- Project: `ce717aae-b15c-41b7-9622-0e5eb1101854`
- Env production: `c1bbd443-c86e-4398-b067-416ae6caa4cb`
- Backend: `559c9976-9b99-4683-95cc-084bc9d4b3bc`
- Frontend: `5e1fc990-46c5-4e27-b513-cdefa4a7d716`

---

## Referencias

- Código: `backend/auth/router.py`, `backend/db/accounts.py`, `backend/db/supabase_client.py`, `frontend/src/lib/auth.ts`
- Docker: `backend/Dockerfile`, `frontend/Dockerfile`
- Env de producción (plantilla): `.env.production.example`
- Diagnóstico DNS: `.archive/docs/RAILWAY_SIGNUP_DNS_FAILURE.md`
- Evaluación de combos: `.archive/docs/DEPLOY_VIABILITY.md`
