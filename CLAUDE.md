# MarketingOS — CLAUDE.md

## Qué es esto
Agente de marketing que convierte lenguaje natural en campañas de Facebook Ads. Vertical inicial: educación ejecutiva y networking (cliente demo: 30X — plataforma creada por los cofundadores de Rappi). Dos fases secuenciales: onboarding conversacional que genera un `brand_config.md`, luego ejecución autónoma de campañas usando tool use.

El `brand_config.md` es el activo central del sistema: codifica el ADN de marca del negocio. El agente lo lee antes de cada acción y opera dentro de sus límites.

---

## Contexto de negocio: 30X

30X es una plataforma de educación ejecutiva y networking creada por Andrés Bilbao, Daniel Bilbao y Dylan Rosemberg. Combina inmersiones presenciales de 3 días con entrenamientos online en ventas, negociación, persuasión e IA para directivos. Ha impactado a más de 1.000 líderes en Colombia, Perú, Chile y Argentina, con expansión a México, EEUU y España en 2026.

**Por qué es el nicho correcto para el MVP:**
- Ticket alto ($500–3.000 USD por programa)
- Público muy definido: fundadores, CEOs, directivos con empresas de 5–200 empleados
- El copy basado en autoridad y pares funciona especialmente bien en Meta Ads
- CPL benchmark LATAM para educación ejecutiva: $8–25 USD/lead

**Referente técnico: Felipe Vergara**
Consultor colombiano de Meta Ads, ha invertido más de $35M USD en publicidad para más de 250 marcas. Sus principios están codificados en el sistema:
- Conocer el nivel de consciencia del público antes de escribir copy
- No editar campañas en los primeros 7 días (fase de aprendizaje de Meta)
- El algoritmo necesita señales claras: audiencias de 150K–500K, no broad
- Definir el "número mágico" (CPL máximo tolerable) antes de lanzar

---

## Stack
| Capa | Tecnología | Nota |
|---|---|---|
| Agente | Python + Anthropic SDK | Tool use + visión nativos |
| Backend | FastAPI (async) | Endpoints para frontend y webhooks |
| ORM | SQLAlchemy 2.0 async | Migración trivial entre DBs |
| Base de datos | PostgreSQL | Railway lo da gestionado |
| Imágenes | Cloudinary | URLs públicas permanentes (Meta las requiere) |
| Scraping | Firecrawl | Devuelve Markdown limpio de cualquier URL |
| Ads | Meta Marketing API sandbox | Sin cobros reales, simula respuesta completa |
| Frontend | Streamlit | Rápido para hackathon |
| Deploy | Railway | PostgreSQL + backend + frontend en un proyecto |
| Migraciones | Alembic | Corre antes del start del servidor |

---

## Variables de entorno (.env)
Todo manejado por el equipo para el MVP — el admin no configura nada.

```env
# AI
ANTHROPIC_API_KEY=sk-ant-...

# Scraping
FIRECRAWL_API_KEY=fc-...

# Facebook Ads (Sandbox)
META_APP_ID=...
META_APP_SECRET=...
META_ACCESS_TOKEN=...
META_AD_ACCOUNT_ID=act_...
META_PAGE_ID=...

# PostgreSQL (Railway lo inyecta automáticamente)
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# App
ENVIRONMENT=sandbox
MAX_BUDGET_USD=200
```

---

