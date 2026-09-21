import { useRef, useState } from 'react';
import {
  ArrowRight, ChevronDown, CircleHelp, Headphones, LayoutDashboard, MessageSquareQuote,
  MonitorSmartphone, PackageCheck, Route, ShieldCheck, Store, Truck, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Reveal from './Reveal';
import { useRovingTabs } from './useRovingTabs';
import { useRailScrollState } from './useRailScrollState';

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
  action: 'catalog' | 'stores' | 'adsWall' | 'contact' | 'seller';
}

const MODULES: Module[] = [
  {
    id: 'howto',
    Icon: Route,
    tab: 'Cómo funciona',
    tag: 'De la patente a tu puerta',
    title: 'Cuatro pasos, sin llamadas a ciegas',
    desc: 'Patente, vehículo confirmado, repuestos compatibles y compra o cotización.',
    image: '/about-assets/como-funciona.webp',
    width: 1672,
    height: 941,
    crop: 'rt-crop--howto',
    isReal: false,
    actionText: 'Buscar por patente',
    action: 'catalog',
  },
  {
    id: 'buyer-panel',
    Icon: LayoutDashboard,
    tab: 'Panel del comprador',
    tag: 'Tu cuenta',
    title: 'Compra, cotiza y sigue tus pedidos',
    desc: 'Tus compras, cotizaciones y repuestos guardados en un solo panel.',
    image: '/about-assets/comprador-panel-real.webp',
    width: 1176,
    height: 832,
    isReal: true,
    actionText: 'Explorar marketplace',
    action: 'catalog',
  },
  {
    id: 'seller-panel',
    Icon: Store,
    tab: 'Panel de la tienda',
    tag: 'Para casas de repuestos',
    title: 'Gestiona tus repuestos de forma rápida',
    desc: 'Publica uno a uno o carga tu catálogo completo desde Excel.',
    image: '/about-assets/vendedor-panel-real.webp',
    width: 1096,
    height: 782,
    isReal: true,
    actionText: 'Quiero vender en RepuesTop',
    action: 'seller',
  },
  {
    id: 'stores',
    Icon: Store,
    tab: 'Casas de repuestos',
    tag: 'Locales verificados',
    title: 'Directorio de Casas de Repuestos',
    desc: 'Locales con dirección, horarios, reputación y disponibilidad real.',
    image: '/about-assets/tiendas-real.webp',
    width: 1096,
    height: 782,
    isReal: true,
    actionText: 'Ver casas de repuestos',
    action: 'stores',
  },
  {
    id: 'services',
    Icon: Wrench,
    tab: 'Mural de servicios',
    tag: 'Talleres y mecánicos',
    title: 'Mural de Servicios Automotrices',
    desc: 'Mecánicos y talleres por comuna, con reseñas y agenda.',
    image: '/about-assets/mecanico-taller.webp',
    width: 1440,
    height: 810,
    ratio: '16 / 9',
    isReal: true,
    actionText: 'Ver mural de servicios',
    action: 'adsWall',
  },
  {
    id: 'quotes',
    Icon: MessageSquareQuote,
    tab: 'Cotizaciones y chat',
    tag: 'Trato directo',
    title: 'Cotizaciones Formales por Chat',
    desc: 'Oferta formal con precio, garantía y PDF dentro del chat.',
    image: '/about-assets/cotizacion-real.webp',
    width: 1096,
    height: 782,
    isReal: true,
    actionText: 'Ir a buscar y cotizar',
    action: 'catalog',
  },
  {
    id: 'qa',
    Icon: CircleHelp,
    tab: 'Preguntas y respuestas',
    tag: 'Transparencia',
    title: 'Preguntas y Respuestas Técnicas',
    desc: 'Resuelve dudas de compatibilidad antes de pagar.',
    image: '/about-assets/ilus-preguntas.webp',
    width: 512,
    height: 512,
    ratio: '4 / 3',
    contain: true,
    isReal: true,
    actionText: 'Explorar catálogo',
    action: 'catalog',
  },
  {
    id: 'orders',
    Icon: PackageCheck,
    tab: 'Seguimiento de pedidos',
    tag: 'Control total',
    title: 'Seguimiento Paso a Paso de tu Pedido',
    desc: 'Pagado, en preparación, listo con tu PIN o en camino con seguimiento.',
    image: '/about-assets/ilus-pedidos.webp',
    width: 512,
    height: 341,
    ratio: '3 / 2',
    contain: true,
    isReal: false,
    actionText: 'Comprar con respaldo',
    action: 'catalog',
  },
  {
    id: 'mediation',
    Icon: ShieldCheck,
    tab: 'Equipo de mediación',
    tag: 'Resolución de problemas',
    title: 'Equipo de Mediación Imparcial',
    desc: 'Una persona revisa las fotos y resuelve con tus fondos protegidos.',
    image: '/about-assets/ilus-verificadas.webp',
    width: 760,
    height: 811,
    ratio: '4 / 3',
    contain: true,
    isReal: false,
    actionText: 'Conocer centro de ayuda',
    action: 'contact',
  },
  {
    id: 'support',
    Icon: Headphones,
    tab: 'Soporte y seguridad',
    tag: 'Atención y respaldo',
    title: 'Centro de Soporte y Seguridad',
    desc: 'Atención con personas reales y revisión de reportes de la comunidad.',
    image: '/about-assets/soporte-real.webp',
    width: 1096,
    height: 782,
    isReal: true,
    actionText: 'Contactar a soporte',
    action: 'contact',
  },
  {
    id: 'logistics',
    Icon: Truck,
    tab: 'Opciones de envío',
    tag: 'Opciones cómodas',
    title: 'Entregas y Despachos a Todo Chile',
    desc: 'Retiro con PIN sin costo, despacho local o courier a todo Chile.',
    image: '/about-assets/delivery-truck.webp',
    width: 1024,
    height: 562,
    ratio: '16 / 9',
    isReal: false,
    actionText: 'Buscar repuestos ahora',
    action: 'catalog',
  },
];

