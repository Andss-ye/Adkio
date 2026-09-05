import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

type Section = { heading: string; body: string };

type LegalDoc = {
  title: string;
  subtitle: string;
  updated: string;
  sections: Section[];
};

const docs: Record<string, LegalDoc> = {
  privacidad: {
    title: 'Privacidad',
    subtitle: 'Cómo recopilamos, usamos y protegemos tu información.',
    updated: 'Última actualización: 2 de septiembre de 2026',
    sections: [
      {
        heading: 'Datos que recopilamos',
        body: 'Cuando creas una cuenta pedimos nombre y email. Al usar Adkio guardamos lo que generas en el producto: prompts, planes de campaña, configuración de marca y el historial de campañas asociadas a tu cuenta. Si conectas Meta (u otra plataforma de ads), recibimos tokens de acceso y metadatos de las cuentas publicitarias que autorices (por ejemplo ad account y página). También registramos datos técnicos básicos (IP, navegador, rutas visitadas) para operar y proteger el servicio. Hoy no cobramos dentro de Adkio: no pedimos datos de tarjeta en la app.',
      },
      {
        heading: 'Cómo los usamos',
        body: 'Usamos tus datos para autenticarte, planificar campañas con el agente, crear o actualizar objetos en las plataformas que conectes (con tu aprobación) y mostrarte el estado de esas campañas. No vendemos tu información. Los prompts y resultados pueden usarse de forma agregada o anonimizada para mejorar el producto; no los usamos para anunciarte a terceros.',
      },
      {
        heading: 'Meta y otras plataformas de ads',
        body: 'Si conectas Meta, Adkio actúa en tu nombre dentro de los permisos que otorgues (por ejemplo gestión y lectura de anuncios). Enviamos a Meta la información necesaria para crear o consultar campañas, conjuntos y anuncios según el plan que apruebes. Las campañas se crean en estado pausado para que no gasten hasta que tú (o tu equipo) las actives en Meta o, cuando exista, desde Adkio. Puedes desconectar la plataforma desde la app; eso deja de usar el token guardado para nuevas acciones.',
      },
      {
        heading: 'Otros proveedores',
        body: 'Usamos proveedores de infraestructura para alojar la app y la base de datos (por ejemplo Supabase y el hosting donde corre Adkio) y proveedores de modelos de lenguaje para generar planes y copy. Esos proveedores solo procesan lo necesario para prestar el servicio.',
      },
      {
        heading: 'Retención',
        body: 'Conservamos tu información mientras la cuenta esté activa. Si pides el cierre de la cuenta, eliminamos o anonimizamos los datos personales en un plazo razonable, salvo lo que debamos conservar por obligación legal. Los objetos ya creados en Meta siguen bajo tu cuenta de Meta y sus propias políticas.',
      },
      {
        heading: 'Tus derechos',
        body: 'Tienes derecho a acceder, rectificar, actualizar o solicitar la eliminación de tus datos personales, conforme a la Ley 1581 de 2012 y normas relacionadas en Colombia. Escríbenos a privacidad@adkio.co; respondemos en los plazos que indique la ley aplicable.',
      },
      {
        heading: 'Contacto',
        body: 'Responsable del tratamiento: Adkio, Bogotá, Colombia. Consultas de privacidad: privacidad@adkio.co.',
      },
    ],
  },
  terminos: {
    title: 'Términos de servicio',
    subtitle: 'Las condiciones bajo las cuales puedes usar Adkio.',
    updated: 'Última actualización: 2 de septiembre de 2026',
    sections: [
      {
        heading: 'Aceptación',
        body: 'Al crear una cuenta o usar Adkio aceptas estos términos. Si usas el servicio en nombre de una empresa, declaras que tienes autoridad para obligarla.',
      },
      {
        heading: 'Qué es Adkio',
        body: 'Adkio es una herramienta en evolución (beta) que ayuda a planificar y lanzar campañas de publicidad paga desde lenguaje natural, con aprobación humana antes de publicar. El producto puede cambiar; nuevas funciones no alteran estos términos hasta que actualicemos esta página.',
      },
      {
        heading: 'Uso permitido',
        body: 'Puedes usar Adkio para crear y gestionar campañas en las plataformas que conectes (hoy el foco es Meta; otras pueden estar en prueba o no disponibles). Está prohibido el contenido ilegal, engañoso o que viole las políticas de Meta u otras plataformas. Podemos suspender cuentas que incumplan estos términos o abusen del servicio.',
      },
      {
        heading: 'Cuentas, credenciales y plataformas',
        body: 'Eres responsable de tu cuenta Adkio y de las credenciales de las plataformas que conectes. No compartas tokens ni contraseñas. El gasto publicitario ocurre en tu cuenta de Meta (u otra plataforma), bajo sus condiciones de pago; Adkio no es el medio de cobro de ese gasto. Si detectas acceso no autorizado, avísanos a seguridad@adkio.co.',
      },
      {
        heading: 'Aprobación humana y campañas en pausa',
        body: 'El plan de campaña no se publica solo: requiere tu aprobación explícita. Las campañas creadas desde Adkio quedan en pausa para que revises antes de gastar. Activar el gasto es tu responsabilidad (en la plataforma de ads o, cuando exista, con una acción explícita en Adkio).',
      },
      {
        heading: 'Planes y cobros de Adkio',
        body: 'Hoy el acceso puede ser demo, invitación o prueba sin cobro dentro de la app. Si en el futuro ofrecemos planes de pago, publicaremos precios y condiciones antes de cobrar y te pediremos aceptación. El presupuesto que defines para anuncios es independiente de cualquier plan de Adkio.',
      },
      {
        heading: 'Propiedad intelectual',
        body: 'Adkio y su software son propiedad de Adkio. El copy, audiencias y configuraciones que generes con el agente son tuyos. Nos das una licencia limitada para usar ese contenido solo para prestar y mejorar el servicio.',
      },
      {
        heading: 'Limitación de responsabilidad',
        body: 'El servicio se ofrece “tal como está”, en beta. No garantizamos resultados de campaña, aprobación de anuncios por Meta ni disponibilidad continua. En la medida que permita la ley, la responsabilidad de Adkio por el uso del servicio se limita a los daños directos demostrables y, si hubieras pagado a Adkio por el servicio, al monto efectivamente pagado en los últimos 12 meses.',
      },
    ],
  },
  seguridad: {
    title: 'Seguridad',
    subtitle: 'Cómo protegemos tu cuenta, tus datos y tus campañas.',
    updated: 'Última actualización: 2 de septiembre de 2026',
    sections: [
      {
        heading: 'Infraestructura',
        body: 'Adkio corre sobre proveedores de nube estándar del mercado (hosting de la API y frontend, y base de datos gestionada). Aplicamos actualizaciones y buenas prácticas de endurecimiento según evoluciona el producto. Esta página describe medidas reales del sistema; no afirma certificaciones que aún no tenemos.',
      },
      {
        heading: 'Cifrado y secretos',
        body: 'El tráfico entre tu navegador y nuestros servidores va por HTTPS/TLS. Los tokens de plataformas (por ejemplo Meta) se guardan cifrados en base de datos y no se exponen en logs ni en mensajes de error al usuario. Las contraseñas de cuenta se almacenan con hash (no en texto plano).',
      },
      {
        heading: 'Control de acceso',
        body: 'Las sesiones usan tokens con expiración. En modo multitenant, cada cuenta solo ve sus propias conexiones y campañas. El acceso del equipo de Adkio a producción se limita a lo necesario para operar el servicio.',
      },
      {
        heading: 'Incidentes',
        body: 'Si confirmamos un incidente que afecte tus datos personales, te avisaremos por los medios de contacto que tengamos y tomaremos medidas razonables de contención. Para reportar un problema de seguridad: seguridad@adkio.co.',
      },
      {
        heading: 'Reporte de vulnerabilidades',
        body: 'Si encuentras una vulnerabilidad, escríbenos a seguridad@adkio.co con detalle suficiente para reproducirla. Atenderemos reportes de buena fe y pedimos no divulgar en público hasta que coordinemos una ventana razonable de corrección.',
      },
    ],
  },
  cookies: {
    title: 'Cookies',
    subtitle: 'Qué cookies usamos y cómo puedes controlarlas.',
    updated: 'Última actualización: 2 de septiembre de 2026',
    sections: [
      {
        heading: '¿Qué son las cookies?',
        body: 'Las cookies (y almacenamiento similar del navegador) son datos que el sitio guarda en tu dispositivo para mantener la sesión y preferencias básicas.',
      },
      {
        heading: 'Qué usamos',
        body: 'Usamos almacenamiento necesario para autenticación y sesión (por ejemplo el token de acceso en el navegador). No usamos cookies de publicidad comportamental de terceros. Si agregamos analítica no esencial, lo declararemos aquí.',
      },
      {
        heading: 'Control',
        body: 'Puedes borrar datos del sitio desde tu navegador; eso puede cerrar tu sesión. No dependemos de un muro de cookies de marketing para usar el producto.',
      },
      {
        heading: 'Actualizaciones',
        body: 'Si cambia cómo usamos cookies o almacenamiento local, actualizamos esta página y la fecha al inicio del documento.',
      },
    ],
  },
};

