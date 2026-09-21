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
              <ShieldCheck size={14} /> Tu confianza es nuestra prioridad
            </span>
            <h2 id="rt-trust-title">Cumplimiento legal, tributario y de protección al comprador</h2>
            <p>
              Construimos RepuesTop bajo la normativa chilena vigente para que operes con el mismo
              respaldo que ofrecen las grandes empresas del país.
            </p>
          </Reveal>

          <Reveal className="rt-trust-spot" delay={80}>
            <figure className="rt-crop rt-crop--shield">
              <img
                src="/about-assets/help-center-hero.png"
                alt=""
                width={1254}
                height={1254}
                loading="lazy"
                decoding="async"
              />
            </figure>
          </Reveal>
        </div>

        <ul className="rt-trust-pillars">
          {TRUST_PILLARS.map(({ Icon, title, desc }, index) => (
            <Reveal as="li" className="rt-pillar" key={title} delay={index * 60}>
              <Icon size={28} />
              <strong>{title}</strong>
              <p>{desc}</p>
            </Reveal>
          ))}
        </ul>

        <div className="rt-trust-foot">
          <img
            src="/about-assets/repuestop-icon.jpg"
            alt=""
            width={64}
            height={64}
            loading="lazy"
            decoding="async"
          />
          <strong>Compromiso RepuesTop Chile</strong>
          <p>
            Plataforma chilena desarrollada por ingenieros comprometidos con la transparencia y el
            rubro automotriz.
          </p>
        </div>
      </div>
    </section>
  );
}
