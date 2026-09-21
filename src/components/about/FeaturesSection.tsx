import { Award } from 'lucide-react';
import Reveal from './Reveal';
import { BrowserFrame } from './Frame';
import { ADVANTAGES } from './data';

const CARDS = ADVANTAGES.filter((a) => a.tier === 'card');
const ROWS = ADVANTAGES.filter((a) => a.tier === 'row');

export default function FeaturesSection() {
  return (
    <section className="rt-band rt-band--muted" id="ventajas" aria-labelledby="rt-features-title">
      <div className="rt-shell">
        <Reveal className="rt-head rt-head--center">
          <span className="rt-eyebrow">
            <Award size={14} /> Por qué RepuesTop
          </span>
          <h2 id="rt-features-title">La forma más segura de comprar repuestos</h2>
        </Reveal>

        {/* Bento: la primera tarjeta ocupa el doble de ancho y jerarquiza sin
            necesidad de escribir mas texto. */}
        <div className="rt-bento">
          {CARDS.map((feat, index) => (
            <Reveal
              as="article"
              className={`rt-bento-card${index === 0 ? ' rt-card--glow' : ''}`}
              key={feat.id}
              delay={Math.min(index * 60, 240)}
            >
              <div className="rt-bento-card__art">
                {feat.artFrame === 'browser' ? (
                  <BrowserFrame url="repuestop.cl">
                    <img src={feat.art} alt={feat.artAlt} width={1440} height={900} loading="lazy" decoding="async" />
                  </BrowserFrame>
                ) : (
                  <img src={feat.art} alt={feat.artAlt} loading="lazy" decoding="async" />
                )}
              </div>

              <div className="rt-bento-card__copy">
                <span className="rt-feat-icon" data-accent={feat.accent}>
                  <feat.Icon size={20} />
                </span>
                <h3>{feat.title}</h3>
                <p>{feat.line}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <ul className="rt-feat-rows">
          {ROWS.map((feat) => (
            <li className="rt-feat-row" key={feat.id}>
              <span className="rt-feat-icon" data-accent={feat.accent}>
                <feat.Icon size={18} />
              </span>
              <div>
                <strong>{feat.title}</strong>
                <span>{feat.line}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
