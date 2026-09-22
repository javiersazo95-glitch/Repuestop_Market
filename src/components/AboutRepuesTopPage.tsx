import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight, BarChart3, Box, Building2, CheckCircle2, ChevronDown,
  Clock3, Gift, Headphones, HeartHandshake, LockKeyhole, MapPin,
  Search, ShieldCheck, ShoppingCart, Sparkles, Store, Truck, Users, Wrench,
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

const FAQS: [string, string][] = [
  ['¿Cómo comprar un repuesto en RepuesTop?', 'Solo debes buscar el repuesto que necesitas, comparar las opciones de nuestros proveedores verificados y realizar tu compra o solicitud de cotización. Es rápido, fácil y seguro.'],
  ['¿Es seguro comprar en RepuesTop?', 'Sí. Trabajamos con proveedores verificados y pagos protegidos para que puedas comprar con tranquilidad.'],
  ['¿Cómo puedo ser parte como casa de repuestos?', 'Crea tu cuenta de proveedor y completa el proceso de verificación para comenzar a publicar tu catálogo.'],
  ['¿En qué regiones funciona RepuesTop?', 'RepuesTop conecta compradores y casas de repuestos en las 16 regiones de Chile.'],
  ['¿Qué formas de pago están disponibles?', 'Puedes pagar a través de las alternativas habilitadas en la plataforma, de forma segura y respaldada.'],
  ['¿Cómo puedo contactar al soporte?', 'Nuestro equipo está disponible desde el Centro de Ayuda para resolver tus dudas.'],
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

const DIRECTORY_POINTS = [
  'Filtros por región y especialidad',
  'Información de contacto',
  'Opiniones y valoraciones',
  'Horarios y ubicación',
];

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
}: AboutRepuesTopPageProps) {
  const [openFaq, setOpenFaq] = useState(0);
  const goCatalog = onOpenCatalog || onBack;
  const goStores = onOpenStores || onBack;

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
              <img src="/about-reference/hero-devices.png" alt="RepuesTop en computador y teléfono junto a distintos repuestos" width="1448" height="1086" fetchPriority="high" />
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
              <nav className="rt-platform__nav" aria-label="Funciones de la plataforma">
                <button className="is-active" type="button" onClick={goStores}><Building2 aria-hidden="true" />Directorio de casas de repuestos</button>
                <button type="button" onClick={goCatalog}><Search aria-hidden="true" />Búsqueda de productos</button>
                <button type="button" onClick={goCatalog}><ShoppingCart aria-hidden="true" />Comparación de cotizaciones</button>
                <button type="button" onClick={onOpenSeller}><BarChart3 aria-hidden="true" />Gestión de tu negocio</button>
              </nav>
              <article className="rt-platform__panel">
                <div className="rt-platform__copy">
                  <h3>Directorio de Casas de Repuestos</h3>
                  <p>Encuentra casas de repuestos verificadas en todo Chile, con su información, especialidades y valoraciones de otros clientes.</p>
                  <CheckList items={DIRECTORY_POINTS} />
                  <button className="rt-btn rt-btn--primary" type="button" onClick={goStores}>Ver directorio <ArrowRight aria-hidden="true" /></button>
                </div>
                <span className="rt-platform__shot">
                  <img src="/about-reference/directory.png" alt="Directorio de casas de repuestos en RepuesTop" width="1448" height="1086" loading="lazy" />
                </span>
                <span className="rt-platform__verified"><CheckCircle2 aria-hidden="true" /> Casas de repuestos<br />reales y verificadas</span>
              </article>
            </div>
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

        <section className="rt-section rt-faq" aria-labelledby="rt-faq-title">
          <div className="rt-shell rt-faq__grid">
            <div className="rt-faq__intro">
              <h2 id="rt-faq-title">Preguntas frecuentes</h2>
              <p>Resolvemos las dudas más comunes sobre cómo funciona RepuesTop.</p>
              <div className="rt-faq__contact">
                <span><Headphones aria-hidden="true" /></span>
                <h3>¿Aún tienes preguntas?</h3>
                <p>Nuestro equipo está listo para ayudarte.</p>
                <button className="rt-btn rt-btn--primary" type="button" onClick={onContact}>Contáctanos</button>
              </div>
            </div>
            <div className="rt-accordion">
              {FAQS.map(([question, answer], index) => {
                const open = openFaq === index;
                return (
                  <article className={open ? 'is-open' : ''} key={question}>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`rt-faq-panel-${index}`}
                      id={`rt-faq-button-${index}`}
                      onClick={() => setOpenFaq(open ? -1 : index)}
                    >
                      {question}<ChevronDown aria-hidden="true" />
                    </button>
                    <div
                      className="rt-accordion__panel"
                      id={`rt-faq-panel-${index}`}
                      role="region"
                      aria-labelledby={`rt-faq-button-${index}`}
                      hidden={!open}
                    >
                      <p>{answer}</p>
                    </div>
                  </article>
                );
              })}
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
