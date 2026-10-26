import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Gavel, LayoutGrid, List, Loader2, MinusCircle, Package, PackagePlus, Search,
  ShieldCheck, SlidersHorizontal, Sparkles, X, XCircle,
} from 'lucide-react';
import { getAuctionSuggestedParts, submitAuctionQuote } from '../services/auctionApi';
import { resolveMediaUrl } from '../services/api';
import { compatibilidadLinea, mapCompatibilidad } from '../services/adapters';
import { evaluateOffer } from '../utils/auctionOfferFit';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import NewCatalogProductModal from './NewCatalogProductModal';
import { itemVehicleLabel } from './AuctionItemsCard';
import '../styles/auction-quote.css';

const nf = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const money = (value) => (value == null || Number.isNaN(value) ? '—' : nf.format(value));

const DELIVERY_TIMES = ['Mismo día / Retiro inmediato', '24 horas', '48 horas', '3 a 5 días hábiles', 'A coordinar con cliente'];
// Los métodos de entrega son los del checkout: así el pago de la compra calza con lo que ofreciste.
const DELIVERY_TYPES = ['Retiro en tienda', 'Envío dentro de la comuna', 'Envío fuera de la comuna'];
const VALIDITIES = ['24 horas', '48 horas', '72 horas', '7 días'];
const CHECK_ICON = { ok: CheckCircle2, warn: AlertTriangle, bad: XCircle, neutral: MinusCircle };

const CONDITION_LABEL = { ORIGINAL: 'Original', ALTERNATIVO: 'Alternativo', USADO: 'Usado', NUEVO: 'Nuevo', REACONDICIONADO: 'Reacondicionado' };
const conditionLabel = (value) => CONDITION_LABEL[String(value || '').toUpperCase()] || (value ? String(value) : '');

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const tokens = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((t) => t.length > 2);

/** Cuántas palabras del repuesto pedido aparecen en el nombre del producto de la tienda (para ordenar sugerencias). */
function nameScore(partName, itemName) {
  const wanted = tokens(itemName);
  if (wanted.length === 0) return 0;
  const have = new Set(tokens(partName));
  return wanted.filter((token) => have.has(token)).length / wanted.length;
}

function PartCard({ part, selected, compatible, vehicle, onSelect, showDescription = false }) {
  const photo = part.imageUrls?.[0] ? resolveMediaUrl(part.imageUrls[0]) : null;
  const title = part.nombrePublicado || part.repuestoNombre || 'Repuesto';
  const meta = [
    part.marcaRepuesto && { label: 'Marca', value: part.marcaRepuesto },
    part.referenciaOem && { label: 'OEM', value: part.referenciaOem },
    part.skuProveedor && { label: 'SKU', value: part.skuProveedor },
    part.condicion && { label: 'Condición', value: conditionLabel(part.condicion) },
    part.garantia && { label: 'Garantía', value: part.garantia },
  ].filter(Boolean);

  return (
    <button type="button" className={`aq-part ${selected ? 'is-selected' : ''}`} onClick={() => onSelect?.(part)} aria-pressed={selected}>
      <span className="aq-part-photo">{photo ? <img src={photo} alt="" loading="lazy" /> : <Package size={26} />}</span>
      <span className="aq-part-body">
        <strong>{title}</strong>
        {showDescription && part.descripcion && <span className="aq-part-desc">{part.descripcion}</span>}
        <span className="aq-part-tags">
          {compatible === null ? null : compatible
            ? <em className="is-ok"><CheckCircle2 size={12} /> Compatible con {vehicle || 'el vehículo'}</em>
            : <em className="is-warn"><AlertTriangle size={12} /> Sin compatibilidad registrada para este vehículo</em>}
          {part.stock != null && <em className={part.stock > 0 ? '' : 'is-bad'}>{part.stock} en stock</em>}
        </span>
        <span className="aq-part-meta">
          {meta.map((item) => <span key={item.label}><small>{item.label}</small> {item.value}</span>)}
        </span>
      </span>
      <span className="aq-part-price">
        <small>Tu precio</small>
        <strong>{money(part.precio)}</strong>
        {selected && <span className="aq-part-check"><CheckCircle2 size={16} /> Elegido</span>}
      </span>
    </button>
  );
}