type Slug = keyof typeof docs;

export default function LegalPage({ slug }: { slug: Slug }) {
  const doc = docs[slug];
  if (!doc) return null;

  return (
    <div className="relative min-h-screen bg-[#0c0c0c] text-white overflow-x-hidden">
      <div className="relative z-10">
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-20">
          {/* Back link */}
          <a
            href="/"
            className="inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors mb-12"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Volver al inicio
          </a>

          {/* Header */}
          <div className="border-b border-white/10 pb-10 mb-10">
            <h1 className="font-serif italic text-5xl md:text-7xl font-bold tracking-tight text-white leading-none">
              {doc.title}
            </h1>
            <p className="mt-5 text-white/55 text-base leading-[1.6] max-w-xl">{doc.subtitle}</p>
            <p className="mt-4 text-xs text-white/30">{doc.updated}</p>
          </div>

          {/* Sections */}
          <div className="flex flex-col gap-0">
            {doc.sections.map((s, i) => (
              <div
                key={i}
                className="grid md:grid-cols-[200px_1fr] gap-3 md:gap-8 py-10 border-b border-white/[0.06] last:border-0"
              >
                <h2 className="text-sm font-semibold text-white/45 tracking-tight leading-snug md:pt-0.5">
                  {s.heading}
                </h2>
                <p className="text-[0.95rem] text-white/75 leading-[1.8]">{s.body}</p>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-20 pt-8 border-t border-white/10 text-xs text-white/25">
            Adkio · Bogotá, Colombia · legal@adkio.co
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
