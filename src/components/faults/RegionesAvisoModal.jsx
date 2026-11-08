import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Circle, Home, MapPin, X } from 'lucide-react';
import { REGION_MAP, REGION_MAP_VIEWBOX, regionDelMapa } from '../../data/chileRegionsMap';

const ORDEN = new Map(REGION_MAP.map((item, index) => [item.key, index]));

/**
 * Ventana "¿A qué regiones avisar?" de las fallas: el mapa de Chile a la izquierda y las regiones de norte a sur a la derecha.
 * Tu región va siempre (azul fuerte, no se quita); las que se suman quedan en azul claro. Las vecinas vienen del catálogo
 * (`/geografia/regiones/{id}/vecinas`), no de una lista fija en el código.
 * `regions` es el catálogo ({ id, nombre }); `selected` son los nombres ya sumados, sin la región de origen.
 */
export default function RegionesAvisoModal({ regions, originId, neighborIds = [], selected = [], onApply, onClose }) {
  const items = useMemo(() => regions
    .map((region) => ({ ...region, mapa: regionDelMapa(region.nombre) }))
    .sort((a, b) => (ORDEN.get(a.mapa?.key) ?? 99) - (ORDEN.get(b.mapa?.key) ?? 99)), [regions]);
  const [picked, setPicked] = useState(() => new Set(selected));
  const [hover, setHover] = useState('');

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isOrigin = (item) => String(item.id) === String(originId);
  const toggle = (item) => {
    if (isOrigin(item)) return;
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(item.nombre)) next.delete(item.nombre); else next.add(item.nombre);
      return next;
    });
  };
  const origin = items.find(isOrigin);
  const neighborSet = new Set(neighborIds.map(String));
  const neighbors = items.filter((item) => neighborSet.has(String(item.id)) && !isOrigin(item));
  const extra = items.filter((item) => !isOrigin(item) && picked.has(item.nombre));
  const stateOf = (item) => (isOrigin(item) ? 'is-origin' : picked.has(item.nombre) ? 'is-on' : '');
  const zonas = [];
  items.forEach((item) => { const zona = item.mapa?.zona || 'Otras'; if (zonas[zonas.length - 1] !== zona) zonas.push(zona); });

  return createPortal(
    <div className="ft-modal-backdrop ft-page" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="ft-modal rg-modal" role="dialog" aria-modal="true" aria-label="A qué regiones avisar">
        <div className="ft-modal-head">
          <div>
            <h2>¿A qué regiones avisar?</h2>
            <p className="ft-sub" style={{ margin: '2px 0 0' }}>{origin ? 'Tu región va siempre. ' : ''}Suma las que quieras: las verán los talleres de ahí.</p>
          </div>
          <button type="button" className="ft-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="rg-tools">
          {neighbors.length > 0 && (
            <button type="button" className="ft-btn ft-btn-outline" onClick={() => setPicked((current) => new Set([...current, ...neighbors.map((item) => item.nombre)]))}>
              <MapPin size={15} /> Sumar vecinas
            </button>
          )}
          <button type="button" className="ft-btn ft-btn-outline" onClick={() => setPicked(new Set())}>Quitar elegidas</button>
        </div>
        <div className="rg-body">
          <div className="rg-map">
            <svg viewBox={REGION_MAP_VIEWBOX} role="img" aria-label="Mapa de Chile por regiones">
              {items.filter((item) => item.mapa).map((item) => (
                <path key={item.id} d={item.mapa.d} className={`${stateOf(item)} ${hover === item.id ? 'is-hover' : ''}`}
                  onClick={() => toggle(item)} onMouseEnter={() => setHover(item.id)} onMouseLeave={() => setHover('')}>
                  <title>{item.mapa.label}</title>
                </path>
              ))}
            </svg>
          </div>
          <div className="rg-list" role="group" aria-label="Regiones, de norte a sur">
            {zonas.map((zona) => (
              <React.Fragment key={zona}>
                <div className="rg-zone">{zona}</div>
                {items.filter((item) => (item.mapa?.zona || 'Otras') === zona).map((item) => (
                  <button key={item.id} type="button" className={`rg-row ${stateOf(item)} ${hover === item.id ? 'is-hover' : ''}`}
                    aria-pressed={isOrigin(item) || picked.has(item.nombre)}
                    onClick={() => toggle(item)} onMouseEnter={() => setHover(item.id)} onMouseLeave={() => setHover('')}>
                    {isOrigin(item) ? <Home size={15} /> : picked.has(item.nombre) ? <Check size={15} /> : <Circle size={15} />}
                    <span>{item.mapa?.label || item.nombre}</span>
                    {isOrigin(item) && <em>Tu región</em>}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="rg-legend"><span><b className="is-origin" />Tu región</span><span><b className="is-on" />Elegida</span><span><b />Sin elegir</span></div>
        <div className="rg-foot">
          <span>{extra.length
            ? `Avisaremos a ${extra.length + 1} regiones: ${[origin, ...extra].filter(Boolean).map((item) => item.mapa?.label || item.nombre).join(', ')}.`
            : 'Solo tu región por ahora. Suma al menos otra para usar «Varias regiones».'}</span>
          <div className="ft-actions">
            <button type="button" className="ft-btn ft-btn-outline" onClick={onClose}>Cancelar</button>
            <button type="button" className="ft-btn ft-btn-primary" onClick={() => onApply(extra.map((item) => item.nombre))}>Listo</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
