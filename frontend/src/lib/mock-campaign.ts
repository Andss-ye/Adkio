import type { Plan, LaunchResult } from '@/hooks/useCampaignStream';

/* ──────────────────────────────────────────────────────────────
 * Mock simulator — replica el contrato SSE del backend para
 * demos sin tener `localhost:8000` corriendo. Los rationales
 * y números son context-aware: parsea presupuesto, ciudad,
 * tipo de campaña y exclusividad del prompt y devuelve un plan
 * coherente con el seed `demo-edu-latam`.
 * ────────────────────────────────────────────────────────────── */

export const DEFAULT_BRAND = {
  negocio_nombre: 'AcademiaEjecutiva LATAM',
  negocio_industria: 'educacion ejecutiva / networking empresarial',
  publico_roles: ['Founder', 'CEO', 'Co-founder', 'Director General'],
  publico_paises: ['CO', 'MX', 'PE', 'AR'],
  publico_edad_min: 28,
  publico_edad_max: 52,
  publico_intereses: [
    'entrepreneurship',
    'business networking',
    'leadership development',
    'startup company',
    'venture capital',
    'Harvard Business Review',
  ],
  publico_exclusiones: ['students', 'unemployed', 'job seeker'],
  presupuesto_min_usd: 100,
  presupuesto_max_usd: 500,
  cpl_benchmark_usd: 14,
  ejemplos_copy: [
    '¿Cuántas decisiones importantes tomás solo?',
    'Los mejores líderes no crecen solos. Crecen con los correctos.',
  ],
};

const CITY_TO_COUNTRY: Record<string, { city: string; iso: string; country: string }> = {
  bogota: { city: 'Bogotá', iso: 'CO', country: 'Colombia' },
  bogotá: { city: 'Bogotá', iso: 'CO', country: 'Colombia' },
  medellin: { city: 'Medellín', iso: 'CO', country: 'Colombia' },
  medellín: { city: 'Medellín', iso: 'CO', country: 'Colombia' },
  cali: { city: 'Cali', iso: 'CO', country: 'Colombia' },
  'buenos aires': { city: 'Buenos Aires', iso: 'AR', country: 'Argentina' },
  'ciudad de mexico': { city: 'CDMX', iso: 'MX', country: 'México' },
  'ciudad de méxico': { city: 'CDMX', iso: 'MX', country: 'México' },
  cdmx: { city: 'CDMX', iso: 'MX', country: 'México' },
  monterrey: { city: 'Monterrey', iso: 'MX', country: 'México' },
  guadalajara: { city: 'Guadalajara', iso: 'MX', country: 'México' },
  lima: { city: 'Lima', iso: 'PE', country: 'Perú' },
  santiago: { city: 'Santiago', iso: 'CL', country: 'Chile' },
};

const MONTHS_RX =
  /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/i;

type CampaignType = 'evento' | 'curso' | 'leads' | 'venta' | 'awareness' | 'app_install';

export type ParsedPrompt = {
  budget_usd: number;
  duration_days: number;
  city?: string;
  iso?: string;
  country?: string;
  date_hint?: string;
  type: CampaignType;
  exclusive: boolean;
  raw: string;
};

export function parsePrompt(prompt: string): ParsedPrompt {
  const lower = prompt.toLowerCase();

  /* budget */
  let budget_usd = 200;
  const dollarMatch = prompt.match(/\$\s?([0-9]{2,5})/);
  const usdMatch = prompt.match(/([0-9]{2,5})\s?(usd|dólares|dolares|d[oó]lares)/i);
  if (dollarMatch) budget_usd = parseInt(dollarMatch[1], 10);
  else if (usdMatch) budget_usd = parseInt(usdMatch[1], 10);

  /* duration */
  let duration_days = 14;
  const dayM = prompt.match(/(\d{1,3})\s*d[ií]a/i);
  const weekM = prompt.match(/(\d{1,2})\s*semana/i);
  if (dayM) duration_days = parseInt(dayM[1], 10);
  else if (weekM) duration_days = parseInt(weekM[1], 10) * 7;

  /* city / country */
  let city: string | undefined;
  let iso: string | undefined;
  let country: string | undefined;
  for (const [k, v] of Object.entries(CITY_TO_COUNTRY)) {
    if (lower.includes(k)) {
      city = v.city;
      iso = v.iso;
      country = v.country;
      break;
    }
  }

  /* date hint — captures "15 de junio" / "junio 15" / "junio" */
  const monthMatch = prompt.match(MONTHS_RX);
  const dayNumMatch = prompt.match(/\b(\d{1,2})\s+de\s+([a-z]+)/i);
  let date_hint: string | undefined;
  if (dayNumMatch) date_hint = `${dayNumMatch[1]} de ${dayNumMatch[2]}`;
  else if (monthMatch) date_hint = monthMatch[0];

  /* type */
  let type: CampaignType = 'leads';
  if (/evento|inmersi[oó]n|presencial|workshop|encuentro|cumbre/.test(lower)) type = 'evento';
  else if (/curso|capacitaci[oó]n|programa|bootcamp/.test(lower)) type = 'curso';
  else if (/venta|sale|comprar|tienda|ecommerce|retarget/.test(lower)) type = 'venta';
  else if (/awareness|brand|conocer|reconocimiento/.test(lower)) type = 'awareness';
  else if (/instal|app\s+downloads/.test(lower)) type = 'app_install';

  const exclusive = /exclusiv|premium|elite|c-?level|ejecutiv|founder|ceo|alto.{0,4}nivel/i.test(
    lower,
  );

  return { budget_usd, duration_days, city, iso, country, date_hint, type, exclusive, raw: prompt };
}

