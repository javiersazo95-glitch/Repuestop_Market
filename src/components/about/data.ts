import type { LucideIcon } from 'lucide-react';
import {
  CalendarRange, CircleHelp, CreditCard, FileCheck, Layers, LockKeyhole, MapPin,
  MessageSquareQuote, PackageCheck, Receipt, Search, ShieldCheck, Store, Truck,
  Users, Wrench,
} from 'lucide-react';

/** Familias de color. Cada una agrupa ventajas afines, no se reparten al azar. */
export type Accent = 'blue' | 'violet' | 'emerald' | 'cyan' | 'amber' | 'indigo' | 'rose';

/* ============================================================================
   Ventajas
   ---------------------------------------------------------------------------
   Seis van a tarjeta con imagen (lo que vende o quita miedo) y seis a fila de
   una linea (lo que solo tranquiliza). La descripcion larga de la version
   anterior desaparece: cada una se resume en un titular y una frase.
   ========================================================================= */
export interface Advantage {
  id: number;
  Icon: LucideIcon;
  accent: Accent;
  tier: 'card' | 'row';
  title: string;
  line: string;
  /** Imagen referencial: ilustracion de marca o captura real. Solo en `card`. */
  art?: string;
  artAlt?: string;
  /** Las capturas van dentro de un marco de navegador; las ilustraciones no. */
  artFrame?: 'browser' | 'plain';
}

export const ADVANTAGES: Advantage[] = [
  {
    id: 1,
    Icon: Search,
    accent: 'blue',
    tier: 'card',
    title: 'Patente exacta',
    line: 'Marca, modelo, año, motor y versión desde los registros oficiales del SII.',
    art: '/about-assets/shot-catalogo.webp',
    artAlt: 'Catálogo de RepuesTop filtrado por el vehículo del comprador',
    artFrame: 'browser',
  },
  {
    id: 7,
    Icon: LockKeyhole,
    accent: 'emerald',
    tier: 'card',
    title: 'Tu plata, retenida 3 días',
    line: 'La tienda cobra recién cuando ya probaste la pieza en tu auto.',
    art: '/about-assets/help-center-hero.webp',
    artAlt: '',
    artFrame: 'plain',
  },
  {
    id: 8,
    Icon: Users,
    accent: 'indigo',
    tier: 'card',
    title: 'Personas, no formularios',
    line: 'Si algo falla, alguien de nuestro equipo revisa las fotos y resuelve.',
    art: '/about-assets/mecanico-taller.webp',
    artAlt: 'Mecánico revisando un vehículo en su taller',
    artFrame: 'plain',
  },
  {
    id: 4,
    Icon: MessageSquareQuote,
    accent: 'cyan',
    tier: 'card',
    title: 'Cotiza por chat',
    line: 'Precio, garantía y documento formal dentro de la misma conversación.',
    art: '/about-assets/ilus-cotizaciones.webp',
    artAlt: '',
    artFrame: 'plain',
  },
  {
    id: 2,
    Icon: Store,
    accent: 'violet',
    tier: 'card',
    title: 'Tiendas de todo Chile',
    line: 'Cientos de casas de repuestos en una sola vitrina, con stock real.',
    art: '/about-assets/shot-tiendas.webp',
    artAlt: 'Directorio de casas de repuestos verificadas de RepuesTop',
    artFrame: 'browser',
  },
  {
    id: 11,
    Icon: ShieldCheck,
    accent: 'rose',
    tier: 'card',
    title: 'Tiendas con papeles al día',
    line: 'Revisamos documentación comercial y tributaria antes de habilitar.',
    art: '/about-assets/ilus-verificadas.webp',
    artAlt: '',
    artFrame: 'plain',
  },

  { id: 3,  Icon: CreditCard, accent: 'emerald', tier: 'row', title: 'Cuotas sin interés',        line: 'Con Webpay y Flow, boleta o factura incluida.' },
  { id: 6,  Icon: Truck,      accent: 'amber',   tier: 'row', title: 'Retiro $0 o despacho',      line: 'Retira con PIN o recibe por courier en todo Chile.' },
  { id: 5,  Icon: CircleHelp, accent: 'cyan',    tier: 'row', title: 'Preguntas públicas',        line: 'Pregunta antes de pagar; la respuesta queda visible.' },
  { id: 9,  Icon: PackageCheck, accent: 'indigo', tier: 'row', title: 'Captadores de repuestos',  line: 'Rastreamos por ti la pieza difícil o descontinuada.' },
  { id: 10, Icon: Wrench,     accent: 'rose',    tier: 'row', title: 'Mural de talleres',         line: 'Mecánicos por comuna, con reseñas reales.' },
  { id: 12, Icon: Layers,     accent: 'blue',    tier: 'row', title: 'Ingeniería chilena',        line: 'Un equipo mejorando la plataforma cada día.' },
];

