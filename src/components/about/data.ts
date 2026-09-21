import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle, CalendarRange, CircleHelp, CreditCard, FileCheck, Layers, LockKeyhole,
  MapPin, MessageSquareQuote, PackageCheck, Receipt, Search, ShieldCheck, Store,
  Truck, Users, Wrench,
} from 'lucide-react';

/** Familias de color de los iconos. Cada una tiene un significado y agrupa
 *  ventajas afines, en vez de repartir colores al azar. */
export type Accent = 'blue' | 'violet' | 'emerald' | 'cyan' | 'amber' | 'indigo' | 'rose';

/* ============================================================================
   Las 12 ventajas comerciales
   ---------------------------------------------------------------------------
   `tier` reparte el peso visual segun la importancia comercial, para que la
   seccion deje de ser un muro de 12 tarjetas identicas:
     a = 3 tarjetas grandes con la descripcion completa
     b = 4 tarjetas medianas
     c = 5 filas compactas de una linea
   ========================================================================= */
export interface Advantage {
  id: number;
  Icon: LucideIcon;
  accent: Accent;
  tier: 'a' | 'b' | 'c';
  title: string;
  badge: string;
  desc: string;
  benefit: string;
}

export const ADVANTAGES: Advantage[] = [
  {
    id: 1,
    Icon: Search,
    accent: 'blue',
    tier: 'a',
    title: 'Búsqueda por Patente de Alta Precisión',
    badge: 'Cero errores',
    desc: 'Ingresas la patente de tu auto y el sistema identifica de inmediato marca, modelo, año, motor y versión según los registros oficiales del SII (desde el 2000 al 2026), para que solo veas repuestos que realmente le sirven a tu vehículo.',
    benefit: 'Ahorras tiempo y compras con la seguridad de que el repuesto va a calzar.',
  },
  {
    id: 7,
    Icon: LockKeyhole,
    accent: 'emerald',
    tier: 'a',
    title: 'Pago Protegido (3 Días de Resguardo)',
    badge: 'Garantía total',
    desc: 'Tu dinero no se entrega a la tienda hasta 3 días después de que recibes el repuesto. Así tienes tiempo suficiente para probarlo en tu auto o en el taller mecánico.',
    benefit: 'Tu compra está 100% protegida; si no es lo que pediste, tu dinero está a salvo.',
  },
  {
    id: 8,
    Icon: ShieldCheck,
    accent: 'indigo',
    tier: 'a',
    title: 'Equipo de Mediación en Caso de Problemas',
    badge: 'Personas reales',
    desc: 'Si una pieza viene con fallas o no calza y no llegas a acuerdo con la tienda, una persona de nuestro equipo interviene, revisa las fotos y gestiona la solución o la devolución de tu dinero.',
    benefit: 'Nunca quedas solo: resolvemos cualquier problema de forma justa y rápida.',
  },
  {
    id: 2,
    Icon: Store,
    accent: 'violet',
    tier: 'b',
    title: 'Cientos de Casas de Repuestos en un Solo Lugar',
    badge: 'Todo Chile',
    desc: 'Reunimos a las mejores casas de repuestos del país en una sola vitrina: piezas originales de fábrica y alternativas de primera calidad con stock real y garantía.',
    benefit: 'Cotiza y compara precios al instante sin tener que recorrer tienda por tienda.',
  },
  {
    id: 3,
    Icon: CreditCard,
    accent: 'emerald',
    tier: 'b',
    title: 'Paga en Cuotas Sin Interés y Medios Seguros',
    badge: 'Webpay y Flow',
    desc: 'Aceptamos tarjetas de crédito en cuotas sin interés, tarjetas de débito, Mach, Tenpo y transferencias seguras, con boleta o factura oficial para tu compra.',
    benefit: 'Paga de forma cómoda y protegida por la principal pasarela de pagos de Chile.',
  },
  {
    id: 4,
    Icon: MessageSquareQuote,
    accent: 'cyan',
    tier: 'b',
    title: 'Cotizaciones Formales por Chat en Vivo',
    badge: 'Trato directo',
    desc: 'Conversa directamente con la casa de repuestos, pide fotos de la pieza y recibe una cotización clara con precio final, garantía y botón para pagar directamente.',
    benefit: 'Atención personalizada y respaldo por escrito de cada precio y condición.',
  },
  {
    id: 6,
    Icon: Truck,
    accent: 'amber',
    tier: 'b',
    title: 'Diferentes Opciones de Envío y Entrega',
    badge: 'Retiro $0 o despacho',
    desc: 'Elige retirar en el local de la casa de repuestos sin costo con tu código de seguridad, pedir despacho local rápido si estás en la misma comuna o envío a todo Chile por courier con seguimiento.',
    benefit: 'Tú eliges cómo y cuándo recibir tus piezas de la forma más conveniente.',
  },
  {
    id: 5,
    Icon: CircleHelp,
    accent: 'cyan',
    tier: 'c',
    title: 'Preguntas y Respuestas sobre el Repuesto',
    badge: 'Comunidad',
    desc: '¿Tienes dudas sobre el lado, conector o modelo? Pregunta en la publicación del repuesto; la tienda te responde y la respuesta queda visible para todos los conductores.',
    benefit: 'Compras con total claridad y resuelves cualquier duda antes de pagar.',
  },
  {
    id: 9,
    Icon: Users,
    accent: 'amber',
    tier: 'c',
    title: 'Apoyo de Captadores de Repuestos',
    badge: 'Búsqueda asistida',
    desc: '¿Buscas una pieza difícil de encontrar o descontinuada? Nuestro equipo de captadores te ayuda a rastrearla directamente consultando con casas de repuestos de todo el país.',
    benefit: 'Encontramos ese repuesto que te ha costado conseguir en el mercado.',
  },
  {
    id: 10,
    Icon: Wrench,
    accent: 'rose',
    tier: 'c',
    title: 'Mural Público de Servicios Mecánicos',
    badge: 'Talleres y mecánicos',
    desc: 'Encuentra talleres mecánicos, especialistas en scanner, frenos, desabolladura y mantenciones por comuna, con reseñas reales de clientes y opción de agendar tu hora.',
    benefit: 'El mecánico o taller ideal para instalar los repuestos que compraste.',
  },
  {
    id: 11,
    Icon: AlertCircle,
    accent: 'indigo',
    tier: 'c',
    title: 'Sistema de Reportes y Tiendas Verificadas',
    badge: 'Comunidad segura',
    desc: 'Todas las casas de repuestos pasan por revisión de documentos comerciales. Además, los usuarios pueden reportar cualquier publicación irregular para mantener un mercado confiable.',
    benefit: 'Compras con total tranquilidad en tiendas reales y establecidas.',
  },
  {
    id: 12,
    Icon: Layers,
    accent: 'rose',
    tier: 'c',
    title: 'Equipo de Ingenieros Trabajando para Ti',
    badge: 'Mejora continua',
    desc: 'Un equipo de ingenieros chilenos trabaja todos los días en la plataforma para que funcione de forma rápida, segura y sin interrupciones, pensando siempre en tu satisfacción.',
    benefit: 'Una plataforma moderna, estable y en constante evolución.',
  },
];