/* ──────────────────────────────────────────────────────────────
 * Plan builder
 * ────────────────────────────────────────────────────────────── */

function audienceFor(p: ParsedPrompt): Plan['targeting'] {
  const paises = p.iso ? [p.iso] : DEFAULT_BRAND.publico_paises.slice();
  const intereses = [...DEFAULT_BRAND.publico_intereses];
  if (p.type === 'evento') intereses.push('business events', 'professional networking');
  if (p.type === 'curso') intereses.push('online courses', 'professional development');
  if (p.type === 'venta') intereses.unshift('online shopping');

  /* tamaño estimado: número distinto según ciudad/país y exclusividad */
  let tamano = 640_000;
  if (p.city) tamano = p.exclusive ? 180_000 : 420_000;
  else if (p.country) tamano = p.exclusive ? 360_000 : 1_200_000;

  const ageMin = p.exclusive ? 32 : DEFAULT_BRAND.publico_edad_min;
  const ageMax = DEFAULT_BRAND.publico_edad_max;

  const exclusiones = p.exclusive
    ? [...DEFAULT_BRAND.publico_exclusiones, 'junior roles', 'interns']
    : DEFAULT_BRAND.publico_exclusiones;

  const where = p.city ? `${p.city}, ${p.country ?? ''}`.replace(/, $/, '') : paises.join(', ');
  const audienceLabel = p.exclusive ? `C-level · ${where}` : `Profesionales ${ageMin}–${ageMax} · ${where}`;

  const rationale = p.exclusive
    ? `Audiencia C-level segmentada por cargo (${DEFAULT_BRAND.publico_roles.join(', ')}) y empresas 200+ empleados. ${audienceLabel}. CPM estimado alto pero CAC objetivo justifica.`
    : `Audiencia profesional con intereses en business networking y leadership development. ${audienceLabel}. Excluyo students y job seekers para mantener calidad del lead.`;

  return {
    intereses,
    edad_min: ageMin,
    edad_max: ageMax,
    paises,
    tamano_estimado: tamano,
    exclusiones,
    rationale,
  };
}

