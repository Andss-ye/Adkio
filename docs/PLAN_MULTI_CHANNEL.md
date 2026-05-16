# Plan de integración — Meta CLI + TikTok Ads + Google Ads

> Estado: propuesta. Última actualización: 15-may-2026.
> Reemplaza la integración mock de Meta y abre el camino a multi-canal sin tocar el patrón de tools + reasoning panel que define la demo.

---

## 1. Qué existe hoy (mayo 2026)

| Plataforma | Herramienta oficial | Tipo | Capacidad de **lanzar** campañas | Auth |
|---|---|---|---|---|
| **Meta** | **Ads CLI** (lanzada 29-abr-2026) | Python pkg (`pip`/`uv`), Python 3.12+ | ✅ Sí — create/edit campaigns, ad sets, ads, creatives, catalogs. PAUSED por default | OAuth |
| **Meta** | **Meta Ads MCP** (`mcp.metamkt.com`) | MCP server oficial hosteado | ✅ 30+ tools, R/W | OAuth click — **sin app developer ni review de 3 días** |
| **TikTok** | **TikTok Ads MCP** (anunciado en TikTok World 2026) | MCP server oficial + comunidad (`AdsMCP/tiktok-ads-mcp-server`) | ✅ Plan, launch, optimize | OAuth / app credentials |
| **Google** | **Google Ads MCP** (`google-marketing-solutions/google_ads_mcp`) | MCP oficial Google | ⚠️ **Read-only**. Lee campañas/keywords/conversions vía GAQL, **no crea ni modifica** | OAuth |

**Implicación crítica:** la Meta Ads CLI + Meta MCP **elimina el bloqueo de los 3 días de verificación** que justifica nuestro mock actual. Podemos demostrar contra Meta real sin esperar la app review.

### 1.1 Matriz de CRUD (create + delete) para gestión de campañas

Requisito Adkio: el agente tiene que **crear** y **eliminar** campañas en los tres canales. Esta es la cobertura real, verificada en docs oficiales:

| Plataforma | Camino técnico | Create | Read | Update | **Delete / Remove** | Notas |
|---|---|---|---|---|---|---|
| **Meta** | `meta-ads` CLI (oficial) | ✅ | ✅ | ✅ | ✅ `meta ads campaign delete <ID>` | CRUD completo. PAUSED por default = guardrail HITL gratis. |
| **TikTok** | Business API + Python SDK oficial (`tiktok-business-api-sdk`) | ✅ `campaign/create/` | ✅ `campaign/get/` | ✅ `update_campaign` | ⚠️ **No hay endpoint de hard-delete.** Solo *disable* vía `campaign/status/update/` (status → `DISABLE`) | Patrón soft-delete. Hay que exponer "eliminar" en el frontend como un soft-disable y dejarlo claro en el rationale. |
| **Google Ads** | Python SDK oficial (`google-ads-python`) | ✅ vía `mutateCampaigns` operation | ✅ GAQL | ✅ vía operation | ✅ operation con `REMOVE` apuntando al resource name | CRUD completo, pero **no por MCP** — el MCP oficial es read-only. El SDK sí. |

**Implicación:** los tres canales soportan el flujo Adkio (crear y "eliminar"), pero TikTok requiere modelar el delete como soft-disable. El agente debe saberlo y el frontend debe mostrarlo honestamente.

---

## 2. Requisito de cuentas conectadas

**Una cuenta Adkio conecta exactamente 1 cuenta por plataforma:** 1 ad account de Meta, 1 advertiser de TikTok, 1 customer de Google Ads. No multi-cuenta dentro del mismo Adkio account (eso queda para el plan Scale en el futuro).

Esto define:

- **Modelo de datos:** las credenciales viven en una tabla `platform_connections` con `UNIQUE(adkio_account_id, platform)`. El intento de conectar una segunda cuenta del mismo provider desconecta la anterior (o pide confirmación).
- **OAuth UX:** tres botones en settings — "Conectar Meta", "Conectar TikTok", "Conectar Google Ads". Cada uno corre OAuth contra el provider y guarda el token cifrado.
- **Identificadores que guardamos:** `meta_ad_account_id` (formato `act_XXX`), `tiktok_advertiser_id`, `google_customer_id` (10 dígitos sin guiones).
- **Resolución en runtime:** cada tool del agente toma el `adkio_account_id` del request, mira `platform_connections`, y usa el token correcto. El agente nunca recibe credenciales — solo el canal y el contexto.
- **Validación al conectar:** en el momento del OAuth, hacer una llamada read trivial (ej. listar 1 campaña) para confirmar que el token tiene los permisos correctos antes de guardarlo. Falla temprano > falla en demo.
- **Revocación:** un botón "Desconectar" por plataforma revoca el token con el provider y borra la fila. El agente automáticamente deja de poder operar ese canal.

