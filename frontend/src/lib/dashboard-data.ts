export type CampaignStatus = 'Activa' | 'Pausada' | 'Borrador' | 'Revisión';

export type Variant = {
  color: string;
  headline: string;
  cta: string;
};

export type Metric = {
  label: string;
  value: string;
  delta?: string;
  good?: boolean;
};

export type Campaign = {
  id: string;
  name: string;
  prompt: string;
  perf: string;
  perfTone?: 'good' | 'neutral' | 'warn';
  time: string;
  status: CampaignStatus;
  saved: boolean;
  archived: boolean;
  unread?: boolean;
  platform: string;
  liveSince: string;
  audience: { label: string; reach: string; cpm: string };
  budget: { dia: number; dias: number; total: number };
  variants: Variant[];
  metrics?: Metric[];
  rationale: string;
  warnings?: string[];
};

export const STATUS_COLORS: Record<CampaignStatus, string> = {
  Activa: '#10b981',
  Pausada: '#f59e0b',
  Borrador: '#A4F4FD',
  Revisión: '#00d2ff',
};

const variantPalettes: Variant[][] = [
  [
    { color: '#00d2ff', headline: 'Vuelve el verano. Y 40% off.', cta: 'Comprar ahora' },
    { color: '#A4F4FD', headline: 'Un swipe. Después, verano.', cta: 'Ver colección' },
    { color: '#0B2551', headline: 'Llevá menos. Comprá mejor.', cta: 'Aprovechar' },
  ],
  [
    { color: '#00d2ff', headline: '¿Cuántas decisiones tomás solo?', cta: 'Reservar demo' },
    { color: '#0B2551', headline: 'El primer SaaS para founders LATAM.', cta: 'Probar 14 días' },
    { color: '#A4F4FD', headline: 'Menos reuniones, más resultados.', cta: 'Ver cómo' },
  ],
  [
    { color: '#A4F4FD', headline: 'El drop más esperado del año.', cta: 'Anotarme' },
    { color: '#00d2ff', headline: 'Solo 500 unidades. 0 réplicas.', cta: 'Ver drop' },
    { color: '#0B2551', headline: 'Lo que vestís cuenta una historia.', cta: 'Descubrir' },
  ],
  [
    { color: '#0B2551', headline: 'Black Friday llega antes acá.', cta: 'Ver lista' },
    { color: '#A4F4FD', headline: 'Tres días. Setenta marcas.', cta: 'Sumarme' },
    { color: '#00d2ff', headline: 'Comprá una vez. Ganá tres veces.', cta: 'Activar' },
  ],
  [
    { color: '#A4F4FD', headline: 'Newsletter de los que mueven LATAM.', cta: 'Suscribirme' },
    { color: '#00d2ff', headline: '5 minutos. Toda la semana.', cta: 'Probarlo' },
  ],
  [
    { color: '#00d2ff', headline: 'Tu app, en su pantalla principal.', cta: 'Instalar' },
    { color: '#0B2551', headline: 'Lo que probás hoy se queda mañana.', cta: 'Bajar gratis' },
  ],
  [
    { color: '#A4F4FD', headline: 'Bogotá, 15 de junio. Solo 80 lugares.', cta: 'Reservar' },
    { color: '#00d2ff', headline: 'El curso que no se promociona.', cta: 'Aplicar' },
    { color: '#0B2551', headline: 'Ejecutivos que lideran. No que reaccionan.', cta: 'Ver agenda' },
  ],
  [
    { color: '#0B2551', headline: 'La fintech que cabe en tu bolsillo.', cta: 'Crear cuenta' },
    { color: '#00d2ff', headline: 'Cero comisiones. Cero excusas.', cta: 'Empezar' },
  ],
  [
    { color: '#A4F4FD', headline: 'Volvé. Y 25% off al primer pedido.', cta: 'Volver' },
    { color: '#00d2ff', headline: 'Te dejamos algo guardado.', cta: 'Reclamar' },
  ],
  [
    { color: '#00d2ff', headline: 'Prueba gratis. Cobranza después.', cta: 'Probar 14 días' },
    { color: '#0B2551', headline: 'El stack favorito de equipos B2B.', cta: 'Demo en vivo' },
    { color: '#A4F4FD', headline: 'De prospect a cliente, en una llamada.', cta: 'Agendar' },
  ],
  [
    { color: '#A4F4FD', headline: 'La mesa de la noche te espera.', cta: 'Reservar' },
    { color: '#00d2ff', headline: 'Sin filas. Con vista.', cta: 'Ver disponibilidad' },
  ],
  [
    { color: '#00d2ff', headline: 'UX que se siente. No que se enseña.', cta: 'Inscribirme' },
    { color: '#A4F4FD', headline: 'Un curso. Un proyecto real. 6 semanas.', cta: 'Ver curso' },
  ],
  [
    { color: '#0B2551', headline: 'Se ve mejor cuando entrenás.', cta: 'Ser miembro' },
    { color: '#00d2ff', headline: 'Membresía + nutrición + comunidad.', cta: 'Probar 7 días' },
  ],
  [
    { color: '#A4F4FD', headline: 'Frío afuera. Glow adentro.', cta: 'Ver promo' },
    { color: '#00d2ff', headline: 'Tu rutina, ahora a la mitad.', cta: 'Aprovechar 50%' },
  ],
  [
    { color: '#0B2551', headline: 'El hot sale más grande del año.', cta: 'Ver ofertas' },
  ],
  [
    { color: '#A4F4FD', headline: 'Una nueva era. Mismo equipo.', cta: 'Conocer' },
  ],
  [
    { color: '#00d2ff', headline: 'Sé de los primeros 1.000.', cta: 'Anotarme beta' },
  ],
  [
    { color: '#A4F4FD', headline: 'Cada lunes, el resumen que importa.', cta: 'Suscribirme' },
  ],
];