## Estructura del proyecto
```
marketingos/
├── .env
├── CLAUDE.md
├── requirements.txt
├── Dockerfile
├── railway.toml
│
├── models.py                        # Todos los modelos SQLAlchemy
├── database.py                      # Engine async, SessionLocal, get_db
│
├── alembic/
│   ├── env.py
│   └── versions/
│
├── agents/
│   ├── onboarding_agent.py          # Conversacional, genera brand_config
│   └── campaign_agent.py            # Orchestrator con tool use loop
│
├── tools/
│   ├── scrape_product_url.py        # Firecrawl wrapper
│   ├── analyze_images.py            # Claude vision → metadata → Cloudinary
│   ├── generate_brand_config.py     # Conversación + scrape + imágenes → .md
│   ├── research_campaign_context.py # web_search → benchmarks + ángulos
│   ├── campaign_validator.py        # Checklist pre-lanzamiento
│   ├── budget_validator.py          # Valida vs límites del brand_config
│   ├── audience_analyzer.py         # Define targeting params para Meta
│   ├── copy_generator.py            # Headline + body + CTA por canal
│   ├── image_selector.py            # Elige imagen apta o retorna needs_input
│   ├── campaign_launcher.py         # Meta Ads API sandbox
│   └── report_generator.py         # Genera .md descargable
│
├── api/
│   ├── main.py
│   └── routes/
│       ├── sessions.py
│       ├── messages.py
│       ├── images.py
│       └── campaigns.py
│
└── frontend/
    └── app.py                       # Streamlit — chat único para ambos modos
```

---

## Modelos de base de datos (SQLAlchemy ORM)

```python
# Todos usan Mapped[] con tipos explícitos (SQLAlchemy 2.0 style)

Session
  id: str (uuid, PK)
  status: str         # "onboarding" | "campaign"
  confidence_score: float
  created_at: datetime
  updated_at: datetime

BrandConfig
  id: int (PK)
  session_id: str (FK → sessions.id, unique)
  config_json: dict   # brand_config parseado como JSON
  config_md: str      # el .md raw generado
  product_url: str | None
  scraped_content: str | None   # markdown del scrape de Firecrawl
  generated_at: datetime
  version: int

Image
  id: int (PK)
  session_id: str (FK → sessions.id)
  filename: str
  cloudinary_url: str           # URL pública permanente
  cloudinary_public_id: str     # para transformaciones y borrado
  content_type: str             # "producto" | "lifestyle" | "persona" | "logo"
  quality: str                  # "alta" | "media" | "baja"
  is_apt: bool                  # apta para Meta Ads
  rejection_reason: str | None  # razón si is_apt=False
  metadata_json: dict           # colores, dimensiones, descripción visual
  uploaded_at: datetime

Campaign
  id: int (PK)
  session_id: str (FK → sessions.id)
  meta_campaign_id: str | None  # ID real en Facebook sandbox
  status: str    # "pending" | "active" | "paused" | "error"
  objective: str                # instrucción original del admin
  budget_usd: float
  targeting_json: dict
  copy_json: dict               # {headline, body, cta}
  image_id: int | None (FK → images.id)
  report_md: str | None
  created_at: datetime

Message
  id: int (PK)
  session_id: str (FK → sessions.id)
  role: str      # "user" | "assistant"
  content: str
  created_at: datetime
```

---

## Detección automática de modo

```python
def get_agent_mode(session_id: str, db: AsyncSession) -> str:
    session = await db.get(Session, session_id)
    if session.status == "onboarding":
        return "onboarding"
    config = await db.get(BrandConfig, session_id)
    if not config:
        return "onboarding"
    return "campaign"
```

Mismo chat para ambos modos. El admin nunca elige manualmente.

---

## FASE 1: Onboarding Agent

### Objetivo
Conversar hasta confidence_score >= 0.85 y generar el `brand_config.md`. El agente infiere lo que puede y pregunta UNA sola cosa a la vez.

### Campos a recolectar
| Campo | Peso | Inferible |
|---|---|---|
| Industria / producto | Alta | A veces del primer mensaje |
| Público objetivo (rol, edad) | Alta | Parcial por industria |
| Ubicación geográfica | Alta | No |
| Presupuesto mensual | Alta | No |
| Canales preferidos | Media | Por industria |
| Tono de comunicación | Media | Por estilo del admin |
| Propuesta de valor | Media | Parcial |
| Restricciones de contenido | Baja | Por industria (salud, finanzas) |

### confidence_score
```
Campos críticos (peso 0.30 total):   industria, público, ubicación, presupuesto
Campos importantes (peso 0.20):      canales, tono, propuesta de valor
Campos opcionales (peso 0.10):       restricciones, ejemplos de copy

score = suma de pesos de campos recolectados
>= 0.85 → llama generate_brand_config()
< 0.85  → hace la pregunta más importante que falta
```

