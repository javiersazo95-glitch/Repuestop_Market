import { useEffect, useRef, useState, type ReactNode } from 'react';
import FounderModal from './FounderModal';
import '../about-repuestop.css';
import {
  Search, ShieldCheck, Smartphone, Store, CreditCard, MessageSquareQuote,
  Users, Wrench, Truck, FileCheck, Crown, ArrowRight, ChevronDown,
  CheckCircle2, LockKeyhole, MapPin, Receipt,
  ShoppingBag, PackageCheck, Sparkles, Clock, X, Zap,
  Award, Download, Check, AlertCircle, Headphones,
  Layers, MessageCircle, RefreshCw, Eye
} from 'lucide-react';

interface AboutRepuesTopPageProps {
  onBack: () => void;
  onContact: () => void;
  onOpenSeller: () => void;
  onOpenCatalog?: () => void;
  onOpenStores?: () => void;
  onOpenAdsWall?: () => void;
}

// -------------------------------------------------------------
// Componentes Auxiliares e Iconos Oficiales
// -------------------------------------------------------------

function AndroidLogoSvg() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M7.4 5.3 5.9 2.8a.7.7 0 0 1 1.2-.7l1.6 2.6a9 9 0 0 1 6.6 0l1.6-2.6a.7.7 0 1 1 1.2.7l-1.5 2.5A7.2 7.2 0 0 1 20 11H4a7.2 7.2 0 0 1 3.4-5.7ZM8 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM4 12h16v7a2 2 0 0 1-2 2h-1v1.3a1 1 0 1 1-2 0V21H9v1.3a1 1 0 1 1-2 0V21H6a2 2 0 0 1-2-2v-7Z" />
    </svg>
  );
}

function GooglePlaySvg() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M3.6 2.5a1.5 1.5 0 0 0-.4 1.1v16.8c0 .4.2.8.4 1.1l9.6-9.5-9.6-9.5Z" fill="#2196F3" />
      <path d="M16.4 8.7 13.2 12l3.2 3.3 3.6-2c1-.6 1-1.6 0-2.2l-3.6-2.4Z" fill="#FFC107" />
      <path d="M3.6 21.5c.5.5 1.4.6 2.2.1l10.6-6.1-3.2-3.5-9.6 9.5Z" fill="#4CAF50" />
      <path d="M16.4 8.7 5.8 2.6c-.8-.5-1.7-.4-2.2.1l9.6 9.3 3.2-3.3Z" fill="#F44336" />
    </svg>
  );
}