export const campaigns: Campaign[] = [
  {
    id: 'cmp_01',
    name: 'Sale de Verano — Lookalike',
    prompt:
      'Empujá nuestro sale de verano a un lookalike 2% de compradores en AR. Presupuesto $200/día, optimizá por compras. Que corra 14 días.',
    perf: 'ROAS 4.8x',
    perfTone: 'good',
    time: 'En vivo',
    status: 'Activa',
    saved: true,
    archived: false,
    unread: true,
    platform: 'Meta',
    liveSince: 'Lanzada hace 2h',
    audience: { label: 'LAL 2% · AR', reach: '2.4M', cpm: 'CPM est. $7' },
    budget: { dia: 200, dias: 14, total: 2800 },
    variants: variantPalettes[0],
    rationale:
      '3 audiencias, 4 variantes creativas, presupuesto diario $200 sobre Meta Ads. ROAS estimado 4.6x.',
    metrics: [
      { label: 'Impresiones', value: '142K', delta: '+18%', good: true },
      { label: 'CTR', value: '2.4%', delta: '+0.6pp', good: true },
      { label: 'CPM', value: '$6.80', delta: '−$0.20', good: true },
      { label: 'Compras', value: '184', delta: '+22', good: true },
    ],
  },
  {
    id: 'cmp_02',
    name: 'Leads — SaaS Q3',
    prompt:
      'Conseguir registros a demo de founders LATAM, $150/día, retargeting + lookalike de últimos clientes.',
    perf: 'CPL $11',
    perfTone: 'good',
    time: 'En vivo',
    status: 'Activa',
    saved: true,
    archived: false,
    unread: true,
    platform: 'Meta',
    liveSince: 'Activa hace 6 días',
    audience: { label: 'LAL 1% + Retarget · LATAM', reach: '640K', cpm: 'CPM est. $9.20' },
    budget: { dia: 150, dias: 30, total: 4500 },
    variants: variantPalettes[1],
    rationale:
      '2 lookalikes (clientes 90d, registrados 30d) + retargeting de visitantes. Optimización por leads, copy con prueba social.',
    metrics: [
      { label: 'Leads', value: '276', delta: '+34', good: true },
      { label: 'CPL', value: '$11.20', delta: '−$2.30', good: true },
      { label: 'CTR', value: '1.8%', good: true },
      { label: 'Frecuencia', value: '1.4', good: true },
    ],
  },
  {
    id: 'cmp_03',
    name: 'Nuevo producto — Drop 04',
    prompt:
      'Anticipá nuestro drop a fashion-forward 18–28 en MX y AR, $80/día, video first y CTA a wishlist.',
    perf: 'CTR 2.4%',
    perfTone: 'good',
    time: 'Hace 2h',
    status: 'Activa',
    saved: false,
    archived: false,
    platform: 'Meta',
    liveSince: 'Activa hace 3 días',
    audience: { label: '18–28 · MX, AR', reach: '1.8M', cpm: 'CPM est. $5.60' },
    budget: { dia: 80, dias: 7, total: 560 },
    variants: variantPalettes[2],
    rationale:
      'Audiencia joven con interés en moda y streetwear. Stories y Reels priorizados, video corto, CTA a wishlist (lead nurturing antes del drop).',
    metrics: [
      { label: 'Reproducciones', value: '38K', good: true },
      { label: 'CTR', value: '2.4%', good: true },
      { label: 'Wishlist', value: '412', good: true },
      { label: 'CPM', value: '$5.60', good: true },
    ],
  },
  {
    id: 'cmp_04',
    name: 'Black Friday — Teaser',
    prompt:
      'Construí awareness para el BF sale, audiencia amplia, video first, gasto $300/día, 5 días previos.',
    perf: 'Listo para revisar',
    perfTone: 'neutral',
    time: 'Ayer',
    status: 'Borrador',
    saved: false,
    archived: false,
    platform: 'Meta',
    liveSince: 'Creada ayer',
    audience: { label: 'Amplia · LATAM', reach: '12M', cpm: 'CPM est. $4.80' },
    budget: { dia: 300, dias: 5, total: 1500 },
    variants: variantPalettes[3],
    rationale:
      'Awareness puro previo al evento. Targeting amplio para entrenar el algoritmo, video corto vertical, CTA blanda a lista de espera.',
    warnings: [
      'Falta vincular el pixel de conversión BF-2026',
      'CTR estimado < benchmark de la cuenta',
    ],
  },
  {
    id: 'cmp_05',
    name: 'Crecer newsletter',
    prompt: 'Más suscriptores — lectores de blogs de tech, lead form ads, $40/día.',
    perf: 'CPL $2.80',
    perfTone: 'good',
    time: 'Lun',
    status: 'Activa',
    saved: false,
    archived: false,
    platform: 'Meta',
    liveSince: 'Activa hace 12 días',
    audience: { label: 'Tech readers · LATAM', reach: '420K', cpm: 'CPM est. $4.10' },
    budget: { dia: 40, dias: 30, total: 1200 },
    variants: variantPalettes[4],
    rationale:
      'Lead form ads nativo de Meta, sin landing. Targeting por intereses de tech blogs (HN, TechCrunch, etc.), creativo simple con headline directo.',
    metrics: [
      { label: 'Suscriptores', value: '1,284', delta: '+162', good: true },
      { label: 'CPL', value: '$2.80', good: true },
      { label: 'Open rate', value: '38%', good: true },
    ],
  },
  {
    id: 'cmp_06',
    name: 'Instalaciones — Android',
    prompt: 'Generá installs en MX y BR, optimización por valor, $120/día.',
    perf: 'CPI $0.42',
    perfTone: 'good',
    time: 'Lun',
    status: 'Activa',
    saved: true,
    archived: false,
    platform: 'Meta',
    liveSince: 'Activa hace 9 días',
    audience: { label: 'Android users · MX, BR', reach: '8.6M', cpm: 'CPM est. $3.20' },
    budget: { dia: 120, dias: 21, total: 2520 },
    variants: variantPalettes[5],
    rationale:
      'App install campaign optimizada por valor (no installs). SDK conectado, eventos in-app trackeados. Targeting por dispositivo y nivel de engagement.',
    metrics: [
      { label: 'Installs', value: '6,142', delta: '+820', good: true },
      { label: 'CPI', value: '$0.42', good: true },
      { label: 'D1 retention', value: '64%', good: true },
    ],
  },
  {
    id: 'cmp_07',
    name: 'Curso Bogotá — 15 jun',
    prompt:
      'Quiero llenar nuestro evento en Bogotá, 15 de junio, $200, somos exclusivos. Audiencia ejecutiva LATAM.',
    perf: 'En revisión',
    perfTone: 'neutral',
    time: 'Hoy',
    status: 'Revisión',
    saved: true,
    archived: false,
    unread: true,
    platform: 'Meta',
    liveSince: 'Esperando aprobación',
    audience: { label: 'C-level · CO, MX, PE', reach: '180K', cpm: 'CPM est. $11.40' },
    budget: { dia: 200, dias: 14, total: 2800 },
    variants: variantPalettes[6],
    rationale:
      'Evento presencial en Bogotá. Targeting C-level por cargos y empresas (1.000+ empleados), copy enfocado en exclusividad y networking.',
    warnings: ['CPL > rango histórico de la cuenta', 'Audiencia chica: monitorear frecuencia'],
  },
  {
    id: 'cmp_08',
    name: 'Fintech — App downloads',
    prompt: 'Bajadas de la app entre jóvenes 18–35 en CO, $90/día, video corto.',
    perf: 'CPI $0.61',
    perfTone: 'good',
    time: 'Mar',
    status: 'Activa',
    saved: false,
    archived: false,
    platform: 'Meta',
    liveSince: 'Activa hace 5 días',
    audience: { label: '18–35 · CO', reach: '3.2M', cpm: 'CPM est. $4.90' },
    budget: { dia: 90, dias: 14, total: 1260 },
    variants: variantPalettes[7],
    rationale:
      'App install con targeting por intereses financieros y comportamiento mobile. Reels priorizados, Stories como secundario.',
    metrics: [
      { label: 'Installs', value: '2,108', good: true },
      { label: 'CPI', value: '$0.61', good: true },
      { label: 'KYC completed', value: '38%', good: true },
    ],
  },
  {
    id: 'cmp_09',
    name: 'E-commerce — Retargeting',
    prompt: 'Recuperá carritos abandonados últimos 14d, $50/día, oferta 25%.',
    perf: 'Pausada',
    perfTone: 'warn',
    time: 'Mié',
    status: 'Pausada',
    saved: false,
    archived: false,
    platform: 'Meta',
    liveSince: 'Pausada hace 1 día',
    audience: { label: 'Carritos 14d · AR', reach: '38K', cpm: 'CPM est. $14.20' },
    budget: { dia: 50, dias: 7, total: 350 },
    variants: variantPalettes[8],
    rationale:
      'Retargeting puro a abandono de carrito. CPM alto pero ROAS objetivo 8x+. Pausada por reducción de inventario.',
    warnings: ['Sin variantes nuevas en 9 días', 'Frecuencia 4.2 — fatiga creativa probable'],
  },
  {
    id: 'cmp_10',
    name: 'SaaS B2B — Demo signups',
    prompt: 'Demo de la plataforma, B2B mid-market en MX, $180/día, lead form + retarget.',
    perf: 'CPL $24',
    perfTone: 'good',
    time: 'Mié',
    status: 'Activa',
    saved: false,
    archived: false,
    platform: 'Meta',
    liveSince: 'Activa hace 11 días',
    audience: { label: 'Job titles B2B · MX', reach: '92K', cpm: 'CPM est. $13.80' },
    budget: { dia: 180, dias: 30, total: 5400 },
    variants: variantPalettes[9],
    rationale:
      'Audiencia chica + cara, pero CAC objetivo $300. Targeting por cargo (Ops/IT/CFO), tamaños de empresa 200–2.000 empleados.',
    metrics: [
      { label: 'Demos', value: '94', delta: '+11', good: true },
      { label: 'CPL', value: '$24.10', good: true },
      { label: 'SQL rate', value: '46%', good: true },
    ],
  },
  {
    id: 'cmp_11',
    name: 'Restaurante — Reservas',
    prompt: 'Reservas para nuestro restaurante en Palermo, foodies 25–45, $30/día, click to website.',
    perf: 'Listo para revisar',
    perfTone: 'neutral',
    time: 'Jue',
    status: 'Borrador',
    saved: true,
    archived: false,
    platform: 'Meta',
    liveSince: 'Creada ayer',
    audience: { label: '25–45 · Palermo, BA', reach: '54K', cpm: 'CPM est. $6.40' },
    budget: { dia: 30, dias: 7, total: 210 },
    variants: variantPalettes[10],
    rationale:
      'Geo radius de 5km alrededor del local. Intereses de gastronomía, vinos, salidas nocturnas. Click to website con landing de reserva.',
  },
  {
    id: 'cmp_12',
    name: 'Curso UX — LATAM',
    prompt: 'Inscripciones al curso UX, profesionales 24–40 en LATAM, $70/día, lead form.',
    perf: 'CPL $9.40',
    perfTone: 'good',
    time: 'Vie',
    status: 'Activa',
    saved: false,
    archived: false,
    platform: 'Meta',
    liveSince: 'Activa hace 2 días',
    audience: { label: 'Diseñadores 24–40 · LATAM', reach: '320K', cpm: 'CPM est. $5.80' },
    budget: { dia: 70, dias: 14, total: 980 },
    variants: variantPalettes[11],
    rationale:
      'Targeting por skills (UX, Figma, Product Design). Lead form con 3 campos, CTA a curso de 6 semanas con proyecto final.',
    metrics: [
      { label: 'Leads', value: '142', good: true },
      { label: 'CPL', value: '$9.40', good: true },
      { label: 'Inscritos', value: '38', good: true },
    ],
  },
  {
    id: 'cmp_13',
    name: 'Gym — Membresías Q4',
    prompt: 'Nuevas membresías para Q4, 22–45 cerca del gym, $40/día, oferta 30 días.',
    perf: 'Pausada',
    perfTone: 'warn',
    time: 'Vie',
    status: 'Pausada',
    saved: false,
    archived: false,
    platform: 'Meta',
    liveSince: 'Pausada hace 4 días',
    audience: { label: '22–45 · Geo 3km', reach: '76K', cpm: 'CPM est. $7.20' },
    budget: { dia: 40, dias: 30, total: 1200 },
    variants: variantPalettes[12],
    rationale:
      'Geo radius del gym. Intereses de fitness, nutrición, running. Pausada por revisión de oferta y cambio de creatividades.',
    warnings: ['CTR cayó 0.4pp en últimos 5 días', 'Recomendación: refrescar variantes'],
  },
  {
    id: 'cmp_14',
    name: 'Belleza — Promo invierno',
    prompt: 'Promo invierno línea skincare, mujeres 24–48 LATAM, $60/día, carrusel + reel.',
    perf: 'Listo para revisar',
    perfTone: 'neutral',
    time: 'Vie',
    status: 'Borrador',
    saved: false,
    archived: false,
    platform: 'Meta',
    liveSince: 'Creada hace 8h',
    audience: { label: 'F · 24–48 · LATAM', reach: '4.8M', cpm: 'CPM est. $5.20' },
    budget: { dia: 60, dias: 21, total: 1260 },
    variants: variantPalettes[13],
    rationale:
      'Combo carrusel (educativo) + reel (UGC). Targeting por intereses skincare, cosmética, K-beauty. CTA a producto destacado.',
  },
  {
    id: 'cmp_15',
    name: 'Hot Sale — 2024',
    prompt: 'Hot sale anual, descuentos 30–50%, audiencia amplia + retargeting, $400/día.',
    perf: 'Archivada',
    perfTone: 'neutral',
    time: 'May 2024',
    status: 'Activa',
    saved: false,
    archived: true,
    platform: 'Meta',
    liveSince: 'Cerrada hace 11 meses',
    audience: { label: 'Amplia + Retarget · AR', reach: '3.6M', cpm: 'CPM hist. $5.40' },
    budget: { dia: 400, dias: 7, total: 2800 },
    variants: variantPalettes[14],
    rationale:
      'Campaña final del Hot Sale 2024. Cerrada con ROAS 5.2x, mejor performance del año. Guardada como referencia.',
    metrics: [
      { label: 'ROAS final', value: '5.2x', good: true },
      { label: 'Compras', value: '1,840', good: true },
      { label: 'CTR final', value: '2.8%', good: true },
    ],
  },
  {
    id: 'cmp_16',
    name: 'Rebranding — Fase 1',
    prompt: 'Awareness del rebranding, audiencia existente + lookalike, $250/día, video.',
    perf: 'Archivada',
    perfTone: 'neutral',
    time: 'Mar 2024',
    status: 'Pausada',
    saved: false,
    archived: true,
    platform: 'Meta',
    liveSince: 'Cerrada hace 14 meses',
    audience: { label: 'Followers + LAL · LATAM', reach: '1.2M', cpm: 'CPM hist. $6.80' },
    budget: { dia: 250, dias: 14, total: 3500 },
    variants: variantPalettes[15],
    rationale:
      'Fase 1 del rebranding. Solo awareness, sin conversión directa. Cerrada cuando inició la fase 2 con CTA a producto.',
  },
  {
    id: 'cmp_17',
    name: 'Lanzamiento app — beta',
    prompt: 'Beta privada de la app, lista de espera, $80/día, lead form.',
    perf: 'Archivada',
    perfTone: 'neutral',
    time: 'Feb 2024',
    status: 'Activa',
    saved: false,
    archived: true,
    platform: 'Meta',
    liveSince: 'Cerrada hace 15 meses',
    audience: { label: 'Early adopters · LATAM', reach: '180K', cpm: 'CPM hist. $7.10' },
    budget: { dia: 80, dias: 21, total: 1680 },
    variants: variantPalettes[16],
    rationale:
      'Captación de lista de espera para beta. 1.000 cupos, llenos en 6 días. Cerrada al alcanzar la meta.',
    metrics: [
      { label: 'Inscritos', value: '1,002', good: true },
      { label: 'CPL', value: '$1.68', good: true },
    ],
  },
  {
    id: 'cmp_18',
    name: 'Newsletter — clásico',
    prompt: 'Suscriptores newsletter mensual, $20/día, lead form ads.',
    perf: 'Archivada',
    perfTone: 'neutral',
    time: 'Ene 2024',
    status: 'Pausada',
    saved: false,
    archived: true,
    platform: 'Meta',
    liveSince: 'Cerrada hace 16 meses',
    audience: { label: 'Tech readers · LATAM', reach: '340K', cpm: 'CPM hist. $4.20' },
    budget: { dia: 20, dias: 60, total: 1200 },
    variants: variantPalettes[17],
    rationale:
      'Versión anterior de la campaña de newsletter. Reemplazada por la nueva ("Crecer newsletter") con copy iterado.',
  },
];

export const getCampaignsCount = () => {
  const total = campaigns.filter((c) => !c.archived).length;
  const saved = campaigns.filter((c) => !c.archived && c.saved).length;
  const active = campaigns.filter((c) => !c.archived && c.status === 'Activa').length;
  const drafts = campaigns.filter((c) => !c.archived && c.status === 'Borrador').length;
  const archived = campaigns.filter((c) => c.archived).length;
  return { total, saved, active, drafts, archived };
};