### Inputs adicionales durante onboarding
- **Link de producto/servicio** → Firecrawl lo scrapea, extrae nombre, descripción, precio, propuesta de valor implícita. Enriquece automáticamente el onboarding.
- **Imágenes** → Claude las analiza con visión. Extrae: tipo de contenido, calidad, colores, aptitud para ads. Se suben a Cloudinary. Metadata se guarda en DB.

### Output: brand_config.md
Formato YAML front-matter dentro de Markdown. Campos inferidos marcados con `# inferido`. Ejemplo para 30X:

```yaml
---
negocio:
  nombre: "30X"
  industria: "educación ejecutiva / networking"
  propuesta_de_valor: "Inmersiones presenciales para que fundadores y CEOs escalen aprendiendo de quienes ya lo lograron"
  website: "https://30x.com"

publico_objetivo:
  rol: ["Fundador", "CEO", "Director General", "C-Suite"]
  edad_min: 28
  edad_max: 52
  tamano_empresa: "5–200 empleados"
  paises_prioritarios: ["Colombia", "México", "Perú", "Argentina"]
  nivel_ingreso: "alto"

presupuesto:
  minimo_campana_usd: 100
  maximo_campana_usd: 500
  alerta_si_supera_usd: 400

canales:
  facebook_ads: true
  instagram_ads: true

tono:
  estilo: ["aspiracional", "directo", "basado en pares"]
  evitar: ["lenguaje de autoayuda genérico", "promesas vacías", "tono académico"]
  ejemplos_copy_aprobado:
    - "¿Cuántas decisiones importantes tomas completamente solo?"
    - "Los mejores líderes no crecen solos. Crecen con los correctos."

pixel_configurado: false
version: "1.0"
generado_en: "2025-05-09T14:30:00Z"
campos_inferidos: 4
---
```

---

## FASE 2: Campaign Agent

### Flujo de tools (en orden)

```
1. research_campaign_context()
   → web_search con fuentes de autoridad (felipevergara.co, meta.com)
   → retorna: CPL benchmark, ángulos emocionales que funcionan,
              formato recomendado, objeciones típicas del público

2. campaign_validator()
   → corre checklist completo
   → BLOQUEA si: objetivo incorrecto, presupuesto < mínimo, audiencia > 5M
   → ADVIERTE si: pixel no configurado, duración < 7 días

3. budget_validator()
   → compara presupuesto solicitado vs brand_config.maximo_campana_usd
   → retorna: approved | warning | rejected

4. audience_analyzer()
   → input: objetivo de campaña + brand_config
   → output: targeting params listos para Meta API
   → para 30X: intereses ejecutivos + comportamiento decision maker,
               audiencia objetivo 150K–500K

5. copy_generator()
   → input: producto, audiencia, tono del brand_config, ángulos del research
   → output: {headline, body, cta}
   → nivel de consciencia: problem_aware (audiencia fría, sin historial de pixel)

6. image_selector()
   → busca imagen apta en DB para la sesión
   → si encuentra: retorna cloudinary_url lista para Meta
   → si no hay aptas: retorna AgentResponse(type="needs_input") con opciones:
       "Subir imágenes nuevas" | "Lanzar sin imagen" | "Cancelar"
   → campaña queda en status="pending" en DB hasta que el admin resuelva

7. campaign_launcher()
   → llama Meta Ads API sandbox
   → crea: Campaign → AdSet → Ad con imagen de Cloudinary
   → retorna: {meta_campaign_id, status, estimated_reach}

8. report_generator()
   → input: resultados de todos los tools anteriores
   → output: .md con resumen ejecutivo, CPL esperado, próximos pasos,
             advertencias (ej: "instala el pixel para poder hacer retargeting")
```

### Tool use loop estándar
```python
while response.stop_reason == "tool_use":
    tool_results = await execute_tools(response.content, db, session_id)
    messages.append({"role": "assistant", "content": response.content})
    messages.append({"role": "user", "content": tool_results})
    response = await claude.messages.create(
        model="claude-sonnet-4-20250514",
        system=system_prompt,  # brand_config.md + instrucciones
        messages=messages,
        tools=CAMPAIGN_TOOLS
    )
```

