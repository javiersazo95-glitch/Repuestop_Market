import React from 'react';
import { LEGAL_VERSION } from '../../data/legalTexts';

// Las secciones vienen numeradas ("7. COMPRA, PAGO Y TARIFA DE SERVICIO"), así
// que se detectan por ese encabezado y el resto son párrafos de la sección.
function parseSections(text) {
  const sections = [];
  String(text || '').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const heading = trimmed.match(/^(\d+)\.\s+([A-ZÁÉÍÓÚÑÜ0-9][^a-z]*)$/);
    if (heading) sections.push({ numero: heading[1], titulo: heading[2].trim(), parrafos: [] });
    else if (sections.length) sections[sections.length - 1].parrafos.push(trimmed);
    else sections.push({ numero: null, titulo: null, parrafos: [trimmed] });
  });
  return sections;
}

/** Render de un documento legal: índice lateral + secciones numeradas. */
export default function LegalDocument({ titulo, descripcion, texto, extra = null }) {
  const sections = parseSections(`${texto}${extra ? `\n${extra}` : ''}`);

  return (
    <article className="legal-document">
      <header className="legal-head">
        <h1>{titulo}</h1>
        {descripcion && <p>{descripcion}</p>}
        <small>Versión vigente: {LEGAL_VERSION}</small>
      </header>

      {/* Solo movil (public-mobile.css): el documento mide 10+ pantallazos. */}
      {sections.some((section) => section.numero) && (
        <details className="legal-mobile-index" id="indice-legal">
          <summary>Índice · {sections.filter((section) => section.numero).length} secciones</summary>
          <ol>
            {sections.filter((section) => section.numero).map((section) => (
              <li key={section.numero}>
                <a href={`#s${section.numero}`}><span>{section.numero}</span>{section.titulo}</a>
              </li>
            ))}
          </ol>
        </details>
      )}
      {sections.some((section) => section.numero) && (
        <a className="legal-mobile-top" href="#indice-legal" aria-label="Volver al índice">↑</a>
      )}

      <div className="legal-body">
        {sections.map((section, index) => (
          <section key={`${section.numero || 'intro'}-${index}`} id={section.numero ? `s${section.numero}` : undefined}>
            {section.titulo && <h2><span>{section.numero}</span>{section.titulo}</h2>}
            {section.parrafos.map((parrafo, pIndex) => (
              parrafo.startsWith('•')
                ? <p className="legal-bullet" key={pIndex}>{parrafo.replace(/^•\s*/, '')}</p>
                : <p key={pIndex}>{parrafo}</p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}

