import { Crown, Search, Sparkles } from 'lucide-react';
import Reveal from './Reveal';

export default function FinalCtaSection({
  onCatalog,
  onOpenSeller,
}: {
  onCatalog: () => void;
  onOpenSeller: () => void;
}) {
  return (
    <section className="rt-cta" id="comenzar" aria-labelledby="rt-cta-title">
      {/* El scrim, casi opaco sobre la izquierda, tapa el titular quemado de la
          pieza y asegura el contraste del copy. */}
      <img className="rt-cta__bg" src="/about-assets/nosotros.webp" alt="" width={1672} height={941} loading="lazy" decoding="async" />
      <div className="rt-cta__scrim" aria-hidden="true" />

      <div className="rt-shell">
        <Reveal className="rt-cta__inner">
          <span className="rt-eyebrow rt-eyebrow--onDark">
            <Sparkles size={14} /> Empieza hoy mismo
          </span>

          <h2 id="rt-cta-title">Tu próximo repuesto está más cerca de lo que piensas</h2>

          <div className="rt-cta__buttons">
            <button type="button" className="rt-btn rt-btn--white" onClick={onCatalog}>
              <Search size={18} />
              <span>Buscar por patente</span>
            </button>
            <button type="button" className="rt-btn rt-btn--ghostWhite" onClick={onOpenSeller}>
              <Crown size={18} />
              <span>Sumar mi casa de repuestos</span>
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