---

## Tipo de campaña (MVP: solo tráfico frío)

**Objetivo Meta:** `LEAD_GENERATION`
**Para quién:** Audiencia que no conoce el negocio (sin pixel data)
**Ángulo copy:** Dolor del aislamiento del líder / problema-aware
**Presupuesto mínimo:** $15 USD/día × mínimo 7 días = $105 para fase de aprendizaje
**No editar** la campaña durante los primeros 7 días (el algoritmo de Meta necesita ese tiempo)

### Segmentación específica para 30X
```python
intereses_primarios = [
    "Entrepreneurship", "Business networking", "Leadership development",
    "Executive education", "Startup company", "Venture capital"
]
intereses_secundarios = [
    "Harvard Business Review", "Forbes", "Rappi",
    "Y Combinator", "TED Talks", "Growth hacking"
]
comportamientos = ["Business decision makers", "Small business owners"]
edad = (28, 52)
paises = ["Colombia", "México", "Perú", "Argentina"]
tamanio_objetivo = "150K–500K"  # broad (>2M) = señal débil, CPL alto
```

---

## Checklist campaign_validator

```
OBJETIVO
  ☐ Objetivo alineado con etapa del funnel
  ☐ KPI principal definido antes de lanzar (CPL objetivo)

AUDIENCIA
  ☐ Tamaño entre 100K y 2M personas
  ☐ Exclusiones configuradas (no impactar clientes actuales)

PRESUPUESTO
  ☐ >= $5 USD/día por conjunto de anuncios
  ☐ Duración >= 7 días (fase de aprendizaje Meta)

COPY
  ☐ Headline ataca dolor específico del ICP
  ☐ Nivel de consciencia del público identificado
  ☐ CTA consistente con la landing o formulario

TÉCNICO
  ☐ URL de destino con UTMs configurados
  ☐ Pixel instalado [ADVERTENCIA si no, no bloquea en MVP]
```

---

## image_selector — lógica completa

```python
@dataclass
class ImageSelectorResult:
    status: Literal["selected", "none_apt", "no_images"]
    selected_image: Image | None
    rejected: list[dict]   # [{filename, reason}]
    message: str

# Si status != "selected":
# → Campaign se guarda con status="pending" en DB
# → Frontend renderiza botones:
#     [Subir imágenes nuevas] [Lanzar sin imagen] [Cancelar]
# → "Subir nuevas": corre analyze_images() → reintenta image_selector()
# → "Sin imagen": campaign_launcher() crea ad solo con copy (Meta lo permite)
# → "Cancelar": limpia pending_campaign de la sesión
```

Meta Ads requiere imágenes con URL pública → por eso Cloudinary es obligatorio en deploy.

---

## Deploy Railway

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD alembic upgrade head && uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

```toml
# railway.toml
[build]
builder = "dockerfile"

[deploy]
startCommand = "alembic upgrade head && uvicorn api.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
restartPolicyType = "on_failure"
```

Servicios en Railway:
- `marketingos-api` → FastAPI (Dockerfile)
- `marketingos-frontend` → Streamlit (Dockerfile separado)
- `PostgreSQL` → Plugin Railway (DATABASE_URL auto-inyectada)

---

## KPIs del demo para jueces

| Métrica | Valor esperado (30X) |
|---|---|
| CPL (costo por lead) | $8–25 USD |
| CTR esperado | 1.5–3% |
| Tamaño audiencia recomendado | 150K–500K |
| Presupuesto mínimo para aprender | $105 USD (7 días) |
| Tiempo fase aprendizaje Meta | 7 días sin tocar |

---

## Fuera del MVP
- Campaña tipo 2 (retargeting / warm conversion — requiere pixel con datos)
- TikTok Ads API
- OAuth con Meta (token manual en .env)
- Multi-tenant / autenticación de usuarios
- Analytics de campañas post-lanzamiento
- Validador de políticas de contenido Meta
- Comandos especiales (/reconfigurar, /pausar, etc.)
