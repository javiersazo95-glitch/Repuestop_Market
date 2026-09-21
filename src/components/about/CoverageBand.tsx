import { MapPin, Truck } from 'lucide-react';
import Reveal from './Reveal';
import { COVERAGE_PILL, COVERAGE_STATS } from './data';

export default function CoverageBand() {
  const PillIcon = COVERAGE_PILL.Icon;

  return (
    <section className="rt-band rt-band--dark" aria-labelledby="rt-coverage-title">
      <div className="rt-shell rt-coverage-grid">
        <Reveal className="rt-coverage-copy">
          <span className="rt-eyebrow rt-eyebrow--onDark">
            <MapPin size={14} /> Cobertura nacional
          </span>

          <h2 id="rt-coverage-title">Juntos mantenemos a Chile en movimiento</h2>

          <p>
            Creemos en una movilidad más simple, transparente y conectada. Por eso acercamos a
            quienes necesitan repuestos con quienes los tienen, sin importar en qué ciudad estén.
          </p>

          <ul className="rt-coverage-stats">
            {COVERAGE_STATS.map(({ Icon, value, label }) => (
              <li key={value}>
                <Icon size={22} />
                <strong>{value}</strong>
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <p className="rt-coverage-pill">
            <PillIcon size={14} />
            <span>{COVERAGE_PILL.text}</span>
          </p>
        </Reveal>

        <Reveal className="rt-coverage-media" delay={90}>
          <figure className="rt-crop rt-crop--coverage">
            <img
              src="/about-assets/compradores.webp"
              alt="Vehículo y repuestos con la cordillera de fondo"
              width={1672}
              height={941}
              loading="lazy"
              decoding="async"
            />
          </figure>

          <div className="rt-coverage-glass">
            <Truck size={22} />
            <div>
              <strong>Envíos a todo Chile</strong>
              <small>Courier con seguimiento o retiro en tienda con PIN</small>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
