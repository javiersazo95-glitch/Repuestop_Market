import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight, BadgeCheck, BarChart3, BellRing, Box, Boxes, Building2, CalendarCheck, CarFront,
  CheckCircle2, ChevronDown, Clock3, Coins, Gift, Headphones, HeartHandshake, Info, LocateFixed,
  LockKeyhole, MapPin, Megaphone, MonitorSmartphone, MousePointerClick, Percent, RefreshCw,
  ScanLine, Search, ShieldCheck, ShoppingCart, Sparkles, Store, Truck, Users, Wallet, Wrench,
} from 'lucide-react';
import Reveal from './about/Reveal';
import './about/about.css';

interface AboutRepuesTopPageProps {
  onBack: () => void;
  onContact: () => void;
  onOpenSeller: () => void;
  onOpenCatalog?: () => void;
  onOpenStores?: () => void;
  onOpenAdsWall?: () => void;
}

const BENEFITS: { Icon: LucideIcon; title: string; text: string }[] = [
  { Icon: Gift, title: 'Amplio catálogo', text: 'Miles de repuestos para todas las marcas y modelos.' },
  { Icon: ShieldCheck, title: 'Proveedores verificados', text: 'Casas de repuestos reales y confiables.' },
  { Icon: Search, title: 'Cotiza y compara', text: 'Recibe múltiples cotizaciones en minutos.' },
  { Icon: LockKeyhole, title: 'Compra segura', text: 'Transacciones protegidas y soporte en todo momento.' },
  { Icon: Truck, title: 'Envíos a todo Chile', text: 'Recibe tus repuestos donde estés.' },
  { Icon: Headphones, title: 'Soporte experto', text: 'Te ayudamos a encontrar el repuesto correcto.' },
  { Icon: Clock3, title: 'Ahorra tiempo y dinero', text: 'Mejores precios, sin llamadas ni visitas innecesarias.' },
  { Icon: BarChart3, title: 'Haz crecer tu negocio', text: 'Más visibilidad y ventas para tu casa de repuestos.' },
];

/**
 * Preguntas frecuentes, en cuatro grupos.
 *
 * Antes eran una lista sola de nueve preguntas: el acordeon medía 815px mientras la columna
 * de al lado medía 425, y esos 390px de aire eran lo unico que se veia a la derecha del
 * bloque. Repartidas, ningun grupo pasa de cinco preguntas y la columna de apoyo deja de
 * quedar corta. Cada grupo lleva ademas SU captura: la pantalla que responde ese tipo de
 * duda, no una ilustracion decorativa repetida en las cuatro pestañas.
 */
interface FaqGroup {
  id: string;
  label: string;
  Icon: LucideIcon;
  image: string;
  alt: string;
  /** Tamaño real del archivo: no todas las capturas tienen la misma proporcion. */
  width: number;
  height: number;
  caption: string;
  items: [string, string][];
}