### 2.1 Schema `platform_connections` (Supabase)

```python
{
  "id": "uuid",
  "adkio_account_id": "uuid",          # FK → cuenta Adkio
  "platform": "meta | tiktok | google_ads",
  "provider_account_id": "str",        # act_XXX | advertiser_id | customer_id
  "access_token_encrypted": "str",
  "refresh_token_encrypted": "str | null",
  "token_expires_at": "timestamp | null",
  "scopes": ["str"],
  "connected_at": "timestamp",
  "last_validated_at": "timestamp"
}
# UNIQUE (adkio_account_id, platform)
```

---

## 3. Aplicabilidad a nuestra arquitectura

Hoy el agente llama tools como funciones Python (`copy_generator`, `campaign_launcher`, etc.) vía `litellm` function calling, y cada tool devuelve un `rationale` que alimenta el panel de razonamiento. Eso es **el moat de la demo** y no se toca.

Hay dos formas de meter los nuevos canales:

**Opción A — Wrappers internos (recomendada).** Cada CLI/MCP nuevo se envuelve detrás de nuestras tools existentes. El agente sigue viendo el mismo I/O contract; cambia lo que pasa adentro.

- Pros: zero cambio en el agente, el frontend y los rationales. Mantenemos el control del "momento WOW". Misma demo, ahora multi-plataforma.
- Contras: tenemos que mantener el adaptador por cada canal.

**Opción B — Agente conectado directo a MCPs.** El agente descubre dinámicamente tools desde `mcp.metamkt.com` + TikTok MCP + Google MCP.

- Pros: 30+ tools Meta gratis, menos código.
- Contras: rompe el patrón de `rationale` curado, perdemos el panel de razonamiento como hoy, los nombres de tools no son los nuestros, demo se vuelve genérica.

→ **Para el MVP/demo: Opción A.** Opción B queda en roadmap como "modo poder" para clientes Scale.

---

## 4. Plan por fases

### Fase 0 — Hoy/mañana (no romper la demo)
- Mantener `META_USE_SANDBOX=true` y el mock actual para la mentoría.
- **No** introducir Meta CLI todavía: Python 3.12 vs nuestro 3.11 + dependencia nueva es riesgo para la demo de mañana.

### Fase 1 — Post-demo (sprint 1, esta semana)
**Reemplazar el mock de Meta sin tocar la interfaz del agente + soportar create/delete:**

1. Subir `backend/` a Python 3.12 (la CLI lo requiere).
2. Agregar `meta-ads-cli` a `requirements.txt`.
3. Crear tabla `platform_connections` en Supabase (ver §2.1) y endpoint OAuth `/connect/meta`.
4. Reescribir `backend/integrations/meta_ads.py`:
   - `launch_campaign(...)` → `meta-ads campaign create --json …`, parsea JSON, mismo schema de salida.
   - `delete_campaign(campaign_id)` → `meta-ads campaign delete <ID>`. **Nuevo.**
   - Idem `create_adset`, `create_ad`, `create_creative`, y sus `delete_*`.
5. `backend/tools/campaign_launcher.py` queda **idéntico** por fuera. Agregar `backend/tools/campaign_remover.py` con el mismo patrón (rationale incluido).
6. OAuth con Meta MCP en lugar de tokens manuales para evitar el flujo de developer app.
7. **Guardrail:** el PAUSED-by-default de la CLI ya alinea con nuestro HITL. Lanzar siempre en PAUSED; el botón "Aprobar y lanzar" del frontend pasa a ACTIVE. `delete` requiere segunda confirmación explícita del usuario.

### Fase 2 — TikTok Ads (sprint 2)
1. Endpoint OAuth `/connect/tiktok` que guarda el advertiser en `platform_connections`.
2. Crear `backend/integrations/tiktok_ads.py` usando `tiktok-business-api-sdk` (Python oficial). Preferir el SDK al MCP para tener control de los rationales.
   - `launch_campaign(...)` → `client.campaign.create_campaigns(...)`.
   - `delete_campaign(campaign_id)` → **soft-delete:** `client.campaign.update_status(status="DISABLE")`. **El rationale debe explicitar que TikTok no permite hard-delete**; quedamos coherentes con la UX de "Eliminar" del frontend.
