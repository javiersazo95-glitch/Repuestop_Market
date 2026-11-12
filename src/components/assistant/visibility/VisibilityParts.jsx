import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, ArrowUp, Car, Check, CheckCircle2, ChevronDown, ChevronUp, Layers, Loader2, Lock, MessagesSquare, Package,
  Plus, Ribbon, Search, Sparkles, Store, Tags, TrendingDown, TrendingUp, Wrench, Zap, Bike,
} from 'lucide-react';
import { getPartCategoriesApi, getPartSubcategoriesApi, resolveMediaUrl } from '../../../services/api';
import { matchesLostSearch } from '../../../utils/assistantVisibility';
import { RepuestinAvatar } from '../AssistantBits';

/**
 * Piezas de "Que Repuestín te recomiende" (`components/assistant/visibility/*` de la app): anillo de avance, podio,
 * sugerencias del ranking, búsquedas que no le llegaron y el selector de rubros y repuestos.
 */

/** Anillo de avance con el % al centro. */
export function ProgressRing({ value, size = 96, stroke = 10, color = '#fff', track = 'rgba(255,255,255,.22)', textColor = '#fff', caption }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className="rv-ring" style={{ width: size, height: size }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} aria-label={`Perfil completo al ${clamped}%`}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="rv-ring-center" style={{ color: textColor }}>
        <strong style={{ fontSize: Math.round(size * 0.26), lineHeight: `${Math.round(size * 0.32)}px` }}>{clamped}%</strong>
        {caption && <small>{caption}</small>}
      </div>
    </div>
  );
}

/** Oro, plata y bronce del podio. */
export const MEDALS = {
  1: { main: '#E0A800', soft: '#FFF4CC', text: '#7A5A00' },
  2: { main: '#94A3B8', soft: '#EEF2F7', text: '#475569' },
  3: { main: '#C2773A', soft: '#FBEBDD', text: '#7C4317' },
};

function PodiumAvatar({ photo, name, size }) {
  const src = photo ? resolveMediaUrl(photo) : null;
  return (
    <span className="rv-podium-avatar" style={{ width: size, height: size }}>
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : name ? String(name).trim().slice(0, 2).toUpperCase() : <Store size={size * 0.45} />}
    </span>
  );
}

/**
 * Repuestín recomienda solo 3 casas por búsqueda: el podio lo muestra de un vistazo. Con `top` muestra las casas reales
 * de la semana; sin él, la silueta de la tienda dentro o fuera del podio.
 */
export function RecommendationPodium({ top, storePlace = null, storeName, storePhoto, tone = 'dark', compact = false }) {
  const order = [2, 1, 3];
  const heights = compact ? { 1: 46, 2: 34, 3: 26 } : { 1: 58, 2: 44, 3: 32 };
  const avatar = compact ? 30 : 40;
  const onDark = tone === 'dark';
  const live = top !== undefined;
  const byPlace = new Map((top ?? []).map((entry) => [entry.place, entry]));
  const label = live
    ? (top.length === 0 ? 'Podio de la semana: aún no hay casas con consultas' : `Podio de la semana: ${top.map((e) => `${e.place}° ${e.name}`).join(', ')}`)
    : storePlace ? `Podio de Repuestín: tu tienda aparece en el lugar ${storePlace} de 3` : 'Podio de Repuestín: hoy tu tienda queda fuera de las 3 recomendadas';
  return (
    <div className={`rv-podium${onDark ? ' is-dark' : ' is-light'}`} role="img" aria-label={label}>
      <div className="rv-podium-row">
        {order.map((place) => {
          const medal = MEDALS[place];
          const entry = live ? byPlace.get(place) : storePlace === place ? { place, name: storeName, photo: storePhoto, isMe: true } : undefined;
          return (
            <div key={place} className={`rv-podium-col${live ? ' is-live' : ''}`}>
              {entry ? (
                <span className="rv-podium-ring" style={{ borderColor: entry.isMe ? '#18A957' : medal.main }}>
                  <PodiumAvatar photo={entry.photo} name={entry.name} size={avatar} />
                  {entry.isMe && <span className="rv-podium-me">TÚ</span>}
                </span>
              ) : (
                <span className="rv-podium-ghost" style={{ width: avatar + 6, height: avatar + 6 }}><Store size={avatar * 0.45} /></span>
              )}
              {live && <span className="rv-podium-name">{entry ? entry.name : 'Libre'}</span>}
              <span className="rv-podium-block" style={{ height: heights[place], background: medal.soft, borderColor: medal.main }}>
                <span className="rv-podium-medal" style={{ background: medal.main }}>{place}</span>
              </span>
            </div>
          );
        })}
      </div>
      {!live && storePlace == null && (
        <div className="rv-podium-outside"><Lock size={12} /> <span>{storeName} · fuera del podio</span></div>
      )}
    </div>
  );
}