function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  as?: any;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal${inView ? ' is-in' : ''}${className ? ' ' + className : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

// -------------------------------------------------------------
// 1. Hero & Ticker Dinámico
// -------------------------------------------------------------

function HeroLiveTicker() {
  const tickerItems = [
    { icon: <Search size={15} />, text: 'Búsqueda exacta por Patente chilena (modelos 2000 a 2026)' },
    { icon: <Store size={15} />, text: 'Conecta con cientos de casas de repuestos verificadas' },
    { icon: <CreditCard size={15} />, text: 'Paga en cuotas sin interés con Webpay y Flow' },
    { icon: <ShieldCheck size={15} />, text: '3 días de fondos protegidos tras la entrega para probar tu repuesto' },
    { icon: <MessageSquareQuote size={15} />, text: 'Cotizaciones formales y chat en vivo con los vendedores' },
    { icon: <Truck size={15} />, text: 'Retiro en tienda con PIN $0 o despacho con seguimiento a todo Chile' },
    { icon: <Users size={15} />, text: 'Equipo de mediación que te apoya si una pieza no calza o falla' },
    { icon: <Wrench size={15} />, text: 'Mural público de talleres mecánicos, scanner y mantenciones' },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tickerItems.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [tickerItems.length]);

  const current = tickerItems[currentIndex];

  return (
    <div className="hero-ticker-pill" aria-live="polite">
      <span className="ticker-pulse-dot" />
      <span className="ticker-icon" key={`icon-${currentIndex}`}>
        {current.icon}
      </span>
      <span className="ticker-text" key={`text-${currentIndex}`}>
        {current.text}
      </span>
    </div>
  );
}

// -------------------------------------------------------------
// Modal de Información de App Móvil
// -------------------------------------------------------------

function AndroidDownloadModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="app-download-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="app-download-modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Cerrar modal">
          <X size={20} />
        </button>
        <div className="modal-icon-badge">
          <AndroidLogoSvg />
        </div>
        <span className="modal-eyebrow">Próximamente para Android</span>
        <h2>La app de RepuesTop está en camino</h2>
        <p>
          Mientras se publica en Google Play Store, puedes usar exactamente las mismas funciones
          desde la plataforma web en tu computador o en el navegador de tu celular: buscar por patente,
          cotizar con tiendas, pagar seguro y retirar con tu PIN, sin instalar nada.
        </p>

        <div className="modal-app-details">
          <div className="app-detail-item">
            <strong>Nombre oficial</strong>
            <span>RepuesTop: Repuestos por Patente</span>
          </div>
          <div className="app-detail-item">
            <strong>Compatibilidad</strong>
            <span>Para cualquier teléfono Android</span>
          </div>
          <div className="app-detail-item">
            <strong>Plataforma oficial</strong>
            <span>RepuesTop Chile</span>
          </div>
          <div className="app-detail-item">
            <strong>Mientras tanto</strong>
            <span>Web 100% disponible en tu computador o celular</span>
          </div>
        </div>

        <div className="modal-actions-row">
          <button type="button" className="button button-outline" onClick={onClose}>
            Continuar en la Web
          </button>
        </div>

        <div className="modal-ios-note">
          <Clock size={14} />
          <span>La plataforma web cubre todas las funciones para compradores y casas de repuestos desde cualquier dispositivo.</span>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 2. Componente Principal
// -------------------------------------------------------------

export default function AboutRepuesTopPage({
  onBack,
  onContact,
  onOpenSeller,
  onOpenCatalog,
  onOpenStores,
  onOpenAdsWall,
}: AboutRepuesTopPageProps) {
  // Estados de modales y tabs interactivos
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [founderModalOpen, setFounderModalOpen] = useState(false);
  const [audienceTab, setAudienceTab] = useState<'buyer' | 'seller'>('buyer');
  const [activeGalleryId, setActiveGalleryId] = useState<'stores' | 'services' | 'quotes' | 'qa' | 'orders' | 'mediation' | 'reports' | 'logistics'>('stores');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  // Apertura sutil del modal de bienvenida a proveedores fundadores a los 2.8s
  useEffect(() => {
    const timer = setTimeout(() => {
      const seen = sessionStorage.getItem('repuestop_founder_about_seen');
      if (!seen) {
        setFounderModalOpen(true);
        sessionStorage.setItem('repuestop_founder_about_seen', 'true');
      }
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  // Metadatos SEO de la página
  useEffect(() => {
    document.title = 'Sobre RepuesTop | Marketplace Automotriz Chileno';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Conoce RepuesTop: Búsqueda por patente chilena sin margen de error, compra protegida, cuotas sin interés, cotizaciones por chat y casas de repuestos verificadas.'
      );
    }
  }, []);

  // Navegación asistida
  const handleCatalog = onOpenCatalog || onBack;
  const handleStores = onOpenStores || onBack;
  const handleAdsWall = onOpenAdsWall || onBack;

  // -------------------------------------------------------------
  // Data: Las 12 Grandes Ventajas Comerciales
  // -------------------------------------------------------------
  const commercialAdvantages = [
    {
      id: 1,
      icon: <Search className="feat-ico-blue" />,
      title: 'Búsqueda por Patente de Alta Precisión',
      badge: 'Cero errores',
      desc: 'Ingresas la patente de tu auto y el sistema identifica de inmediato marca, modelo, año, motor y versión según los registros oficiales del SII (desde el 2000 al 2026), para que solo veas repuestos que realmente le sirven a tu vehículo.',
      benefit: 'Ahorras tiempo y compras con la seguridad de que el repuesto va a calzar.',
    },
    {
      id: 2,
      icon: <Store className="feat-ico-violet" />,
      title: 'Cientos de Casas de Repuestos en un Solo Lugar',
      badge: 'Todo Chile',
      desc: 'Reunimos a las mejores casas de repuestos del país en una sola vitrina: piezas originales de fábrica y alternativas de primera calidad con stock real y garantía.',
      benefit: 'Cotiza y compara precios al instante sin tener que recorrer tienda por tienda.',
    },
    {
      id: 3,
      icon: <CreditCard className="feat-ico-emerald" />,
      title: 'Paga en Cuotas Sin Interés y Medios Seguros',
      badge: 'Webpay y Flow',
      desc: 'Aceptamos tarjetas de crédito en cuotas sin interés, tarjetas de débito, Mach, Tenpo y transferencias seguras, con boleta o factura oficial para tu compra.',
      benefit: 'Paga de forma cómoda y protegida por la principal pasarela de pagos de Chile.',
    },
    {
      id: 4,
      icon: <MessageSquareQuote className="feat-ico-cyan" />,
      title: 'Cotizaciones Formales por Chat en Vivo',
      badge: 'Trato directo',
      desc: 'Conversa directamente con la casa de repuestos, pide fotos de la pieza y recibe una cotización clara con precio final, garantía y botón para pagar directamente.',
      benefit: 'Atención personalizada y respaldo por escrito de cada precio y condición.',
    },
    {
      id: 5,
      icon: <HelpCircleIcon className="feat-ico-amber" />,
      title: 'Preguntas y Respuestas sobre el Repuesto',
      badge: 'Comunidad',
      desc: '¿Tienes dudas sobre el lado, conector o modelo? Pregunta en la publicación del repuesto; la tienda te responde y la respuesta queda visible para todos los conductores.',
      benefit: 'Compras con total claridad y resuelves cualquier duda antes de pagar.',
    },
    {
      id: 6,
      icon: <Truck className="feat-ico-orange" />,
      title: 'Diferentes Opciones de Envío y Entrega',
      badge: 'Retiro $0 o despacho',
      desc: 'Elige retirar en el local de la casa de repuestos sin costo con tu código de seguridad, pedir despacho local rápido si estás en la misma comuna o envío a todo Chile por courier con seguimiento.',
      benefit: 'Tú eliges cómo y cuándo recibir tus piezas de la forma más conveniente.',
    },
    {
      id: 7,
      icon: <LockKeyhole className="feat-ico-green" />,
      title: 'Pago Protegido (3 Días de Resguardo)',
      badge: 'Garantía total',
      desc: 'Tu dinero no se entrega a la tienda hasta 3 días después de que recibes el repuesto. Así tienes tiempo suficiente para probarlo en tu auto o en el taller mecánico.',
      benefit: 'Tu compra está 100% protegida; si no es lo que pediste, tu dinero está a salvo.',
    },
    {
      id: 8,
      icon: <ShieldCheck className="feat-ico-indigo" />,
      title: 'Equipo de Mediación en Caso de Problemas',
      badge: 'Personas reales',
      desc: 'Si una pieza viene con fallas o no calza y no llegas a acuerdo con la tienda, una persona de nuestro equipo interviene, revisa las fotos y gestiona la solución o la devolución de tu dinero.',
      benefit: 'Nunca quedas solo: resolvemos cualquier problema de forma justa y rápida.',
    },
    {
      id: 9,
      icon: <Users className="feat-ico-teal" />,
      title: 'Apoyo de Captadores de Repuestos',
      badge: 'Búsqueda asistida',
      desc: '¿Buscas una pieza difícil de encontrar o descontinuada? Nuestro equipo de captadores te ayuda a rastrearla directamente consultando con casas de repuestos de todo el país.',
      benefit: 'Encontramos ese repuesto que te ha costado conseguir en el mercado.',
    },
    {
      id: 10,
      icon: <Wrench className="feat-ico-rose" />,
      title: 'Mural Público de Servicios Mecánicos',
      badge: 'Talleres y mecánicos',
      desc: 'Encuentra talleres mecánicos, especialistas en scanner, frenos, desabolladura y mantenciones por comuna, con reseñas reales de clientes y opción de agendar tu hora.',
      benefit: 'El mecánico o taller ideal para instalar los repuestos que compraste.',
    },
    {
      id: 11,
      icon: <AlertCircle className="feat-ico-red" />,
      title: 'Sistema de Reportes y Tiendas Verificadas',
      badge: 'Comunidad segura',
      desc: 'Todas las casas de repuestos pasan por revisión de documentos comerciales. Además, los usuarios pueden reportar cualquier publicación irregular para mantener un mercado confiable.',
      benefit: 'Compras con total tranquilidad en tiendas reales y establecidas.',
    },
    {
      id: 12,
      icon: <Layers className="feat-ico-blue2" />,
      title: 'Equipo de Ingenieros Trabajando para Ti',
      badge: 'Mejora continua',
      desc: 'Un equipo de ingenieros chilenos trabaja todos los días en la plataforma para que funcione de forma rápida, segura y sin interrupciones, pensando siempre en tu satisfacción.',
      benefit: 'Una plataforma moderna, estable y en constante evolución.',
    },
  ];

  // -------------------------------------------------------------
  // Data: Galería Interactiva con Capturas Reales
  // -------------------------------------------------------------
  const galleryItems = {
    stores: {
      title: 'Directorio de Casas de Repuestos',
      tag: 'Locales Verificados',
      desc: 'Encuentra locales comerciales de repuestos con su dirección exacta, horarios de atención, teléfonos, reputación y disponibilidad de piezas para retiro o despacho.',
      image: '/about-assets/tiendas-real.png',
      isReal: true,
      actionText: 'Ver casas de repuestos',
      onAction: handleStores,
    },
    services: {
      title: 'Mural de Servicios Automotrices',
      tag: 'Talleres y Mecánicos',
      desc: 'Conecta con mecánicos profesionales y talleres para scanner, frenos, mantenciones y reparaciones, revisando su experiencia y agendando tu atención.',
      image: '/about-assets/mural-real.png',
      isReal: true,
      actionText: 'Ver mural de servicios',
      onAction: handleAdsWall,
    },
    quotes: {
      title: 'Catálogo y Cotizaciones Formales',
      tag: 'Trato Directo',
      desc: 'Busca por patente o categoría y recibe ofertas directas de los vendedores con precio neto, descuento, garantía y botón directo para pagar con Flow.',
      image: '/about-assets/catalogo-real.png',
      isReal: true,
      actionText: 'Ir a buscar y cotizar',
      onAction: handleCatalog,
    },
    qa: {
      title: 'Preguntas y Respuestas Técnicas',
      tag: 'Transparencia',
      desc: 'Consulta dudas específicas de compatibilidad antes de pagar. El vendedor recibe alerta inmediata y la respuesta queda registrada públicamente.',
      image: '/about-assets/qa-real.png',
      isReal: true,
      actionText: 'Explorar catálogo',
      onAction: handleCatalog,
    },
    orders: {
      title: 'Seguimiento Paso a Paso de tu Pedido',
      tag: 'Control Total',
      desc: 'Revisa en qué etapa está tu compra: Pagado, En preparación, Listo para retirar con tu PIN de seguridad o En camino con empresa de despacho y número de seguimiento.',
      image: '/about-assets/orders-hero-v2.png',
      isReal: false,
      actionText: 'Comprar con respaldo',
      onAction: handleCatalog,
    },
    mediation: {
      title: 'Equipo de Mediación Imparcial',
      tag: 'Resolución de Problemas',
      desc: 'Si una pieza presenta problemas o no calza, una persona de nuestro equipo revisa las fotos y antecedentes para resolver de forma justa con tus fondos protegidos.',
      image: '/about-assets/mediator-profile.webp',
      isReal: false,
      actionText: 'Conocer centro de ayuda',
      onAction: onContact,
    },
    reports: {
      title: 'Centro de Soporte y Seguridad',
      tag: 'Atención y Respaldo',
      desc: 'Atención personalizada con personas reales para responder tus consultas y revisar reportes de la comunidad para que compres con total tranquilidad.',
      image: '/about-assets/soporte-real.png',
      isReal: true,
      actionText: 'Contactar a soporte',
      onAction: onContact,
    },
    logistics: {
      title: 'Entregas y Despachos a Todo Chile',
      tag: 'Opciones Cómodas',
      desc: 'Retiro en el local de la tienda sin costo con código PIN seguro, despacho local rápido o envío por courier a cualquier ciudad del país.',
      image: '/about-assets/delivery-truck.webp',
      isReal: false,
      actionText: 'Buscar repuestos ahora',
      onAction: handleCatalog,
    },
  } as const;

  const currentGallery = galleryItems[activeGalleryId];

  // -------------------------------------------------------------
  // Data: Preguntas Frecuentes
  // -------------------------------------------------------------
  const faqs = [
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

  return (
    <div className="repuestop-about-page">
      {/* Modales Interactivos */}
      <FounderModal
        isOpen={founderModalOpen}
        onClose={() => setFounderModalOpen(false)}
        onApply={onOpenSeller}
      />
      <AndroidDownloadModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />

      <main className="about-main-container">
        {/* =========================================================
            BLOQUE 1: HERO COMERCIAL DE ALTO IMPACTO
        ========================================================= */}
        <section className="about-hero-section" id="inicio">
          <div className="about-hero-mesh" aria-hidden="true" />
          <div className="about-hero-glow-1" aria-hidden="true" />
          <div className="about-hero-glow-2" aria-hidden="true" />

          <div className="about-hero-shell">
            {/* Columna Izquierda: Copy persuasivo */}
            <div className="about-hero-copy">
              <div className="hero-top-badges">
                <div className="hero-brand-pill">
                  <img src="/about-assets/repuestop-icon.jpg" alt="RepuesTop" />
                  <span>
                    Repues<span>Top</span>
                  </span>
                </div>
                <span className="hero-ecosystem-tag">
                  <Sparkles size={14} /> Plataforma Web 100% Operativa
                </span>
              </div>

              <HeroLiveTicker />

              <h1 className="hero-main-title">
                De la patente a la puerta de tu casa o taller, con <em>respaldo real</em> en cada paso.
              </h1>

              <p className="hero-lead-text">
                El marketplace automotriz más completo y transparente de Chile. Conectamos a conductores
                y talleres con cientos de casas de repuestos verificadas: busca por patente sin margen de
                error, cotiza en vivo por chat, paga en cuotas sin interés y sigue tu pedido con 3 días
                de fondos protegidos.
              </p>

              {/* Badges de Plataformas Oficiales */}
              <div className="hero-platform-strip">
                <button
                  type="button"
                  className="platform-card platform-android"
                  onClick={() => setDownloadModalOpen(true)}
                  title="Ver estado de la app Android"
                >
                  <div className="platform-card-icon">
                    <GooglePlaySvg />
                  </div>
                  <div className="platform-card-meta">
                    <small>App para Android</small>
                    <strong>Próximamente en Google Play</strong>
                  </div>
                  <span className="platform-status-badge is-soon">En desarrollo</span>
                </button>

                <div className="platform-card platform-web">
                  <div className="platform-card-icon">
                    <Zap size={20} className="color-brand-blue" />
                  </div>
                  <div className="platform-card-meta">
                    <small>En tu computador o celular</small>
                    <strong>Plataforma Web</strong>
                  </div>
                  <span className="platform-status-badge is-live">100% Operativa</span>
                </div>

                <div className="platform-card platform-ios">
                  <div className="platform-card-icon">
                    <Smartphone size={20} />
                  </div>
                  <div className="platform-card-meta">
                    <small>Versión iOS (iPhone)</small>
                    <strong>App Store</strong>
                  </div>
                  <span className="platform-status-badge is-soon">En camino</span>
                </div>
              </div>

              {/* Botones de Acción (CTAs) */}
              <div className="hero-cta-group">
                <button type="button" className="button button-primary-glow" onClick={handleCatalog}>
                  <Search size={18} />
                  <span>Buscar repuestos por patente</span>
                </button>
                <button
                  type="button"
                  className="button button-google-play"
                  onClick={() => setDownloadModalOpen(true)}
                >
                  <Download size={18} />
                  <span>App Android (en camino)</span>
                </button>
                <button type="button" className="button button-outline-glow" onClick={onOpenSeller}>
                  <Crown size={18} />
                  <span>Ser tienda fundadora</span>
                </button>
              </div>

              <div className="hero-trust-subtext">
                <span>
                  <CheckCircle2 size={15} /> Pagos protegidos con Webpay y Flow
                </span>
                <span>
                  <CheckCircle2 size={15} /> Boleta o Factura automática
                </span>
                <span>
                  <CheckCircle2 size={15} /> 100% Casas de repuestos verificadas
                </span>
              </div>
            </div>

            {/* Columna Derecha: Render 3D del Ecosistema */}
            <div className="about-hero-visual">
              <div className="hero-visual-card">
                <img
                  src="/about-assets/repuestop-web-home-real.png"
                  alt="Captura real de la plataforma web de RepuesTop"
                  className="hero-device-image"
                />
                <div className="hero-device-scanline" aria-hidden="true" />
                <div className="floating-stat-chip stat-top-left">
                  <Search size={16} />
                  <div>
                    <strong>Patente Inteligente</strong>
                    <small>Marca, modelo y motor exacto</small>
                  </div>
                </div>
                <div className="floating-stat-chip stat-bottom-right">
                  <ShieldCheck size={16} />
                  <div>
                    <strong>Pago Protegido</strong>
                    <small>3 días de fondos en custodia</small>
                  </div>
                </div>
                <div className="hero-mobile-peek">
                  <img
                    src="/about-assets/app-movil-real.png"
                    alt="Vista previa real de la app Android de RepuesTop, actualmente en desarrollo"
                  />
                  <span className="hero-mobile-peek-badge">
                    <Smartphone size={12} /> App Android · En desarrollo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            BLOQUE 2: BARRA DE MÉTRICAS Y RESPALDO (Social Proof)
        ========================================================= */}
        <section className="about-metrics-strip" aria-label="Cifras del ecosistema RepuesTop">
          <div className="about-section-shell metrics-grid">
            <Reveal as="div" className="metric-box" delay={0}>
              <span className="metric-number">+100</span>
              <strong>Casas de Repuestos Verificadas</strong>
              <p>Locales comerciales con RUT, patente e historial comercial al día.</p>
            </Reveal>

            <Reveal as="div" className="metric-box" delay={60}>
              <span className="metric-number">2000–2026</span>
              <strong>Años de Vehículos en Chile</strong>
              <p>Información oficial del SII para autos de marcas tradicionales y marcas chinas.</p>
            </Reveal>

            <Reveal as="div" className="metric-box" delay={120}>
              <span className="metric-number">3 Días</span>
              <strong>De Fondos Protegidos</strong>
              <p>Tu dinero se libera a la tienda solo después de que recibes y pruebas el repuesto.</p>
            </Reveal>

            <Reveal as="div" className="metric-box" delay={180}>
              <span className="metric-number">100%</span>
              <strong>Mediación Humana Imparcial</strong>
              <p>Nuestro equipo revisa cada caso con fotos si el repuesto llega con fallas.</p>
            </Reveal>
          </div>
        </section>

        {/* =========================================================
            BLOQUE 3: UNA WEB, DOS EXPERIENCIAS (Comprador + Vendedor)
        ========================================================= */}
        <section className="about-sync-section" id="ecosistema">
          <div className="about-section-shell">
            <Reveal as="div" className="section-header-center">
              <span className="section-eyebrow">
                <RefreshCw size={14} /> Capturas reales de la plataforma
              </span>
              <h2>Una sola plataforma, pensada para compradores y casas de repuestos.</h2>
              <p>
                Nada de mockups ni fotos genéricas: así se ve RepuesTop hoy mismo. Cada usuario tiene su
                propio panel, con pedidos, cotizaciones y catálogo siempre al día.
              </p>
            </Reveal>

            <div className="sync-cards-duo">
              {/* Tarjeta 1: Comprador */}
              <Reveal as="article" className="sync-platform-card web-card" delay={0}>
                <div className="sync-card-badge">
                  <Zap size={16} /> Panel del Comprador
                </div>
                <h3>Compra, cotiza y sigue tus pedidos</h3>
                <p>
                  Un panel claro donde ves el estado real de tus compras, cotizaciones y repuestos
                  guardados, todo con la misma cuenta.
                </p>
                <ul className="sync-card-feature-list">
                  <li>
                    <Check size={16} /> <strong>Resumen de compras:</strong> Pedidos, envíos en camino y cotizaciones activas en un solo lugar.
                  </li>
                  <li>
                    <Check size={16} /> <strong>Cotizaciones formales:</strong> Chat directo con la tienda y respuesta con precio y garantía.
                  </li>
                  <li>
                    <Check size={16} /> <strong>Favoritos y repetición de compra:</strong> Guarda repuestos para tu vehículo y vuelve a comprarlos fácil.
                  </li>
                  <li>
                    <Check size={16} /> <strong>Factura para empresas:</strong> Ingreso de RUT y razón social para crédito fiscal IVA.
                  </li>
                </ul>
                <div className="sync-card-image-box">
                  <img src="/about-assets/comprador-panel-real.png" alt="Captura real del panel de comprador de RepuesTop" />
                </div>
                <button type="button" className="button button-outline" onClick={handleCatalog}>
                  <span>Explorar marketplace web</span>
                  <ArrowRight size={16} />
                </button>
              </Reveal>

              {/* Tarjeta 2: Vendedor */}
              <Reveal as="article" className="sync-platform-card mobile-card" delay={90}>
                <div className="sync-card-badge android-badge">
                  <Store size={16} /> Panel de la Casa de Repuestos
                </div>
                <h3>Gestiona tus repuestos de forma rápida</h3>
                <p>
                  Publica productos uno a uno o carga masivamente tu catálogo desde Excel, con cálculo
                  automático de tu ganancia y stock siempre visible al público.
                </p>
                <ul className="sync-card-feature-list">
                  <li>
                    <Check size={16} /> <strong>Carga fácil desde Excel:</strong> Sube tu catálogo completo de repuestos en minutos.
                  </li>
                  <li>
                    <Check size={16} /> <strong>Comisión transparente:</strong> Ves el monto exacto a recibir antes de publicar cada repuesto.
                  </li>
                  <li>
                    <Check size={16} /> <strong>Compatibilidad por vehículo:</strong> Asocia la pieza al modelo o márcala como universal.
                  </li>
                  <li>
                    <Check size={16} /> <strong>Control de inventario:</strong> Repuestos activos, stock disponible y ventas al día.
                  </li>
                </ul>
                <div className="sync-card-image-box">
                  <img src="/about-assets/vendedor-panel-real.png" alt="Captura real del panel de gestión de repuestos de RepuesTop" />
                </div>
                <button
                  type="button"
                  className="button button-primary-glow"
                  onClick={onOpenSeller}
                >
                  <Crown size={16} />
                  <span>Quiero vender en RepuesTop</span>
                </button>
              </Reveal>
            </div>
          </div>
        </section>

        {/* =========================================================
            BLOQUE 4: LAS 12 GRANDES VENTAJAS COMERCIALES
        ========================================================= */}
        <section className="about-features-grid-section" id="ventajas">
          <div className="about-section-shell">
            <Reveal as="div" className="section-header-center">
              <span className="section-eyebrow">
                <Award size={14} /> Ventajas del Sistema
              </span>
              <h2>Por qué RepuesTop es la forma más segura de comprar repuestos</h2>
              <p>
                Diseñamos cada función para erradicar las malas experiencias del rubro: piezas que no
                calzan, tiendas sin respaldo, pagos informales y falta de garantía.
              </p>
            </Reveal>

            <div className="power-features-grid">
              {commercialAdvantages.map((feat, index) => (
                <Reveal as="article" className="power-feat-card" key={feat.id} delay={(index % 4) * 60}>
                  <div className="feat-header-row">
                    <div className="feat-icon-box">{feat.icon}</div>
                    <span className="feat-badge-pill">{feat.badge}</span>
                  </div>
                  <h3>{feat.title}</h3>
                  <p>{feat.desc}</p>
                  <div className="feat-benefit-foot">
                    <Sparkles size={14} />
                    <span>{feat.benefit}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================
            BLOQUE 5: GALERÍA INTERACTIVA DE MÓDULOS REALES
        ========================================================= */}
        <section className="about-gallery-section" id="modulos">
          <div className="about-section-shell">
            <Reveal as="div" className="section-header-center">
              <span className="section-eyebrow">
                <Eye size={14} /> Conoce el Sistema por Dentro
              </span>
              <h2>Imágenes reales. Pantallas reales. Cero sorpresas.</h2>
              <p>
                Haz clic en cada sección para ver cómo luce la plataforma y qué herramientas tendrás a mano
                antes de realizar tu primera compra o publicación.
              </p>
            </Reveal>

            {/* Pestañas de selección de módulos */}
            <div className="gallery-tabs-selector" role="tablist" aria-label="Módulos del sistema">
              <button
                type="button"
                role="tab"
                aria-selected={activeGalleryId === 'stores'}
                className={`gallery-nav-btn ${activeGalleryId === 'stores' ? 'is-active' : ''}`}
                onClick={() => setActiveGalleryId('stores')}
              >
                <Store size={16} />
                <span>Casas de Repuestos</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeGalleryId === 'services'}
                className={`gallery-nav-btn ${activeGalleryId === 'services' ? 'is-active' : ''}`}
                onClick={() => setActiveGalleryId('services')}
              >
                <Wrench size={16} />
                <span>Mural de Servicios</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeGalleryId === 'quotes'}
                className={`gallery-nav-btn ${activeGalleryId === 'quotes' ? 'is-active' : ''}`}
                onClick={() => setActiveGalleryId('quotes')}
              >
                <MessageSquareQuote size={16} />
                <span>Cotizaciones & Chat</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeGalleryId === 'qa'}
                className={`gallery-nav-btn ${activeGalleryId === 'qa' ? 'is-active' : ''}`}
                onClick={() => setActiveGalleryId('qa')}
              >
                <HelpCircleIcon size={16} />
                <span>Preguntas sobre Repuestos</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeGalleryId === 'orders'}
                className={`gallery-nav-btn ${activeGalleryId === 'orders' ? 'is-active' : ''}`}
                onClick={() => setActiveGalleryId('orders')}
              >
                <PackageCheck size={16} />
                <span>Seguimiento de Pedidos</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeGalleryId === 'mediation'}
                className={`gallery-nav-btn ${activeGalleryId === 'mediation' ? 'is-active' : ''}`}
                onClick={() => setActiveGalleryId('mediation')}
              >
                <ShieldCheck size={16} />
                <span>Equipo de Mediación</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeGalleryId === 'reports'}
                className={`gallery-nav-btn ${activeGalleryId === 'reports' ? 'is-active' : ''}`}
                onClick={() => setActiveGalleryId('reports')}
              >
                <AlertCircle size={16} />
                <span>Soporte y Seguridad</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeGalleryId === 'logistics'}
                className={`gallery-nav-btn ${activeGalleryId === 'logistics' ? 'is-active' : ''}`}
                onClick={() => setActiveGalleryId('logistics')}
              >
                <Truck size={16} />
                <span>Opciones de Envío</span>
              </button>
            </div>

            {/* Panel de visualización interactivo */}
            <div className="gallery-display-stage" key={activeGalleryId}>
              <div className="gallery-meta-column">
                <span className="gallery-tag-pill">{currentGallery.tag}</span>
                <h3>{currentGallery.title}</h3>
                <p>{currentGallery.desc}</p>

                <div className="gallery-highlights-list">
                  <div className="highlight-item">
                    <CheckCircle2 size={16} />
                    <span>Stock y precios siempre actualizados al instante en la plataforma.</span>
                  </div>
                  <div className="highlight-item">
                    <CheckCircle2 size={16} />
                    <span>Optimizada para computador y celular, sin instalar nada.</span>
                  </div>
                  <div className="highlight-item">
                    <CheckCircle2 size={16} />
                    <span>Acceso directo con un solo clic desde tu cuenta.</span>
                  </div>
                </div>

                <div className="gallery-action-box">
                  <button type="button" className="button button-primary" onClick={currentGallery.onAction}>
                    <span>{currentGallery.actionText}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              <div className="gallery-visual-column">
                <div className="gallery-image-frame">
                  <img src={currentGallery.image} alt={currentGallery.title} />
                  {currentGallery.isReal && (
                    <div className="gallery-live-badge">
                      <span className="live-dot" />
                      <span>Captura real de la plataforma</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            BLOQUE 6: EXPERIENCIA DUAL (Comprador vs. Casa de Repuestos)
        ========================================================= */}
        <section className="about-audience-section" id="experiencias">
          <div className="about-section-shell">
            <Reveal as="div" className="section-header-center">
              <span className="section-eyebrow">
                <Users size={14} /> Elige tu Experiencia
              </span>
              <h2>Hecho a la medida de conductores, talleres y casas de repuestos</h2>
              <p>Selecciona tu perfil para conocer el conjunto de herramientas que preparamos para ti.</p>
            </Reveal>

            {/* Selector de Pestañas */}
            <div className="audience-toggle-bar">
              <button
                type="button"
                className={`audience-toggle-btn ${audienceTab === 'buyer' ? 'is-active' : ''}`}
                onClick={() => setAudienceTab('buyer')}
              >
                <ShoppingBag size={18} />
                <span>Quiero comprar repuestos</span>
              </button>
              <button
                type="button"
                className={`audience-toggle-btn ${audienceTab === 'seller' ? 'is-active' : ''}`}
                onClick={() => setAudienceTab('seller')}
              >
                <Store size={18} />
                <span>Soy casa de repuestos</span>
              </button>
            </div>

            {/* Contenido Comprador */}
            {audienceTab === 'buyer' && (
              <div className="audience-panel-grid buyer-theme">
                <div className="audience-copy-col">
                  <span className="audience-badge">Para conductores, talleres mecánicos y empresas</span>
                  <h3>Compra con la certeza de que el repuesto calza y tu dinero está a salvo</h3>
                  <p>
                    Olvida las llamadas a ciegas y las transferencias a cuentas desconocidas sin garantía.
                    En RepuesTop buscas por la patente de tu vehículo, comparas precios entre casas de repuestos
                    verificadas, pagas en cuotas con Webpay y tienes 3 días tras recibir la pieza para validar
                    que funcione a la perfección.
                  </p>

                  <div className="audience-steps-mini">
                    <div className="step-mini-item">
                      <b>1</b>
                      <div>
                        <strong>Ingresa la patente</strong>
                        <small>El sistema filtra el catálogo automáticamente según tu vehículo.</small>
                      </div>
                    </div>
                    <div className="step-mini-item">
                      <b>2</b>
                      <div>
                        <strong>Cotiza o compra directo</strong>
                        <small>Habla con la tienda por chat o paga en cuotas sin interés.</small>
                      </div>
                    </div>
                    <div className="step-mini-item">
                      <b>3</b>
                      <div>
                        <strong>Recibe con respaldo</strong>
                        <small>Retira con PIN $0 o recibe con courier. Fondos protegidos por 3 días.</small>
                      </div>
                    </div>
                  </div>

                  <div className="audience-btn-row">
                    <button type="button" className="button button-primary" onClick={handleCatalog}>
                      <Search size={18} />
                      <span>Comenzar a buscar</span>
                    </button>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setDownloadModalOpen(true)}
                    >
                      <GooglePlaySvg />
                      <span>App Android (en camino)</span>
                    </button>
                  </div>
                </div>

                <div className="audience-media-col">
                  <img
                    src="/about-assets/comprador-panel-real.png"
                    alt="Captura real del panel de comprador de RepuesTop"
                  />
                </div>
              </div>
            )}

            {/* Contenido Casa de Repuestos */}
            {audienceTab === 'seller' && (
              <div className="audience-panel-grid seller-theme">
                <div className="audience-copy-col">
                  <span className="audience-badge badge-founder">
                    <Crown size={14} /> Campaña Tiendas Fundadoras
                  </span>
                  <h3>Vende tus repuestos a clientes con intención real y comisión fija del 5%</h3>
                  <p>
                    Aumenta tus ventas conectando con miles de conductores y talleres que buscan repuestos específicos
                    para su vehículo. Carga tu lista de repuestos desde Excel, responde cotizaciones por chat,
                    gestiona tus envíos y recibe tus pagos puntuales sin riesgos.
                  </p>

                  <div className="audience-steps-mini">
                    <div className="step-mini-item">
                      <b>1</b>
                      <div>
                        <strong>5% de comisión de tienda fundadora</strong>
                        <small>Comisión preferencial fija garantizada durante todo tu primer año.</small>
                      </div>
                    </div>
                    <div className="step-mini-item">
                      <b>2</b>
                      <div>
                        <strong>Carga fácil desde Excel</strong>
                        <small>Sube tu catálogo completo de repuestos en minutos sin ingresar uno por uno.</small>
                      </div>
                    </div>
                    <div className="step-mini-item">
                      <b>3</b>
                      <div>
                        <strong>Calculadora de ganancia clara</strong>
                        <small>Fija tus precios de venta sabiendo exactamente cuánto vas a recibir por cada repuesto.</small>
                      </div>
                    </div>
                  </div>

                  <div className="audience-btn-row">
                    <button type="button" className="button button-primary" onClick={onOpenSeller}>
                      <Crown size={18} />
                      <span>Quiero ser tienda fundadora</span>
                    </button>
                    <button type="button" className="button button-outline" onClick={onContact}>
                      <MessageCircle size={18} />
                      <span>Contactar al equipo comercial</span>
                    </button>
                  </div>
                </div>

                <div className="audience-media-col">
                  <img
                    src="/about-assets/vendedor-panel-real.png"
                    alt="Captura real del panel de gestión de repuestos de RepuesTop"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* =========================================================
            BLOQUE 7: CUMPLIMIENTO SERNAC, SEGURIDAD Y LEGAL
        ========================================================= */}
        <section className="about-trust-framework-section" id="seguridad">
          <div className="about-section-shell">
            <div className="trust-framework-card">
              <div className="framework-copy">
                <span className="section-eyebrow">
                  <ShieldCheck size={14} /> Respaldo y Confianza en Chile
                </span>
                <h2>Cumplimiento legal, tributario y de protección al comprador</h2>
                <p>
                  Construimos RepuesTop bajo la normativa chilena vigente para que operes con el mismo
                  respaldo que ofrecen las grandes empresas del país.
                </p>

                <div className="framework-pillars-grid">
                  <div className="pillar-box">
                    <Receipt className="pillar-icon" />
                    <strong>Boleta y Factura Oficial</strong>
                    <p>Emisión autorizada por el SII con respaldo contable para personas y talleres.</p>
                  </div>

                  <div className="pillar-box">
                    <ShieldCheck className="pillar-icon" />
                    <strong>Garantía SERNAC (6 Meses)</strong>
                    <p>Respaldo legal según la Ley del Consumidor en repuestos nuevos ante cualquier falla de fábrica.</p>
                  </div>

                  <div className="pillar-box">
                    <LockKeyhole className="pillar-icon" />
                    <strong>Pagos 100% Seguros</strong>
                    <p>Pagas directamente con Webpay y Flow con respaldo bancario oficial; nadie accede a los datos de tu tarjeta.</p>
                  </div>

                  <div className="pillar-box">
                    <FileCheck className="pillar-icon" />
                    <strong>Tiendas Verificadas</strong>
                    <p>Revisamos la documentación comercial y tributaria de cada casa de repuestos antes de habilitarla.</p>
                  </div>
                </div>
              </div>

              <div className="framework-seal-box">
                <img src="/about-assets/repuestop-icon.jpg" alt="Sello de garantía RepuesTop" />
                <strong>Compromiso RepuesTop Chile</strong>
                <p>Plataforma chilena desarrollada por ingenieros comprometidos con la transparencia y el rubro automotriz.</p>
                <div className="chile-origin-pill">
                  <MapPin size={14} />
                  <span>Diseñado y operado en Santiago, Chile</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            BLOQUE 8: PREGUNTAS FRECUENTES (FAQ Accordion)
        ========================================================= */}
        <section className="about-faq-section" id="preguntas">
          <div className="about-section-shell">
            <Reveal as="div" className="section-header-center">
              <span className="section-eyebrow">
                <HelpCircleIcon size={14} /> Respuestas Claras
              </span>
              <h2>Preguntas frecuentes sobre RepuesTop</h2>
              <p>Resolvemos todas tus dudas sobre compras, despachos, app móvil y garantías.</p>
            </Reveal>

            <div className="faq-accordion-container">
              {faqs.map((item, index) => {
                const isOpen = activeFaq === index;
                const answerId = `faq-about-${index}`;

                return (
                  <Reveal as="article" className={`faq-about-card ${isOpen ? 'is-open' : ''}`} key={index} delay={index * 40}>
                    <button
                      type="button"
                      className="faq-question-trigger"
                      onClick={() => setActiveFaq(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      aria-controls={answerId}
                    >
                      <span className="faq-question-text">{item.q}</span>
                      <ChevronDown className="faq-chevron-icon" />
                    </button>
                    <div className="faq-answer-drawer" id={answerId} role="region" aria-hidden={!isOpen}>
                      <p>{item.a}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            <div className="faq-support-strip">
              <Headphones size={22} className="color-brand-blue" />
              <div>
                <strong>¿Tienes otra consulta o caso especial?</strong>
                <p>Nuestro equipo de soporte humano está disponible para orientarte en lo que necesites.</p>
              </div>
              <button type="button" className="button button-outline" onClick={onContact}>
                <span>Contactar soporte</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================
            BLOQUE 9: CALL TO ACTION FINAL (Doble Vía de Conversión)
        ========================================================= */}
        <section className="about-final-cta-section" id="comenzar">
          <div className="about-section-shell">
            <div className="final-cta-card">
              <div className="final-cta-copy">
                <span className="section-eyebrow color-white">
                  <Sparkles size={14} /> Empieza Hoy Mismo
                </span>
                <h2>La forma más fácil y segura de comprar repuestos en Chile</h2>
                <p>
                  Únete a miles de conductores y casas de repuestos que ya operan con total tranquilidad,
                  garantía y respaldo.
                </p>

                <div className="final-cta-buttons-row">
                  <button type="button" className="button button-white-glow" onClick={handleCatalog}>
                    <Search size={18} />
                    <span>Buscar repuesto por patente</span>
                  </button>

                  <button type="button" className="button button-ghost-white" onClick={onOpenSeller}>
                    <Crown size={18} />
                    <span>Sumar mi casa de repuestos (5% comisión)</span>
                  </button>
                </div>
              </div>

              <div className="final-cta-device-preview">
                <img
                  src="/about-assets/vendedor-panel-real.png"
                  alt="Captura real del panel de gestión para casas de repuestos de RepuesTop"
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// Icono auxiliar de ayuda
function HelpCircleIcon(props: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size || 24}
      height={props.size || 24}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}
