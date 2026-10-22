import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, AlertTriangle, CheckCircle2, Gavel, Loader2, MinusCircle, Package, PackagePlus, Search,
  ShieldCheck, Sparkles, X, XCircle,
} from 'lucide-react';
import { getAuctionSuggestedParts, submitAuctionQuote } from '../services/auctionApi';
import { resolveMediaUrl } from '../services/api';
import { evaluateOffer } from '../utils/auctionOfferFit';
import { useAuth } from '../context/AuthContext';
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

function PartCard({ part, selected, compatible, vehicle, onSelect }) {
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
    <button type="button" className={`aq-part ${selected ? 'is-selected' : ''}`} onClick={() => onSelect(part)} aria-pressed={selected}>
      <span className="aq-part-photo">{photo ? <img src={photo} alt="" loading="lazy" /> : <Package size={26} />}</span>
      <span className="aq-part-body">
        <strong>{title}</strong>
        <span className="aq-part-tags">
          {compatible
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

/**
 * Un repuesto del pedido: la tienda marca si lo tiene, elige el producto de su inventario (sugerido según el
 * vehículo y el nombre pedido) o lo carga con el flujo normal, y fija su precio unitario.
 */
function ItemOfferRow({ auction, item, line, onChange, onCreateRequest }) {
  const vehicle = item.vehiculoPropio ? itemVehicleLabel(item) : [auction.marca, auction.modelo, auction.anio].filter(Boolean).join(' ');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const [onlyCompatible, setOnlyCompatible] = useState(true);
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
    getAuctionSuggestedParts(auction.id, { itemId: item.id, texto: debounced || undefined, soloCompatibles: onlyCompatible })
      .then((data) => {
        if (!active) return;
        const list = [...(data?.resultado?.content || [])].sort((a, b) => nameScore(b.nombrePublicado || b.repuestoNombre, item.repuesto) - nameScore(a.nombrePublicado || a.repuestoNombre, item.repuesto));
        setSuggestions({ items: list, compatibleIds: data?.idsCompatibles || [] });
      })
      .catch((err) => { if (active) setLoadError(err?.message || 'No pudimos cargar tus repuestos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showPicker, auction.id, item.id, item.repuesto, debounced, onlyCompatible]);

  const compatibleIds = useMemo(() => new Set(suggestions.compatibleIds), [suggestions.compatibleIds]);
  const lineTotal = (parseFloat(line?.unitPrice) || 0) * item.cantidad;

  const pick = (part) => {
    onChange(item.id, { part, unitPrice: part.precio ? String(Math.round(part.precio)) : line.unitPrice, warranty: part.garantia || line.warranty });
    setChanging(false);
  };

  return (
    <li className={`aq-item ${enabled ? 'is-on' : ''}`}>
      <label className="aq-item-head">
        <input type="checkbox" checked={enabled} onChange={(e) => onChange(item.id, { enabled: e.target.checked })} />
        <span className="aq-item-title">
          <strong>{item.repuesto} <small>× {item.cantidad}</small></strong>
          <span>
            {item.categoria ? `${item.categoria} · ` : ''}Para {vehicle || 'el vehículo del pedido'}
            {item.vehiculoPropio ? <em className="aq-item-other">otro vehículo</em> : null}
          </span>
          {item.descripcion && <span className="aq-item-desc">{item.descripcion}</span>}
        </span>
        <span className={`aq-item-have ${enabled ? 'is-on' : ''}`}>{enabled ? <><CheckCircle2 size={14} /> Lo ofrezco</> : 'Lo tengo'}</span>
      </label>

      {enabled && (
        <div className="aq-item-body">
          {line.part && !changing ? (
            <div className="aq-linked">
              <CheckCircle2 size={16} />
              <span>Producto: <b>{line.part.nombrePublicado || line.part.repuestoNombre}</b></span>
              <button type="button" onClick={() => setChanging(true)}>Cambiar</button>
              <button type="button" onClick={() => onCreateRequest(item)}>Agregar otro repuesto</button>
            </div>
          ) : (
            <>
              <div className="aq-search-row">
                <label className="aq-search">
                  <Search size={16} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, OEM o SKU…" aria-label={`Buscar ${item.repuesto} en tu inventario`} />
                  {search && <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}
                </label>
                <label className="aq-switch">
                  <input type="checkbox" checked={onlyCompatible} onChange={(e) => setOnlyCompatible(e.target.checked)} />
                  <span>Solo compatibles con {vehicle || 'el vehículo'}</span>
                </label>
              </div>
              <div className="aq-create-bar">
                <span>¿Ninguno es el repuesto correcto o no lo tienes cargado?</span>
                <button type="button" className="aq-btn-outline" onClick={() => onCreateRequest(item)}><PackagePlus size={15} /> Agregar repuesto</button>
              </div>
              <div className="aq-parts" aria-busy={loading}>
                {loading && suggestions.items.length === 0 ? (
                  [0, 1].map((i) => <div key={i} className="aq-part aq-skeleton" />)
                ) : loadError ? (
                  <p className="aq-notice is-bad"><AlertCircle size={16} /> {loadError}</p>
                ) : suggestions.items.length === 0 ? (
                  <div className="aq-empty">
                    <Package size={26} />
                    <strong>{onlyCompatible ? 'No encontramos repuestos tuyos compatibles con este vehículo' : 'No encontramos repuestos con esa búsqueda'}</strong>
                    <div>
                      {onlyCompatible && <button type="button" className="aq-btn-outline" onClick={() => setOnlyCompatible(false)}>Buscar en todo mi inventario</button>}
                      <button type="button" className="aq-btn-primary" onClick={() => onCreateRequest(item)}><PackagePlus size={15} /> Cargar repuesto</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {!debounced && onlyCompatible && <p className="aq-hint"><Sparkles size={14} /> Sugeridos para {vehicle || 'este vehículo'}: {suggestions.items.length}</p>}
                    {suggestions.items.map((part) => (
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
      : { enabled: false, part: null, unitPrice: '', warranty: '' };
  });
  return lines;
}

/** Métodos con que esta tienda puede ofertar a este pedido (los calcula el servidor según la comuna y lo que publica la tienda). */
function deliveryOptions(auction) {
  const options = auction?.opcionesEntregaOferta;
  if (!Array.isArray(options) || options.length === 0) return DELIVERY_TYPES.map((metodo) => ({ metodo, disponible: true, motivo: null }));
  return options;
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

  const enabledItems = pendingItems.filter((item) => lines[item.id]?.enabled);
  const covered = enabledItems.map((item) => {
    const line = lines[item.id];
    const unit = parseFloat(line.unitPrice) || 0;
    return { item, line, unit, total: unit * item.cantidad };
  });
  const total = covered.reduce((sum, entry) => sum + entry.total, 0);
  const notCovered = pendingItems.filter((item) => !lines[item.id]?.enabled);

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
  if (enabledItems.length === 0) missing.push('marca al menos un repuesto que tengas');
  if (covered.some((entry) => !entry.line.part)) missing.push('elige el producto de cada repuesto que ofreces');
  else if (covered.some((entry) => !(entry.unit > 0))) missing.push('fija el precio de cada repuesto');

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
            {notCovered.length > 0 && <div><dt>Faltan en tu oferta</dt><dd>{notCovered.map((item) => item.repuesto).join(', ')}</dd></div>}
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
          <div>
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
              <h3><span>1</span> Marca los repuestos que tienes</h3>
              <p className="aq-lead">
                {pendingItems.length > 1
                  ? `El comprador pidió ${pendingItems.length} repuestos. Ofrece solo los que tengas: le informaremos cuáles incluye tu oferta y cuáles faltan.`
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
                    onChange={changeLine}
                    onCreateRequest={setCreateFor}
                  />
                ))}
              </ul>
              {notCovered.length > 0 && enabledItems.length > 0 && (
                <p className="aq-notice is-warn" role="note">
                  <AlertTriangle size={16} />
                  <span>Tu oferta no incluye: <b>{notCovered.map((item) => item.repuesto).join(', ')}</b>. El comprador verá que faltan esos repuestos y otras tiendas podrán ofrecerlos.</span>
                </p>
              )}
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
              <small>Total de tu oferta</small>
              <strong>{money(total || null)}</strong>
              <span>{enabledItems.length} de {pendingItems.length} {pendingItems.length === 1 ? 'repuesto' : 'repuestos'}</span>
            </section>

            <p className="aq-secure"><ShieldCheck size={15} /> Tu oferta es confidencial: solo la ve el comprador.</p>
          </aside>

          <footer className="aq-foot">
            {error && <p className="aq-notice is-bad" role="alert"><AlertCircle size={16} /> {error}</p>}
            {!error && missing.length > 0 && <p className="aq-pending">Falta: {missing.join(' y ')}.</p>}
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