function copyFor(p: ParsedPrompt): Plan['copy'] {
  const cityLabel = p.city ?? 'tu ciudad';
  const dateLabel = p.date_hint ? ` · ${p.date_hint}` : '';

  if (p.type === 'evento') {
    return {
      headline: p.exclusive
        ? `Bogotá te espera. Solo 80 lugares.`
        : `${cityLabel}${dateLabel}. Confirma tu lugar.`,
      body: p.exclusive
        ? `Una noche con founders que ya pasaron donde estás. Sin venta. Sin pitch. Solo conversaciones reales entre quienes lideran LATAM. ${dateLabel ? `Reservá tu lugar para el ${p.date_hint}.` : ''}`
        : `Encuentro presencial para fundadores y operadores. Mesa redonda + Q&A + networking. Cupo limitado.`,
      cta: 'Reservar mi lugar',
      rationale: p.exclusive
        ? `Hook con scarcity ("80 lugares") + ego del C-level ("ya pasaron donde estás"). Body refuerza autenticidad — sin pitch, sin venta. Tono basado en pares, no autoayuda.`
        : `Headline directo (cuándo + dónde + acción). Body simple con formato del evento. CTA con urgencia.`,
    };
  }

  if (p.type === 'curso') {
    return {
      headline: '6 semanas. Un proyecto real. Cero teoría.',
      body: `Un curso pensado para profesionales que ya están en la industria. Mentorías 1-a-1, comunidad activa y certificación. Próxima cohorte abierta.`,
      cta: 'Ver programa',
      rationale: `Headline con números concretos y promesa diferenciada. Body enfatiza diferenciador (1-a-1, comunidad). CTA blando — el lead form viene después.`,
    };
  }

  if (p.type === 'venta') {
    return {
      headline: 'La promo que no se vuelve a repetir.',
      body: `40% off en toda la colección por tiempo limitado. Envíos gratis ${p.country ? `a ${p.country}` : 'en LATAM'}. Solo este fin de semana.`,
      cta: 'Comprar ahora',
      rationale: `Hook de scarcity puro. Body con beneficio claro (40% off + envíos) + límite temporal. Conversión directa.`,
    };
  }

  /* default leads */
  return {
    headline: '¿Cuántas decisiones importantes tomás solo?',
    body: `Los mejores líderes no crecen solos. Crecen con los correctos. Sumate a una comunidad de fundadores y CEOs que ya escalaron sus empresas.`,
    cta: 'Conocer más',
    rationale: `Hook con pregunta directa al ego del founder (validado en seed de copy aprobado). Body con prueba social ("ya escalaron"). CTA blanda — ideal para audiencia top-of-funnel.`,
  };
}

function budgetFor(p: ParsedPrompt): Plan['budget'] {
  const total = p.budget_usd;
  const diario = total / p.duration_days;
  const warnings: string[] = [];

  if (total < DEFAULT_BRAND.presupuesto_min_usd) {
    warnings.push(
      `Presupuesto bajo el mínimo recomendado ($${DEFAULT_BRAND.presupuesto_min_usd}). Esperá CPL volátil.`,
    );
  }
  if (diario < 10) {
    warnings.push(
      `Presupuesto diario muy chico ($${diario.toFixed(2)}/día) — Meta puede tardar 5-7 días en salir de fase de aprendizaje.`,
    );
  }
  if (total > DEFAULT_BRAND.presupuesto_max_usd) {
    warnings.push(
      `Presupuesto sobre el rango configurado ($${DEFAULT_BRAND.presupuesto_max_usd}). Confirmar con stakeholders.`,
    );
  }

  return {
    aprobado: warnings.length < 2,
    warnings,
    presupuesto_diario_calculado: Math.round(diario * 100) / 100,
    rationale: `$${total} repartido en ${p.duration_days} días = $${diario.toFixed(2)}/día. CPL benchmark para ${DEFAULT_BRAND.negocio_industria}: $${DEFAULT_BRAND.cpl_benchmark_usd}. Esperás ~${Math.floor(total / DEFAULT_BRAND.cpl_benchmark_usd)} leads en ${p.duration_days} días.`,
  };
}

function validationFor(p: ParsedPrompt, audience: Plan['targeting']): Plan['validation'] {
  const checklist: Record<string, boolean> = {
    pixel_configurado: true,
    evento_de_conversion: true,
    audiencia_minima: audience.tamano_estimado >= 50_000,
    presupuesto_diario_minimo: true,
    creatividades_completas: true,
    landing_page_responsive: true,
    politicas_meta_ok: true,
    copy_dentro_de_limite: true,
  };
  const passed = Object.values(checklist).every(Boolean);
  const warnings: string[] = [];
  if (!checklist.audiencia_minima)
    warnings.push('Audiencia chica (<50K) — frecuencia subirá rápido. Monitorear día 7.');
  if (p.exclusive)
    warnings.push('Audiencia exclusiva: monitorear frecuencia y CPM en primeras 48h.');

  return {
    passed,
    warnings,
    blockers: [],
    checklist_results: checklist,
    rationale: `${Object.values(checklist).filter(Boolean).length}/${Object.keys(checklist).length} criterios Meta superados. Pixel trackeado, evento de conversión configurado, copy dentro de límites. Lista para lanzar.`,
  };
}

export function buildMockPlan(prompt: string): Plan {
  const parsed = parsePrompt(prompt);
  const targeting = audienceFor(parsed);
  return {
    copy: copyFor(parsed),
    targeting,
    budget: budgetFor(parsed),
    validation: validationFor(parsed, targeting),
    claims: claimsFor(),
    duracion_dias: parsed.duration_days,
  };
}