const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'generales',
    label: 'Generales',
    Icon: Info,
    image: '/about-assets/home-real.webp',
    alt: 'Portada de RepuesTop, con el buscador por patente y el carrusel de categorías de repuestos',
    width: 1096,
    height: 822,
    caption: 'Portada de RepuesTop',
    items: [
      ['¿Qué es RepuesTop?', 'Un marketplace chileno de repuestos automotrices. Escribes la patente de tu vehículo y RepuesTop cruza tu auto con el inventario de cientos de casas de repuestos para mostrarte solo las piezas que le calzan, con precio, stock y tienda a la vista.'],
      ['¿En qué regiones funciona RepuesTop?', 'RepuesTop conecta compradores y casas de repuestos en las 16 regiones de Chile. Puedes filtrar por comuna y elegir retiro en tienda o despacho a todo el país.'],
      ['¿RepuesTop tiene aplicación móvil?', 'La app Android está en camino a Google Play. Es la misma cuenta y los mismos datos que la web: buscas en el computador y sigues la cotización desde el celular. Mientras tanto, la versión web funciona completa desde el navegador del teléfono.'],
      ['¿Cómo puedo contactar al soporte?', 'Desde el Centro de Ayuda, donde están las respuestas por tema y el formulario para escribirnos. Si tienes cuenta, además puedes seguir el estado de tu caso.'],
    ],
  },
  {
    id: 'uso',
    label: 'Uso del sistema',
    Icon: MousePointerClick,
    image: '/about-assets/repuesto-real.webp',
    alt: 'Ficha de un repuesto en RepuesTop, con precio, compatibilidad, tienda vendedora y formas de pago',
    width: 1096,
    height: 782,
    caption: 'Ficha de un repuesto',
    items: [
      ['¿Cómo compro un repuesto?', 'Buscas por patente o por nombre, comparas las ofertas de las tiendas verificadas y eliges. Si el repuesto tiene precio publicado puedes comprarlo al instante; si no, pides una cotización y la tienda te responde por chat.'],
      ['¿Para qué sirve buscar por patente?', 'Para no equivocarte de pieza. Con la patente identificamos marca, modelo, año y versión de tu vehículo, y filtramos el catálogo: ves solo lo compatible, incluidos los repuestos universales, y no una lista genérica que tendrías que revisar a mano.'],
      ['¿Qué pasa si un repuesto no muestra precio?', 'Significa que la tienda lo vende solo a cotización. Pides el precio desde la misma ficha y queda una conversación con el vendedor donde puedes acordar condiciones, plazos y despacho antes de pagar.'],
      ['¿Cómo publico mi catálogo como casa de repuestos?', 'Creas tu cuenta de tienda, subes los documentos que acreditan tu negocio y, una vez aprobada, publicas tu inventario desde el panel de vendedor. Publicar no tiene costo ni límite de productos.'],
      ['¿Cómo encuentro un taller cerca de mí?', 'En el Mural de Anuncios. Desde la app puedes filtrar los talleres especialistas en la marca de tu vehículo y ver a cuántos kilómetros está cada uno de tu ubicación, además de escribir por WhatsApp o reservar hora.'],
    ],
  },
  {
    id: 'cobros',
    label: 'Cobros',
    Icon: Wallet,
    image: '/about-assets/monedas-real.webp',
    alt: 'Monedero de Monedas RepuesTop, con el saldo disponible y el costo en Monedas de cada tipo de anuncio',
    width: 1096,
    height: 782,
    caption: 'Monedero de Monedas RepuesTop',
    items: [
      ['¿Cuánto cuesta usar RepuesTop?', 'Nada. Buscar por patente, comparar, pedir cotizaciones y comprar es gratis para cualquier persona, y publicar tu catálogo como casa de repuestos tampoco tiene costo. La plataforma cobra una tarifa de servicio solo sobre las ventas concretadas: 5% durante los primeros 3 meses desde el lanzamiento y 8% después.'],
      ['¿Cuándo se cobra la tarifa de servicio?', 'Solo cuando una venta se concreta, y se descuenta de esa misma venta. No hay suscripción, ni cobro por publicar, ni costo por recibir cotizaciones: si no vendes, no pagas nada.'],
      ['¿Qué son las Monedas RepuesTop?', 'Son el saldo interno de la plataforma y son totalmente opcionales. Cada Moneda equivale a $50 CLP y sirven para dos cosas: impulsar un repuesto al posicionamiento Top Ventas y publicar o subir de plan un anuncio en el Mural. Tus 2 primeros repuestos Top y tu primer anuncio Básico no cuestan Monedas.'],
      ['¿Qué formas de pago están disponibles?', 'Pagas con tarjeta de crédito, débito o Redcompra a través de Flow, con la opción de simular cuotas antes de confirmar, o por transferencia vía Khipu según la alternativa que habilite la tienda. Los datos de tu tarjeta se ingresan solo en la pasarela, nunca en RepuesTop.'],
    ],
  },
  {
    id: 'seguridad',
    label: 'Seguridad',
    Icon: ShieldCheck,
    image: '/about-assets/seguridad-real.webp',
    alt: 'Centro de seguridad de RepuesTop, con las respuestas sobre compra protegida, mediación y cuidado de la cuenta',
    width: 1096,
    height: 782,
    caption: 'Centro de seguridad',
    items: [
      ['¿Cómo sé que una casa de repuestos es confiable?', 'Por el sello de Tienda Verificada: validamos su identidad y sus datos tributarios al registrarse, antes de dejarla publicar. En su perfil público ves además su catálogo, sus métodos de envío, su comuna y las evaluaciones de otros compradores.'],
      ['¿Cómo protege RepuesTop mi compra?', 'El pago se procesa por la pasarela dentro de la plataforma y queda asociado a tu pedido, con su estado y su historial. Si algo sale mal puedes abrir un reclamo desde el detalle del pedido y el caso pasa a nuestro equipo de mediación.'],
      ['¿Qué pasa si el repuesto no llega o no corresponde?', 'Abres un reclamo desde el pedido. Ambas partes pueden exponer su versión y adjuntar fotos en el chat del caso, y si no hay acuerdo lo resuelve un mediador de RepuesTop revisando la evidencia. Puedes seguir el estado desde tu perfil.'],
      ['¿Por qué no debo pagar ni coordinar fuera de la plataforma?', 'Un pago hecho por transferencia directa, fuera del flujo de compra, no queda registrado en RepuesTop: no genera pedido, no tiene seguimiento y no podemos mediar si el repuesto no llega o no es el correcto. Si un vendedor te insiste en pagar por fuera, repórtalo.'],
      ['¿RepuesTop me va a pedir mi contraseña o los datos de mi tarjeta?', 'Nunca. No pedimos tu contraseña por correo, chat ni teléfono, y los datos de tu tarjeta se ingresan únicamente en la pasarela de pago. Cualquier mensaje que te los pida, aunque parezca de RepuesTop, es un intento de fraude.'],
    ],
  },
];

const BUYER_POINTS = [
  'Compara precios y disponibilidad',
  'Encuentra repuestos originales y alternativos',
  'Compra de forma segura',
  'Recibe en tu casa o taller',
];

const SELLER_POINTS = [
  'Publica tu catálogo fácilmente',
  'Recibe cotizaciones de clientes reales',
  'Gestiona tus ventas en un solo lugar',
  'Haz crecer tu negocio',
];

/**
 * Los cuatro modulos de "Pantallas reales, resultados reales".
 *
 * Las cuatro imagenes son capturas de la plataforma con datos de prueba, no maquetas: la
 * seccion promete pantallas reales y antes mostraba un mockup ilustrado con la marca escrita
 * mal ("RepuestoTop") y tiendas inventadas. `action` dispara la navegacion del boton; el
 * `nav` solo cambia de panel.
 */
interface PlatformModule {
  id: string;
  Icon: LucideIcon;
  nav: string;
  title: string;
  desc: string;
  points: string[];
  cta: string;
  action: 'stores' | 'catalog' | 'seller';
  image: string;
  width: number;
  height: number;
  alt: string;
  badge: [string, string];
  /** Pieza secundaria que se superpone a la captura. Hoy solo la usa cotizaciones, para
   *  mostrar ademas el PDF que genera la plataforma. */
  extra?: { image: string; width: number; height: number; alt: string };
}