/* ============================================================================
   Metricas
   ========================================================================= */
export const METRICS: { Icon: LucideIcon; value: string; label: string; countTo?: number }[] = [
  { Icon: Store,        value: '+100',      label: 'Tiendas verificadas',  countTo: 100 },
  { Icon: CalendarRange, value: '2000–2026', label: 'Años de vehículos' },
  { Icon: ShieldCheck,  value: '3 días',    label: 'Fondos protegidos' },
  { Icon: Users,        value: '100%',      label: 'Mediación humana',     countTo: 100 },
];

/* ============================================================================
   Marcas referenciales del catalogo (SVG en public/brand-logos)
   ========================================================================= */
export const BRAND_LOGOS = [
  'toyota', 'chevrolet', 'hyundai', 'kia', 'nissan', 'suzuki', 'mazda',
  'mitsubishi', 'peugeot', 'mg', 'bosch', 'ngk', 'mann-filter', 'brembo',
];

/* ============================================================================
   Pilares de cumplimiento — solo el titulo, el detalle esta en el FAQ
   ========================================================================= */
export const TRUST_PILLARS: { Icon: LucideIcon; title: string }[] = [
  { Icon: Receipt,    title: 'Boleta y Factura' },
  { Icon: ShieldCheck, title: 'Garantía SERNAC 6 meses' },
  { Icon: LockKeyhole, title: 'Webpay y Flow' },
  { Icon: FileCheck,  title: 'Tiendas verificadas' },
];

/* ============================================================================
   Cobertura — solo cifras que la plataforma ya publica
   ========================================================================= */
export const COVERAGE_STATS: { Icon: LucideIcon; value: string; label: string }[] = [
  { Icon: Truck,         value: '16 regiones', label: 'Despacho con seguimiento' },
  { Icon: Store,         value: '+100 casas',  label: 'Locales verificados' },
  { Icon: CalendarRange, value: '2000–2026',   label: 'Vehículos cubiertos' },
  { Icon: PackageCheck,  value: 'Retiro $0',   label: 'Con PIN de 6 dígitos' },
];

export const COVERAGE_PILL = { Icon: MapPin, text: 'Diseñado y operado en Santiago, Chile' };

/* ============================================================================
   Preguntas frecuentes — seis, con respuesta de dos lineas
   ========================================================================= */
export const FAQS: { q: string; a: string }[] = [
  {
    q: '¿Qué tan precisa es la búsqueda por patente?',
    a: 'Consultamos la información oficial del SII para modelos del 2000 al 2026 y detectamos marca, modelo, año, versión y motor. El catálogo te muestra solo lo que le sirve a tu auto.',
  },
  {
    q: '¿Cómo funciona el pago protegido de 3 días?',
    a: 'La casa de repuestos no recibe el dinero al instante: queda retenido en la plataforma hasta 3 días después de que recibes la pieza, para que alcances a probarla.',
  },
  {
    q: '¿Qué pasa si el repuesto llega dañado o no calza?',
    a: 'Abres un caso desde el Centro de Ayuda y un mediador real revisa las fotos y los mensajes. Mientras tanto tu dinero sigue protegido, y si corresponde te lo devolvemos.',
  },
  {
    q: '¿Puedo pagar en cuotas y pedir factura?',
    a: 'Sí. Con Webpay Plus y Flow pagas en cuotas sin interés según tu banco, y al momento de pagar eliges boleta o factura con el RUT de tu empresa.',
  },
  {
    q: '¿Cómo es el retiro en tienda con PIN?',
    a: 'Al elegir retiro sin costo, tu cuenta genera un PIN de 6 dígitos. Se lo muestras al vendedor en el local y él lo ingresa para confirmar la entrega.',
  },
  {
    q: '¿Cómo sumo mi casa de repuestos?',
    a: 'Postulas como Tienda Fundadora y accedes a comisión fija del 5% durante todo el primer año, carga de catálogo desde Excel y el distintivo de tienda verificada.',
  },
];

/* ============================================================================
   Ticker del hero
   ========================================================================= */
export const TICKER_ITEMS: { Icon: LucideIcon; text: string }[] = [
  { Icon: Search,             text: 'Búsqueda exacta por patente chilena (2000 a 2026)' },
  { Icon: Store,              text: 'Cientos de casas de repuestos verificadas' },
  { Icon: CreditCard,         text: 'Cuotas sin interés con Webpay y Flow' },
  { Icon: ShieldCheck,        text: '3 días de fondos protegidos tras la entrega' },
  { Icon: MessageSquareQuote, text: 'Cotizaciones formales por chat en vivo' },
  { Icon: Truck,              text: 'Retiro con PIN $0 o despacho a todo Chile' },
  { Icon: Users,              text: 'Equipo de mediación si una pieza no calza' },
  { Icon: Wrench,             text: 'Mural de talleres mecánicos por comuna' },
];
