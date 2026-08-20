import { useEffect, useRef, useState, type ReactNode } from 'react';
import FounderModal from './FounderModal';
import '../about-repuestop.css';
import {
  ArrowDown, ArrowRight, BadgeCheck, Boxes, ChevronDown,
  Calculator, CircleDollarSign, Crown, FileCheck, FileSpreadsheet, Headphones, HeartHandshake, LockKeyhole,
  MessageSquareQuote, PackageCheck, Search, ShieldCheck, ShoppingCart,
  Smartphone, Store, Users, Zap, KeyRound, MapPin, UserRound,
  Package, CreditCard, CarFront, Truck, Mail, MessageCircle, ClipboardCheck,
  Monitor,
} from 'lucide-react';
import { siteConfig, trackEvent } from './founderConfig';

type Feature = { icon: ReactNode; title: string; text: string };
type ExperienceMode = 'buyer' | 'seller';

const buyerFeatures: Feature[] = [
  { icon: <Search />, title: 'Patente inteligente', text: 'Ingresa la patente y RepuesTop completa marca, modelo, año, versión y datos técnicos para partir con el vehículo correcto.' },
  { icon: <BadgeCheck />, title: 'Catálogo filtrado', text: 'La búsqueda muestra repuestos asociados al vehículo seleccionado para reducir errores antes de comprar.' },
  { icon: <MessageSquareQuote />, title: 'Cotizaciones por chat', text: 'Habla con la tienda y recibe una cotización formal con precio, descuento, garantía, disponibilidad y vigencia.' },
  { icon: <LockKeyhole />, title: 'Pago protegido', text: 'Paga con Flow y mantenemos los fondos retenidos por 3 días tras la entrega para validar que el repuesto calza.' },
  { icon: <PackageCheck />, title: 'Seguimiento claro', text: 'Revisa el avance desde pagado hasta finalizado, con comprobante descargable, y valida el retiro en tienda con un PIN de 6 dígitos.' },
  { icon: <ShoppingCart />, title: 'Carrito y checkout', text: 'Compra a varias tiendas en un solo carrito, con el envío calculado por proveedor, y define en tres pasos entrega, documento y pago.' },
];

const sellerFeatures: Feature[] = [
  { icon: <Users />, title: 'Clientes con intención real', text: 'Tu tienda aparece frente a compradores que ya buscaron un vehículo y necesitan piezas compatibles.' },
  { icon: <FileSpreadsheet />, title: 'Inventario flexible', text: 'Publica manualmente o carga stock masivo con Excel/CSV, imágenes y compatibilidades por producto.' },
  { icon: <Calculator />, title: 'Precio con ganancia clara', text: 'Usa una calculadora que sugiere precio de lista según la ganancia neta que quieres obtener.' },
  { icon: <MessageSquareQuote />, title: 'Cotizaciones formales', text: 'Responde por chat con precio final, descuento, garantía, disponibilidad, notas y tiempo de entrega.' },
  { icon: <Truck />, title: 'Envíos configurables', text: 'Activa retiro en tienda, despacho local por comuna o courier nacional por pagar con tracking.' },
  { icon: <Crown />, title: 'Tienda fundadora', text: 'Las tiendas que se integren en esta primera etapa tendrán 5% fijo de comisión, sin importar el valor de la venta, y reconocimiento por creer temprano en RepuesTop.' },
];


const experiences = {
  buyer: {
    label: 'Quiero comprar', icon: <ShoppingCart />, eyebrow: 'Para personas y talleres',
    title: 'Encuentra repuestos compatibles y compra con respaldo',
    text: 'Tu patente abre el camino: identificamos el vehículo, filtramos el catálogo y conectamos con tiendas verificadas. Compras a varias tiendas en un solo carrito, eliges boleta o factura y el pago queda protegido hasta que confirmes que el repuesto calza.',
    features: buyerFeatures, image: '/about-assets/comprador-web-mobile.png',
    stats: [['Patente o manual', 'Ficha técnica del vehículo'], ['3 días protegidos', 'Fondos retenidos tras entrega'], ['Boleta o factura', 'Documento a tu nombre o al de tu empresa']],
  },
  seller: {
    label: 'Soy proveedor', icon: <Store />, eyebrow: 'Para tiendas de repuestos',
    title: 'Vende con inventario ordenado, cotizaciones y control de despacho',
    text: 'Carga productos, responde oportunidades por chat, configura tus entregas y controla ganancias, pedidos en curso y ventas completadas desde un dashboard. Cuando la entrega queda cerrada, solicitas el retiro de tu saldo a la cuenta que registraste.',
    features: sellerFeatures, image: '/about-assets/vendedor-web-mobile.png',
    stats: [['5% fundador', 'Comisión fija por venta'], ['Excel/CSV', 'Carga masiva de stock'], ['Tienda verificada', 'Documentos revisados por soporte']],
  },
} as const;

function usePageMeta() {
  useEffect(() => {
    document.title = 'RepuesTop | Repuestos por patente, tiendas verificadas y pago protegido';
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'Marketplace chileno de repuestos automotrices: busca por patente, compra en tiendas verificadas, cotiza por chat y paga con respaldo.');
  }, []);
}

function AndroidIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.4 5.3 5.9 2.8a.7.7 0 0 1 1.2-.7l1.6 2.6a9 9 0 0 1 6.6 0l1.6-2.6a.7.7 0 1 1 1.2.7l-1.5 2.5A7.2 7.2 0 0 1 20 11H4a7.2 7.2 0 0 1 3.4-5.7ZM8 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM4 12h16v7a2 2 0 0 1-2 2h-1v1.3a1 1 0 1 1-2 0V21H9v1.3a1 1 0 1 1-2 0V21H6a2 2 0 0 1-2-2v-7Z" /></svg>;
}

function AppleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.8 12.8c0-2.3 1.9-3.4 2-3.5a4.3 4.3 0 0 0-3.4-1.8c-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.9-3-.9a4.5 4.5 0 0 0-3.8 2.3c-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3.1-.7 1.4 0 1.9.7 3.1.7 1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.7-1-2.7-3.6ZM14.5 6c.6-.8 1.1-2 1-3.2-1 .1-2.3.7-3 1.5-.7.7-1.2 1.9-1.1 3 1.2.1 2.4-.5 3.1-1.3Z" /></svg>;
}