const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: 'directorio',
    Icon: Building2,
    nav: 'Directorio de casas de repuestos',
    title: 'Directorio de Casas de Repuestos',
    desc: 'Encuentra casas de repuestos verificadas en todo Chile, con su información, especialidades y valoraciones de otros clientes.',
    points: [
      'Filtros por región y especialidad',
      'Información de contacto',
      'Opiniones y valoraciones',
      'Horarios y ubicación',
    ],
    cta: 'Ver directorio',
    action: 'stores',
    image: '/about-assets/directorio-real.webp',
    width: 1096,
    height: 782,
    alt: 'Directorio de casas de repuestos de RepuesTop, con filtros por giro, comuna y método de envío',
    badge: ['Casas de repuestos', 'reales y verificadas'],
  },
  {
    id: 'busqueda',
    Icon: Search,
    nav: 'Búsqueda de productos',
    title: 'Búsqueda de Productos por Patente',
    desc: 'Ingresas la patente y el catálogo queda filtrado a los repuestos que le sirven a tu auto, con precio, stock y tienda a la vista.',
    points: [
      'Compatibilidad resuelta por patente',
      'Precio y stock reales de cada tienda',
      'Filtros por categoría, condición y comuna',
      'Repuestos universales incluidos',
    ],
    cta: 'Buscar repuestos',
    action: 'catalog',
    image: '/about-assets/busqueda-real.webp',
    width: 1096,
    height: 782,
    alt: 'Catálogo de RepuesTop filtrado por la patente de un Toyota Yaris, mostrando los repuestos compatibles',
    badge: ['Solo repuestos', 'compatibles con tu auto'],
  },
  {
    id: 'cotizaciones',
    Icon: ShoppingCart,
    nav: 'Comparación de cotizaciones',
    title: 'Comparación de Cotizaciones',
    desc: 'Cada tienda responde con una oferta formal: precio, método de envío y PDF dentro del chat, para que compares con todo a la vista.',
    points: [
      'Oferta formal con precio cerrado',
      'Documento PDF de la cotización',
      'Chat privado con la tienda',
      'Historial de todas tus solicitudes',
    ],
    cta: 'Pedir una cotización',
    action: 'catalog',
    image: '/about-assets/cotizacion-real.webp',
    width: 1096,
    height: 782,
    alt: 'Chat de una cotización en RepuesTop, con la oferta formal y el PDF adjunto',
    badge: ['Ofertas formales,', 'no promesas por teléfono'],
    extra: {
      image: '/about-assets/cotizacion-pdf-real.webp',
      width: 620,
      height: 877,
      alt: 'PDF de la cotización N° 13 generado por RepuesTop, con el detalle, el total y las condiciones',
    },
  },
  {
    id: 'negocio',
    Icon: BarChart3,
    nav: 'Gestión de tu negocio',
    title: 'Gestión de tu Negocio',
    desc: 'Publica uno a uno o carga tu catálogo completo desde Excel, y mantén stock y precios al día desde un solo panel.',
    points: [
      'Carga masiva desde Excel',
      'Stock y precios editables al vuelo',
      'Compatibilidad por vehículo',
      'Métricas de tu inventario',
    ],
    cta: 'Quiero vender en RepuesTop',
    action: 'seller',
    image: '/about-assets/vendedor-panel-real.webp',
    width: 1096,
    height: 782,
    alt: 'Panel de gestión de inventario de una tienda en RepuesTop, con sus productos, stock y precios',
    badge: ['Tu inventario', 'siempre al día'],
  },
];

/**
 * Los tres pasos de la busqueda por patente. Es el diferencial del producto y la vista no lo
 * contaba en ninguna parte: se explicaba "compara y cotiza" como cualquier marketplace.
 */
const PLATE_STEPS: { Icon: LucideIcon; title: string; text: string }[] = [
  {
    Icon: CarFront,
    title: 'Escribes tu patente',
    text: 'Seis caracteres, los mismos que van en tu vehículo. Sin manuales ni números de pieza.',
  },
  {
    Icon: ScanLine,
    title: 'Identificamos tu vehículo',
    text: 'Marca, modelo, año y versión quedan confirmados antes de que veas un solo precio.',
  },
  {
    Icon: Boxes,
    title: 'Ves solo lo que le calza',
    text: 'Cruzamos tu auto con el inventario de cientos de casas de repuestos y filtramos el resto.',
  },
];

/** Ventajas del Mural de Anuncios para quien busca un taller. */
const MURAL_POINTS = [
  'Talleres, grúas, vulcanizaciones y estética automotriz',
  'Con precio desde, horario y comuna a la vista',
  'WhatsApp directo o reserva de hora sin llamar',
  'Puedes buscar por patente y ver solo lo compatible',
];

/**
 * Como se financia la plataforma. Es lo unico que se cobra, y la vista no lo decia en
 * ninguna parte: un comprador no tiene forma de saber que usarla no le cuesta nada.
 */
const PRICING_CARDS: { Icon: LucideIcon; tag: string; title: string; text: string; points: string[] }[] = [
  {
    Icon: Users,
    tag: 'Para quien compra',
    title: 'Gratis, siempre',
    text: 'Buscar por patente, comparar, pedir cotizaciones y comprar no tiene ningún costo.',
    points: ['Sin suscripción', 'Sin costo por cotizar', 'Sin límite de búsquedas'],
  },
  {
    Icon: Percent,
    tag: 'Para quien vende',
    title: 'Comisión solo al vender',
    text: 'Publicar tu catálogo es gratis. La tarifa de servicio se cobra únicamente sobre las ventas concretadas.',
    points: ['5% los primeros 3 meses desde el lanzamiento', 'Después, 8% por venta', 'Si no vendes, no pagas nada'],
  },
  {
    Icon: Coins,
    tag: 'Opcional',
    title: 'Monedas RepuesTop',
    text: 'Solo si quieres más visibilidad: impulsar un repuesto a Top Ventas o publicar en el Mural de Anuncios.',
    points: ['Se compran cuando las necesitas', 'Nunca son obligatorias', 'Tu primer anuncio Básico es gratis'],
  },
];

