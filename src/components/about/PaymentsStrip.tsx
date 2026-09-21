import { CreditCard, FileText, Landmark, ShieldCheck } from 'lucide-react';
import Reveal from './Reveal';

const METHODS = [
  { Icon: Landmark, label: 'Webpay Plus' },
  { Icon: CreditCard, label: 'Cuotas sin interés' },
  { Icon: ShieldCheck, label: 'Flow' },
  { Icon: FileText, label: 'Boleta y Factura' },
];

/** Señal de confianza mas barata que existe: qué medios de pago se aceptan. */
export default function PaymentsStrip() {
  return (
    <section className="rt-payments" aria-label="Medios de pago aceptados">
      <div className="rt-shell">
        <Reveal className="rt-payments__inner">
          <p className="rt-payments__title">Pagos procesados por las pasarelas líderes de Chile</p>
          <ul className="rt-payments__list">
            {METHODS.map(({ Icon, label }) => (
              <li key={label}>
                <Icon size={18} />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
