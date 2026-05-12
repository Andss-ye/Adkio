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
    updated: 'Última actualización: 10 de mayo de 2026',
    sections: [
      {
        heading: 'Datos que recopilamos',
        body: 'Recopilamos la información que nos proporcionás al crear tu cuenta (nombre, email, datos de pago) y la información generada al usar el servicio (campañas creadas, prompts ingresados, configuración de tu marca). También recopilamos datos técnicos básicos como dirección IP, tipo de navegador y páginas visitadas para garantizar el funcionamiento del servicio.',
      },
      {
        heading: 'Cómo los usamos',
        body: 'Usamos tus datos exclusivamente para proveer, mejorar y personalizar el servicio de Adkio. Nunca vendemos tu información a terceros. Los prompts e historial de campañas pueden usarse de forma anonimizada y agregada para mejorar los modelos de generación de audiencias y copy.',
      },
      {
        heading: 'Compartición de datos',
        body: 'Compartimos datos únicamente con proveedores de infraestructura necesarios para operar el servicio (Supabase para la base de datos, proveedores de cómputo). Todos están sujetos a acuerdos de procesamiento de datos y estándares de seguridad equivalentes a los nuestros. No compartimos información con plataformas de publicidad de terceros.',
      },
      {
        heading: 'Retención',
        body: 'Conservamos tu información mientras tu cuenta esté activa. Al cancelar, eliminamos tus datos personales dentro de los 30 días hábiles siguientes. Algunos datos pueden conservarse por más tiempo cuando lo exija la legislación aplicable (por ejemplo, registros de facturación).',
      },
      {
        heading: 'Tus derechos',
        body: 'Tenés derecho a acceder, rectificar, portar y eliminar tus datos personales en cualquier momento. Para ejercer estos derechos, escribinos a privacidad@adkio.co. Respondemos todas las solicitudes dentro de los 30 días corridos.',
      },
      {
        heading: 'Contacto',
        body: 'Para consultas sobre privacidad, escribinos a privacidad@adkio.co. Operamos bajo la legislación colombiana de protección de datos personales (Ley 1581 de 2012).',
      },
    ],
  },
  terminos: {
    title: 'Términos de servicio',
    subtitle: 'Las condiciones bajo las cuales podés usar Adkio.',
    updated: 'Última actualización: 10 de mayo de 2026',
    sections: [
      {
        heading: 'Aceptación',
        body: 'Al crear una cuenta o usar el servicio de Adkio, aceptás estos Términos de Servicio. Si usás Adkio en nombre de una empresa, representás que tenés autoridad para vincular a dicha empresa con estos términos.',
      },
      {
        heading: 'Uso del servicio',
        body: 'Podés usar Adkio exclusivamente para crear y gestionar campañas de publicidad paga en las plataformas soportadas. No está permitido generar contenido ilegal, engañoso o que infrinja los términos de Meta o cualquier otra plataforma integrada. Nos reservamos el derecho de suspender cuentas que violen estos términos.',
      },
      {
        heading: 'Cuentas y acceso',
        body: 'Sos responsable de mantener la confidencialidad de tus credenciales. Si detectás acceso no autorizado, notificanos de inmediato a seguridad@adkio.co. Una cuenta no puede compartirse entre personas sin un plan multi-usuario activo.',
      },
      {
        heading: 'Pagos y suscripción',
        body: 'Las suscripciones se cobran mensual o anualmente según el plan elegido. Los precios pueden cambiar con un aviso previo de 30 días. No realizamos reembolsos parciales por períodos no utilizados, salvo cuando la ley aplicable lo exija.',
      },
      {
        heading: 'Propiedad intelectual',
        body: 'Adkio y su tecnología son propiedad de Adkio, Inc. El contenido generado por el agente (copy, audiencias, configuraciones de campaña) es de tu propiedad. Nos otorgás una licencia limitada para usar dicho contenido con el único fin de prestar el servicio.',
      },
      {
        heading: 'Limitación de responsabilidad',
        body: 'El servicio se provee "tal como está". No garantizamos resultados específicos en campañas de publicidad. En ningún caso nuestra responsabilidad superará el monto pagado en los últimos 12 meses por el servicio.',
      },
    ],
  },
  seguridad: {
    title: 'Seguridad',
    subtitle: 'Cómo protegemos tu cuenta, tus datos y tus campañas.',
    updated: 'Última actualización: 10 de mayo de 2026',
    sections: [
      {
        heading: 'Infraestructura',
        body: 'Adkio opera sobre infraestructura en la nube con certificación SOC 2. Los datos se almacenan en regiones de Norteamérica y Europa, con replicación automática y backups diarios. Toda la infraestructura se revisa y actualiza de forma continua.',
      },
      {
        heading: 'Cifrado de datos',
        body: 'Toda la comunicación entre tu navegador y nuestros servidores está cifrada con TLS 1.3. Los datos en reposo se cifran con AES-256. Las credenciales de terceros (tokens de Meta, claves de API) se almacenan usando cifrado de sobre con rotación periódica de claves.',
      },
      {
        heading: 'Control de acceso',
        body: 'Implementamos sesiones con tiempo de expiración y acceso con mínimo privilegio. El acceso interno a datos de producción está restringido por roles y requiere aprobación de dos personas. Todos los accesos a producción quedan auditados.',
      },
      {
        heading: 'Respuesta a incidentes',
        body: 'Contamos con un plan de respuesta a incidentes que incluye clasificación, contención, erradicación y comunicación. En caso de una brecha que afecte tus datos, te notificamos dentro de las 72 horas de haberla confirmado, en cumplimiento con la legislación aplicable.',
      },
      {
        heading: 'Reporte de vulnerabilidades',
        body: 'Si descubrís una vulnerabilidad en Adkio, escribinos de inmediato a seguridad@adkio.co. Respondemos todos los reportes de buena fe dentro de las 48 horas hábiles y trabajamos con vos para resolver el problema de forma responsable antes de cualquier divulgación pública.',
      },
    ],
  },
  cookies: {
    title: 'Cookies',
    subtitle: 'Qué cookies usamos y cómo podés controlarlas.',
    updated: 'Última actualización: 10 de mayo de 2026',
    sections: [
      {
        heading: '¿Qué son las cookies?',
        body: 'Las cookies son pequeños archivos de texto que los sitios web almacenan en tu navegador. Permiten recordar preferencias, mantener sesiones activas y entender cómo se usa el servicio.',
      },
      {
        heading: 'Cookies que usamos',
        body: 'Usamos cookies estrictamente necesarias para el funcionamiento de la sesión y la autenticación. También usamos cookies de análisis propias (sin terceros publicitarios) para medir qué funcionalidades se usan más. No usamos cookies de publicidad comportamental.',
      },
      {
        heading: 'Control de cookies',
        body: 'Podés configurar tu navegador para rechazar cookies, aunque esto puede afectar el inicio de sesión. En la Unión Europea y países con leyes equivalentes, te pedimos consentimiento explícito antes de instalar cualquier cookie no esencial.',
      },
      {
        heading: 'Actualizaciones',
        body: 'Esta política puede actualizarse cuando cambie nuestra forma de usar cookies. Publicamos los cambios en esta página y, si son significativos, te notificamos por email. La fecha de última actualización aparece siempre al inicio del documento.',
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
            Adkio, Inc. · Bogotá, Colombia · legal@adkio.co
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
