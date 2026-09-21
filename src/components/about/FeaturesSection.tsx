import { Award, Sparkles } from 'lucide-react';
import Reveal from './Reveal';
import { ADVANTAGES } from './data';

const TIER_A = ADVANTAGES.filter((item) => item.tier === 'a');
const TIER_B = ADVANTAGES.filter((item) => item.tier === 'b');
const TIER_C = ADVANTAGES.filter((item) => item.tier === 'c');

export default function FeaturesSection() {
  return (
    <section className="rt-band rt-band--muted" id="ventajas" aria-labelledby="rt-features-title">
      <div className="rt-shell">
        <Reveal className="rt-head rt-head--center">
          <span className="rt-eyebrow">
            <Award size={14} /> Ventajas del sistema
          </span>
          <h2 id="rt-features-title">
            Por qué RepuesTop es la forma más segura de comprar repuestos
          </h2>
          <p>
            Diseñamos cada función para erradicar las malas experiencias del rubro: piezas que no
            calzan, tiendas sin respaldo, pagos informales y falta de garantía.
          </p>
        </Reveal>

        {/* Las tres que resuelven las objeciones principales: calce, dinero y
            qué pasa si algo sale mal. */}
        <div className="rt-feat-tierA">
          {TIER_A.map((feat, index) => (
            <Reveal
              as="article"
              className="rt-featA"
              key={feat.id}
              delay={index * 70}
            >
              <span className="rt-feat-icon" data-accent={feat.accent}>
                <feat.Icon size={26} />
              </span>
              <span className="rt-badge" data-accent={feat.accent}>{feat.badge}</span>
              <h3>{feat.title}</h3>
              <p>{feat.desc}</p>
              <p className="rt-featA__foot" data-accent={feat.accent}>
                <Sparkles size={14} />
                <span>{feat.benefit}</span>
              </p>
            </Reveal>
          ))}
        </div>

        <div className="rt-feat-tierB">
          {TIER_B.map((feat, index) => (
            <Reveal as="article" className="rt-featB" key={feat.id} delay={index * 60}>
              <span className="rt-feat-icon" data-accent={feat.accent}>
                <feat.Icon size={22} />
              </span>
              <span className="rt-badge" data-accent={feat.accent}>{feat.badge}</span>
              <h4>{feat.title}</h4>
              <p>{feat.desc}</p>
            </Reveal>
          ))}
        </div>

        <div className="rt-feat-tierC">
          {TIER_C.map((feat) => (
            <div className="rt-featC" key={feat.id}>
              <span className="rt-feat-icon" data-accent={feat.accent}>
                <feat.Icon size={18} />
              </span>
              <div>
                <strong>{feat.title}</strong>
                <span>{feat.benefit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
