import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Acordeón de preguntas frecuentes. Reusa las clases `.support-faq-list` que ya
 * existían en el panel de ayuda del perfil para no duplicar estilos.
 */
export default function HelpFaqAccordion({ faqs = [], defaultOpen = 0 }) {
  const [openIndex, setOpenIndex] = useState(defaultOpen);

  if (!faqs.length) return null;

  return (
    <div className="support-faq-list">
      {faqs.map((faq, index) => (
        <article key={faq.q} className={openIndex === index ? 'open' : ''}>
          <button
            type="button"
            aria-expanded={openIndex === index}
            onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
          >
            <strong>{faq.q}</strong>
            <ChevronDown />
          </button>
          {openIndex === index && <p>{faq.a}</p>}
        </article>
      ))}
    </div>
  );
}