const IMPACT = {
  ALTO: { label: 'Sube mucho', cls: 'is-high' },
  MEDIO: { label: 'Sube', cls: 'is-mid' },
  BAJO: { label: 'Suma', cls: 'is-low' },
};
const SUGGESTION_ICONS = {
  REPUESTOS: Wrench, CATEGORIA: TrendingUp, RESPONDER: MessagesSquare, RAPIDEZ: Zap, MARCAS: Car, ENCARGO: Package,
  CATALOGO: Tags, TIPOS: Ribbon, DESPACHO: Bike,
};

/** "Repuestín te sugiere": lo que le falta a la casa para subir en el ranking. Cada fila lleva a completarlo. */
export function RankingSuggestions({ suggestions, onPress, position }) {
  return (
    <section className="rv-card rv-suggestions">
      <div className="rv-card-head">
        <RepuestinAvatar size={34} />
        <div>
          <h3>Repuestín te sugiere</h3>
          <small>
            {suggestions.length === 0 ? 'No te falta nada: mantén tus respuestas rápidas.'
              : position && position <= 3 ? 'Estás en el podio. Para no bajar:' : 'Para subir en el ranking de esta semana:'}
          </small>
        </div>
      </div>
      {suggestions.map((suggestion) => {
        const impact = IMPACT[suggestion.impacto] ?? IMPACT.BAJO;
        const Icon = SUGGESTION_ICONS[suggestion.clave] ?? Sparkles;
        return (
          <button key={suggestion.clave} type="button" className="rv-suggestion" onClick={() => onPress(suggestion)} aria-label={`${suggestion.titulo}. ${suggestion.detalle}. Ir a completarlo`}>
            <span className="rv-suggestion-icon"><Icon size={16} /></span>
            <span className="rv-suggestion-copy">
              <span className="rv-suggestion-title"><strong>{suggestion.titulo}</strong><em className={`rv-impact ${impact.cls}`}><ArrowUp size={10} />{impact.label}</em></span>
              <small>{suggestion.detalle}</small>
            </span>
            <span className="rv-go"><ArrowRight size={16} /></span>
          </button>
        );
      })}
    </section>
  );
}

const LOST_PREVIEW = 3;
const LOST_PAGE = 10;
const LOST_SEARCH_FROM = 8;

function LostRow({ group, rank, onPress }) {
  const missing = group.repuestos.filter((r) => !r.added);
  const shown = missing.slice(0, 2);
  const rest = missing.length - shown.length;
  const detail = shown.length > 0 ? `${shown.map((r) => `${r.nombre} (${r.cantidad})`).join(' · ')}${rest > 0 ? ` · +${rest}` : ''}` : 'Repuestos varios del rubro';
  return (
    <button type="button" className="rv-lost-row" onClick={onPress} aria-label={`${group.nombre}: ${group.cantidad} búsquedas. ${detail}. Ir a la categoría`}>
      <span className={`rv-lost-count${rank === 1 ? ' is-top' : ''}`}>{group.cantidad > 999 ? '999+' : group.cantidad}</span>
      <span className="rv-lost-copy">
        <span className="rv-lost-line"><em>Categoría</em><strong>{group.nombre}</strong></span>
        <span className="rv-lost-line"><em>{shown.length === 1 && rest === 0 ? 'Subcategoría' : 'Subcategorías'}</em><small>{detail}</small></span>
      </span>
      <span className="rv-lost-go">Agregar <ArrowRight size={14} /></span>
    </button>
  );
}

