import Reveal from './Reveal';
import { METRICS } from './data';

export default function MetricsStrip() {
  return (
    <section className="rt-metrics-band" aria-label="Cifras del ecosistema RepuesTop">
      <div className="rt-shell">
        <ul className="rt-metrics">
          {METRICS.map(({ Icon, value, label, note }, index) => (
            <Reveal as="li" className="rt-metric" key={value} delay={index * 60}>
              <span className="rt-metric__icon">
                <Icon size={20} />
              </span>
              <span className="rt-metric__value">{value}</span>
              <span className="rt-metric__label">{label}</span>
              <p>{note}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
