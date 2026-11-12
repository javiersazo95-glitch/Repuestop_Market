import React, { useEffect } from 'react';
import { GitBranch, Hourglass, Store, Trophy, X } from 'lucide-react';
import { resolveMediaUrl } from '../../../services/api';
import { formatMinutes, weekLabel } from '../../../utils/assistantVisibility';
import { MEDALS, RankingSuggestions } from './VisibilityParts';

const responseRate = (store) => (store.derivaciones > 0 ? `${Math.round((store.respondidas / store.derivaciones) * 100)}%` : '—');

function Row({ row }) {
  const medal = row.posicion && row.posicion <= 3 ? MEDALS[row.posicion] : null;
  const photo = row.foto ? resolveMediaUrl(row.foto) : null;
  return (
    <div className={`rv-tr${row.esMiTienda ? ' is-me' : ''}`} aria-label={`${row.posicion ? `Lugar ${row.posicion}` : 'Sin lugar'}: ${row.nombre}${row.esMiTienda ? ' (tu tienda)' : ''}, ${row.derivaciones} consultas, ${responseRate(row)} respondidas`}>
      <span className="rv-col-pos">{medal ? <span className="rv-medal" style={{ background: medal.main }}>{row.posicion}</span> : <span className="rv-muted">{row.posicion ?? '—'}</span>}</span>
      <span className="rv-col-store">
        <span className="rv-row-avatar">{photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <Store size={14} />}</span>
        <span className="rv-row-copy">
          <strong>{row.esMiTienda ? `${row.nombre} (tú)` : row.nombre}</strong>
          <small>{[row.comuna, row.minutosMediana != null ? `resp. en ${formatMinutes(row.minutosMediana)}` : null].filter(Boolean).join(' · ') || '—'}</small>
        </span>
      </span>
      <span className="rv-col-count">{row.derivaciones}</span>
      <span className="rv-col-rate">{responseRate(row)}</span>
      <span className="rv-col-rating">{row.rating ? Number(row.rating).toFixed(1) : '—'}</span>
    </div>
  );
}

function Summary({ Icon, value, label, highlight }) {
  return (
    <div className={`rv-summary-item${highlight ? ' is-gold' : ''}`}>
      <Icon size={14} />
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

/**
 * "Ver más" del podio (`WeeklyRankingSheet.tsx`): las casas a las que Repuestín más derivó consultas esta semana, con la
 * propia destacada (o fija abajo si no está entre las 20) y lo que le falta para subir. Todo vuelve a cero cada lunes.
 * Celular: hoja desde abajo; escritorio: ventana centrada.
 */
export default function WeeklyRankingSheet({ open, ranking, isMobile, onClose, onSuggestion }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open || !ranking) return null;
  const me = ranking.miTienda;
  const meInTop = ranking.top.some((row) => row.esMiTienda);
  return (
    <div className={`rv-modal-root${isMobile ? ' is-mobile' : ' is-desktop'}`}>
      <button type="button" className="rv-backdrop" aria-label="Cerrar ranking" onClick={onClose} />
      <section className="rv-modal rv-ranking" role="dialog" aria-modal="true" aria-label="Ranking de la semana">
        {isMobile && <span className="rv-grabber" aria-hidden="true" />}
        <header className="rv-modal-head">
          <div>
            <h2>Ranking de la semana</h2>
            <small>{weekLabel(ranking)} · se reinicia cada lunes</small>
          </div>
          <button type="button" className="rv-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="rv-summary">
          <Summary Icon={GitBranch} value={String(ranking.totalDerivaciones)} label="consultas derivadas" />
          <Summary Icon={Store} value={String(ranking.tiendasConDerivaciones)} label="casas con consultas" />
          <Summary Icon={Trophy} value={me.posicion ? `#${me.posicion}` : '—'} label="tu lugar" highlight />
        </div>
        <div className="rv-modal-scroll">
          <div className="rv-table">
            <div className="rv-tr rv-th">
              <span className="rv-col-pos">#</span>
              <span className="rv-col-store">Casa de repuestos</span>
              <span className="rv-col-count">Consultas</span>
              <span className="rv-col-rate">Resp.</span>
              <span className="rv-col-rating">★</span>
            </div>
            {ranking.top.length === 0 ? (
              <div className="rv-table-empty"><Hourglass size={22} /><span>La semana recién parte: aún no hay consultas derivadas. ¡El primer lugar está libre!</span></div>
            ) : ranking.top.map((row) => <Row key={`${row.proveedorId}-${row.posicion}`} row={row} />)}
          </div>
          <p className="rv-caption">
            Consultas: las que Repuestín le derivó a cada casa esta semana (todas parten en 0 el lunes). Resp.: cuántas respondió. A igual número, sube la que responde más y más rápido, la mejor valorada y la de catálogo más amplio.
          </p>
          <RankingSuggestions suggestions={ranking.sugerencias} onPress={onSuggestion} position={me.posicion} />
        </div>
        {!meInTop && <div className="rv-me-footer"><Row row={me} /></div>}
      </section>
    </div>
  );
}