/* ============================================================================
   Franja de metricas
   ========================================================================= */
export const METRICS: { Icon: LucideIcon; value: string; label: string; note: string }[] = [
  {
    Icon: Store,
    value: '+100',
    label: 'Casas de Repuestos Verificadas',
    note: 'Locales comerciales con RUT, patente e historial comercial al día.',
  },
  {
    Icon: CalendarRange,
    value: '2000–2026',
    label: 'Años de Vehículos en Chile',
    note: 'Información oficial del SII para autos de marcas tradicionales y marcas chinas.',
  },
  {
    Icon: ShieldCheck,
    value: '3 Días',
    label: 'De Fondos Protegidos',
    note: 'Tu dinero se libera a la tienda solo después de que recibes y pruebas el repuesto.',
  },
  {
    Icon: Users,
    value: '100%',
    label: 'Mediación Humana Imparcial',
    note: 'Nuestro equipo revisa cada caso con fotos si el repuesto llega con fallas.',
  },
];

/* ============================================================================
   Franja de marcas
   ---------------------------------------------------------------------------
   Marcas referenciales: las mas vendidas en Chile mas los fabricantes de
   repuesto que aparecen en el catalogo. Los SVG viven en public/brand-logos/.
   ========================================================================= */
export const BRAND_LOGOS = [
  'toyota', 'chevrolet', 'hyundai', 'kia', 'nissan', 'suzuki', 'mazda',
  'mitsubishi', 'peugeot', 'mg', 'bosch', 'ngk', 'mann-filter', 'brembo',
];

/* ============================================================================
   Pilares de cumplimiento legal
   ========================================================================= */
export const TRUST_PILLARS: { Icon: LucideIcon; title: string; desc: string }[] = [
  {
    Icon: Receipt,
    title: 'Boleta y Factura Oficial',
    desc: 'Emisión autorizada por el SII con respaldo contable para personas y talleres.',
  },
  {
    Icon: ShieldCheck,
    title: 'Garantía SERNAC (6 Meses)',
    desc: 'Respaldo legal según la Ley del Consumidor en repuestos nuevos ante cualquier falla de fábrica.',
  },
  {
    Icon: LockKeyhole,
    title: 'Pagos 100% Seguros',
    desc: 'Pagas directamente con Webpay y Flow con respaldo bancario oficial; nadie accede a los datos de tu tarjeta.',
  },
  {
    Icon: FileCheck,
    title: 'Tiendas Verificadas',
    desc: 'Revisamos la documentación comercial y tributaria de cada casa de repuestos antes de habilitarla.',
  },
];

/* ============================================================================
   Cobertura (banda oscura)
   ---------------------------------------------------------------------------
   Solo cifras que la plataforma ya publica. Nada de metricas de usuarios que
   no podamos respaldar.
   ========================================================================= */