3. Nuevas tools `tiktok_audience_analyzer`, `tiktok_copy_generator` (TikTok pide formatos verticales y tono distinto — no es copy-paste del de Meta).
4. `campaign_launcher` y `campaign_remover` reciben `canal` y rutean al integration correcto. El agente decide el canal según `brand_config` + objetivo del usuario.

### Fase 3 — Google Ads (sprint 2/3)
Esto es **asimétrico** vs Meta/TikTok porque el MCP oficial es read-only — pero el SDK Python sí soporta CRUD completo:

- **Conexión:** endpoint `/connect/google` con OAuth + selección de `google_customer_id` (10 dígitos).
- **Lectura/análisis:** usar el MCP oficial (`google-marketing-solutions/google_ads_mcp`) para alimentar `report_generator` con datos cross-channel (CPA, ROAS, conversiones).
- **Creación:** `google-ads-python` SDK → `campaign_service.mutate_campaigns(operations=[create_op])`.
- **Eliminación:** mismo SDK → operation con `remove` apuntando al resource name `customers/{cid}/campaigns/{id}`. **Hard-delete real**, distinto a TikTok.
- Aislar todo en `backend/integrations/google_ads.py` para que el día que Google saque write-MCP sea un swap interno sin tocar tools.

### Fase 4 — Modo "agente con MCPs nativos" (Plan Scale, roadmap)
Para clientes que pidan "darle al agente todas las tools nativas": habilitar conexión MCP directa como modo opt-in. No es el default — el default sigue siendo nuestro flujo curado con rationales.

---

## 5. Cambios de schema que esto fuerza

- Nueva tabla `platform_connections` (ver §2.1) — reemplaza la idea inicial de meter tokens en `brand_config`.
- `brand_config` queda enfocado solo en la marca (tono, audiencia, propuesta de valor). **No** guarda credenciales ni IDs de cuenta del provider.
- Tool contracts: agregar `canal: "meta" | "tiktok" | "google"` donde no lo está; los outputs ya son agnósticos.
- `campaign_launcher` output debe incluir `provider_native_id` además de `campaign_id` interno.
- Nuevo tool `campaign_remover(canal, campaign_id)` con output `{deleted: bool, soft_delete: bool, rationale: str}`. El flag `soft_delete=true` aplica a TikTok.

Estos cambios se documentan en CLAUDE.md en el mismo PR.

---

## 6. Decisiones pendientes

1. **¿Subimos a Python 3.12 ahora o post-demo?** (la CLI de Meta lo exige)
2. **¿Empezamos por Meta CLI o Meta MCP?** CLI = más control, mejor para el reasoning panel; MCP = setup en 1 click y data fresca, pero menos previsible.
3. **Google Ads write:** ¿prioridad sprint 2 (SDK directo) o esperar el MCP oficial con write?
4. **TikTok:** ¿SDK oficial Python (recomendado), MCP oficial o MCP comunidad (`AdsMCP`)?
5. **UX del soft-delete de TikTok:** ¿lo llamamos "Eliminar" (con disclaimer en rationale) o "Desactivar" en el frontend, para no mentir? Recomiendo "Eliminar (desactiva en TikTok)" en el botón y rationale honesto en el panel.
6. **Política multi-cuenta a futuro:** hoy 1 cuenta por plataforma por Adkio account. ¿Confirmamos que multi-cuenta queda fuera del MVP y se documenta como límite explícito en el plan Starter/Growth?

---

## Fuentes

- [Meta's new Ads CLI lets AI agents manage ad campaigns](https://ppc.land/metas-new-ads-cli-lets-ai-agents-manage-ad-campaigns-from-the-command-line/)
- [Meta Ads MCP and CLI: Inside Meta's Official AI Connectors](https://mcp.directory/blog/meta-ads-cli-mcp)
- [Meta MCP Server Official Setup & Configuration Guide (2026)](https://www.get-ryze.ai/blog/meta-mcp-server-official-setup-and-configuration)
- [TikTok launches MCP server to let AI agents run campaigns](https://digiday.com/marketing/tiktok-launches-mcp-server-to-let-ai-agents-run-campaigns/)
- [TikTok Ads MCP Server (AdsMCP)](https://github.com/AdsMCP/tiktok-ads-mcp-server)
- [Google Ads MCP server — developer guide](https://developers.google.com/google-ads/api/docs/developer-toolkit/mcp-server)
- [google-marketing-solutions/google_ads_mcp (GitHub)](https://github.com/google-marketing-solutions/google_ads_mcp)
