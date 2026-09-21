import Reveal from './Reveal';
import CountUp from './CountUp';
import { METRICS } from './data';

export default function MetricsStrip() {
  return (
    <section className="rt-metrics-band" aria-label="Cifras del ecosistema RepuesTop">
      <div className="rt-shell">
        <ul className="rt-metrics">
          {METRICS.map(({ Icon, value, label, countTo }, index) => (
            <Reveal as="li" className="rt-metric" key={value} delay={index * 60}>
              <span className="rt-metric__icon">
                <Icon size={20} />
              </span>
              <span className="rt-metric__value">
                {countTo ? (
                  <CountUp to={countTo} format={(n) => value.replace(String(countTo), String(n))} />
                ) : (
                  value
                )}
              </span>
              <span className="rt-metric__label">{label}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
