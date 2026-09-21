import { ShieldCheck } from 'lucide-react';
import Reveal from './Reveal';
import { TRUST_PILLARS } from './data';

export default function TrustBand() {
  return (
    <section className="rt-band rt-band--blue rt-trust" id="seguridad" aria-labelledby="rt-trust-title">
      <div className="rt-shell">
        <div className="rt-trust-head">
          <Reveal className="rt-head">
            <span className="rt-eyebrow rt-eyebrow--onDark">
              <ShieldCheck size={14} /> Respaldo legal en Chile
            </span>
            <h2 id="rt-trust-title">Más que repuestos, construimos confianza</h2>
          </Reveal>

          <Reveal className="rt-trust-spot" delay={80}>
            <figure className="rt-crop rt-crop--shield">
              <img src="/about-assets/help-center-hero.webp" alt="" width={640} height={640} loading="lazy" decoding="async" />
            </figure>
          </Reveal>
        </div>

        <ul className="rt-trust-pillars">
          {TRUST_PILLARS.map(({ Icon, title }, index) => (
            <Reveal as="li" className="rt-pillar" key={title} delay={index * 60}>
              <Icon size={26} />
              <strong>{title}</strong>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