/** Por que conviene tener la app ademas de la web. */
const APP_POINTS = [
  'Una sola cuenta para el celular y el computador',
  'Tus cotizaciones y pedidos sincronizados al instante',
  'La misma búsqueda por patente en los dos lados',
  'Avisos cuando una tienda responde tu cotización',
];

/** Marca de Google Play, en sus colores oficiales. */
function GooglePlayMark() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
      <path d="M3.6 2.5a1.5 1.5 0 0 0-.4 1.1v16.8c0 .4.2.8.4 1.1l9.6-9.5-9.6-9.5Z" fill="#2196F3" />
      <path d="M16.4 8.7 13.2 12l3.2 3.3 3.6-2c1-.6 1-1.6 0-2.2l-3.6-2.4Z" fill="#FFC107" />
      <path d="M3.6 21.5c.5.5 1.4.6 2.2.1l10.6-6.1-3.2-3.5-9.6 9.5Z" fill="#4CAF50" />
      <path d="M16.4 8.7 5.8 2.6c-.8-.5-1.7-.4-2.2.1l9.6 9.3 3.2-3.3Z" fill="#F44336" />
    </svg>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="rt-checklist">
      {items.map((item) => (
        <li key={item}><CheckCircle2 aria-hidden="true" />{item}</li>
      ))}
    </ul>
  );
}

/**
 * Silueta de Chile del bloque de cobertura. Va como fondo de la tarjeta, no como
 * icono: por eso es `aria-hidden` y no tiene tamaño propio, lo estira el CSS.
 */
function ChileMark() {
  return (
    <svg className="rt-chile-mark" viewBox="0 0 72 230" aria-hidden="true">
      <path d="M42 4c7 16-2 25 6 39 6 11-7 18-3 29 4 13-5 21-1 35 4 13-8 23-3 36 5 14-7 24-4 37 2 12-9 26-5 43l-15 4c-2-19 9-31 5-45-4-15 8-24 3-38-5-15 8-23 4-38-4-14 8-23 3-37-5-14 7-24 2-38-4-12 2-21 8-27Z" fill="currentColor" />
      <circle cx="15" cy="225" r="3" fill="currentColor" />
    </svg>
  );
}

