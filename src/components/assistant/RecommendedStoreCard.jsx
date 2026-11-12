import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Circle, Sparkles, Star, Store } from 'lucide-react';
import { resolveMediaUrl } from '../../services/api';
import { sinceLabel, storeFacts } from '../../utils/assistantVisibility';
import { FactIcon } from './AssistantBits';

const AFFINITY = {
  ALTA: { label: 'Muy probable', tone: 'good' },
  MEDIA: { label: 'Probable', tone: 'fair' },
  POSIBLE: { label: 'Posible', tone: 'none' },
};
const MEDAL = { 1: '#E0A800', 2: '#94A3B8', 3: '#C2773A' };
/** Datos a la vista antes de "Ver más datos": lo justo para decidir sin llenar el chat. */
const FACTS_PREVIEW = 4;

/**
 * Tarjeta de una casa recomendada por Repuestín (`components/assistant/RecommendedStoreCard.tsx`): quién es, por qué
 * se la recomienda y lo que registró. La misma tarjeta es la vista previa "Así te ve el comprador" del vendedor.
 */
export default function RecommendedStoreCard({ name, logoUrl, comuna, rank, affinity, reasons = [], ficha, selected, onToggle, onOpenProfile }) {
  const [expanded, setExpanded] = useState(false);
  const tone = AFFINITY[affinity] || AFFINITY.POSIBLE;
  const logo = logoUrl ? resolveMediaUrl(logoUrl) : null;
  const facts = ficha ? storeFacts(ficha) : [];
  const visibleFacts = expanded ? facts : facts.slice(0, FACTS_PREVIEW);
  const since = sinceLabel(ficha?.enRepuestopDesde);
  const selectable = typeof onToggle === 'function';
  const rating = Number(ficha?.rating);
  const meta = [
    comuna,
    rating ? `★ ${rating.toFixed(1)}${ficha?.cantidadOpiniones ? ` (${ficha.cantidadOpiniones})` : ''}` : null,
    since ? `Desde ${since}` : null,
  ].filter(Boolean).join(' · ');
  const medal = rank && rank <= 3 ? MEDAL[rank] : 'var(--ak-primary, #0066ff)';
  const label = `${rank ? `Puesto ${rank}: ` : ''}${name}${comuna ? `, ${comuna}` : ''}. ${tone.label}. ${reasons.slice(0, 2).join('. ')}`;

  const Wrapper = selectable ? 'div' : 'article';
  const wrapperProps = selectable
    ? {
      role: 'checkbox',
      tabIndex: 0,
      'aria-checked': Boolean(selected),
      'aria-label': label,
      onClick: onToggle,
      onKeyDown: (event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); onToggle(); } },
    }
    : { 'aria-label': label };

  return (
    <Wrapper className={`ra-store-card${selectable ? ' is-selectable' : ''}${selected ? ' is-on' : ''}`} {...wrapperProps}>
      <div className="ra-store-head">
        <div className="ra-store-logo-wrap">
          {logo ? <img className="ra-store-logo" src={logo} alt="" referrerPolicy="no-referrer" /> : <span className="ra-store-logo is-fallback"><Store size={22} /></span>}
          {rank ? <span className="ra-store-rank" style={{ background: medal }}>{rank}</span> : null}
        </div>
        <div className="ra-store-copy">
          <div className="ra-store-title">
            <strong>{name}</strong>
            <span className={`ra-affinity is-${tone.tone}`}>{tone.label}</span>
          </div>
          {meta && <small className="ra-store-meta">{meta}</small>}
          {onOpenProfile && (
            <button type="button" className="ra-link ra-store-profile" onClick={(event) => { event.stopPropagation(); onOpenProfile(); }} aria-label={`Ver perfil de ${name}`}>
              Ver perfil <ChevronRight size={13} />
            </button>
          )}
          {ficha && (ficha.tiendaNueva || ficha.fundadora) ? (
            <div className="ra-store-badges">
              {ficha.fundadora && <span className="ra-badge is-gold"><Star size={10} /> Tienda fundadora</span>}
              {ficha.tiendaNueva && <span className="ra-badge is-blue"><Sparkles size={10} /> Nueva en RepuesTop</span>}
            </div>
          ) : null}
        </div>
        {selectable && (selected
          ? <CheckCircle2 size={26} className="ra-check is-on" aria-hidden="true" />
          : <Circle size={26} className="ra-check" aria-hidden="true" />)}
      </div>

      {reasons.length > 0 && (
        <ul className="ra-store-reasons">
          {reasons.slice(0, 2).map((reason) => (
            <li key={reason}><CheckCircle2 size={14} aria-hidden="true" /><span>{reason}</span></li>
          ))}
        </ul>
      )}

      {visibleFacts.length > 0 && (
        <div className="ra-store-facts">
          {visibleFacts.map((fact) => (
            <div key={fact.key} className="ra-store-fact" aria-label={`${fact.label}: ${fact.text}`}>
              <FactIcon name={fact.icon} />
              <div><em>{fact.label}</em><span>{fact.text}</span></div>
            </div>
          ))}
        </div>
      )}

      {facts.length > FACTS_PREVIEW && (
        <button type="button" className="ra-link" onClick={(event) => { event.stopPropagation(); setExpanded((value) => !value); }}>
          {expanded ? 'Ver menos' : `Ver ${facts.length - FACTS_PREVIEW} datos más`}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
    </Wrapper>
  );
}