export const COVERAGE_STATS: { Icon: LucideIcon; value: string; label: string }[] = [
  { Icon: Truck, value: '16 regiones', label: 'Despachos por courier con seguimiento a todo el país' },
  { Icon: Store, value: '+100 casas', label: 'Locales de repuestos verificados y con documentación al día' },
  { Icon: CalendarRange, value: '2000–2026', label: 'Años de vehículos cubiertos con datos oficiales del SII' },
  { Icon: PackageCheck, value: 'Retiro $0', label: 'Retiro en tienda con PIN de 6 dígitos, sin costo de envío' },
];

export const COVERAGE_PILL = { Icon: MapPin, text: 'Diseñado y operado en Santiago, Chile' };

/* ============================================================================
   Preguntas frecuentes
   ========================================================================= */
export const FAQS: { q: string; a: string }[] = [
  {
    q: '¿Cómo funciona la búsqueda por patente y qué tan precisa es?',
    a: 'Al ingresar la patente de tu vehículo, nuestro sistema consulta la información oficial del SII (modelos desde el año 2000 al 2026). Detectamos marca, modelo, año exacto, versión y motor. Así, el catálogo te muestra únicamente los repuestos que le sirven a tu auto, evitando errores de compra.',
  },
  {
    q: '¿Existe una app móvil o solo puedo comprar desde la web?',
    a: 'Hoy RepuesTop funciona 100% desde la plataforma web, optimizada para computador y celular: puedes buscar por patente, cotizar por chat, pagar y mostrar tu PIN de retiro sin instalar nada. La app para Android está en desarrollo; cuando esté lista, podrás ingresar con tu misma cuenta y tener todo sincronizado.',
  },
  {
    q: '¿Cómo funciona el resguardo de fondos de 3 días (Pago Protegido)?',
    a: 'Cuando compras en RepuesTop a través de Webpay o Flow, la casa de repuestos no recibe el dinero de inmediato. Los fondos quedan retenidos de manera segura en la plataforma durante 3 días después de que recibes el repuesto. Así tienes tiempo para probar que calce e instalarlo con tranquilidad.',
  },
  {
    q: '¿Qué ocurre si el repuesto llega dañado, con fallas o no calza?',
    a: 'En RepuesTop cuentas con un equipo de mediación con personas reales. Puedes abrir un caso desde el Centro de Ayuda; un mediador revisará las fotos y los mensajes con la tienda. Mientras se revisa, tu dinero sigue protegido y, si el repuesto no correspondía o tiene fallas, gestionamos la devolución de tu dinero.',
  },
  {
    q: '¿Puedo pagar en cuotas sin interés y solicitar Factura para mi taller o empresa?',
    a: 'Sí. A través de Webpay Plus y Flow, puedes pagar con tarjetas de crédito en cuotas sin interés según las condiciones de tu banco. Además, al momento de pagar puedes elegir Boleta o Factura con RUT de empresa para tu taller o negocio.',
  },
  {
    q: '¿Cómo funciona el retiro en tienda con PIN de 6 dígitos?',
    a: 'Si eliges "Retiro en tienda ($0 costo)", el sistema genera un PIN de 6 dígitos en tu cuenta. Al ir al local de la casa de repuestos, le das ese código al vendedor; él lo ingresa en su pantalla para confirmar la entrega. Así nadie más puede retirar tu compra.',
  },
  {
    q: '¿Qué es el Mural Público de Servicios Automotrices y qué ofrece?',
    a: 'El Mural de Servicios es una vitrina para conectar a conductores con mecánicos y talleres profesionales en Chile. Puedes buscar por comuna especialistas en scanner, frenos, desabolladura y pintura o mantenciones, revisar opiniones de otros clientes y solicitar una hora.',
  },
  {
    q: '¿Cómo puedo incorporar mi casa de repuestos como Tienda Fundadora?',
    a: 'Puedes postular directamente haciendo clic en "Quiero ser tienda fundadora". Las primeras casas de repuestos asociadas disfrutan de una comisión preferencial y fija del 5% durante todo su primer año, apoyo para subir sus repuestos desde Excel, panel de control de ventas y el distintivo oficial de tienda verificada.',
  },
];

/* ============================================================================
   Ticker del hero
   ========================================================================= */
export const TICKER_ITEMS: { Icon: LucideIcon; text: string }[] = [
  { Icon: Search, text: 'Búsqueda exacta por Patente chilena (modelos 2000 a 2026)' },
  { Icon: Store, text: 'Conecta con cientos de casas de repuestos verificadas' },
  { Icon: CreditCard, text: 'Paga en cuotas sin interés con Webpay y Flow' },
  { Icon: ShieldCheck, text: '3 días de fondos protegidos tras la entrega para probar tu repuesto' },
  { Icon: MessageSquareQuote, text: 'Cotizaciones formales y chat en vivo con los vendedores' },
  { Icon: Truck, text: 'Retiro en tienda con PIN $0 o despacho con seguimiento a todo Chile' },
  { Icon: Users, text: 'Equipo de mediación que te apoya si una pieza no calza o falla' },
  { Icon: Wrench, text: 'Mural público de talleres mecánicos, scanner y mantenciones' },
];