export default function ProductPreviewSection({
  onCatalog,
  onStores,
  onAdsWall,
  onContact,
  onOpenSeller,
}: {
  onCatalog: () => void;
  onStores: () => void;
  onAdsWall: () => void;
  onContact: () => void;
  onOpenSeller: () => void;
}) {
  const [active, setActive] = useState(0);
  const { register, onKeyDown } = useRovingTabs(MODULES.length, setActive);
  const railRef = useRef<HTMLDivElement | null>(null);
  const rail = useRailScrollState(railRef);
  // El rail muestra hasta "Seguimiento de pedidos"; el resto queda bajo scroll.
  const hidden = MODULES.length - 8;

  const actions = {
    catalog: onCatalog,
    stores: onStores,
    adsWall: onAdsWall,
    contact: onContact,
    seller: onOpenSeller,
  };
  const current = MODULES[active];

  return (
    <section className="rt-band" id="modulos" aria-labelledby="rt-preview-title">
      <div className="rt-shell">
        <Reveal className="rt-head">
          <span className="rt-eyebrow">
            <MonitorSmartphone size={14} /> Pantallas reales, resultados reales
          </span>
          <h2 id="rt-preview-title">Así se ve RepuesTop por dentro</h2>
        </Reveal>

        <div className="rt-preview-grid">
          <div className="rt-tabrail-wrap">
          <div
            ref={railRef}
            className="rt-tabrail"
            data-scroll={rail.state}
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

          {rail.overflows && rail.state !== 'end' && hidden > 0 && (
            <p className="rt-tabrail-more" aria-hidden="true">
              <ChevronDown size={14} />
              <span>{hidden} módulos más</span>
            </p>
          )}
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