/** "Esta semana N búsquedas no te llegaron": rubros pendientes, del más al menos buscado. */
export function LostSearchesCard({ total, groups, onOpenCategory }) {
  const [expanded, setExpanded] = useState(false);
  const [limit, setLimit] = useState(LOST_PAGE);
  const [query, setQuery] = useState('');
  const [showAdded, setShowAdded] = useState(false);
  const pending = useMemo(() => groups.filter((g) => !g.added), [groups]);
  const added = useMemo(() => groups.filter((g) => g.added), [groups]);
  const filtered = useMemo(() => pending.filter((g) => matchesLostSearch(g, query)), [pending, query]);
  const visible = expanded ? filtered.slice(0, limit) : pending.slice(0, LOST_PREVIEW);
  const hiddenCount = expanded ? Math.max(0, filtered.length - limit) : Math.max(0, pending.length - LOST_PREVIEW);
  return (
    <section className="rv-card rv-lost">
      <div className="rv-card-head">
        <span className="rv-lost-icon"><TrendingDown size={20} /></span>
        <div>
          <h3 className="rv-danger">{total === 1 ? 'Esta semana 1 búsqueda no te llegó' : `Esta semana ${total} búsquedas no te llegaron`}</h3>
          <small>{pending.length > 0 ? 'Toca una categoría: te llevamos a ella para agregarla.' : groups.length > 0 ? '¡Bien! Ya agregaste todo lo que buscaron. Guarda para recibirlas.' : 'Cuéntale a Repuestín qué trabajas para recibirlas.'}</small>
        </div>
      </div>
      {expanded && pending.length >= LOST_SEARCH_FROM && (
        <label className="rv-search">
          <Search size={15} />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(LOST_PAGE); }} placeholder="Buscar categoría o subcategoría" aria-label="Buscar entre las búsquedas perdidas" />
        </label>
      )}
      {visible.length > 0 ? (
        <div className="rv-lost-list">
          {visible.map((group, index) => <LostRow key={group.categoriaId} group={group} rank={index + 1} onPress={() => onOpenCategory(group.categoriaId)} />)}
        </div>
      ) : expanded && query ? <p className="rv-caption rv-center">Ninguna categoría coincide con «{query.trim()}».</p> : null}
      {(hiddenCount > 0 || (expanded && pending.length > LOST_PREVIEW)) && (
        <div className="rv-lost-footer">
          {hiddenCount > 0 ? (
            <button type="button" className="rv-link rv-danger" onClick={() => (expanded ? setLimit((n) => n + LOST_PAGE) : setExpanded(true))}>
              {expanded ? `Ver ${Math.min(LOST_PAGE, hiddenCount)} más` : `Ver las ${pending.length} categorías`} <ChevronDown size={14} />
            </button>
          ) : <span />}
          {expanded && (
            <button type="button" className="rv-link rv-muted" onClick={() => { setExpanded(false); setQuery(''); setLimit(LOST_PAGE); }}>Mostrar menos <ChevronUp size={14} /></button>
          )}
        </div>
      )}
      {added.length > 0 && (
        <div>
          <button type="button" className="rv-added-line" onClick={() => setShowAdded((v) => !v)}>
            <CheckCircle2 size={16} /><span>{added.length === 1 ? '1 categoría ya agregada' : `${added.length} categorías ya agregadas`}</span>
            {showAdded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showAdded && (
            <div className="rv-chips">
              {added.map((group) => <button key={group.categoriaId} type="button" className="rv-added-chip" onClick={() => onOpenCategory(group.categoriaId)}>{group.nombre} · {group.cantidad}</button>)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Chip que se marca (rubro completo, repuesto, tipo, días). */
export function Chip({ label, selected, onPress, accent, icon: Icon, count }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      className={`rv-chip${selected ? ' is-on' : ''}`}
      style={selected ? { background: accent.main, borderColor: accent.main, color: '#fff' } : { borderColor: accent.border, color: accent.text }}
      onClick={onPress}
    >
      {selected ? <Check size={14} /> : Icon ? <Icon size={14} /> : null}
      <span>{label}</span>
      {count > 0 && !selected && <em className="rv-chip-count">{count > 99 ? '99+' : count}</em>}
    </button>
  );
}

/**
 * Rubros como filas que se despliegan: "Todo frenos" declara el rubro completo y los chips de abajo declaran repuestos
 * puntuales. Con `focus` se despliega, destaca y lleva al rubro que tocó en "búsquedas que no te llegaron".
 */
export function PartsPicker({ accent, categories, parts, onToggleCategory, onTogglePart, focus, demand }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(focus?.categoryId ?? null);
  const [highlightId, setHighlightId] = useState(null);
  const [subsByCategory, setSubsByCategory] = useState({});
  const rowRefs = useRef(new Map());

  useEffect(() => {
    let active = true;
    getPartCategoriesApi()
      .then((items) => { if (active) setCatalog(Array.isArray(items) ? items : []); })
      .catch(() => { if (active) setError('No pudimos cargar los rubros. Revisa tu conexión.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!focus || !catalog) return undefined;
    setOpenId(focus.categoryId);
    setHighlightId(focus.categoryId);
    const scroll = setTimeout(() => rowRefs.current.get(focus.categoryId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    const unmark = setTimeout(() => setHighlightId(null), 2600);
    return () => { clearTimeout(scroll); clearTimeout(unmark); };
  }, [focus?.nonce, catalog]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (openId == null || subsByCategory[openId]) return;
    setSubsByCategory((current) => ({ ...current, [openId]: 'loading' }));
    getPartSubcategoriesApi(openId)
      .then((items) => setSubsByCategory((current) => ({ ...current, [openId]: Array.isArray(items) ? items : [] })))
      .catch(() => setSubsByCategory((current) => ({ ...current, [openId]: 'error' })));
  }, [openId, subsByCategory]);

  if (error) return <p className="rv-error">{error}</p>;
  if (!catalog) return <div className="rv-loader"><Loader2 size={22} className="ra-spin" style={{ color: accent.main }} /></div>;
  return (
    <div className="rv-parts">
      {catalog.map((category) => {
        const isOpen = openId === category.id;
        const wholeCategory = categories.has(category.id);
        const pickedHere = [...parts.values()].filter((part) => part.categoriaId === category.id).length;
        const active = wholeCategory || pickedHere > 0;
        const subs = subsByCategory[category.id];
        const searched = demand?.byCategory.get(category.id) ?? 0;
        const highlighted = highlightId === category.id;
        const orderedSubs = Array.isArray(subs) && demand ? [...subs].sort((a, b) => (demand.byPart.get(b.id) ?? 0) - (demand.byPart.get(a.id) ?? 0)) : subs;
        return (
          <div
            key={category.id}
            ref={(node) => { if (node) rowRefs.current.set(category.id, node); else rowRefs.current.delete(category.id); }}
            className={`rv-parts-row${highlighted ? ' is-highlight' : ''}`}
            style={active || highlighted ? { borderColor: highlighted ? accent.main : accent.border, background: accent.soft } : undefined}
          >
            <button type="button" className="rv-parts-head" onClick={() => setOpenId(isOpen ? null : category.id)} aria-expanded={isOpen}>
              <span className="rv-parts-dot" style={{ background: active ? accent.main : undefined, color: active ? '#fff' : undefined }}>{active ? <Check size={14} /> : <Plus size={14} />}</span>
              <strong>{category.nombre}</strong>
              {searched > 0 && !active && <span className="rv-demand" aria-label={`${searched} búsquedas esta semana`}><Search size={11} />{searched > 99 ? '99+' : searched}</span>}
              {wholeCategory ? <em style={{ color: accent.text }}>Todo el rubro</em> : pickedHere > 0 ? <em style={{ color: accent.text }}>{pickedHere} elegido{pickedHere === 1 ? '' : 's'}</em> : null}
              {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {isOpen && (
              <div className="rv-chips rv-parts-chips">
                <Chip label={`Todo ${String(category.nombre).toLowerCase()}`} icon={Layers} selected={wholeCategory} accent={accent} onPress={() => onToggleCategory({ id: category.id, nombre: category.nombre })} />
                {subs === 'loading' && <Loader2 size={18} className="ra-spin" style={{ color: accent.main }} />}
                {subs === 'error' && <span className="rv-error">No pudimos cargar sus repuestos.</span>}
                {Array.isArray(orderedSubs) && orderedSubs.map((sub) => (
                  <Chip
                    key={sub.id}
                    label={sub.nombre}
                    selected={parts.has(sub.id)}
                    accent={accent}
                    count={demand?.byPart.get(sub.id)}
                    onPress={() => onTogglePart({ id: sub.id, nombre: sub.nombre, categoriaId: category.id })}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