function Brand() {
  return <a href="#inicio" className="hero-brand" aria-label="RepuesTop, inicio"><img src="/about-assets/repuestop-icon.jpg" alt="" /><span>Repues<span>Top</span></span></a>;
}

function PlatformPill({ platform, soon = false }: { platform: 'web' | 'android' | 'ios'; soon?: boolean }) {
  const isWeb = platform === 'web';
  const isAndroid = platform === 'android';
  return <div className={`platform-pill ${platform}`}>
    <span className="platform-icon">{isWeb ? <Monitor /> : isAndroid ? <AndroidIcon /> : <AppleIcon />}</span>
    <span><small>{isWeb ? 'Disponible ahora' : 'App móvil en desarrollo'}</small><strong>{isWeb ? 'Versión web' : isAndroid ? 'Android' : 'iOS'}</strong></span>
    <i>{isWeb ? 'Disponible' : soon ? 'Etapa siguiente' : 'En camino'}</i>
  </div>;
}

function Reveal({ children, delay = 0, as: Tag = 'div', className = '' }: { children: ReactNode; delay?: number; as?: any; className?: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setInView(true); io.unobserve(el); } }, { threshold: 0.18, rootMargin: '0px 0px -60px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal${inView ? ' is-in' : ''}${className ? ' ' + className : ''}`} style={{ transitionDelay: `${delay}ms` }}>{children}</Tag>;
}

function FeatureGrid({ items }: { items: readonly Feature[] }) {
  return <div className="feature-grid">{items.map((item, index) => <Reveal as="article" className={`feature-card accent-${index + 1}`} key={item.title} delay={index * 70}><div className="icon-box">{item.icon}</div><h3>{item.title}</h3><p>{item.text}</p></Reveal>)}</div>;
}

function ExperienceTabs() {
  const [mode, setMode] = useState<ExperienceMode>('buyer');
  const [expanded, setExpanded] = useState(false);
  const experience = experiences[mode];
  const selectMode = (nextMode: ExperienceMode) => {
    setMode(nextMode);
    setExpanded(false);
    trackEvent('audience_tab', nextMode);
  };

  return <section className={`experience-section experience-${mode}`} id="experiencias">
    <div className="section experience-shell">
      <Reveal as="div" className="section-heading centered"><span className="eyebrow"><Users /> Una plataforma, dos experiencias</span><h2>Compra con menos riesgo. Vende con más control.</h2><p>RepuesTop traduce flujos reales de búsqueda, cotización, pago, despacho y reclamos en una experiencia simple para ambos lados.</p></Reveal>
      <div className="experience-tabs" role="tablist" aria-label="Elige tu experiencia">
        {(Object.keys(experiences) as ExperienceMode[]).map(key => (
          <button 
            key={key} 
            type="button" 
            role="tab" 
            id={`experience-tab-${key}`}
            aria-controls={`experience-panel-${key}`}
            aria-selected={mode === key} 
            className={mode === key ? 'is-active' : ''} 
            onClick={() => selectMode(key)}
          >
            {experiences[key].icon}
            <span>{experiences[key].label}</span>
          </button>
        ))}
      </div>
      <div 
        className="experience-panel" 
        role="tabpanel" 
        id={`experience-panel-${mode}`}
        aria-labelledby={`experience-tab-${mode}`}
        key={mode}
      >
        <div className="experience-content"><span className="eyebrow">{experience.eyebrow}</span><h2>{experience.title}</h2><p>{experience.text}</p><div className="experience-stats">{experience.stats.map(([value, label], i) => <Reveal as="div" key={value} delay={i * 70}><strong>{value}</strong><span>{label}</span></Reveal>)}</div><button className="button experience-cta" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Ver menos' : 'Ver todo lo que ofrece'} <ChevronDown /></button></div>
        <div className="experience-media"><div className="media-glow" /><div className="image-panel"><img src={experience.image} alt={experience.title} /></div><span className="floating-chip chip-top"><Zap /> Flujo real del MVP</span><span className="floating-chip chip-bottom"><BadgeCheck /> Respaldo en cada etapa</span></div>
      </div>
      <div className={`experience-features expandable-content ${expanded ? 'is-expanded' : ''}`} aria-hidden={!expanded}><FeatureGrid items={experience.features} /></div>
    </div>
  </section>;
}

function HeroProofStrip() {
  const proofs = [
    { icon: <Search />, title: 'Patente', text: 'Identifica el vehículo y filtra el catálogo por compatibilidad.' },
    { icon: <ShoppingCart />, title: 'Compra completa', text: 'Carrito multi-tienda, envío por proveedor y boleta o factura.' },
    { icon: <LockKeyhole />, title: 'Pago protegido', text: 'Fondos retenidos 3 días tras la entrega.' },
    { icon: <HeartHandshake />, title: 'Si algo falla', text: 'Reclamo, mediación con evidencia y soporte que responde.' },
  ];
  return <section className="proof-strip" aria-label="Beneficios principales de RepuesTop"><div className="section proof-strip-grid">
    {proofs.map((item, index) => <Reveal as="article" key={item.title} delay={index * 55}><span>{item.icon}</span><div><strong>{item.title}</strong><p>{item.text}</p></div></Reveal>)}
  </div></section>;
}

type InfoMode = 'flow' | 'about' | 'help' | 'privacy';

const infoOptions = {
  flow: { label: 'Cómo funciona', icon: <Zap />, tone: 'cyan' },
  about: { label: 'Nosotros', icon: <HeartHandshake />, tone: 'violet' },
  help: { label: 'Ayuda', icon: <Headphones />, tone: 'coral' },
  privacy: { label: 'Privacidad', icon: <LockKeyhole />, tone: 'lime' },
} as const;

type HelpTopicKey = 'buyers' | 'vendors' | 'orders' | 'payments';