function InventoryTile({ part, selected, compatible, onSelect }) {
  const photo = part.imageUrls?.[0] ? resolveMediaUrl(part.imageUrls[0]) : null;
  const title = part.nombrePublicado || part.repuestoNombre || 'Repuesto';
  const sub = [part.marcaRepuesto, conditionLabel(part.condicion)].filter(Boolean).join(' · ');
  const registered = registeredCompatibility(part);
  return (
    <button type="button" className={`aq-tile ${selected ? 'is-selected' : ''}`} onClick={() => onSelect(part)} aria-pressed={selected}>
      <span className="aq-tile-image">
        {photo ? <img src={photo} alt={title} loading="lazy" /> : <Package size={36} />}
        {compatible && <em className="aq-tile-compat"><CheckCircle2 size={12} /> Compatible</em>}
      </span>
      <span className="aq-tile-body">
        <small className="aq-mono">{part.skuProveedor ? `SKU ${part.skuProveedor}` : 'Sin SKU'}</small>
        <strong title={title}>{title}</strong>
        {sub && <span className="aq-tile-sub">{sub}</span>}
        <span className="aq-tile-oem"><small>OEM</small> <b className="aq-mono">{part.referenciaOem || '—'}</b></span>
        <span className={`aq-tile-fit ${registered ? '' : 'is-empty'}`} title={registered || undefined}>
          <small>Compatibilidad registrada</small>
          {registered || 'Sin compatibilidad registrada'}
        </span>
        <span className="aq-tile-row">
          <span className={part.stock > 0 ? '' : 'is-bad'}>{part.stock ?? 0} en stock</span>
          <b>{money(part.precio)}</b>
        </span>
      </span>
      <span className="aq-tile-cta">{selected ? <><CheckCircle2 size={15} /> Elegido</> : 'Elegir este repuesto'}</span>
    </button>
  );
}

