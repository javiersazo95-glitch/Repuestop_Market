import { useState } from 'react';
import {
  ArrowRight, CheckCircle2, CircleHelp, Headphones, MessageSquareQuote, MonitorSmartphone,
  PackageCheck, Route, ShieldCheck, Store, Truck, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Reveal from './Reveal';
import { useRovingTabs } from './useRovingTabs';

interface Module {
  id: string;
  Icon: LucideIcon;
  tab: string;
  tag: string;
  title: string;
  desc: string;
  image: string;
  width: number;
  height: number;
  /** Proporcion del marco. Por defecto 16/11, que es la de las capturas de
   *  pantalla (1096x782 y 1176x832); las piezas con otra forma la declaran. */
  ratio?: string;
  /** Piezas que no son capturas y se deben ver enteras. */
  contain?: boolean;
  /** Piezas con texto quemado: se recortan con `.rt-crop` en vez del marco. */
  crop?: string;
  isReal: boolean;
  actionText: string;
  action: 'catalog' | 'stores' | 'adsWall' | 'contact';
  highlights: [string, string];
}

const MODULES: Module[] = [
  {
    id: 'howto',
    Icon: Route,
    tab: 'Cómo funciona',
    tag: 'De la patente a tu puerta',
    title: 'Cuatro pasos, sin llamadas a ciegas',
    desc: 'Buscas por patente o de forma manual, confirmas tu vehículo, revisas los repuestos compatibles y compras o pides una cotización formal. Todo desde el mismo lugar.',
    image: '/about-assets/como-funciona.jpg',
    width: 1672,
    height: 941,
    crop: 'rt-crop--howto',
    isReal: false,
    actionText: 'Buscar por patente',
    action: 'catalog',
    highlights: [
      'El catálogo se filtra solo con los datos oficiales de tu vehículo.',
      'Compras al instante o pides cotización a la tienda, tú eliges.',
    ],
  },
  {
    id: 'stores',
    Icon: Store,
    tab: 'Casas de repuestos',
    tag: 'Locales verificados',
    title: 'Directorio de Casas de Repuestos',
    desc: 'Encuentra locales comerciales de repuestos con su dirección exacta, horarios de atención, teléfonos, reputación y disponibilidad de piezas para retiro o despacho.',
    image: '/about-assets/tiendas-real.png',
    width: 1096,
    height: 782,
    isReal: true,
    actionText: 'Ver casas de repuestos',
    action: 'stores',
    highlights: [
      'Cada tienda pasa por revisión de documentación comercial y tributaria.',
      'Filtra por región, especialidad y valoraciones de otros clientes.',
    ],
  },
  {
    id: 'services',
    Icon: Wrench,
    tab: 'Mural de servicios',
    tag: 'Talleres y mecánicos',
    title: 'Mural de Servicios Automotrices',
    desc: 'Conecta con mecánicos profesionales y talleres para scanner, frenos, mantenciones y reparaciones, revisando su experiencia y agendando tu atención.',
    image: '/about-assets/mural-real.png',
    width: 1096,
    height: 782,
    isReal: true,
    actionText: 'Ver mural de servicios',
    action: 'adsWall',
    highlights: [
      'Especialistas por comuna con reseñas reales de otros conductores.',
      'Agenda tu hora sin salir de la plataforma.',
    ],
  },
  {
    id: 'quotes',
    Icon: MessageSquareQuote,
    tab: 'Cotizaciones y chat',
    tag: 'Trato directo',
    title: 'Cotizaciones Formales por Chat',
    desc: 'Solicita el precio de un repuesto directo a la tienda y recibe una oferta formal con documento PDF adjunto, todo dentro de un chat privado ligado a esa cotización.',
    image: '/about-assets/cotizacion-real.png',
    width: 1096,
    height: 782,
    isReal: true,
    actionText: 'Ir a buscar y cotizar',
    action: 'catalog',
    highlights: [
      'La oferta llega con precio neto, descuento, garantía y PDF adjunto.',
      'El chat queda ligado a esa cotización: nada se pierde.',
    ],
  },
  {
    id: 'qa',
    Icon: CircleHelp,
    tab: 'Preguntas y respuestas',
    tag: 'Transparencia',
    title: 'Preguntas y Respuestas Técnicas',
    desc: 'Consulta dudas específicas de compatibilidad antes de pagar. El vendedor recibe alerta inmediata y la respuesta queda registrada públicamente.',
    image: '/about-assets/qa-real.png',
    width: 1496,
    height: 592,
    ratio: '16 / 7',
    isReal: true,
    actionText: 'Explorar catálogo',
    action: 'catalog',
    highlights: [
      'Pregunta por el lado, el conector o la versión antes de pagar.',
      'Las respuestas quedan visibles para toda la comunidad.',
    ],
  },
  {
    id: 'orders',
    Icon: PackageCheck,
    tab: 'Seguimiento de pedidos',
    tag: 'Control total',
    title: 'Seguimiento Paso a Paso de tu Pedido',
    desc: 'Revisa en qué etapa está tu compra: Pagado, En preparación, Listo para retirar con tu PIN de seguridad o En camino con empresa de despacho y número de seguimiento.',
    image: '/about-assets/orders-hero-v2.png',
    width: 512,
    height: 341,
    ratio: '3 / 2',
    isReal: false,
    actionText: 'Comprar con respaldo',
    action: 'catalog',
    highlights: [
      'Cada cambio de estado te llega como notificación.',
      'El PIN de retiro solo aparece en tu cuenta, nadie más puede usarlo.',
    ],
  },
  {
    id: 'mediation',
    Icon: ShieldCheck,
    tab: 'Equipo de mediación',
    tag: 'Resolución de problemas',
    title: 'Equipo de Mediación Imparcial',
    desc: 'Si una pieza presenta problemas o no calza, una persona de nuestro equipo revisa las fotos y antecedentes para resolver de forma justa con tus fondos protegidos.',
    image: '/about-assets/mediator-profile.webp',
    width: 800,
    height: 787,
    contain: true,
    isReal: false,
    actionText: 'Conocer centro de ayuda',
    action: 'contact',
    highlights: [
      'Personas reales revisando el caso, no un formulario automático.',
      'Mientras se resuelve, tu dinero sigue retenido en la plataforma.',
    ],
  },
  {
    id: 'support',
    Icon: Headphones,
    tab: 'Soporte y seguridad',
    tag: 'Atención y respaldo',
    title: 'Centro de Soporte y Seguridad',
    desc: 'Atención personalizada con personas reales para responder tus consultas y revisar reportes de la comunidad para que compres con total tranquilidad.',
    image: '/about-assets/soporte-real.png',
    width: 1096,
    height: 782,
    isReal: true,
    actionText: 'Contactar a soporte',
    action: 'contact',
    highlights: [
      'Cualquier publicación irregular se puede reportar en un clic.',
      'Historial completo de tus casos dentro de tu cuenta.',
    ],
  },
  {
    id: 'logistics',
    Icon: Truck,
    tab: 'Opciones de envío',
    tag: 'Opciones cómodas',
    title: 'Entregas y Despachos a Todo Chile',
    desc: 'Retiro en el local de la tienda sin costo con código PIN seguro, despacho local rápido o envío por courier a cualquier ciudad del país.',
    image: '/about-assets/delivery-truck.webp',
    width: 1024,
    height: 562,
    ratio: '16 / 9',
    isReal: false,
    actionText: 'Buscar repuestos ahora',
    action: 'catalog',
    highlights: [
      'Retiro en tienda sin costo de envío, con PIN de 6 dígitos.',
      'Despacho por courier con número de seguimiento a todo el país.',
    ],
  },
];

export default function ProductPreviewSection({
  onCatalog,
  onStores,
  onAdsWall,
  onContact,
}: {
  onCatalog: () => void;
  onStores: () => void;
  onAdsWall: () => void;
  onContact: () => void;
}) {
  const [active, setActive] = useState(0);
  const { register, onKeyDown } = useRovingTabs(MODULES.length, setActive);

  const actions = { catalog: onCatalog, stores: onStores, adsWall: onAdsWall, contact: onContact };
  const current = MODULES[active];

  return (
    <section className="rt-band" id="modulos" aria-labelledby="rt-preview-title">
      <div className="rt-shell">
        <Reveal className="rt-head">
          <span className="rt-eyebrow">
            <MonitorSmartphone size={14} /> Pantallas reales, resultados reales
          </span>
          <h2 id="rt-preview-title">Así se ve RepuesTop por dentro</h2>
          <p>
            Elige un módulo para ver cómo luce la plataforma y qué herramientas tendrás a mano
            antes de tu primera compra o publicación.
          </p>
        </Reveal>

        <div className="rt-preview-grid">
          <div
            className="rt-tabrail"
            role="tablist"
            aria-orientation="vertical"
            aria-label="Módulos de la plataforma"
          >
            {MODULES.map((module, index) => {
              const selected = index === active;
              return (
                <button
                  key={module.id}
                  ref={register(index)}
                  type="button"
                  role="tab"
                  id={`rt-tab-${module.id}`}
                  aria-controls={`rt-panel-${module.id}`}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className="rt-tab"
                  onClick={() => setActive(index)}
                  onKeyDown={onKeyDown(index)}
                >
                  <span className="rt-tab__icon">
                    <module.Icon size={18} />
                  </span>
                  <span>{module.tab}</span>
                </button>
              );
            })}
          </div>

          <div
            className={`rt-panel${current.crop ? ' rt-panel--wide' : ''}`}
            role="tabpanel"
            id={`rt-panel-${current.id}`}
            aria-labelledby={`rt-tab-${current.id}`}
            tabIndex={0}
          >
            <div className="rt-panel__copy">
              <span className="rt-tag">{current.tag}</span>
              <h3>{current.title}</h3>
              <p>{current.desc}</p>

              <ul className="rt-panel__highlights">
                {current.highlights.map((highlight) => (
                  <li key={highlight}>
                    <CheckCircle2 size={16} />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="rt-btn rt-btn--primary"
                onClick={actions[current.action]}
              >
                <span>{current.actionText}</span>
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="rt-panel__stage">
              {current.crop ? (
                <figure className={`rt-crop ${current.crop}`}>
                  <img
                    key={current.id}
                    src={current.image}
                    alt={`${current.title} en RepuesTop`}
                    width={current.width}
                    height={current.height}
                    loading="lazy"
                    decoding="async"
                  />
                </figure>
              ) : (
                <div
                  className={`rt-panel__frame${current.contain ? ' rt-panel__frame--contain' : ''}`}
                  style={current.ratio ? { aspectRatio: current.ratio } : undefined}
                >
                  <img
                    key={current.id}
                    src={current.image}
                    alt={`${current.title} en RepuesTop`}
                    width={current.width}
                    height={current.height}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}
              {current.isReal && (
                <span className="rt-panel__stamp">
                  <i /> Captura real de la plataforma
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