const helpTopics: Record<HelpTopicKey, {
  label: string;
  icon: ReactNode;
  intro: string;
  title: string;
  description: string;
  questions: Array<{ icon: ReactNode; question: string; answer: string }>;
}> = {
  buyers: {
    label: 'Compradores',
    icon: <UserRound />,
    intro: 'Patente, compatibilidad y compra protegida.',
    title: 'Compra repuestos con más seguridad',
    description: 'La plataforma reduce la incertidumbre desde la identificación del vehículo hasta la entrega del repuesto, y deja por escrito el reclamo y la mediación si algo sale mal.',
    questions: [
      {
        icon: <Search />,
        question: '¿Cómo funciona la búsqueda por patente?',
        answer: 'Ingresas la patente y RepuesTop intenta completar automáticamente marca, modelo, año, versión y datos técnicos. Si no se encuentra el vehículo, puedes usar el ingreso manual por marca, modelo, año y versión.',
      },
      {
        icon: <BadgeCheck />,
        question: '¿Cómo ayuda la compatibilidad antes de comprar?',
        answer: 'El catálogo se filtra con la ficha del vehículo seleccionado para mostrar repuestos asociados a ese auto. Así comparas con más contexto y reduces compras equivocadas.',
      },
      {
        icon: <MessageSquareQuote />,
        question: '¿Puedo cotizar si tengo dudas?',
        answer: 'Sí. Puedes abrir un chat con la tienda y recibir una cotización formal con precio unitario, descuento, garantía, disponibilidad, notas y días de vigencia.',
      },
      {
        icon: <LockKeyhole />,
        question: '¿Qué pasa si el repuesto no calza?',
        answer: 'Tras la entrega se activa un periodo de 3 días de protección. Si hay un problema, puedes abrir un reclamo en el Centro de Ayuda y el pedido queda en revisión antes de liberar los fondos.',
      },
    ],
  },
  vendors: {
    label: 'Proveedores',
    icon: <Store />,
    intro: 'Inventario, cotización y ventas trazables.',
    title: 'Convierte tu tienda en proveedor verificado',
    description: 'RepuesTop te ayuda a ordenar stock, responder oportunidades reales y vender con reglas claras.',
    questions: [
      {
        icon: <FileCheck />,
        question: '¿Cómo se verifica una tienda?',
        answer: 'La tienda queda pendiente y cerrada hasta que el equipo de soporte revise documentos como cédula del representante, RUT o inicio de actividades, patente municipal, documento tributario y contrato de adhesión.',
      },
      {
        icon: <FileSpreadsheet />,
        question: '¿Cómo cargo mi catálogo?',
        answer: 'Puedes publicar productos uno a uno con imágenes, compatibilidades y precio, o subir stock de forma masiva mediante planillas Excel/CSV.',
      },
      {
        icon: <Calculator />,
        question: '¿Cómo defino precios sin perder margen?',
        answer: 'La publicación incluye una calculadora de precio sugerido basada en la ganancia neta que quieres obtener, para que publiques con más claridad comercial.',
      },
      {
        icon: <Crown />,
        question: '¿Qué significa ser tienda fundadora?',
        answer: 'Ser tienda fundadora significa entrar en esta primera etapa, vender con una comisión fija del 5% sin importar el valor de la venta y destacar como uno de los primeros comercios que creyó en RepuesTop.',
      },
    ],
  },
  orders: {
    label: 'Pedidos',
    icon: <Package />,
    intro: 'Estados, entrega y reclamos.',
    title: 'Todo el camino del pedido queda trazado',
    description: 'Cada compra avanza con estados claros, opciones de despacho y mecanismos de validación.',
    questions: [
      {
        icon: <Package />,
        question: '¿Cómo reviso el estado de un pedido?',
        answer: 'El timeline muestra estados como Pagado, En preparación, En camino o Listo para retirar, Entregado, En reclamo y Finalizado.',
      },
      {
        icon: <Truck />,
        question: '¿Qué métodos de despacho existen?',
        answer: 'Hay retiro en tienda sin costo con PIN de 6 dígitos, despacho local si comprador y tienda están en la misma comuna, y courier nacional por pagar con empresa y número de seguimiento.',
      },
      {
        icon: <KeyRound />,
        question: '¿Cómo funciona el retiro con PIN?',
        answer: 'Al elegir retiro en tienda, el comprador recibe un PIN único de 6 dígitos. El vendedor lo ingresa al entregar el repuesto para validar la recepción.',
      },
      {
        icon: <Headphones />,
        question: '¿Qué pasa si hay un reclamo?',
        answer: 'El Centro de Ayuda adapta los motivos según el estado del pedido. Si no hay acuerdo, el equipo de soporte puede revisar evidencias y dejar el pedido en disputa con fondos retenidos.',
      },
    ],
  },
  payments: {
    label: 'Pagos',
    icon: <CreditCard />,
    intro: 'Flow, trazabilidad y resguardo.',
    title: 'Pagos integrados con respaldo',
    description: 'RepuesTop integra Flow para dar medios de pago conocidos y mantiene reglas de protección propias durante la entrega.',
    questions: [
      {
        icon: <CreditCard />,
        question: '¿Cómo se protege mi pago?',
        answer: 'El pago se confirma a través de Flow y RepuesTop retiene los fondos 3 días después de la entrega. Si existe un reclamo, el pedido puede quedar en disputa antes de liberar el dinero.',
      },
      {
        icon: <ShieldCheck />,
        question: '¿Qué permite pagar Flow?',
        answer: 'Según la documentación oficial de Flow, Webpay permite pagos con tarjetas de débito, crédito y prepago. Flow también publica más de 30 medios de pago disponibles en Chile.',
      },
      {
        icon: <CircleDollarSign />,
        question: '¿Quién asume las comisiones?',
        answer: 'La comisión comercial de RepuesTop se cobra al proveedor. Los costos de recaudación de Flow dependen de sus condiciones vigentes, por eso la web debe enlazar siempre a sus tarifas oficiales.',
      },
      {
        icon: <ArrowRight />,
        question: '¿Dónde puedo revisar información oficial de Flow?',
        answer: 'Puedes revisar Webpay, métodos de pago, tarifas y reembolsos desde los enlaces oficiales de Flow incluidos en esta sección de pagos.',
      },
    ],
  },
};