function InventoryTable({ parts, selectedId, compatibleIds, onSelect }) {
  return (
    <div className="aq-inv-table-wrap">
      <table className="aq-inv-table">
        <thead>
          <tr><th>Repuesto</th><th>Marca</th><th>OEM</th><th>SKU</th><th>Condición</th><th>Garantía</th><th>Compatibilidad registrada</th><th className="is-num">Stock</th><th className="is-num">Precio</th><th /></tr>
        </thead>
        <tbody>
          {parts.map((part) => {
            const photo = part.imageUrls?.[0] ? resolveMediaUrl(part.imageUrls[0]) : null;
            const title = part.nombrePublicado || part.repuestoNombre || 'Repuesto';
            return (
              <tr key={part.id} className={selectedId === part.id ? 'is-selected' : ''} onClick={() => onSelect(part)}>
                <td><span className="aq-inv-cell-name"><span className="aq-inv-thumb">{photo ? <img src={photo} alt="" loading="lazy" /> : <Package size={16} />}</span><strong title={title}>{title}</strong></span></td>
                <td>{part.marcaRepuesto || '—'}</td>
                <td className="aq-mono">{part.referenciaOem || '—'}</td>
                <td className="aq-mono">{part.skuProveedor || '—'}</td>
                <td>{conditionLabel(part.condicion) || '—'}</td>
                <td>{part.garantia || '—'}</td>
                <td className="aq-inv-fit" title={registeredCompatibility(part) || undefined}>{compatibleIds.has(part.id) && <em className="aq-inv-yes"><CheckCircle2 size={13} /> Compatible</em>}<span>{registeredCompatibility(part) || 'Sin registro'}</span></td>
                <td className={`is-num ${part.stock > 0 ? '' : 'is-bad'}`}>{part.stock ?? 0}</td>
                <td className="is-num"><b>{money(part.precio)}</b></td>
                <td><button type="button" className="aq-btn-outline aq-inv-pick" onClick={(event) => { event.stopPropagation(); onSelect(part); }}>{selectedId === part.id ? 'Elegido' : 'Elegir'}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Vehículos para los que el producto tiene compatibilidad registrada ("Hyundai Accent 2018–2022 · +2 vehículos"). */
const registeredCompatibility = (part) => compatibilidadLinea(mapCompatibilidad(part));

const SORTS = [
  { value: 'relevancia', label: 'Más parecidos' },
  { value: 'precio-asc', label: 'Precio: menor a mayor' },
  { value: 'precio-desc', label: 'Precio: mayor a menor' },
  { value: 'nombre', label: 'Nombre A-Z' },
];
// El backend entrega hasta 50 por página; son múltiplos de 4 para que el mosaico (4 columnas) cierre sus filas.
const PAGE_SIZES = [12, 24, 48];
const EMPTY_FILTERS = { condicion: '', marca: '', soloStock: false, soloCompatibles: false, orden: 'relevancia' };

/**
 * Pantalla completa con todo el inventario de la tienda: búsqueda y filtros avanzados en la misma fila,
 * y "Volver" regresa a la oferta justo donde estaba.
 */
function InventoryPicker({ auction, item, vehicle, takenPartIds, selectedId, onSelect, onBack, onCreate }) {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const listRef = useRef(null);
  const [parts, setParts] = useState([]);
  const [compatibleIds, setCompatibleIds] = useState(() => new Set());
  const isMobile = useIsMobile();
  // En escritorio la vista por defecto es el mosaico; la tabla sirve para comparar muchos repuestos de un vistazo.
  const [view, setView] = useState('grid');
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => { setPage(0); }, [debounced, pageSize]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getAuctionSuggestedParts(auction.id, { itemId: item.id, texto: debounced || undefined, soloCompatibles: false, size: pageSize, page })
      .then((data) => {
        if (!active) return;
        const content = data?.resultado?.content || [];
        setParts(content);
        setCompatibleIds(new Set(data?.idsCompatibles || []));
        setTotalPages(data?.resultado?.totalPages || 1);
        setTotalElements(data?.resultado?.totalElements ?? content.length);
        listRef.current?.scrollTo?.({ top: 0 });
      })
      .catch((err) => { if (active) setError(err?.message || 'No pudimos cargar tu inventario.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auction.id, item.id, debounced, page, pageSize]);

  const base = useMemo(() => parts.filter((part) => !takenPartIds.has(part.id)), [parts, takenPartIds]);
  const brands = useMemo(() => [...new Set(base.map((p) => p.marcaRepuesto).filter(Boolean))].sort(), [base]);
  const conditions = useMemo(() => [...new Set(base.map((p) => p.condicion).filter(Boolean))], [base]);
  const visible = useMemo(() => {
    const list = base.filter((part) => (
      (!filters.condicion || part.condicion === filters.condicion)
      && (!filters.marca || part.marcaRepuesto === filters.marca)
      && (!filters.soloStock || (part.stock || 0) > 0)
      && (!filters.soloCompatibles || compatibleIds.has(part.id))
    ));
    const byName = (part) => part.nombrePublicado || part.repuestoNombre || '';
    if (filters.orden === 'precio-asc') list.sort((a, b) => (a.precio || 0) - (b.precio || 0));
    else if (filters.orden === 'precio-desc') list.sort((a, b) => (b.precio || 0) - (a.precio || 0));
    else if (filters.orden === 'nombre') list.sort((a, b) => byName(a).localeCompare(byName(b), 'es'));
    else list.sort((a, b) => (Number(compatibleIds.has(b.id)) - Number(compatibleIds.has(a.id))) || (nameScore(byName(b), item.repuesto) - nameScore(byName(a), item.repuesto)));
    return list;
  }, [base, filters, compatibleIds, item.repuesto]);
  const activeFilters = ['condicion', 'marca', 'soloStock', 'soloCompatibles'].filter((key) => filters[key]).length + (filters.orden !== 'relevancia' ? 1 : 0);
  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onBack(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <div className="aq-inventory" role="dialog" aria-modal="true" aria-label="Todo mi inventario">
      <header className="aq-inv-head">
        <button type="button" className="aq-inv-back" onClick={onBack}><ArrowLeft size={18} /> Volver a la oferta</button>
        <div>
          <h2>Todo mi inventario</h2>
          <p>Elige el repuesto para <b>{item.repuesto}</b>{vehicle ? <> · {vehicle}</> : null}</p>
        </div>
      </header>

      <div className="aq-inv-bar">
        <label className="aq-search">
          <Search size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, OEM o SKU…" aria-label="Buscar en todo tu inventario" autoFocus />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}
        </label>
        <button type="button" className={`aq-inv-filter-btn ${filtersOpen || activeFilters ? 'is-active' : ''}`} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
          <SlidersHorizontal size={16} /> <span>Filtros</span>{activeFilters > 0 && <em>{activeFilters}</em>}
        </button>
        {!isMobile && (
          <div className="aq-inv-view" role="group" aria-label="Tipo de vista">
            <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-pressed={view === 'grid'} title="Vista de mosaico"><LayoutGrid size={16} /> Mosaico</button>
            <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} aria-pressed={view === 'table'} title="Vista de tabla"><List size={16} /> Tabla</button>
          </div>
        )}
      </div>

      {filtersOpen && (
        <div className="aq-inv-filters">
          <label className="aq-field"><span>Ordenar por</span>
            <select value={filters.orden} onChange={(e) => setFilter('orden', e.target.value)}>
              {SORTS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
            </select>
          </label>
          <label className="aq-field"><span>Marca</span>
            <select value={filters.marca} onChange={(e) => setFilter('marca', e.target.value)}>
              <option value="">Todas</option>
              {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
          </label>
          <label className="aq-field"><span>Condición</span>
            <select value={filters.condicion} onChange={(e) => setFilter('condicion', e.target.value)}>
              <option value="">Todas</option>
              {conditions.map((value) => <option key={value} value={value}>{conditionLabel(value)}</option>)}
            </select>
          </label>
          <label className="aq-switch"><input type="checkbox" checked={filters.soloStock} onChange={(e) => setFilter('soloStock', e.target.checked)} /> Solo con stock</label>
          <label className="aq-switch"><input type="checkbox" checked={filters.soloCompatibles} onChange={(e) => setFilter('soloCompatibles', e.target.checked)} /> Solo compatibles con el vehículo</label>
          {activeFilters > 0 && <button type="button" className="aq-link-btn" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar filtros</button>}
        </div>
      )}

      <div className="aq-inv-list" ref={listRef} aria-busy={loading}>
        {error ? (
          <p className="aq-notice is-bad"><AlertCircle size={16} /> {error}</p>
        ) : loading && parts.length === 0 ? (
          <div className="aq-inv-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="aq-part aq-skeleton" />)}</div>
        ) : visible.length === 0 ? (
          <div className="aq-empty">
            <Package size={26} />
            <strong>{debounced || activeFilters ? 'No encontramos repuestos con esa búsqueda o esos filtros' : 'Aún no tienes repuestos en tu inventario'}</strong>
            <div><button type="button" className="aq-btn-primary" onClick={onCreate}><PackagePlus size={15} /> Cargar repuesto</button></div>
          </div>
        ) : (
          <>
            <p className="aq-hint">{totalElements.toLocaleString('es-CL')} {totalElements === 1 ? 'repuesto' : 'repuestos'}{visible.length !== parts.length ? ` · ${visible.length} con los filtros en esta página` : ''}</p>
            {isMobile ? (
              visible.map((part) => (
                <PartCard key={part.id} part={part} selected={selectedId === part.id} compatible={compatibleIds.has(part.id)} vehicle={vehicle} onSelect={onSelect} />
              ))
            ) : view === 'grid' ? (
              <div className="aq-inv-grid">
                {visible.map((part) => (
                  <InventoryTile key={part.id} part={part} selected={selectedId === part.id} compatible={compatibleIds.has(part.id)} onSelect={onSelect} />
                ))}
              </div>
            ) : (
              <InventoryTable parts={visible} selectedId={selectedId} compatibleIds={compatibleIds} onSelect={onSelect} />
            )}
            <div className="aq-inv-pager">
              <label>Mostrar
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
                por página
              </label>
              <div>
                <button type="button" className="aq-btn-outline" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} /> Anterior</button>
                <span>Pág. {page + 1} de {totalPages}</span>
                <button type="button" className="aq-btn-outline" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>Siguiente <ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Un repuesto del pedido: la tienda marca si lo tiene, elige el producto de su inventario (sugerido según el
 * vehículo y el nombre pedido) o lo carga con el flujo normal, y fija su precio unitario.
 */
function ItemOfferRow({ auction, item, line, takenPartIds, onChange, onCreateRequest }) {
  const vehicle = item.vehiculoPropio ? itemVehicleLabel(item) : [auction.marca, auction.modelo, auction.anio].filter(Boolean).join(' ');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  // Aquí solo se ofrecen los compatibles con el vehículo; "Buscar en todo mi inventario" abre la pantalla completa.
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [suggestions, setSuggestions] = useState({ items: [], compatibleIds: [] });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [changing, setChanging] = useState(false);

  const enabled = Boolean(line?.enabled);
  const showPicker = enabled && (!line.part || changing);

  useEffect(() => {
    if (!showPicker) return undefined;
    let active = true;
    setLoading(true);
    setLoadError('');
    getAuctionSuggestedParts(auction.id, { itemId: item.id, texto: debounced || undefined, soloCompatibles: true, size: 50 })
      .then((data) => {
        if (!active) return;
        // Primero los compatibles con el vehículo; entre iguales, los que más se parecen al nombre pedido.
        const compatibleSet = new Set(data?.idsCompatibles || []);
        const list = [...(data?.resultado?.content || [])].sort((a, b) => (
          (Number(compatibleSet.has(b.id)) - Number(compatibleSet.has(a.id)))
          || (nameScore(b.nombrePublicado || b.repuestoNombre, item.repuesto) - nameScore(a.nombrePublicado || a.repuestoNombre, item.repuesto))
        ));
        setSuggestions({ items: list, compatibleIds: data?.idsCompatibles || [] });
      })
      .catch((err) => { if (active) setLoadError(err?.message || 'No pudimos cargar tus repuestos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showPicker, auction.id, item.id, item.repuesto, debounced]);

  const compatibleIds = useMemo(() => new Set(suggestions.compatibleIds), [suggestions.compatibleIds]);
  // Un repuesto del inventario cubre un solo repuesto del pedido: los ya elegidos en otras líneas no se sugieren de nuevo.
  const available = useMemo(() => suggestions.items.filter((part) => !takenPartIds.has(part.id)), [suggestions.items, takenPartIds]);
  const lineTotal = (parseFloat(line?.unitPrice) || 0) * item.cantidad;

  const pick = (part) => {
    onChange(item.id, { part, unitPrice: part.precio ? String(Math.round(part.precio)) : line.unitPrice, warranty: part.garantia || line.warranty });
    setChanging(false);
  };

  return (
    <li className={`aq-item ${enabled ? 'is-on' : ''}`}>
      <label className="aq-item-head">
        <span className="aq-item-title">
          <strong>{item.repuesto} <small>× {item.cantidad}</small></strong>
          <span>
            {item.categoria ? `${item.categoria} · ` : ''}Para {vehicle || 'el vehículo del pedido'}
            {item.vehiculoPropio ? <em className="aq-item-other">otro vehículo</em> : null}
          </span>
          {item.descripcion && <span className="aq-item-desc">{item.descripcion}</span>}
        </span>
        <span className={`aq-item-have ${line?.part ? 'is-on' : ''}`}>{line?.part ? <><CheckCircle2 size={14} /> Cubierto</> : 'Obligatorio'}</span>
      </label>

      {enabled && (
        <div className="aq-item-body">
          {line.part && !changing ? (
            <div className="aq-linked">
              <PartCard
                part={line.part}
                selected
                showDescription
                vehicle={vehicle}
                compatible={suggestions.items.some((p) => p.id === line.part.id) ? compatibleIds.has(line.part.id) : null}
              />
              <button type="button" onClick={() => setChanging(true)}>Cambiar</button>
              <button type="button" onClick={() => onCreateRequest(item)}>Agregar otro repuesto</button>
            </div>
          ) : (
            <>
              {(available.length > 0 || search) && !loadError && (
              <div className="aq-search-row">
                <label className="aq-search">
                  <Search size={16} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, OEM o SKU…" aria-label={`Buscar ${item.repuesto} en tu inventario`} />
                  {search && <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}
                </label>
              </div>
              )}
              {available.length > 0 && !loadError && (
              <div className="aq-create-bar">
                <strong>¿No es el que buscas?</strong>
                <div className="aq-create-actions">
                  <button type="button" className="aq-btn-outline" onClick={() => setInventoryOpen(true)}><Search size={15} /> Buscar en todo mi inventario</button>
                  <button type="button" className="aq-btn-outline" onClick={() => onCreateRequest(item)}><PackagePlus size={15} /> Nuevo repuesto</button>
                </div>
              </div>
              )}
              <div className="aq-parts" aria-busy={loading}>
                {loading && suggestions.items.length === 0 ? (
                  [0, 1].map((i) => <div key={i} className="aq-part aq-skeleton" />)
                ) : loadError ? (
                  <p className="aq-notice is-bad"><AlertCircle size={16} /> {loadError}</p>
                ) : available.length === 0 ? (
                  <div className="aq-empty">
                    <Package size={26} />
                    <strong>{search ? 'No encontramos repuestos compatibles con esa búsqueda' : `No encontramos repuestos tuyos compatibles con ${vehicle || 'este vehículo'}`}</strong>
                    <div>
                      <button type="button" className="aq-btn-outline" onClick={() => setInventoryOpen(true)}>Buscar en todo mi inventario</button>
                      <button type="button" className="aq-btn-primary" onClick={() => onCreateRequest(item)}><PackagePlus size={15} /> Cargar repuesto</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {available.length > 0 && <p className="aq-hint"><Sparkles size={14} /> Repuestos compatibles con la solicitud: {available.length}</p>}
                    {available.map((part) => (
                      <PartCard key={part.id} part={part} selected={line.part?.id === part.id} compatible={compatibleIds.has(part.id)} vehicle={vehicle} onSelect={pick} />
                    ))}
                  </>
                )}
              </div>
            </>
          )}

          {line.part && !changing && (
            <div className="aq-item-price">
              <label className="aq-field">
                <span>Precio unitario *</span>
                <div className="aq-money">
                  <i>$</i>
                  <input type="number" min="1" inputMode="numeric" value={line.unitPrice} onChange={(e) => onChange(item.id, { unitPrice: e.target.value })} placeholder="Ej: 45000" />
                </div>
                {line.part.precio ? <small>Precio en tu catálogo: {money(line.part.precio)}</small> : null}
              </label>
              <div className="aq-item-subtotal">
                <small>{item.cantidad} {item.cantidad === 1 ? 'unidad' : 'unidades'}</small>
                <strong>{money(lineTotal || null)}</strong>
              </div>
            </div>
          )}
        </div>
      )}
      {inventoryOpen && (
        <InventoryPicker
          auction={auction}
          item={item}
          vehicle={vehicle}
          takenPartIds={takenPartIds}
          selectedId={line?.part?.id}
          onSelect={(part) => { pick(part); setInventoryOpen(false); }}
          onBack={() => setInventoryOpen(false)}
          onCreate={() => { setInventoryOpen(false); onCreateRequest(item); }}
        />
      )}
    </li>
  );
}

function initialLines(auction, myQuote) {
  const lines = {};
  const byItem = new Map((myQuote?.lineas || []).map((line) => [line.itemId, line]));
  (auction.items || []).filter((item) => item.pendiente).forEach((item) => {
    const existing = byItem.get(item.id);
    lines[item.id] = existing
      ? {
        enabled: true,
        part: { id: existing.productoId, nombrePublicado: existing.productoTitulo, precio: existing.precioUnitario, imageUrls: existing.productoFotoUrl ? [existing.productoFotoUrl] : [] },
        unitPrice: String(Math.round(existing.precioUnitario)),
        warranty: '',
      }
      : { enabled: true, part: null, unitPrice: '', warranty: '' };
  });
  return lines;
}

/** Métodos con que esta tienda puede ofertar a este pedido (los calcula el servidor según la comuna y lo que publica la tienda). */
function deliveryOptions(auction) {
  const options = auction?.opcionesEntregaOferta;
  if (!Array.isArray(options) || options.length === 0) return DELIVERY_TYPES.map((metodo) => ({ metodo, disponible: true, motivo: null }));
  return options;
}

/** Lo que el comprador va a ver de la entrega según el método elegido (costo, "por pagar" o dirección de retiro). */
function deliveryExplain(type, options, auction) {
  const option = options.find((item) => item.metodo === type);
  const comuna = auction?.comuna ? ` (${auction.comuna})` : '';
  if (type === 'Retiro en tienda') return `El comprador retira en tu tienda: verá su dirección en tu oferta. Solo aplica a pedidos de tu misma comuna${comuna}.`;
  if (type === 'Envío dentro de la comuna') {
    const cost = Number(option?.costo || 0);
    return cost > 0
      ? `Despacho a domicilio en tu comuna: se carga el envío de ${money(cost)} en el detalle de tu oferta y el comprador lo paga junto al pedido.`
      : 'Despacho a domicilio en tu comuna, sin costo de envío.';
  }
  if (type === 'Envío fuera de la comuna') return 'Despacho a domicilio por pagar (courier): el costo del envío no va en tu oferta; el comprador lo paga aparte al recibirlo.';
  return '';
}

function defaultDeliveryType(options, myQuote) {
  const allowed = options.filter((option) => option.disponible).map((option) => option.metodo);
  if (myQuote?.tipoEntrega && allowed.includes(myQuote.tipoEntrega)) return myQuote.tipoEntrega;
  return allowed.includes('Envío dentro de la comuna') ? 'Envío dentro de la comuna' : (allowed[0] || '');
}

function AuctionQuoteModalContent({ onClose, auction, myQuote, sellerId, onSuccess }) {
  const { user } = useAuth();
  const vehicle = [auction?.marca, auction?.modelo, auction?.anio].filter(Boolean).join(' ');
  const pendingItems = useMemo(() => (auction.items || []).filter((item) => item.pendiente), [auction.items]);

  const [lines, setLines] = useState(() => initialLines(auction, myQuote));
  const [createFor, setCreateFor] = useState(null);
  const [justCreated, setJustCreated] = useState('');

  const [deliveryTime, setDeliveryTime] = useState(myQuote?.tiempoEntrega || '24 horas');
  const deliveryChoices = useMemo(() => deliveryOptions(auction), [auction]);
  const noDeliveryAllowed = !deliveryChoices.some((option) => option.disponible);
  const [deliveryType, setDeliveryType] = useState(() => defaultDeliveryType(deliveryOptions(auction), myQuote));
  const [warranty, setWarranty] = useState(myQuote?.garantia || '6 meses (garantía legal)');
  const [validity, setValidity] = useState(myQuote?.vigencia || '48 horas');
  const [notes, setNotes] = useState(myQuote?.notas || '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const changeLine = (itemId, patch) => setLines((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } }));

  const handleCreated = (saved) => {
    const item = createFor;
    setCreateFor(null);
    if (!saved?.id || !item) return;
    changeLine(item.id, {
      enabled: true,
      part: saved,
      unitPrice: saved.precio ? String(Math.round(saved.precio)) : '',
    });
    setJustCreated(item.repuesto);
  };

  const takenPartIds = (itemId) => new Set(
    Object.entries(lines)
      .filter(([id, line]) => Number(id) !== itemId && line.enabled && line.part)
      .map(([, line]) => line.part.id),
  );

  const enabledItems = pendingItems.filter((item) => lines[item.id]?.enabled);
  const covered = enabledItems.map((item) => {
    const line = lines[item.id];
    const unit = parseFloat(line.unitPrice) || 0;
    return { item, line, unit, total: unit * item.cantidad };
  });
  const total = covered.reduce((sum, entry) => sum + entry.total, 0);

  const fit = useMemo(() => evaluateOffer(auction, {
    precioFinal: total,
    tiempoEntrega: deliveryTime,
    tipoEntrega: deliveryType,
    lineas: covered.map(({ item, line, total: lineTotal }) => ({
      itemId: item.id, cantidad: item.cantidad, precioTotal: lineTotal, vigente: true, productoId: line.part?.id,
    })),
  }), [auction, total, deliveryTime, deliveryType, covered]);

  const missing = [];
  if (noDeliveryAllowed) missing.push('actualiza tus métodos de envío en Mi tienda');
  const uncovered = pendingItems.filter((item) => !lines[item.id]?.part);
  if (uncovered.length > 0) missing.push(`cubre todos los repuestos del pedido (te falta: ${uncovered.map((item) => item.repuesto).join(', ')})`);
  if (uncovered.length === 0 && covered.some((entry) => !(entry.unit > 0))) missing.push('fija el precio de cada repuesto');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (missing.length > 0) {
      setError(`Para enviar tu oferta, ${missing.join(' y ')}.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitAuctionQuote(auction.id, {
        lineas: covered.map(({ item, line, unit }) => ({ itemId: item.id, proveedorProductoId: line.part.id, precioUnitario: unit })),
        precio: total,
        precioFinal: total,
        cantidad: covered.reduce((sum, entry) => sum + entry.item.cantidad, 0),
        tiempoEntrega: deliveryTime,
        tipoEntrega: deliveryType,
        garantia: warranty,
        vigencia: validity,
        notas: notes.trim() || undefined,
      });
      setSent(true);
    } catch (err) {
      setError(err?.message || 'No pudimos enviar tu oferta. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const finish = () => {
    onSuccess?.();
    onClose();
  };

  if (sent) {
    return (
      <div className="aq-overlay" role="presentation">
        <div className="aq-modal aq-sent" role="dialog" aria-modal="true" aria-label="Oferta enviada">
          <span className="aq-sent-icon"><CheckCircle2 size={40} /></span>
          <h2>{myQuote ? '¡Oferta actualizada!' : '¡Oferta enviada!'}</h2>
          <p>El comprador la verá junto a las demás ofertas. Te avisaremos si te elige.</p>
          <dl>
            <div><dt>Repuestos que ofreces</dt><dd>{enabledItems.length} de {pendingItems.length}</dd></div>
            <div><dt>Total ofertado</dt><dd>{money(total)}</dd></div>
            <div><dt>Entrega</dt><dd>{deliveryType} · {deliveryTime}</dd></div>
          </dl>
          <button type="button" className="aq-btn-primary" onClick={finish}>Listo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="aq-overlay" role="presentation">
      <div className="aq-modal" role="dialog" aria-modal="true" aria-label="Enviar oferta">
        <header className="aq-head">
          <span className="aq-head-icon" aria-hidden="true"><Gavel size={22} /></span>
          <div className="aq-head-text">
            <span className="aq-eyebrow"><Gavel size={14} /> {myQuote ? 'Modificar mi oferta' : 'Enviar oferta'}</span>
            <h2>{auction?.repuestoSolicitado}</h2>
            <p>
              {vehicle || 'Vehículo'}
              {auction?.patenteAnonimizada ? <> · Patente <b>{auction.patenteAnonimizada}</b></> : null}
              {auction?.chasis ? <> · Chasis <b className="aq-mono">{auction.chasis}</b></> : null}
            </p>
          </div>
          <button type="button" className="aq-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <form className="aq-body" onSubmit={handleSubmit}>
          <div className="aq-main">
            <section className="aq-step">
              <h3><span>1</span> Cubre todos los repuestos del pedido</h3>
              <p className="aq-lead">
                {pendingItems.length > 1
                  ? `El comprador pidió ${pendingItems.length} repuestos y recibe solo ofertas completas: elige un producto de tu inventario para cada uno. Si te falta alguno, no podrás enviar la oferta.`
                  : 'Elige el repuesto de tu inventario con el que cubres esta solicitud.'}
              </p>
              {justCreated && (
                <p className="aq-notice is-ok" role="status"><CheckCircle2 size={16} /> «{justCreated}» quedó cargado en tu catálogo y enlazado a esta oferta. Revisa su precio.</p>
              )}
              <ul className="aq-items">
                {pendingItems.map((item) => (
                  <ItemOfferRow
                    key={item.id}
                    auction={auction}
                    item={item}
                    line={lines[item.id]}
                    takenPartIds={takenPartIds(item.id)}
                    onChange={changeLine}
                    onCreateRequest={setCreateFor}
                  />
                ))}
              </ul>
            </section>

            <section className="aq-step">
              <h3><span>2</span> Condiciones de tu oferta</h3>
              <fieldset className="aq-fields">
                <label className="aq-field">
                  <span>Plazo de entrega *</span>
                  <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)}>{DELIVERY_TIMES.map((v) => <option key={v}>{v}</option>)}</select>
                </label>
                <label className="aq-field">
                  <span>Método de entrega *</span>
                  <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}>
                    {deliveryChoices.map((option) => (
                      <option key={option.metodo} value={option.metodo} disabled={!option.disponible}>{option.metodo}{option.disponible ? '' : ' (no disponible)'}</option>
                    ))}
                  </select>
                  <small>
                    Según la comuna del pedido{auction?.comuna ? ` (${auction.comuna})` : ''} y los métodos que publicó tu tienda; el costo del envío dentro de la comuna es el que publicaste.
                  </small>
                  <small className="aq-delivery-explain">{deliveryExplain(deliveryType, deliveryChoices, auction)}</small>
                  {deliveryChoices.filter((option) => !option.disponible && option.motivo).map((option) => (
                    <small key={option.metodo} className="aq-delivery-reason"><b>{option.metodo}:</b> {option.motivo}</small>
                  ))}
                  {noDeliveryAllowed && <small className="aq-delivery-reason is-blocking">Tu tienda no tiene un método de envío que sirva para este pedido: actualiza tus métodos de envío en Mi tienda para poder ofertar.</small>}
                </label>
                <label className="aq-field">
                  <span>Garantía</span>
                  <input value={warranty} maxLength={100} onChange={(e) => setWarranty(e.target.value)} />
                </label>
                <label className="aq-field">
                  <span>Vigencia de la oferta</span>
                  <select value={validity} onChange={(e) => setValidity(e.target.value)}>{VALIDITIES.map((v) => <option key={v}>{v}</option>)}</select>
                </label>
                <label className="aq-field aq-field-wide">
                  <span>Observaciones <small>Opcional</small></span>
                  <textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: incluye conector y soportes, retiro en sucursal…" />
                </label>
              </fieldset>
            </section>
          </div>

          <aside className="aq-side">
            <section className="aq-card">
              <h4>Lo que pidió el comprador</h4>
              <dl>
                <div><dt>Repuestos</dt><dd>{(auction.items || []).length || 1}</dd></div>
                <div><dt>Disponibles</dt><dd>{pendingItems.length}</dd></div>
                <div><dt>Presupuesto tope</dt><dd>{auction?.presupuestoMaximo ? money(auction.presupuestoMaximo) : 'Sin tope'}</dd></div>
                <div><dt>Plazo máximo</dt><dd>{auction?.tiempoMaximoEnvio || 'A convenir'}</dd></div>
                <div><dt>Envío</dt><dd>{auction?.tipoEnvio || 'Cualquiera'}</dd></div>
              </dl>
            </section>

            <section className={`aq-card aq-fit is-${enabledItems.length > 0 && total > 0 ? fit.level : 'idle'}`} aria-live="polite">
              <h4>Tu oferta frente a lo pedido</h4>
              {enabledItems.length > 0 && total > 0 ? (
                <ul>
                  {fit.checks.map((check) => {
                    const Icon = CHECK_ICON[check.status];
                    return (
                      <li key={check.key} className={`is-${check.status}`}>
                        <Icon size={15} />
                        <span><strong>{check.label}</strong>{check.detail}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>Marca los repuestos que tienes y fija sus precios para ver cómo se compara con lo que pidió el comprador.</p>
              )}
            </section>

            <section className="aq-card aq-total">
              <small>Total de tu oferta<span className="aq-foot-count"> · {enabledItems.length} de {pendingItems.length} {pendingItems.length === 1 ? 'repuesto' : 'repuestos'}</span></small>
              <strong>{money(total || null)}</strong>
              <span>{enabledItems.length} de {pendingItems.length} {pendingItems.length === 1 ? 'repuesto' : 'repuestos'}</span>
            </section>

            <p className="aq-secure"><ShieldCheck size={15} /> Tu oferta es confidencial: solo la ve el comprador.</p>
          </aside>

          <footer className="aq-foot">
            {error && <p className="aq-notice is-bad" role="alert"><AlertCircle size={16} /> {error}</p>}
            {!error && missing.length > 0 && <p className="aq-pending">Falta: {missing.join(' y ')}.</p>}
            <div className="aq-foot-total" aria-live="polite">
              <small>Total de tu oferta<span className="aq-foot-count"> · {enabledItems.length} de {pendingItems.length} {pendingItems.length === 1 ? 'repuesto' : 'repuestos'}</span></small>
              <strong>{money(total || null)}</strong>
            </div>
            <div className="aq-foot-actions">
              <button type="button" className="aq-btn-outline" onClick={onClose} disabled={submitting}>Cancelar</button>
              <button type="submit" className="aq-btn-primary" disabled={submitting || missing.length > 0}>
                {submitting ? <><Loader2 size={16} className="aq-spin" /> Enviando…</> : <><Gavel size={16} /> {myQuote ? 'Actualizar oferta' : 'Enviar oferta'}</>}
              </button>
            </div>
          </footer>
        </form>
      </div>

      {createFor && (
        <div className="aq-nested">
          <NewCatalogProductModal
            sellerId={sellerId}
            isFounder={Boolean(user?.founder ?? user?.fundador)}
            prefill={{
              name: createFor.repuesto,
              category: createFor.categoria,
              brand: createFor.vehiculoPropio ? createFor.marca : auction?.marca,
              model: createFor.vehiculoPropio ? createFor.modelo : auction?.modelo,
              year: createFor.vehiculoPropio ? createFor.anio : auction?.anio,
            }}
            onClose={() => setCreateFor(null)}
            onCreated={handleCreated}
          />
        </div>
      )}
    </div>
  );
}

/* El contenido tiene hooks: se monta solo con el modal abierto. */
export default function AuctionQuoteModal(props) {
  if (!props.isOpen) return null;
  return <AuctionQuoteModalContent {...props} />;
}
