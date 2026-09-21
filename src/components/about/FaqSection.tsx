import { useState } from 'react';
import { ChevronDown, Headphones, MessageCircle } from 'lucide-react';
import Reveal from './Reveal';
import { FAQS } from './data';

export default function FaqSection({ onContact }: { onContact: () => void }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="rt-band" id="preguntas" aria-labelledby="rt-faq-title">
      <div className="rt-shell rt-faq-grid">
        <div className="rt-faq-aside">
          <Reveal className="rt-head">
            <span className="rt-eyebrow">
              <MessageCircle size={14} /> Respuestas claras
            </span>
            <h2 id="rt-faq-title">Preguntas frecuentes</h2>
            <p>Resolvemos las dudas más comunes sobre compras, despachos, app móvil y garantías.</p>
          </Reveal>

          <Reveal className="rt-faq-help" delay={80}>
            <span className="rt-faq-help__icon">
              <Headphones size={22} />
            </span>
            <strong>¿Aún tienes preguntas?</strong>
            <p>Nuestro equipo está listo para ayudarte con cualquier caso especial.</p>
            <button type="button" className="rt-btn rt-btn--primary" onClick={onContact}>
              Contáctanos
            </button>
          </Reveal>
        </div>

        <ul className="rt-faq-list">
          {FAQS.map((faq, index) => {
            const isOpen = open === index;
            const panelId = `rt-faq-panel-${index}`;
            const buttonId = `rt-faq-btn-${index}`;

            return (
              <Reveal
                as="li"
                className={`rt-faq-item${isOpen ? ' is-open' : ''}`}
                key={faq.q}
                delay={Math.min(index * 40, 240)}
              >
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : index)}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown size={18} />
                  </button>
                </h3>
                {/* `hidden` y no `display:none` por CSS: asi el contenido sale
                    del arbol de accesibilidad de forma explicita. */}
                <div
                  className="rt-faq-answer"
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                >
                  <p>{faq.a}</p>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