function HelpExperience({ onContact }: { onContact: () => void }) {
  const [category, setCategory] = useState<HelpTopicKey>('buyers');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const topic = helpTopics[category];
  useEffect(() => setOpenFaq(0), [category]);
  return <div className="help-experience">
    <div className="help-intro-column">
      <div className="help-title-row"><span className="help-title-icon"><Headphones /></span><div><span className="eyebrow">Ayuda</span><h2>Respuestas rápidas.<br />Personas reales.</h2><p>Orientación para compradores y tiendas en cada etapa de la experiencia.</p></div></div>
      <div className="support-showcase"><div className="support-visual"><span className="support-ring ring-one" /><span className="support-ring ring-two" /><Headphones /><MessageCircle /></div><div className="support-copy"><span>Estamos para ayudarte</span><h3>Nuestro equipo está listo para apoyarte</h3><p>Te ayudamos con compatibilidad, envíos, pagos y pedidos. Hablamos contigo.</p><button type="button" className="support-primary" onClick={onContact} style={{ border: 'none', cursor: 'pointer' }}><MessageCircle /> Contactar soporte <ArrowRight /></button><a className="support-secondary" href={`mailto:${siteConfig.supportEmail}`}><Mail /> Escribir a {siteConfig.supportEmail}</a></div></div>
      <div className="support-benefits"><span><Zap /><div><strong>Respuesta rápida</strong><small>Sin bots ni esperas innecesarias.</small></div></span><span><Users /><div><strong>Soporte humano</strong><small>Personas reales que entienden tu caso.</small></div></span><span><ClipboardCheck /><div><strong>Seguimiento</strong><small>Te acompañamos hasta resolverlo.</small></div></span></div>
    </div>
    <div className="help-faq-column">
      <div className="help-topic-header"><span className="eyebrow">{topic.label}</span><h3>{topic.title}</h3><p>{topic.description}</p></div>
      <div className="help-category-tabs">{(Object.entries(helpTopics) as Array<[HelpTopicKey, typeof topic]>).map(([key, item]) => <button type="button" className={category === key ? 'is-active' : ''} key={item.label} onClick={() => setCategory(key)}>{item.icon}<span>{item.label}</span></button>)}</div>
      <div className="visual-faq-list">
        {topic.questions.map((item, index) => {
          const isOpen = openFaq === index;
          const answerId = `faq-answer-${category}-${index}`;
          return (
            <Reveal as="article" className={isOpen ? 'is-open' : ''} key={item.question} delay={index * 50}>
              <button 
                type="button" 
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() => setOpenFaq(isOpen ? null : index)}
              >
                <span className="faq-icon">{item.icon}</span>
                <strong>{item.question}</strong>
                <ChevronDown />
              </button>
              <div 
                className="visual-faq-answer" 
                id={answerId}
                role="region"
                aria-hidden={!isOpen}
              >
                <p>{item.answer}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
      {category === 'payments' && <div className="flow-official-links" aria-label="Enlaces oficiales de Flow">
        <a href={siteConfig.flowUrls.webpay} target="_blank" rel="noopener noreferrer">Webpay en Flow <ArrowRight /></a>
        <a href={siteConfig.flowUrls.paymentMethods} target="_blank" rel="noopener noreferrer">Métodos de pago <ArrowRight /></a>
        <a href={siteConfig.flowUrls.tariffs} target="_blank" rel="noopener noreferrer">Tarifas vigentes <ArrowRight /></a>
        <a href={siteConfig.flowUrls.refunds} target="_blank" rel="noopener noreferrer">Reembolsos y operación <ArrowRight /></a>
      </div>}
      <div className="help-contact-bar"><span className="contact-question">?</span><div><strong>¿No encuentras lo que buscas?</strong><small>Escríbenos y te ayudamos con gusto.</small></div><button type="button" onClick={onContact} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>Ir a contacto <ArrowRight style={{ width: '16px' }} /></button></div>
    </div>
  </div>;
}

function PrivacyExperience() {
  const [openPrivacy, setOpenPrivacy] = useState<number | null>(0);
  const privacyItems = [
    { icon: <UserRound />, title: 'Datos personales', text: 'Información básica asociada a tu cuenta', detail: 'Incluye datos como nombre, correo y teléfono cuando sean necesarios para identificar tu cuenta, contactarte o prestar soporte. Puedes solicitar su actualización cuando corresponda.' },
    { icon: <CarFront />, title: 'Vehículos guardados', text: 'Datos que facilitan tus futuras búsquedas', detail: 'Puedes guardar información de tus vehículos para agilizar búsquedas y mostrar alternativas más relevantes. Esta información puede modificarse o eliminarse desde tu experiencia.' },
    { icon: <CreditCard />, title: 'Información de pagos', text: 'Referencias necesarias para gestionar compras', detail: 'RepuesTop utiliza únicamente la información necesaria para coordinar y registrar operaciones. Los datos sensibles de pago serán gestionados por proveedores especializados cuando el servicio esté habilitado.' },
    { icon: <MapPin />, title: 'Direcciones', text: 'Datos de envío y facturación que decidas guardar', detail: 'Las direcciones permiten calcular o coordinar entregas y emitir documentos cuando corresponda. Solo se comparten con quienes participan en la operación cuando resulta necesario.' },
    { icon: <MessageCircle />, title: 'Preferencias', text: 'Comunicaciones y configuración de tu experiencia', detail: 'Puedes definir cómo deseas recibir novedades, recordatorios o comunicaciones del servicio. Buscamos ofrecer opciones claras para ajustar estas preferencias.' },
  ];
  return <div className="privacy-experience">
    <div className="privacy-intro-column">
      <div className="privacy-title-row"><span className="privacy-title-icon"><LockKeyhole /></span><div><span className="eyebrow">Privacidad</span><h2>Privacidad y control para cada usuario</h2><p>Cuidamos tu información y te explicamos de forma clara para qué se utiliza.</p></div></div>
      <div className="privacy-commitments"><article><h3>Compromisos</h3><span><BadgeCheck /> Uso transparente de la información</span><span><BadgeCheck /> Acceso cuidado a tu cuenta</span><span><BadgeCheck /> Datos utilizados con un propósito claro</span><span><BadgeCheck /> Soporte para consultas de privacidad</span></article><div className="privacy-signals"><span><ShieldCheck /><strong>Buenas prácticas</strong><small>Medidas acordes al servicio</small></span><span><KeyRound /><strong>Acceso protegido</strong><small>Controles para cuidar tu cuenta</small></span><span><Headphones /><strong>Soporte cercano</strong><small>Canal para resolver tus dudas</small></span></div></div>
      <div className="privacy-priority"><ShieldCheck /> Tu confianza es importante. Mejoramos nuestras medidas de seguridad a medida que evoluciona el servicio.</div>
    </div>
    <div className="privacy-control-panel">
      <div className="privacy-settings"><div className="privacy-panel-title"><span><ShieldCheck /></span><div><h3>Mi privacidad</h3><p>Consulta qué información puede formar parte de tu experiencia.</p></div></div><div className="privacy-item-list">{privacyItems.map((item, index) => <Reveal as="article" className={openPrivacy === index ? 'is-expanded' : ''} key={item.title} delay={index * 50}><button type="button" aria-expanded={openPrivacy === index} onClick={() => setOpenPrivacy(openPrivacy === index ? null : index)}><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.text}</small></div><ChevronDown /></button><div className="privacy-item-detail"><p>{item.detail}</p></div></Reveal>)}</div></div>
      <aside className="privacy-shield-card"><div className="shield-visual"><span className="shield-orbit orbit-one" /><span className="shield-orbit orbit-two" /><ShieldCheck /></div><div className="shield-message"><LockKeyhole /><div><strong>Tu información merece cuidado</strong><p>Aplicamos medidas razonables para limitar accesos indebidos y tratar tus datos de forma responsable.</p></div></div><span className="privacy-status"><BadgeCheck /> Seguridad en mejora continua</span></aside>
    </div>
  </div>;
}

function FlowExperience() {
  const [audience, setAudience] = useState<'buyer' | 'seller'>('buyer');
  const flows = {
    buyer: {
      label: 'Comprador', icon: <ShoppingCart />,
      summary: 'Desde la patente hasta la validación de entrega, cada paso reduce incertidumbre y deja trazabilidad.',
      steps: [
        { icon: <Search />, title: 'Busca por patente', text: 'La plataforma completa la ficha técnica o permite ingreso manual si no encuentra el vehículo.' },
        { icon: <BadgeCheck />, title: 'Compara compatibles', text: 'El catálogo se filtra con la ficha del vehículo para mostrar opciones con más contexto.' },
        { icon: <MessageSquareQuote />, title: 'Cotiza o compra', text: 'Puedes comprar directo o recibir una cotización formal por chat con garantía y vigencia.' },
        { icon: <Truck />, title: 'Elige despacho', text: 'Retiro con PIN, despacho local por comuna o courier nacional por pagar con tracking.' },
        { icon: <CreditCard />, title: 'Paga en tres pasos', text: 'Entrega, documento —boleta o factura— y pago con Flow. El envío se cobra una vez por proveedor.' },
        { icon: <PackageCheck />, title: 'Valida entrega', text: 'El pedido avanza por timeline y mantiene 3 días de resguardo tras recibir el repuesto.' },
      ],
      benefits: [['Menos llamadas', 'Busca sin recorrer tienda por tienda'], ['Menos riesgo', 'Fondos protegidos tras entrega'], ['Más trazabilidad', 'Estados, chat y evidencia en un lugar']] as Array<[string, string]>,
    },
    seller: {
      label: 'Proveedor', icon: <Store />,
      summary: 'Tu tienda entra verificada, publica stock, responde oportunidades y cobra cuando la entrega queda cerrada.',
      steps: [
        { icon: <FileCheck />, title: 'Postula y verifica', text: 'Sube documentos; soporte revisa y abre la tienda cuando queda aprobada.' },
        { icon: <FileSpreadsheet />, title: 'Carga catálogo', text: 'Publica manualmente o importa stock masivo con Excel/CSV y compatibilidades.' },
        { icon: <MessageSquareQuote />, title: 'Cotiza en chat', text: 'Envía ofertas formales con precio final, descuento, garantía y tiempo de entrega.' },
        { icon: <ClipboardCheck />, title: 'Gestiona pedidos', text: 'Prepara, marca listo para retiro o ingresa datos de courier y tracking.' },
        { icon: <KeyRound />, title: 'Valida entrega', text: 'Ingresa el PIN del comprador cuando retira en tienda o registra el despacho realizado.' },
        { icon: <CircleDollarSign />, title: 'Libera fondos', text: 'Tras 3 días desde la entrega, o cierre anticipado del comprador, el pago queda listo para cobro.' },
      ],
      benefits: [['Dashboard 2x2', 'Ganancias, pedidos y ventas visibles'], ['Control local', 'Retiro, comuna y courier configurables'], ['Tienda fundadora', 'Reconocimiento por entrar temprano']] as Array<[string, string]>,
    },
  } as const;
  const deliveryOptions = [
    { icon: <KeyRound />, title: 'Retiro en tienda', text: 'Costo $0 y entrega validada con PIN de 6 dígitos.' },
    { icon: <MapPin />, title: 'Despacho local', text: 'Disponible solo si comprador y tienda comparten comuna.' },
    { icon: <Truck />, title: 'Courier nacional', text: 'Modalidad por pagar con empresa y número de seguimiento.' },
  ];
  const orderStates = ['Pagado', 'En preparación', 'En camino / Listo para retirar', 'Entregado', 'En reclamo', 'Finalizado'];
  const trustSignals = [
    { icon: <LockKeyhole />, title: '3 días de resguardo', text: 'El pago no se libera inmediatamente tras entregar.' },
    { icon: <Headphones />, title: 'Mediación con evidencia', text: 'Si comprador y proveedor no resuelven, un mediador revisa la evidencia de ambos lados con los fondos retenidos.' },
    { icon: <ShieldCheck />, title: 'Suspensión preventiva', text: 'Cuentas infractoras pueden bloquearse en tiempo real.' },
  ];
  const flow = flows[audience];
  return <div className="flow-experience">
    <div className="flow-intro-column">
      <div className="flow-title-row"><span className="flow-title-icon"><Zap /></span><div><span className="eyebrow">Cómo funciona</span><h2>El repuesto correcto. La venta correcta.</h2><p>RepuesTop conecta búsqueda por patente, catálogo compatible, cotización, pago, despacho y reclamos en un flujo diseñado para el mercado chileno.</p></div></div>
      <div className="flow-problem-card"><span className="flow-problem-icon"><Search /></span><div><strong>El problema que resolvemos</strong><p>Comprar repuestos suele depender de llamadas, fotos sueltas y confianza informal. RepuesTop ordena la información del vehículo, valida tiendas y deja registro de la compra.</p></div></div>
      <div className="flow-visual web-preview-visual"><span><Monitor /> Versión web disponible</span><img src="/about-assets/repuestop-web-home.png" alt="Marketplace web de RepuesTop disponible desde computadores" /></div>
      <div className="trust-signal-grid">{trustSignals.map((item, index) => <Reveal as="article" key={item.title} delay={index * 60}><span>{item.icon}</span><div><strong>{item.title}</strong><p>{item.text}</p></div></Reveal>)}</div>
    </div>
    <div className="flow-content-column">
      <div className="flow-audience-tabs" role="tablist" aria-label="Cómo funciona para cada perfil">
        {(Object.keys(flows) as Array<'buyer' | 'seller'>).map(key => <button type="button" role="tab" aria-selected={audience === key} className={audience === key ? 'is-active' : ''} key={key} onClick={() => setAudience(key)}>{flows[key].icon}<span>{flows[key].label}</span></button>)}
      </div>
      <p className="flow-summary">{flow.summary}</p>
      <div className="flow-steps-grid">{flow.steps.map((step, i) => <Reveal as="article" key={step.title} delay={i * 60}><b>{i + 1}</b><span className="flow-step-icon">{step.icon}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></Reveal>)}</div>
      <div className="flow-benefit-row">{flow.benefits.map(([title, text]) => <span key={title}><strong>{title}</strong><small>{text}</small></span>)}</div>
      <div className="delivery-grid">{deliveryOptions.map((item, index) => <Reveal as="article" key={item.title} delay={index * 55}><span>{item.icon}</span><strong>{item.title}</strong><p>{item.text}</p></Reveal>)}</div>
      <div className="order-state-strip" aria-label="Estados del pedido">{orderStates.map(state => <span key={state}>{state}</span>)}</div>
    </div>
  </div>;
}

function AboutExperience() {
  const problems = [
    { icon: <Boxes />, title: 'Inventario disperso y poco visible', text: 'Muchas tiendas de repuestos no tienen presencia digital ni forma de mostrar lo que realmente tienen disponible.' },
    { icon: <Search />, title: 'Encontrar el repuesto correcto es difícil', text: 'Compatibilidad, marcas, versiones y años generan errores de compra y pérdida de tiempo para personas y talleres.' },
    { icon: <MessageSquareQuote />, title: 'Cotizar y negociar toma demasiado tiempo', text: 'Llamadas, mensajes y visitas presenciales que podrían resolverse desde una sola plataforma.' },
  ];
  const approach = [
    { icon: <Search />, title: 'Claridad', text: 'Información técnica y de compatibilidad fácil de entender, sin letra chica.' },
    { icon: <ShieldCheck />, title: 'Confianza', text: 'Tiendas verificadas y reglas claras para comprador y vendedor.' },
    { icon: <Users />, title: 'Conexión', text: 'Acercamos inventario real a quienes realmente lo necesitan.' },
    { icon: <Smartphone />, title: 'Simplicidad', text: 'Una experiencia pensada para resolver en minutos, no en días.' },
  ];
  return <div className="about-experience">
    <div className="about-intro-column">
      <div className="about-title-row"><span className="about-title-icon"><HeartHandshake /></span><div><span className="eyebrow">Nosotros</span><h2>Ingenieros resolviendo problemas reales del rubro automotriz</h2><p>Somos un equipo de ingenieros que construye soluciones tecnológicas para ordenar y modernizar el mercado de repuestos y servicios mecánicos en Chile.</p></div></div>
      <div className="about-photo-panel"><img src="/about-assets/nosotros.jpg" alt="Equipo RepuesTop conectando personas y tiendas" /></div>
      <div className="about-mission-card"><span className="about-mission-icon"><ShieldCheck /></span><div><strong>Nuestra misión</strong><p>Usar ingeniería y tecnología para que comprar y vender repuestos sea rápido, confiable y transparente para todos.</p></div></div>
      <div className="chile-strip"><MapPin /><span><strong>Creado en Chile</strong><small>Para el mercado automotriz local</small></span><i>CL</i></div>
    </div>
    <div className="about-content-column">
      <div className="about-section-block">
        <h3>El problema que buscamos resolver</h3>
        <div className="about-problem-list">{problems.map((item, i) => <Reveal as="article" key={item.title} delay={i * 60}><span>{item.icon}</span><div><strong>{item.title}</strong><p>{item.text}</p></div></Reveal>)}</div>
      </div>
      <div className="about-section-block">
        <h3>Cómo lo resolvemos</h3>
        <div className="about-values-grid">
          {approach.map((item, i) => <Reveal as="article" key={item.title} delay={i * 60}><span>{item.icon}</span><strong>{item.title}</strong><p>{item.text}</p></Reveal>)}
        </div>
      </div>
    </div>
  </div>;
}

function InfoHub({ mode, setMode, onContact }: { mode: InfoMode; setMode: (mode: InfoMode) => void; onContact: () => void; }) {
  const option = infoOptions[mode];
  return <section className={`info-hub hub-${option.tone}`} id="como-funciona"><div className="section">
    <Reveal as="div" className="matrix-heading centered"><span className="eyebrow"><MapPin /> Conoce RepuesTop</span><h2>Todo lo importante, a un toque</h2><p>Selecciona una categoría para explorar toda su información.</p></Reveal>
    <div className="info-icon-tabs" role="tablist" aria-label="Información de RepuesTop">
      {(Object.keys(infoOptions) as InfoMode[]).map(key => (
        <button 
          type="button" 
          role="tab" 
          id={`info-tab-${key}`}
          aria-controls={`info-panel-${key}`}
          aria-selected={mode === key} 
          className={`info-icon-tab tab-${infoOptions[key].tone} ${mode === key ? 'is-active' : ''}`} 
          key={key} 
          onClick={() => setMode(key)}
        >
          <span>{infoOptions[key].icon}</span>
          <strong>{infoOptions[key].label}</strong>
          <i />
        </button>
      ))}
    </div>
    <div 
      className="info-detail-panel" 
      role="tabpanel" 
      id={`info-panel-${mode}`}
      aria-labelledby={`info-tab-${mode}`}
      key={mode}
    >
      {mode === 'flow' && <FlowExperience />}
      {mode === 'about' && <AboutExperience />}
      {mode === 'help' && <HelpExperience onContact={onContact} />}
      {mode === 'privacy' && <PrivacyExperience />}
    </div>
  </div></section>;
}

function FounderSection({ onOpenSeller }: { onOpenSeller: () => void }) {
  const founderBenefits = [
    { icon: <CircleDollarSign />, title: '5% fijo fundador', text: 'Comisión fija para tiendas fundadoras, sin importar el valor de cada venta.' },
    { icon: <Crown />, title: 'Reconocimiento fundador', text: 'Distintivo para destacar a los comercios que creyeron temprano en RepuesTop.' },
    { icon: <FileSpreadsheet />, title: 'Carga masiva preparada', text: 'Soporte para ordenar inventario con planillas Excel/CSV cuando comience la operación.' },
    { icon: <Calculator />, title: 'Precio con margen', text: 'Calculadora para publicar pensando en ganancia neta.' },
  ];
  const verificationSteps = [
    'Sube documentos de la tienda',
    'Soporte revisa y observa si falta algo',
    'Tienda aprobada aparece como verificada',
  ];
  return <section className="founder-section" id="proveedores">
    <div className="section founder-shell">
      <Reveal as="div" className="founder-copy">
        <span className="eyebrow"><Crown /> Campaña proveedores</span>
        <h2>Sé parte de las tiendas fundadoras de RepuesTop</h2>
        <p>Estamos convocando a los primeros comercios que quieran sumarse a esta etapa fundadora: tiendas reales, verificadas y protagonistas de una nueva forma de vender repuestos en Chile, con 5% fijo de comisión como beneficio fundador.</p>
        <div className="founder-actions">
          <button type="button" className="button" onClick={onOpenSeller} style={{ cursor: 'pointer' }}><Crown /> Quiero ser tienda fundadora</button>
          <a className="button button-outline" href="#como-funciona">Ver cómo vender <ArrowRight /></a>
        </div>
      </Reveal>
      <div className="founder-benefit-grid">
        {founderBenefits.map((item, index) => <Reveal as="article" key={item.title} delay={index * 70}><span>{item.icon}</span><h3>{item.title}</h3><p>{item.text}</p></Reveal>)}
      </div>
      <Reveal as="aside" className="verification-card">
        <span className="verification-icon"><FileCheck /></span>
        <div>
          <span className="eyebrow">Tienda verificada</span>
          <h3>La tienda no se abre hasta ser aprobada</h3>
          <p>El proveedor sube documentación comercial y tributaria. Si todo está correcto, el equipo de soporte aprueba la cuenta y activa la tienda al público.</p>
          <div className="verification-steps">{verificationSteps.map((step, index) => <span key={step}><b>{index + 1}</b>{step}</span>)}</div>
        </div>
      </Reveal>
    </div>
  </section>;
}

function FinalStage({ onContact, onOpenSeller, onBack }: { onContact: () => void; onOpenSeller: () => void; onBack: () => void; }) {
  const buyerHighlights = [
    { icon: <Search />, label: 'Patente inteligente', text: 'Ficha del vehículo en segundos' },
    { icon: <BadgeCheck />, label: 'Catálogo compatible', text: 'Opciones filtradas por vehículo' },
    { icon: <ShieldCheck />, label: '3 días protegidos', text: 'Fondos retenidos tras entrega' },
    { icon: <Truck />, label: 'Despacho trazable', text: 'PIN, comuna o courier con tracking' },
  ];
  const sellerHighlights = [
    { icon: <Crown />, label: '5% fundador', text: 'Comisión fija sin importar la venta' },
    { icon: <FileSpreadsheet />, label: 'Excel/CSV', text: 'Carga masiva de inventario' },
    { icon: <ClipboardCheck />, label: 'Dashboard 2x2', text: 'Ganancias y pedidos visibles' },
    { icon: <MessageSquareQuote />, label: 'Cotizaciones', text: 'Ofertas formales por chat' },
  ];

  return <section className="final-stage" id="descargar">
    <div className="section final-stage-shell">
      <Reveal as="div" className="final-stage-heading">
        <span className="eyebrow"><Monitor /> Marketplace web operativo · App móvil en desarrollo</span>
        <h2>Empieza hoy en la web. La app llega con lo mismo.</h2>
        <p>El marketplace web está completo: catálogo por patente, cotizaciones por chat, carrito multi-tienda, checkout con boleta o factura, seguimiento del pedido y mediación si algo falla. La app móvil suma lo que solo el teléfono puede dar: avisos push cuando tu pedido avanza y la cámara para publicar sin pasar por el computador.</p>
      </Reveal>

      <div className="final-stage-grid">
        <article className="final-route-card route-buyer">
          <span className="route-icon"><Search /></span>
          <div>
            <h3>Soy comprador</h3>
            <p>Busca por patente, cotiza por chat, paga con Flow y sigue tu pedido hasta validar la entrega.</p>
          </div>
          <div className="route-mini-grid">
            {buyerHighlights.map((item, i) => <Reveal as="span" key={item.label} delay={i * 60}><i>{item.icon}</i><strong>{item.label}</strong><small>{item.text}</small></Reveal>)}
          </div>
          <div className="route-actions">
            <button type="button" className="button button-white" onClick={onBack}>Entrar al marketplace web <ArrowRight /></button>
            <button type="button" className="button button-ghost route-dark" onClick={onContact} style={{ cursor: 'pointer' }}>
              <Smartphone /> Avísame cuando llegue la app
            </button>
          </div>
        </article>

        <div className="final-device-stage final-platform-stage">
          <img src="/about-assets/repuestop-web-mobile-hero.png" alt="RepuesTop, marketplace web operativo y app móvil en desarrollo" />
          <span className="floating-chip chip-search"><Monitor /> Web operativa</span>
          <span className="floating-chip chip-store"><Smartphone /> App en desarrollo</span>
        </div>

        <article className="final-route-card route-seller">
          <span className="route-icon"><Store /></span>
          <div>
            <h3>Soy vendedor</h3>
            <p>Postula a la etapa fundadora, verifica tu tienda, carga inventario y vende desde la web con 5% fijo de comisión.</p>
          </div>
          <div className="route-mini-grid">
            {sellerHighlights.map((item, i) => <Reveal as="span" key={item.label} delay={i * 60}><i>{item.icon}</i><strong>{item.label}</strong><small>{item.text}</small></Reveal>)}
          </div>
          <div className="route-actions">
            <button type="button" className="button button-white" onClick={onOpenSeller}>Quiero ser tienda fundadora <ArrowRight /></button>
            <button type="button" className="button button-ghost route-dark" onClick={onContact} style={{ cursor: 'pointer' }}><MessageCircle /> Hablar con el equipo</button>
          </div>
        </article>
      </div>

      <div className="final-benefits">
        <Reveal as="span"><ShieldCheck /><div><strong>Tiendas verificadas</strong><small>Soporte revisa documentos antes de vender.</small></div></Reveal>
        <Reveal as="span" delay={70}><PackageCheck /><div><strong>Compatibilidad filtrada</strong><small>El vehículo guía la búsqueda de repuestos.</small></div></Reveal>
        <Reveal as="span" delay={140}><Headphones /><div><strong>Soporte y reclamos</strong><small>Disputas con evidencia y fondos retenidos.</small></div></Reveal>
        <Reveal as="span" delay={210}><LockKeyhole /><div><strong>Pago protegido</strong><small>Flow más resguardo de 3 días tras entrega.</small></div></Reveal>
      </div>
    </div>
  </section>;
}

function HeroLiveBadge() {
  const items = [
    { icon: <Search />, text: 'Patente identifica tu vehículo' },
    { icon: <BadgeCheck />, text: 'Catálogo filtrado por compatibilidad' },
    { icon: <LockKeyhole />, text: 'Pago protegido por 3 días' },
    { icon: <PackageCheck />, text: 'Pedido con timeline y reclamos' },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI(v => (v + 1) % items.length), 2600);
    return () => clearInterval(id);
  }, []);
  const current = items[i];
  return <div className="hero-badge hero-badge-live"><span className="hero-badge-dot" /><span className="hero-badge-icon" key={`icon-${i}`}>{current.icon}</span><span className="hero-badge-text" key={`text-${i}`}>{current.text}</span></div>;
}