/* El copy del mock sale de templates limpios, así que el guardrail siempre pasa.
   El `rationale` es el literal de la rama sin claims de `claims_validator.py`:
   no se replican las regex acá — la fuente de verdad es el backend. */
function claimsFor(): NonNullable<Plan['claims']> {
  return {
    passed: true,
    blockers: [],
    warnings: [],
    claims: [],
    rationale:
      'El copy no tiene claims que violen las políticas de contenido de Meta: ' +
      'sin promesas de resultado, claims de salud ni atributos personales.',
  };
}

/* ──────────────────────────────────────────────────────────────
 * Stream simulator — emite los mismos events que el backend SSE
 * ────────────────────────────────────────────────────────────── */

export type MockEvent =
  | { kind: 'tool_start'; tool: string }
  | {
      kind: 'tool_result';
      tool: string;
      result: Record<string, unknown>;
    }
  | { kind: 'plan_ready'; plan: Plan };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const TOOL_TIMINGS: { tool: string; min: number; max: number }[] = [
  { tool: 'budget_validator', min: 600, max: 900 },
  { tool: 'audience_analyzer', min: 1100, max: 1500 },
  { tool: 'copy_generator', min: 1400, max: 1900 },
  // Rápido a propósito: es regex determinista, no una llamada al LLM.
  { tool: 'claims_validator', min: 300, max: 500 },
  { tool: 'campaign_validator', min: 700, max: 1000 },
];

export async function simulateMockStream(
  prompt: string,
  emit: (e: MockEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const plan = buildMockPlan(prompt);
  const resultByTool: Record<string, unknown> = {
    budget_validator: plan.budget,
    audience_analyzer: plan.targeting,
    copy_generator: plan.copy,
    claims_validator: plan.claims,
    campaign_validator: plan.validation,
  };

  for (const t of TOOL_TIMINGS) {
    if (signal?.aborted) return;
    emit({ kind: 'tool_start', tool: t.tool });
    const dur = t.min + Math.random() * (t.max - t.min);
    await sleep(dur);
    if (signal?.aborted) return;
    emit({
      kind: 'tool_result',
      tool: t.tool,
      result: resultByTool[t.tool] as Record<string, unknown>,
    });
    await sleep(120 + Math.random() * 100);
  }

  if (signal?.aborted) return;
  await sleep(200);
  emit({ kind: 'plan_ready', plan });
}

/* ──────────────────────────────────────────────────────────────
 * Mock launch — simula POST /campaign/approve
 * ────────────────────────────────────────────────────────────── */

export async function simulateMockLaunch(plan: Plan, prompt: string): Promise<LaunchResult> {
  const parsed = parsePrompt(prompt);
  await sleep(900 + Math.random() * 500);

  const adAccountId = '7392845106';
  const ts = Math.floor(Date.now() / 1000);
  const campaign_id = `act_${adAccountId}_${ts}`;

  const reachLow = Math.round(plan.targeting.tamano_estimado * 0.18);
  const reachHigh = Math.round(plan.targeting.tamano_estimado * 0.42);
  const expectedLeads = Math.max(1, Math.floor(parsed.budget_usd / DEFAULT_BRAND.cpl_benchmark_usd));

  const fmt = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${Math.round(n / 1_000)}K`
        : `${n}`;

  return {
    campaign_id,
    status: 'PAUSED',
    estimated_reach: `${fmt(reachLow)}–${fmt(reachHigh)} personas`,
    preview_url: undefined,
    kpis: {
      expected_leads: expectedLeads,
      cpl_usd: DEFAULT_BRAND.cpl_benchmark_usd,
      total_budget_usd: parsed.budget_usd,
      daily_budget_usd: plan.budget.presupuesto_diario_calculado,
      duration_days: plan.duracion_dias,
    },
    next_steps: [
      'Activar la campaña en Meta Ads Manager',
      'Monitorear las primeras 48h (fase de aprendizaje)',
      `Refrescar copy si el CPL supera $${DEFAULT_BRAND.cpl_benchmark_usd + 6}`,
    ],
  };
}

/* ──────────────────────────────────────────────────────────────
 * Backend health check con timeout corto
 * ────────────────────────────────────────────────────────────── */

export async function isBackendAlive(backendUrl: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(`${backendUrl}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}