/** Escudo decorativo del bloque de confianza (el de la referencia, sobre el auto). */
function TrustSeal() {
  return (
    <svg className="rt-trust-band__seal" viewBox="0 0 120 140" aria-hidden="true">
      <defs>
        <linearGradient id="rt-seal-outer" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3f8bff" />
          <stop offset="1" stopColor="#0b49b8" />
        </linearGradient>
        <linearGradient id="rt-seal-inner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fb6ff" />
          <stop offset="1" stopColor="#2f78ee" />
        </linearGradient>
      </defs>
      <path d="M60 2 111 22v48c0 32-21 55-51 68C30 125 9 102 9 70V22Z" fill="url(#rt-seal-outer)" />
      <path d="M60 16 98 31v38c0 25-16 43-38 53-22-10-38-28-38-53V31Z" fill="url(#rt-seal-inner)" opacity=".55" />
      <path d="m44 70 12 12 22-24" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AboutRepuesTopPage({
  onBack,
  onContact,
  onOpenSeller,
  onOpenCatalog,
  onOpenStores,
  onOpenAdsWall,
}: AboutRepuesTopPageProps) {
  // La pregunta abierta se guarda por grupo, no por indice suelto: si fuera un indice global,
  // cambiar de pestaña dejaria abierta "la tercera" del grupo nuevo sin que nadie la pidiera.
  const [activeFaqGroup, setActiveFaqGroup] = useState(0);
  const [openFaq, setOpenFaq] = useState('generales-0');
  // Los cuatro botones de "Pantallas reales" ahora cambian de panel. Antes los tres ultimos
  // navegaban fuera de la pagina, asi que el unico modulo que se podia ver era el directorio.
  const [activeModule, setActiveModule] = useState(0);
  const currentFaqGroup = FAQ_GROUPS[activeFaqGroup];
  const goCatalog = onOpenCatalog || onBack;
  const goStores = onOpenStores || onBack;
  const goAdsWall = onOpenAdsWall || onBack;
  const moduleActions = { stores: goStores, catalog: goCatalog, seller: onOpenSeller };
  const currentModule = PLATFORM_MODULES[activeModule];

  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]');
    if (!meta) return;
    const previous = meta.getAttribute('content');
    meta.setAttribute('content', 'Conoce RepuesTop, la plataforma que conecta conductores, talleres y casas de repuestos de todo Chile.');
    return () => {
      if (previous !== null) meta.setAttribute('content', previous);
    };
  }, []);

  return (
    <div className="rt-about">
      <main>
        <section className="rt-hero" aria-labelledby="rt-main-title">
          <div className="rt-shell rt-hero__grid">
            <div className="rt-hero__copy">
              <p className="rt-kicker">Repuestos. Personas. Movilidad.</p>
              <h1 id="rt-main-title">Encuentra el repuesto <br />que necesitas, <span>más rápido</span> <br />y con total confianza</h1>
              <p className="rt-hero__lead">RepuesTop conecta a conductores, talleres y casas de repuestos en todo Chile. Compara, cotiza y compra repuestos de forma simple, segura y sin salir de casa o tu taller.</p>
              <div className="rt-actions">
                <button className="rt-btn rt-btn--primary" type="button" onClick={goCatalog}>Buscar repuestos ahora <ArrowRight aria-hidden="true" /></button>
                <button className="rt-btn rt-btn--outline" type="button" onClick={onOpenSeller}><Store aria-hidden="true" /> Quiero ofrecer mis repuestos</button>
              </div>
              <ul className="rt-hero__trust">
                <li><ShieldCheck aria-hidden="true" /><span>100% seguro<br />y confiable</span></li>
                <li><ShieldCheck aria-hidden="true" /><span>Proveedores verificados<br />en todo Chile</span></li>
                <li><Sparkles aria-hidden="true" /><span>Miles de repuestos<br />disponibles</span></li>
              </ul>
            </div>
            <div className="rt-hero__visual">
              <p className="rt-hero__note">
                Tu auto sigue en<br />buenas manos
                <svg viewBox="0 0 40 46" aria-hidden="true"><path d="M6 2c14 4 24 14 25 30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M24 30h8v-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="rotate(38 30 28)" /></svg>
              </p>
              <img src="/about-assets/hero-devices-real.webp" alt="RepuesTop abierto en un computador, mostrando la portada con el buscador por patente, y en un teléfono con la búsqueda por patente de la app" width="1448" height="1086" fetchPriority="high" />
            </div>
          </div>
        </section>

        <section className="rt-metrics" aria-label="Cifras de RepuesTop">
          <div className="rt-shell">
            <div className="rt-metrics__grid">
              {([
                [Store, '+100', 'Casas de repuestos conectadas'],
                [Box, '2000+', 'Marcas y modelos cubiertos'],
                [Clock3, '3 días', 'Tiempo promedio de respuesta'],
                [ShieldCheck, '98%', 'Clientes satisfechos'],
              ] as [LucideIcon, string, string][]).map(([Icon, value, label]) => (
                <div className="rt-metric" key={value}>
                  <span><Icon aria-hidden="true" /></span>
                  <div><strong>{value}</strong><small>{label}</small></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rt-section rt-plate" id="patente" aria-labelledby="rt-plate-title">
          <div className="rt-shell">
            <Reveal as="header" className="rt-section-head">
              <p className="rt-kicker">Lo que nos hace distintos</p>
              <h2 id="rt-plate-title">Tu patente filtra el catálogo por ti</h2>
              <p>Escribes seis caracteres y RepuesTop cruza tu vehículo con el inventario de cientos de casas de repuestos de todo Chile. Lo que aparece en pantalla ya viene filtrado: solo piezas que le calzan a tu auto, con su precio, su stock y la tienda que las tiene.</p>
            </Reveal>

            <div className="rt-plate__grid">
              <ol className="rt-plate__steps">
                {PLATE_STEPS.map(({ Icon, title, text }, index) => (
                  <Reveal as="li" key={title} delay={index * 90}>
                    <span className="rt-plate__step-icon"><Icon aria-hidden="true" /></span>
                    <div>
                      <h3><i>{index + 1}</i>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </Reveal>
                ))}
              </ol>

              <Reveal className="rt-plate__visual" delay={120}>
                <span className="rt-plate__badge" aria-hidden="true"><i>CL</i><b>ABCD11</b></span>
                <img
                  src="/about-assets/busqueda-real.webp"
                  alt="Catálogo de RepuesTop filtrado por la patente de un Toyota Yaris"
                  width={1096}
                  height={782}
                  loading="lazy"
                  decoding="async"
                />
                <span className="rt-plate__float"><CheckCircle2 aria-hidden="true" /> Solo compatibles<br />con tu vehículo</span>
              </Reveal>
            </div>

            <div className="rt-plate__facts">
              {([
                [Building2, 'Cientos de casas de repuestos', 'Un solo lugar para consultarle a todas a la vez, sin llamar una por una.'],
                [Search, 'Cero piezas que no calzan', 'La compatibilidad la resuelve el sistema, no tu memoria ni el vendedor.'],
                [Sparkles, 'También los universales', 'Las piezas que sirven a cualquier vehículo aparecen igual, no se pierden.'],
              ] as [LucideIcon, string, string][]).map(([Icon, title, text], index) => (
                <Reveal as="article" className="rt-plate__fact" key={title} delay={index * 70}>
                  <span><Icon aria-hidden="true" /></span>
                  <div><h3>{title}</h3><p>{text}</p></div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="rt-section rt-communities" aria-labelledby="rt-communities-title">
          <div className="rt-shell">
            <Reveal>
              <p className="rt-kicker">Una plataforma, dos grandes comunidades</p>
              <h2 id="rt-communities-title">Hecha para quienes mantienen<br />a Chile en movimiento</h2>
            </Reveal>
            <div className="rt-community-grid">
              <Reveal as="article" className="rt-community-card">
                <div className="rt-community-card__content">
                  <h3><span><Users aria-hidden="true" /></span>Para compradores</h3>
                  <p>Encuentra el repuesto correcto al mejor precio, compara entre múltiples proveedores y compra con confianza.</p>
                  <CheckList items={BUYER_POINTS} />
                  <button className="rt-btn rt-btn--primary" type="button" onClick={goCatalog}>Buscar repuestos <ArrowRight aria-hidden="true" /></button>
                </div>
                <img src="/about-reference/buyer.png" alt="Comprador usando RepuesTop desde su teléfono" width="1086" height="1448" loading="lazy" />
                <span className="rt-community-card__float"><Search aria-hidden="true" /> Repuestos al<br />mejor precio</span>
              </Reveal>

              <Reveal as="article" className="rt-community-card rt-community-card--seller" delay={110}>
                <div className="rt-community-card__content">
                  <h3><span><Store aria-hidden="true" /></span>Para casas de repuestos</h3>
                  <p>Publica tus productos, recibe solicitudes de cotización y aumenta tus ventas. Conecta con miles de clientes en todo Chile.</p>
                  <CheckList items={SELLER_POINTS} />
                  <button className="rt-btn rt-btn--primary" type="button" onClick={onOpenSeller}>Quiero ser proveedor <ArrowRight aria-hidden="true" /></button>
                </div>
                <img src="/about-reference/seller.png" alt="Dueño de una casa de repuestos" width="1086" height="1448" loading="lazy" />
                <span className="rt-community-card__float"><BarChart3 aria-hidden="true" /> Más clientes<br />para tu negocio</span>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="rt-section rt-benefits" id="beneficios" aria-labelledby="rt-benefits-title">
          <div className="rt-shell">
            <Reveal as="header" className="rt-section-head">
              <p className="rt-kicker">Más que una plataforma</p>
              <h2 id="rt-benefits-title">Todo lo que necesitas en un solo lugar</h2>
              <p>RepuesTop simplifica la forma de comprar y vender repuestos, con herramientas pensadas para hacer tu experiencia más rápida, segura y eficiente.</p>
            </Reveal>
            <div className="rt-benefit-grid">
              {BENEFITS.map(({ Icon, title, text }, index) => (
                <Reveal as="article" className="rt-benefit-card" key={title} delay={index * 45}>
                  <span><Icon aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="rt-section rt-platform" id="como-funciona" aria-labelledby="rt-platform-title">
          <div className="rt-shell">
            <Reveal as="header" className="rt-section-head">
              <p className="rt-kicker">Pantallas reales, resultados reales</p>
              <h2 id="rt-platform-title">Una plataforma simple, potente y visual</h2>
              <p>Así se ve RepuesTop por dentro. Una experiencia moderna, intuitiva y pensada para ahorrar tiempo.</p>
            </Reveal>
            <div className="rt-platform__layout">
              <div className="rt-platform__nav" role="tablist" aria-label="Funciones de la plataforma">
                {PLATFORM_MODULES.map((module, index) => (
                  <button
                    key={module.id}
                    type="button"
                    role="tab"
                    id={`rt-platform-tab-${module.id}`}
                    aria-controls={`rt-platform-panel-${module.id}`}
                    aria-selected={index === activeModule}
                    tabIndex={index === activeModule ? 0 : -1}
                    className={index === activeModule ? 'is-active' : undefined}
                    onClick={() => setActiveModule(index)}
                  >
                    <module.Icon aria-hidden="true" />{module.nav}
                  </button>
                ))}
              </div>
              <article
                className="rt-platform__panel"
                role="tabpanel"
                id={`rt-platform-panel-${currentModule.id}`}
                aria-labelledby={`rt-platform-tab-${currentModule.id}`}
              >
                <div className="rt-platform__copy">
                  <h3>{currentModule.title}</h3>
                  <p>{currentModule.desc}</p>
                  <CheckList items={currentModule.points} />
                  <button
                    className="rt-btn rt-btn--primary"
                    type="button"
                    onClick={moduleActions[currentModule.action]}
                  >
                    {currentModule.cta} <ArrowRight aria-hidden="true" />
                  </button>
                </div>
                <span className="rt-platform__shot">
                  <img
                    key={currentModule.id}
                    src={currentModule.image}
                    alt={currentModule.alt}
                    width={currentModule.width}
                    height={currentModule.height}
                    loading="lazy"
                    decoding="async"
                  />
                  {currentModule.extra && (
                    <img
                      className="rt-platform__doc"
                      key={`${currentModule.id}-doc`}
                      src={currentModule.extra.image}
                      alt={currentModule.extra.alt}
                      width={currentModule.extra.width}
                      height={currentModule.extra.height}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </span>
                <span className="rt-platform__verified">
                  <CheckCircle2 aria-hidden="true" />
                  {currentModule.badge[0]}<br />{currentModule.badge[1]}
                </span>
              </article>
            </div>
          </div>
        </section>

        <section className="rt-apps" id="app" aria-labelledby="rt-apps-title">
          <div className="rt-shell rt-apps__grid">
            <div className="rt-apps__copy">
              <p className="rt-kicker">Celular y computador, la misma cuenta</p>
              <h2 id="rt-apps-title">Búscalo en el computador,<br />síguelo desde el celular</h2>
              <p>RepuesTop es la misma plataforma en los dos lados. Buscas por patente en la web, guardas el repuesto y sigues la cotización desde el teléfono: es una sola cuenta y los mismos datos, no dos sistemas distintos.</p>
              <CheckList items={APP_POINTS} />
              <div className="rt-apps__actions">
                <span className="rt-store-badge" role="note">
                  <GooglePlayMark />
                  <span><small>Muy pronto en</small><strong>Google Play</strong></span>
                </span>
                <button className="rt-btn rt-btn--primary" type="button" onClick={goCatalog}>
                  <MonitorSmartphone aria-hidden="true" /> Usar la versión web
                </button>
              </div>
              <p className="rt-apps__note"><BellRing aria-hidden="true" /> La app Android está en camino. Mientras tanto, la versión web funciona completa desde el navegador del celular.</p>
            </div>

            <Reveal className="rt-apps__visual" delay={110}>
              <img
                className="rt-apps__web"
                src="/about-assets/busqueda-real.webp"
                alt="RepuesTop en el navegador del computador, con el catálogo filtrado por patente"
                width={1096}
                height={782}
                loading="lazy"
                decoding="async"
              />
              <img
                className="rt-apps__phone"
                src="/about-assets/shot-app-patente.webp"
                alt="La app de RepuesTop en un teléfono, buscando por la misma patente"
                width={390}
                height={844}
                loading="lazy"
                decoding="async"
              />
              <span className="rt-apps__sync"><RefreshCw aria-hidden="true" /> Misma cuenta,<br />mismos datos</span>
            </Reveal>
          </div>
        </section>

        <section className="rt-section rt-mural" id="mural" aria-labelledby="rt-mural-title">
          <div className="rt-shell">
            <Reveal as="header" className="rt-section-head">
              <p className="rt-kicker"><Megaphone aria-hidden="true" /> Mural de Anuncios</p>
              <h2 id="rt-mural-title">El repuesto es la mitad: alguien tiene que instalarlo</h2>
              <p>El Mural reúne talleres mecánicos, eléctricos, vulcanizaciones, grúas y estética automotriz de todo Chile. Cada anuncio muestra precio desde, horario, comuna y las marcas en las que ese taller es especialista.</p>
            </Reveal>

            <div className="rt-mural__grid">
              <Reveal className="rt-mural__visual">
                <img
                  src="/about-assets/mural-real.webp"
                  alt="Mural de Anuncios de RepuesTop con talleres de distintas regiones"
                  width={1096}
                  height={782}
                  loading="lazy"
                  decoding="async"
                />
              </Reveal>

              <div className="rt-mural__copy">
                <CheckList items={MURAL_POINTS} />

                {/* El diferencial del Mural en el celular: el filtro por marca especialista y
                    la distancia real desde donde estas parado. */}
                <article className="rt-mural__mobile">
                  <h3><LocateFixed aria-hidden="true" /> Desde el celular, aún mejor</h3>
                  <ul>
                    <li>
                      <span><BadgeCheck aria-hidden="true" /></span>
                      <div><strong>Filtra por tu marca</strong><small>Solo los talleres especialistas en la marca de tu vehículo.</small></div>
                    </li>
                    <li>
                      <span><LocateFixed aria-hidden="true" /></span>
                      <div><strong>Ordenados por cercanía</strong><small>Cada taller muestra a cuántos kilómetros está de donde estás.</small></div>
                    </li>
                    <li>
                      <span><CalendarCheck aria-hidden="true" /></span>
                      <div><strong>Reserva hora al toque</strong><small>Agenda o escribe por WhatsApp sin salir de la app.</small></div>
                    </li>
                  </ul>
                </article>

                <button className="rt-btn rt-btn--primary" type="button" onClick={goAdsWall}>
                  Ver el Mural de Anuncios <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rt-section rt-pricing" id="precios" aria-labelledby="rt-pricing-title">
          <div className="rt-shell">
            <Reveal as="header" className="rt-section-head">
              <p className="rt-kicker">Sin suscripciones ni costos ocultos</p>
              <h2 id="rt-pricing-title">Usar RepuesTop es <span>100% gratis</span></h2>
              <p>Para el público no cuesta nada: ni buscar, ni comparar, ni cotizar, ni comprar. Y para las casas de repuestos, publicar el catálogo tampoco. La plataforma se financia con la tarifa de servicio de cada venta y con las Monedas, que son opcionales.</p>
            </Reveal>

            <div className="rt-pricing__grid">
              {PRICING_CARDS.map(({ Icon, tag, title, text, points }, index) => (
                <Reveal as="article" className="rt-pricing__card" key={title} delay={index * 80}>
                  <span className="rt-pricing__icon"><Icon aria-hidden="true" /></span>
                  <p className="rt-pricing__tag">{tag}</p>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <ul>
                    {points.map((point) => (
                      <li key={point}><CheckCircle2 aria-hidden="true" />{point}</li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>

            <Reveal className="rt-pricing__note">
              <ShieldCheck aria-hidden="true" />
              <p>
                <strong>Nunca te vamos a cobrar por usar la plataforma.</strong> Las Monedas RepuesTop
                sirven para destacar un repuesto o publicar en el Mural, y se compran solo cuando
                decides usarlas.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="rt-road-band" aria-labelledby="rt-road-title">
          <div className="rt-shell rt-road-band__grid">
            <div className="rt-road-band__copy">
              <h2 id="rt-road-title">Para conductores,<br />talleres y casas de repuestos</h2>
              <p>Desde quienes buscan un repuesto hasta quienes los ofrecen, RepuesTop es el punto de encuentro de la industria automotriz en Chile.</p>
              <div className="rt-road-band__audiences">
                <span><Users aria-hidden="true" />Conductores<br />Particulares</span>
                <span><Wrench aria-hidden="true" />Talleres<br />Mecánicos</span>
                <span><Store aria-hidden="true" />Casas de<br />Repuestos</span>
              </div>
            </div>
            <article className="rt-coverage-card">
              <ChileMark />
              <div className="rt-coverage-card__body">
                <h3>Juntos mantenemos<br />a Chile en movimiento</h3>
                <p>Creemos en una movilidad más simple, transparente y conectada. Por eso trabajamos todos los días para acercar a quienes necesitan repuestos con quienes tienen la solución.</p>
                <ul className="rt-coverage-card__stats">
                  <li><span><HeartHandshake aria-hidden="true" /></span><div><strong>+200.000</strong><small>Personas ya confían en nosotros</small></div></li>
                  <li><span><MapPin aria-hidden="true" /></span><div><strong>16 regiones</strong><small>Cobertura en todo Chile</small></div></li>
                </ul>
              </div>
              <p className="rt-coverage-card__pill"><MapPin aria-hidden="true" /><span>De Arica a Punta Arenas<br />Repuestos para todo Chile</span></p>
            </article>
          </div>
        </section>

        <section className="rt-trust-band" aria-labelledby="rt-trust-title">
          <div className="rt-shell">
            <p className="rt-kicker">Tu confianza es nuestra prioridad</p>
            <h2 id="rt-trust-title">Una plataforma segura, transparente<br />y comprometida con tu tranquilidad</h2>
            <TrustSeal />
            <div className="rt-trust-grid">
              {([
                [ShieldCheck, 'Protección de datos', 'Tu información está segura con estándares de clase mundial.'],
                [CheckCircle2, 'Proveedores verificados', 'Solo trabajamos con negocios reales y confiables.'],
                [LockKeyhole, 'Transacciones seguras', 'Compra o cotiza con total tranquilidad.'],
                [Headphones, 'Soporte en todo Chile', 'Te acompañamos en cada paso.'],
              ] as [LucideIcon, string, string][]).map(([Icon, title, text]) => (
                <article key={title}>
                  <span><Icon aria-hidden="true" /></span>
                  <div><h3>{title}</h3><p>{text}</p></div>
                </article>
              ))}
            </div>
            <p className="rt-trust-band__claim">Más que repuestos,<br />construimos confianza</p>
          </div>
        </section>

        <section className="rt-section rt-faq" id="preguntas" aria-labelledby="rt-faq-title">
          <div className="rt-shell">
            <Reveal as="header" className="rt-section-head">
              <p className="rt-kicker">Preguntas frecuentes</p>
              <h2 id="rt-faq-title">Todo lo que suelen preguntarnos</h2>
              <p>Cuatro grupos: qué es RepuesTop, cómo se usa, qué se cobra y cómo te protege. Cada uno con la pantalla real que lo responde.</p>
            </Reveal>

            <div className="rt-faq__tabs" role="tablist" aria-label="Grupos de preguntas frecuentes">
              {FAQ_GROUPS.map((group, index) => (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  id={`rt-faq-tab-${group.id}`}
                  aria-controls={`rt-faq-group-${group.id}`}
                  aria-selected={index === activeFaqGroup}
                  tabIndex={index === activeFaqGroup ? 0 : -1}
                  className={index === activeFaqGroup ? 'is-active' : undefined}
                  onClick={() => {
                    setActiveFaqGroup(index);
                    setOpenFaq(`${group.id}-0`);
                  }}
                >
                  <group.Icon aria-hidden="true" />
                  {group.label}
                  <small>{group.items.length}</small>
                </button>
              ))}
            </div>

            <div
              className="rt-faq__grid"
              role="tabpanel"
              id={`rt-faq-group-${currentFaqGroup.id}`}
              aria-labelledby={`rt-faq-tab-${currentFaqGroup.id}`}
            >
              {/* La captura se estira para ocupar el alto que sobra (ver about.css): asi la
                  columna nunca queda mas corta que el acordeon, que era justamente el hueco
                  que se veia cuando las nueve preguntas iban en una sola lista. */}
              <aside className="rt-faq__aside">
                <p className="rt-faq__tag"><ScanLine aria-hidden="true" />Pantalla real · {currentFaqGroup.caption}</p>
                <figure className="rt-faq__shot">
                  <img
                    key={currentFaqGroup.id}
                    src={currentFaqGroup.image}
                    alt={currentFaqGroup.alt}
                    width={currentFaqGroup.width}
                    height={currentFaqGroup.height}
                    loading="lazy"
                    decoding="async"
                  />
                </figure>
              </aside>

              <div className="rt-faq__list">
                <div className="rt-accordion">
                {currentFaqGroup.items.map(([question, answer], index) => {
                  const key = `${currentFaqGroup.id}-${index}`;
                  const open = openFaq === key;
                  return (
                    <article className={open ? 'is-open' : ''} key={question}>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`rt-faq-panel-${key}`}
                        id={`rt-faq-button-${key}`}
                        onClick={() => setOpenFaq(open ? '' : key)}
                      >
                        {question}<ChevronDown aria-hidden="true" />
                      </button>
                      <div
                        className="rt-accordion__panel"
                        id={`rt-faq-panel-${key}`}
                        role="region"
                        aria-labelledby={`rt-faq-button-${key}`}
                        hidden={!open}
                      >
                        <p>{answer}</p>
                      </div>
                    </article>
                  );
                })}
                </div>

                {/* Va despues de la lista y no al lado de la imagen: es la salida natural de
                    quien llego al final sin encontrar su pregunta. */}
                <div className="rt-faq__contact">
                  <span><Headphones aria-hidden="true" /></span>
                  <div>
                    <h3>¿Aún tienes preguntas?</h3>
                    <p>Nuestro equipo responde en el Centro de Ayuda.</p>
                  </div>
                  <button className="rt-btn rt-btn--primary" type="button" onClick={onContact}>Contáctanos</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rt-final-cta" aria-labelledby="rt-cta-title">
          <div className="rt-shell rt-final-cta__grid">
            <div>
              <h2 id="rt-cta-title">Tu próximo repuesto está más cerca<br />de lo que piensas</h2>
              <p>Únete a miles de conductores y casas de repuestos que ya confían en RepuesTop.</p>
              <div className="rt-actions">
                <button className="rt-btn rt-btn--glass" type="button" onClick={goCatalog}><Search aria-hidden="true" />Buscar repuestos ahora <ArrowRight aria-hidden="true" /></button>
                <button className="rt-btn rt-btn--dark-outline" type="button" onClick={onOpenSeller}><Sparkles aria-hidden="true" />Crear cuenta gratis</button>
              </div>
            </div>
            <p className="rt-final-cta__lockup">
              <img src="/repuestop_icon.png" alt="" width="128" height="128" loading="lazy" />
              <span><strong>RepuesTop</strong><small>Movemos Chile juntos</small></span>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