function HomePage({ onContact, onOpenSeller, onBack }: { onContact: () => void; onOpenSeller: () => void; onBack: () => void }) {
  usePageMeta();
  const [infoMode, setInfoMode] = useState<InfoMode>('flow');
  const [founderModalOpen, setFounderModalOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setFounderModalOpen(true);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return <>
    <FounderModal isOpen={founderModalOpen} onClose={() => setFounderModalOpen(false)} onApply={onOpenSeller} />
    <main className="single-page">
    <section className="home-hero section" id="inicio"><div className="hero-mesh" aria-hidden="true" /><div className="hero-orb orb-one" /><div className="hero-orb orb-two" /><div className="hero-copy"><div className="hero-topline"><Brand /><span className="hero-topline-divider" aria-hidden="true" /><span className="eyebrow hero-eyebrow"><Monitor /> Marketplace web operativo · App móvil en desarrollo</span></div><h1>De la patente a la puerta de tu casa, con <em>respaldo</em> en cada paso.</h1><p>El marketplace web ya está operativo de punta a punta: buscas por patente, cotizas por chat, compras a varias tiendas en un solo carrito, pagas con Flow y sigues el pedido hasta la entrega. La app móvil viene con lo mismo, en el bolsillo.</p><div className="button-row"><button type="button" className="button" onClick={onBack}><Monitor /> Entrar al marketplace web</button><a href="#proveedores" className="button button-outline">Ser tienda fundadora <ArrowDown /></a></div><div className="hero-platforms"><PlatformPill platform="web" /><PlatformPill platform="android" /><PlatformPill platform="ios" soon /></div></div><div className="hero-visual"><HeroLiveBadge /><div className="image-panel"><img src="/about-assets/repuestop-web-mobile-hero.png" alt="RepuesTop, marketplace web operativo y app móvil en desarrollo" /><div className="scan-sweep" aria-hidden="true" /></div></div></section>

    <HeroProofStrip />

    <ExperienceTabs />

    <InfoHub mode={infoMode} setMode={setInfoMode} onContact={onContact} />

    <FounderSection onOpenSeller={onOpenSeller} />

    <FinalStage onContact={onContact} onOpenSeller={onOpenSeller} onBack={onBack} />
  </main></>;
}

export default function AboutRepuesTopPage({ onContact, onOpenSeller, onBack }: { onContact: () => void; onOpenSeller: () => void; onBack: () => void }) {
  return <div className="repuestop-about-page"><HomePage onContact={onContact} onOpenSeller={onOpenSeller} onBack={onBack} /></div>;
}
