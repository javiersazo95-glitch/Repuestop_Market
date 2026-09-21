import { useEffect, useState } from 'react';
import { CheckCircle2, Crown, Search, ShieldCheck, Smartphone, Sparkles, Zap } from 'lucide-react';
import Reveal from './Reveal';
import { GooglePlaySvg } from './icons';
import { TICKER_ITEMS } from './data';

const TICKER_MS = 3200;

function HeroTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const timer = setInterval(() => setIndex((prev) => (prev + 1) % TICKER_ITEMS.length), TICKER_MS);
    return () => clearInterval(timer);
  }, []);

  const { Icon, text } = TICKER_ITEMS[index];

  // Decorativo: rota cada 3,2 s y anunciarlo seria ruido continuo para un
  // lector de pantalla. El resumen estatico de al lado si es accesible.
  return (
    <>
      <p className="rt-ticker" aria-hidden="true">
        <span className="rt-ticker__dot" />
        <span className="rt-ticker__icon" key={`i${index}`}>
          <Icon size={15} />
        </span>
        <span className="rt-ticker__text" key={`t${index}`}>
          {text}
        </span>
      </p>
      <span className="rt-visually-hidden">
        Búsqueda por patente, casas de repuestos verificadas, pago en cuotas sin interés,
        fondos protegidos por 3 días y equipo de mediación.
      </span>
    </>
  );
}

export default function HeroSection({
  onCatalog,
  onOpenSeller,
  onOpenAndroid,
}: {
  onCatalog: () => void;
  onOpenSeller: () => void;
  onOpenAndroid: () => void;
}) {
  return (
    <section className="rt-hero" id="inicio" aria-labelledby="rt-hero-title">
      <div className="rt-shell rt-hero-grid">
        <Reveal className="rt-hero-copy">
          <span className="rt-eyebrow">
            <Sparkles size={14} /> Marketplace automotriz chileno
          </span>

          <HeroTicker />

          <h1 id="rt-hero-title">
            De la patente a tu taller, con respaldo real en cada paso.
          </h1>

          <p className="rt-hero-lead">
            Conectamos a conductores y talleres con cientos de casas de repuestos verificadas:
            busca por patente sin margen de error, cotiza en vivo por chat y paga con 3 días de
            fondos protegidos.
          </p>

          <div className="rt-hero-ctas">
            <button type="button" className="rt-btn rt-btn--primary" onClick={onCatalog}>
              <Search size={18} />
              <span>Buscar repuestos por patente</span>
            </button>
            <button type="button" className="rt-btn rt-btn--outline" onClick={onOpenSeller}>
              <Crown size={18} />
              <span>Ser tienda fundadora</span>
            </button>
          </div>

          <div className="rt-platforms">
            <span className="rt-platform">
              <Zap size={15} /> Plataforma web
              <span className="rt-platform__state is-live">100% operativa</span>
            </span>
            <button
              type="button"
              className="rt-platform"
              onClick={onOpenAndroid}
              title="Ver estado de la app Android"
            >
              <GooglePlaySvg /> Android
              <span className="rt-platform__state is-soon">En camino</span>
            </button>
            <span className="rt-platform">
              <Smartphone size={15} /> iOS
              <span className="rt-platform__state is-soon">En camino</span>
            </span>
          </div>

          <ul className="rt-hero-trust">
            <li><CheckCircle2 size={15} /> Pagos protegidos con Webpay y Flow</li>
            <li><CheckCircle2 size={15} /> Boleta o Factura automática</li>
            <li><CheckCircle2 size={15} /> 100% casas de repuestos verificadas</li>
          </ul>
        </Reveal>

        <Reveal className="rt-hero-stage" delay={90}>
          <img
            className="rt-hero-shot"
            src="/about-assets/repuestop-web-home-real.png"
            alt="Pantalla real del marketplace de RepuesTop con la búsqueda por patente"
            width={1176}
            height={832}
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />

          <div className="rt-hero-chip rt-hero-chip--a">
            <Search size={20} />
            <div>
              <strong>Patente inteligente</strong>
              <small>Marca, modelo y motor exacto</small>
            </div>
          </div>

          <div className="rt-hero-chip rt-hero-chip--b">
            <ShieldCheck size={20} />
            <div>
              <strong>Pago protegido</strong>
              <small>3 días de fondos en custodia</small>
            </div>
          </div>

          <img
            className="rt-hero-phone"
            src="/about-assets/app-movil-real.png"
            alt=""
            width={466}
            height={920}
            loading="lazy"
            decoding="async"
          />
        </Reveal>
      </div>
    </section>
  );
}
