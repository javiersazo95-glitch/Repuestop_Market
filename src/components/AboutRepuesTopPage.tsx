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
    { icon: <Search size={15} />, text: 'Búsqueda de alta precisión por Patente chilena (2000 - 2026)' },
    { icon: <Smartphone size={15} />, text: 'Plataforma Web y App Android en Google Play sincronizadas' },
    { icon: <CreditCard size={15} />, text: 'Paga en hasta 12 cuotas sin interés con Webpay Plus y Flow' },
    { icon: <ShieldCheck size={15} />, text: '3 días de fondos retenidos tras entrega para validar que calza' },
    { icon: <MessageSquareQuote size={15} />, text: 'Cotizaciones formales y chat en vivo con vendedores' },
    { icon: <Truck size={15} />, text: 'Retiro en tienda con PIN $0 o despacho con tracking a todo Chile' },
    { icon: <Users size={15} />, text: 'Equipo de mediadores humanos en caso de fallas o discrepancias' },
    { icon: <Wrench size={15} />, text: 'Mural público de servicios mecánicos, scanner y talleres' },
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
// Modal de Descarga de App Android
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
        <span className="modal-eyebrow">Google Play Store · Android</span>
        <h2>Descarga RepuesTop en tu teléfono</h2>
        <p>
          Lleva en tu bolsillo todo el ecosistema: búsqueda por patente, notificaciones push cuando tu
          pedido cambie de estado, chat directo con vendedores y el PIN digital de retiro seguro.
        </p>

        <div className="modal-app-details">
          <div className="app-detail-item">
            <strong>Nombre oficial</strong>
            <span>RepuesTop: Repuestos por Patente</span>
          </div>
          <div className="app-detail-item">
            <strong>Compatibilidad</strong>
            <span>Android 7.0 o superior</span>
          </div>
          <div className="app-detail-item">
            <strong>Desarrollador</strong>
            <span>Corebit SpA / RepuesTop Chile</span>
          </div>
          <div className="app-detail-item">
            <strong>Sincronización</strong>
            <span>100% en tiempo real con la web</span>
          </div>
        </div>

        <div className="modal-actions-row">
          <a
            href="https://play.google.com/store"
            target="_blank"
            rel="noopener noreferrer"
            className="button button-playstore"
          >
            <GooglePlaySvg />
            <div className="btn-play-text">
              <small>Disponible en</small>
              <strong>Google Play</strong>
            </div>
          </a>
          <button type="button" className="button button-outline" onClick={onClose}>
            Continuar en la Web
          </button>
        </div>

        <div className="modal-ios-note">
          <Clock size={14} />
          <span>¿Usas iPhone? La versión para iOS se encuentra actualmente en desarrollo y llegará pronto.</span>
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
    document.title = 'Sobre RepuesTop | Marketplace Automotriz y App Móvil Sincronizada';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Conoce RepuesTop: Búsqueda por patente chilena sin margen de error, compra protegida, cuotas sin interés, cotizaciones por chat, tiendas verificadas y app Android en Google Play.'
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
      desc: 'Ingresas la patente chilena y completamos marca, modelo, año, motor, versión y transmisión con homologación oficial SII (2000-2026), garantizando repuestos 100% compatibles.',
      benefit: 'Ahorras tiempo y eliminas el riesgo de compras equivocadas.',
    },
    {
      id: 2,
      icon: <Store className="feat-ico-violet" />,
      title: 'Cientos de Casas de Repuestos y Desarmadurías',
      badge: 'Todo Chile',
      desc: 'Conectamos con una red verificada de comercios automotrices: repuestos nuevos originales (OEM), marcas alternativas de alta gama y piezas de desarme legal con procedencia garantizada.',
      benefit: 'Compara precios y disponibilidad real sin recorrer la calle 10 de Julio.',
    },
    {
      id: 3,
      icon: <CreditCard className="feat-ico-emerald" />,
      title: 'Paga en Cuotas Sin Interés & +30 Medios',
      badge: 'Flow / Webpay',
      desc: 'Aceptamos tarjetas de crédito en cuotas sin interés, tarjetas de débito Redcompra, prepago (Mach, Tenpo, Copec Pay) y transferencias directas con emisión de boleta o factura.',
      benefit: 'Flexibilidad de pago respaldada por la principal pasarela de Chile.',
    },
    {
      id: 4,
      icon: <MessageSquareQuote className="feat-ico-cyan" />,
      title: 'Cotizaciones Formales por Chat en Vivo',
      badge: 'En tiempo real',
      desc: 'Habla directamente con los vendedores, pide fotos de la pieza y recibe una cotización formal con descuento, garantía detallada y botón para pagar en 1 solo clic.',
      benefit: 'Trato directo y personalizado con respaldo y registro legal de la oferta.',
    },
    {
      id: 5,
      icon: <HelpCircleIcon className="feat-ico-amber" />,
      title: 'Preguntas y Respuestas Públicas',
      badge: 'Comunidad',
      desc: '¿Tienes dudas sobre el lado, conector o versión? Pregunta en la ficha del repuesto; las respuestas quedan públicas para beneficio de todos los dueños del mismo modelo.',
      benefit: 'Compras con total certeza técnica y transparencia absoluta.',
    },
    {
      id: 6,
      icon: <Truck className="feat-ico-orange" />,
      title: 'Logística Multimodal y Transparente',
      badge: 'Retiro $0 o despacho',
      desc: 'Elige entre retiro en tienda con PIN de seguridad sin costo adicional, despacho local dentro de tu comuna o courier nacional por pagar (Starken, Chilexpress) con tracking.',
      benefit: 'Tú decides si quieres ahorrar en flete o recibir en la puerta de tu taller.',
    },
    {
      id: 7,
      icon: <LockKeyhole className="feat-ico-green" />,
      title: 'Pago Protegido (Resguardo de 3 Días)',
      badge: 'Garantía real',
      desc: 'Tus fondos permanecen custodiados y no se transfieren a la tienda hasta 3 días después de recibida la pieza, dándote margen suficiente para instalar y probar que calza.',
      benefit: 'Comprar repuestos deja de ser una apuesta; tu dinero está resguardado.',
    },
    {
      id: 8,
      icon: <ShieldCheck className="feat-ico-indigo" />,
      title: 'Equipo de Mediación Humana en Fallas',
      badge: 'Personas reales',
      desc: 'Si un repuesto no calza o presenta defectos de fábrica y no hay acuerdo con el vendedor, un mediador humano imparcial abre un expediente, evalúa fotos y ejecuta el reembolso.',
      benefit: 'Sin llamadas eternas ni bots: resolvemos tu reclamo con evidencias.',
    },
    {
      id: 9,
      icon: <Users className="feat-ico-teal" />,
      title: 'Apoyo de Captadores Automotrices',
      badge: 'Búsqueda asistida',
      desc: '¿Buscas una pieza difícil, descontinuada o de un modelo escaso? Nuestro equipo de captadores automotrices rastrea almacenes físicos y redes de desarmadurías por ti.',
      benefit: 'Encontramos ese repuesto que nadie más tiene disponible.',
    },
    {
      id: 10,
      icon: <Wrench className="feat-ico-rose" />,
      title: 'Mural Público de Servicios Automotrices',
      badge: 'Talleres y mecánicos',
      desc: 'Vitrina integral para talleres mecánicos, scanner automotriz, frenos, desabolladura, pintura y mantención por kilometraje con acreditación técnica y reserva de citas.',
      benefit: 'Encuentra el especialista ideal para instalar el repuesto que compraste.',
    },
    {
      id: 11,
      icon: <AlertCircle className="feat-ico-red" />,
      title: 'Sistema de Reportes y Moderación Continua',
      badge: 'Comunidad segura',
      desc: 'Herramientas de reporte comunitario y revisión activa de soporte para suspender publicaciones dudosas, comercios irregulares o malas prácticas comerciales.',
      benefit: 'Operas en un entorno limpio, auditado y transparente.',
    },
    {
      id: 12,
      icon: <Layers className="feat-ico-blue2" />,
      title: 'Equipo de Ingenieros en Mejora Continua',
      badge: 'Desarrollo chileno',
      desc: 'Nuestra plataforma es creada y evolucionada permanentemente por un equipo multidisciplinario de ingenieros de software y expertos del rubro automotriz nacional.',
      benefit: 'Plataforma estable 24/7, segura, rápida y en constante evolución.',
    },
  ];

  // -------------------------------------------------------------
  // Data: Galería Interactiva con Capturas Reales
  // -------------------------------------------------------------
  const galleryItems = {
    stores: {
      title: 'Directorio de Tiendas y Desarmadurías',
      tag: 'Red Comercial',
      desc: 'Explora locales físicos y desarmadurías verificadas con dirección, horario de atención, reputación con estrellas y catálogo disponible para retiro inmediato.',
      image: '/about-assets/store-directory-hero-v6.webp',
      actionText: 'Ver tiendas verificadas',
      onAction: handleStores,
    },
    services: {
      title: 'Mural de Servicios Automotrices',
      tag: 'Talleres y Especialistas',
      desc: 'Conecta con mecánicos acreditados, especialistas en frenos, scanner multimarca, aire acondicionado y desabolladura con agenda de citas y reseñas reales.',
      image: '/about-assets/ads-wall-hero-mechanic.png',
      actionText: 'Explorar mural de servicios',
      onAction: handleAdsWall,
    },
    quotes: {
      title: 'Cotizaciones Formales en Chat',
      tag: 'Trato Directo',
      desc: 'Recibe ofertas directas de los vendedores con precio neto, porcentaje de descuento, garantía y botón directo para pagar con Flow sin salir del chat.',
      image: '/about-assets/seller-quotes-hero.png',
      actionText: 'Ir a buscar y cotizar',
      onAction: handleCatalog,
    },
    qa: {
      title: 'Preguntas y Respuestas Técnicas',
      tag: 'Transparencia',
      desc: 'Consulta dudas específicas de compatibilidad antes de pagar. El vendedor recibe alerta inmediata y la respuesta queda registrada públicamente.',
      image: '/about-assets/seller-questions-hero.png',
      actionText: 'Explorar catálogo',
      onAction: handleCatalog,
    },
    orders: {
      title: 'Timeline y Seguimiento de Pedidos',
      tag: 'Trazabilidad Total',
      desc: 'Visualiza cada paso de tu compra: Pagado, En preparación, Listo para retiro con PIN de 6 dígitos o En camino con courier y número de seguimiento.',
      image: '/about-assets/orders-hero-v2.png',
      actionText: 'Comprar con respaldo',
      onAction: handleCatalog,
    },
    mediation: {
      title: 'Equipo de Mediación Imparcial',
      tag: 'Resolución de Disputas',
      desc: 'Si una pieza presenta problemas o no calza, un mediador humano de RepuesTop revisa el expediente fotográfico y resuelve con fondos retenidos.',
      image: '/about-assets/mediator-profile.webp',
      actionText: 'Conocer centro de ayuda',
      onAction: onContact,
    },
    reports: {
      title: 'Centro de Soporte y Seguridad',
      tag: 'Confianza y Ética',
      desc: 'Sistema de tickets con agentes humanos y reportes comunitarios para fiscalizar publicaciones y mantener la máxima transparencia del mercado.',
      image: '/about-assets/reports-hero.png',
      actionText: 'Contactar a soporte',
      onAction: onContact,
    },
    logistics: {
      title: 'Logística Multimodal a Todo Chile',
      tag: 'Entregas Garantizadas',
      desc: 'Retiro en tienda sin costo con código PIN seguro, flete comunal express o despacho por courier a cualquier región del país.',
      image: '/about-assets/delivery-truck.webp',
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
      a: 'Al ingresar la patente de tu vehículo, nuestro sistema consulta la base oficial del parque automotriz chileno y homologaciones del SII (desde el año 2000 al 2026). Detectamos marca, modelo, año exacto, versión y cilindrada. Así, el catálogo se filtra únicamente con repuestos 100% compatibles, evitando que compres una pieza equivocada.',
    },
    {
      q: '¿Cómo descargo la aplicación móvil y qué ventajas tiene frente a la web?',
      a: 'La aplicación móvil de RepuesTop está disponible para Android en Google Play Store. Ambas plataformas están 100% sincronizadas en la nube: si buscas o guardas en la web, aparece en tu teléfono. La app añade notificaciones push al instante de cada cambio en tu pedido, cámara para enviar fotos al chat de cotización y tu PIN de retiro digital en el bolsillo.',
    },
    {
      q: '¿Cómo funciona el resguardo de fondos de 3 días (Pago Protegido)?',
      a: 'Cuando compras en RepuesTop a través de Webpay o Flow, el vendedor no recibe tu dinero de inmediato. Los fondos quedan retenidos de manera segura en la cuenta de custodia de la plataforma durante los 3 días posteriores a la entrega física. Durante este plazo puedes probar e instalar el repuesto con total tranquilidad.',
    },
    {
      q: '¿Qué ocurre si el repuesto llega dañado, con fallas o no calza?',
      a: 'A diferencia de compras informales por redes sociales, en RepuesTop cuentas con un equipo de Mediación Humana. Puedes abrir una disputa desde el Centro de Ayuda; un mediador imparcial de nuestro equipo revisará las fotos, mensajes y especificaciones técnicas. Mientras el caso se revisa, los fondos permanecen congelados y, si no calza, gestionamos tu reembolso total.',
    },
    {
      q: '¿Puedo pagar en cuotas sin interés y solicitar Factura para mi taller o empresa?',
      a: 'Sí. A través de la integración oficial con Webpay Plus y Flow, puedes pagar con tarjetas de crédito en cuotas sin interés según las promociones de tu banco emisor. Además, al momento del checkout puedes elegir entre Boleta electrónica o Factura comercial con RUT de empresa y giro tributario.',
    },
    {
      q: '¿Cómo funciona el retiro en tienda con PIN de 6 dígitos?',
      a: 'Si eliges "Retiro en tienda ($0 costo)", el sistema genera un PIN único digital de 6 dígitos en tu cuenta y app. Al ir al local de la casa de repuestos, muestras tu PIN; el vendedor lo digita en su panel para validar la entrega. Así nadie más puede retirar tu compra y la recepción queda firmada digitalmente.',
    },
    {
      q: '¿Qué es el Mural Público de Servicios Automotrices y qué ofrece?',
      a: 'El Mural de Anuncios es nuestra vitrina para conectar a conductores con mecánicos y talleres profesionales acreditados en Chile. Puedes buscar servicios por comuna (scanner automotriz, frenos, desabolladura y pintura, aire acondicionado, etc.), revisar credenciales técnicas y coordinar citas de atención.',
    },
    {
      q: '¿Cómo puedo incorporar mi casa de repuestos o desarmaduría como Tienda Fundadora?',
      a: 'Puedes postular directamente haciendo clic en "Quiero ser tienda fundadora". Los primeros comercios asociados disfrutan de una comisión preferencial y fija del 5% durante todo su primer año, soporte para carga masiva de inventario en Excel/CSV, panel de ventas y un distintivo oficial de tienda verificada.',
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
                  <Sparkles size={14} /> Ecosistema Web & App Móvil Sincronizadas
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
                  title="Ver información de descarga en Google Play Store"
                >
                  <div className="platform-card-icon">
                    <GooglePlaySvg />
                  </div>
                  <div className="platform-card-meta">
                    <small>App para Android</small>
                    <strong>Google Play Store</strong>
                  </div>
                  <span className="platform-status-badge is-live">Disponible</span>
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
                  <span>Descargar App Android</span>
                </button>
                <button type="button" className="button button-outline-glow" onClick={onOpenSeller}>
                  <Crown size={18} />
                  <span>Ser tienda fundadora</span>
                </button>
              </div>

              <div className="hero-trust-subtext">
                <span>
                  <CheckCircle2 size={15} /> Pagos protegidos con Flow / Webpay
                </span>
                <span>
                  <CheckCircle2 size={15} /> Boleta o Factura automática
                </span>
                <span>
                  <CheckCircle2 size={15} /> 100% Tiendas auditadas
                </span>
              </div>
            </div>

            {/* Columna Derecha: Render 3D del Ecosistema */}
            <div className="about-hero-visual">
              <div className="hero-visual-card">
                <img
                  src="/about-assets/repuestop-web-mobile-hero.png"
                  alt="Plataforma Web y Aplicación Móvil Android de RepuesTop"
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
              <strong>Casas de Repuestos y Desarmadurías</strong>
              <p>Locales auditados con RUT, patente comercial e historial verificado.</p>
            </Reveal>

            <Reveal as="div" className="metric-box" delay={60}>
              <span className="metric-number">2000–2026</span>
              <strong>Parque Automotriz Homologado</strong>
              <p>Ficha técnica oficial SII para marcas tradicionales y vehículos chinos.</p>
            </Reveal>

            <Reveal as="div" className="metric-box" delay={120}>
              <span className="metric-number">3 Días</span>
              <strong>De Fondos en Custodia Segura</strong>
              <p>El dinero se libera tras la entrega física si confirmas conformidad.</p>
            </Reveal>

            <Reveal as="div" className="metric-box" delay={180}>
              <span className="metric-number">100%</span>
              <strong>Mediación Humana Imparcial</strong>
              <p>Personas reales revisan evidencias fotográficas ante cualquier falla.</p>
            </Reveal>
          </div>
        </section>

        {/* =========================================================
            BLOQUE 3: ECOSISTEMA SINCRONIZADO (Web + App Android)
        ========================================================= */}
        <section className="about-sync-section" id="ecosistema">
          <div className="about-section-shell">
            <Reveal as="div" className="section-header-center">
              <span className="section-eyebrow">
                <RefreshCw size={14} /> Sincronización en Tiempo Real
              </span>
              <h2>Una sola cuenta. Dos experiencias perfectamente sincronizadas.</h2>
              <p>
                Todo lo que haces en la web se actualiza al instante en la aplicación móvil Android y
                viceversa: carrito de compras, cotizaciones por chat, seguimiento de pedidos y preguntas.
              </p>
            </Reveal>

            <div className="sync-cards-duo">
              {/* Tarjeta 1: La Web */}
              <Reveal as="article" className="sync-platform-card web-card" delay={0}>
                <div className="sync-card-badge">
                  <Zap size={16} /> En tu Computador o Navegador
                </div>
                <h3>Plataforma Web Operativa</h3>
                <p>
                  Ideal para talleres mecánicos, compras de oficina y cotización intensiva de múltiples
                  piezas a la vez con pantalla ancha.
                </p>
                <ul className="sync-card-feature-list">
                  <li>
                    <Check size={16} /> <strong>Carrito multi-tienda:</strong> Compra a varios proveedores en una sola transacción.
                  </li>
                  <li>
                    <Check size={16} /> <strong>Ficha técnica profunda:</strong> Comparación de dimensiones, números de parte OEM y compatibilidades.
                  </li>
                  <li>
                    <Check size={16} /> <strong>Factura para empresas:</strong> Ingreso de RUT y razón social para crédito fiscal IVA.
                  </li>
                  <li>
                    <Check size={16} /> <strong>Panel de proveedor:</strong> Carga masiva de inventario por planillas Excel/CSV.
                  </li>
                </ul>
                <div className="sync-card-image-box">
                  <img src="/about-assets/repuestop-web-home.png" alt="Marketplace web de RepuesTop" />
                </div>
                <button type="button" className="button button-outline" onClick={handleCatalog}>
                  <span>Explorar marketplace web</span>
                  <ArrowRight size={16} />
                </button>
              </Reveal>

              {/* Tarjeta 2: La App Android */}
              <Reveal as="article" className="sync-platform-card mobile-card" delay={90}>
                <div className="sync-card-badge android-badge">
                  <GooglePlaySvg /> En tu Teléfono Android
                </div>
                <h3>App Móvil en Google Play</h3>
                <p>
                  Pensada para la calle, el taller y la desarmaduría: responde cotizaciones al instante y
                  recibe alertas push directas.
                </p>
                <ul className="sync-card-feature-list">
                  <li>
                    <Check size={16} /> <strong>Avisos push inmediatos:</strong> Notificaciones cuando un vendedor cotiza o tu pedido avanza.
                  </li>
                  <li>
                    <Check size={16} /> <strong>Cámara integrada:</strong> Sube fotos de la muestra rota directo al chat de la tienda.
                  </li>
                  <li>
                    <Check size={16} /> <strong>PIN digital en el bolsillo:</strong> Muestra tu código de 6 dígitos en el mesón de la tienda en 2 segundos.
                  </li>
                  <li>
                    <Check size={16} /> <strong>Chat en tiempo real:</strong> Negocia descuentos y garantías dondequiera que estés.
                  </li>
                </ul>
                <div className="sync-card-image-box">
                  <img src="/about-assets/comprador-web-mobile.png" alt="App móvil de RepuesTop para Android" />
                </div>
                <button
                  type="button"
                  className="button button-primary-glow"
                  onClick={() => setDownloadModalOpen(true)}
                >
                  <Download size={16} />
                  <span>Obtener en Google Play Store</span>
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
                <Award size={14} /> Ventajas Competitivas
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
                <Eye size={14} /> Conoce el Sistema en Vivo
              </span>
              <h2>Imágenes reales. Flujos reales. Cero sorpresas.</h2>
              <p>
                Haz clic en cada módulo para previsualizar cómo se ve y funciona la plataforma por dentro
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
                <span>Directorio Tiendas</span>
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
                <span>Preguntas Q&A</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeGalleryId === 'orders'}
                className={`gallery-nav-btn ${activeGalleryId === 'orders' ? 'is-active' : ''}`}
                onClick={() => setActiveGalleryId('orders')}
              >
                <PackageCheck size={16} />
                <span>Seguimiento Pedidos</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeGalleryId === 'mediation'}
                className={`gallery-nav-btn ${activeGalleryId === 'mediation' ? 'is-active' : ''}`}
                onClick={() => setActiveGalleryId('mediation')}
              >
                <ShieldCheck size={16} />
                <span>Equipo Mediación</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeGalleryId === 'reports'}
                className={`gallery-nav-btn ${activeGalleryId === 'reports' ? 'is-active' : ''}`}
                onClick={() => setActiveGalleryId('reports')}
              >
                <AlertCircle size={16} />
                <span>Soporte & Reportes</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeGalleryId === 'logistics'}
                className={`gallery-nav-btn ${activeGalleryId === 'logistics' ? 'is-active' : ''}`}
                onClick={() => setActiveGalleryId('logistics')}
              >
                <Truck size={16} />
                <span>Logística & Envíos</span>
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
                    <span>Datos actualizados en tiempo real por el backend.</span>
                  </div>
                  <div className="highlight-item">
                    <CheckCircle2 size={16} />
                    <span>Interfaz idéntica en versión web y en la app Android.</span>
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
                  <div className="gallery-live-badge">
                    <span className="live-dot" />
                    <span>Módulo operativo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            BLOQUE 6: EXPERIENCIA DUAL (Comprador vs. Proveedor)
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
                <span>Soy tienda o desarmaduría</span>
              </button>
            </div>

            {/* Contenido Comprador */}
            {audienceTab === 'buyer' && (
              <div className="audience-panel-grid buyer-theme">
                <div className="audience-copy-col">
                  <span className="audience-badge">Para particulares, talleres mecánicos y flotas</span>
                  <h3>Compra con la certeza de que el repuesto calza y tu dinero está a salvo</h3>
                  <p>
                    Olvida las llamadas a ciegas y los pagos por transferencia a cuentas desconocidas.
                    En RepuesTop buscas por la patente de tu vehículo, comparas precios entre tiendas
                    formales, pagas en cuotas con Webpay y tienes 3 días tras recibir la pieza para validar
                    su funcionamiento.
                  </p>

                  <div className="audience-steps-mini">
                    <div className="step-mini-item">
                      <b>1</b>
                      <div>
                        <strong>Ingresa la patente</strong>
                        <small>El sistema filtra el catálogo automáticamente.</small>
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
                        <small>Retira con PIN $0 o recibe con courier. Fondos retenidos por 3 días.</small>
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
                      <span>Descargar app Android</span>
                    </button>
                  </div>
                </div>

                <div className="audience-media-col">
                  <img
                    src="/about-assets/comprador-como-funciona.png"
                    alt="Experiencia para compradores en RepuesTop"
                  />
                </div>
              </div>
            )}

            {/* Contenido Proveedor */}
            {audienceTab === 'seller' && (
              <div className="audience-panel-grid seller-theme">
                <div className="audience-copy-col">
                  <span className="audience-badge badge-founder">
                    <Crown size={14} /> Campaña Tiendas Fundadoras
                  </span>
                  <h3>Vende tus repuestos a clientes con intención real y comisión fija del 5%</h3>
                  <p>
                    Multiplica tus ventas conectando con miles de usuarios que buscan repuestos específicos
                    para su patente. Carga tu stock masivo en Excel, responde oportunidades por chat,
                    controla despachos y retira tu dinero con liquidaciones transparentes.
                  </p>

                  <div className="audience-steps-mini">
                    <div className="step-mini-item">
                      <b>1</b>
                      <div>
                        <strong>5% de comisión fundador</strong>
                        <small>Tasa fija preferencial garantizada durante el primer año.</small>
                      </div>
                    </div>
                    <div className="step-mini-item">
                      <b>2</b>
                      <div>
                        <strong>Carga masiva Excel/CSV</strong>
                        <small>Sube miles de repuestos y compatibilidades en minutos.</small>
                      </div>
                    </div>
                    <div className="step-mini-item">
                      <b>3</b>
                      <div>
                        <strong>Calculadora de margen neto</strong>
                        <small>Define precios de lista sabiendo exactamente cuánto vas a ganar.</small>
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
                    src="/about-assets/vendedor-web-mobile.png"
                    alt="Experiencia para vendedores y proveedores en RepuesTop"
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
                  <ShieldCheck size={14} /> Estándar de Confianza Nacional
                </span>
                <h2>Cumplimiento legal, tributario y de protección al consumidor</h2>
                <p>
                  Construimos RepuesTop bajo la normativa chilena vigente para que operes con el mismo
                  respaldo que ofrecen las grandes empresas del retail internacional.
                </p>

                <div className="framework-pillars-grid">
                  <div className="pillar-box">
                    <Receipt className="pillar-icon" />
                    <strong>Boleta y Factura Oficial</strong>
                    <p>Emisión autorizada por el SII con respaldo contable y crédito fiscal para empresas.</p>
                  </div>

                  <div className="pillar-box">
                    <ShieldCheck className="pillar-icon" />
                    <strong>Garantía SERNAC (6 Meses)</strong>
                    <p>Respaldo legal según la Ley del Consumidor en repuestos nuevos ante defectos de fábrica.</p>
                  </div>

                  <div className="pillar-box">
                    <LockKeyhole className="pillar-icon" />
                    <strong>Cifrado Bancario SSL</strong>
                    <p>Las transacciones viajan directamente por Webpay/Flow; no almacenamos datos de tarjetas.</p>
                  </div>

                  <div className="pillar-box">
                    <FileCheck className="pillar-icon" />
                    <strong>Comercios Verificados</strong>
                    <p>Auditamos cédula, patente municipal, RUT y domicilio comercial de cada proveedor.</p>
                  </div>
                </div>
              </div>

              <div className="framework-seal-box">
                <img src="/about-assets/repuestop-icon.jpg" alt="Sello de garantía RepuesTop" />
                <strong>Compromiso RepuesTop Chile</strong>
                <p>Plataforma chilena desarrollada por ingenieros comprometidos con la transparencia automotriz.</p>
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
                <h2>El futuro de los repuestos automotrices en Chile ya comenzó</h2>
                <p>
                  Únete a miles de conductores y tiendas que ya compran y venden con total seguridad,
                  garantía y trazabilidad.
                </p>

                <div className="final-cta-buttons-row">
                  <button type="button" className="button button-white-glow" onClick={handleCatalog}>
                    <Search size={18} />
                    <span>Buscar repuesto por patente</span>
                  </button>

                  <button
                    type="button"
                    className="button button-playstore-white"
                    onClick={() => setDownloadModalOpen(true)}
                  >
                    <GooglePlaySvg />
                    <div className="btn-play-text">
                      <small>Disponible en</small>
                      <strong>Google Play</strong>
                    </div>
                  </button>

                  <button type="button" className="button button-ghost-white" onClick={onOpenSeller}>
                    <Crown size={18} />
                    <span>Sumar mi tienda (5% comisión)</span>
                  </button>
                </div>
              </div>

              <div className="final-cta-device-preview">
                <img
                  src="/about-assets/repuestop-web-mobile-hero.png"
                  alt="RepuesTop web y móvil"
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
