import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import OrderCard from './OrderCard';
import { useLocation } from 'react-router-dom';
import usePagedList, { recentOrdersNote } from '../hooks/usePagedList';
import { useRestoredState } from '../routes/useRestoredState';
import { useScrollMemory } from '../routes/useScrollMemory';
import ListPager from './ListPager';
import { orderDisplayCode } from '../data/orderIdentity';
import { buyerClaimState, normalizeOrderStatus } from '../data/orderStatusFlow';

/**
 * Lista de compras del comprador con busqueda, filtros y orden. La app los tiene en
 * `app/(buyer)/orders.tsx`; en la web era solo una grilla y encontrar un pedido entre muchos
 * obligaba a recorrerlos todos.
 */
const STATUS_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendientes de pago' },
  { key: 'active', label: 'En curso' },
  { key: 'delivered', label: 'Entregados' },
  { key: 'finished', label: 'Finalizados' },
  { key: 'claim', label: 'Con reclamo' },
  { key: 'cancelled', label: 'Cancelados' },
];

const DATE_FILTERS = [
  { key: 'all', label: 'Cualquier fecha' },
  { key: '7', label: 'Últimos 7 días' },
  { key: '30', label: 'Últimos 30 días' },
  { key: '90', label: 'Últimos 3 meses' },
];

const SORTS = [
  { key: 'recent', label: 'Más recientes' },
  { key: 'oldest', label: 'Más antiguos' },
  { key: 'amount', label: 'Mayor monto' },
];

// Sin tildes ni mayusculas: "preparacion" encuentra "preparación".
function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function searchableText(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const subs = Array.isArray(order?.subordenes) ? order.subordenes : [];
  return normalize([
    orderDisplayCode(order),
    order?.numeroPedido,
    order?.id,
    order?.vendedorNombre,
    order?.nombreTienda,
    ...subs.map((sub) => sub?.nombreTienda),
    ...items.flatMap((item) => [
      item?.titulo, item?.nombreProducto, item?.productName, item?.repuestoNombre, item?.nombre,
      item?.proveedorNombre, item?.nombreTienda, item?.sku, item?.skuProveedor,
    ]),
  ].filter(Boolean).join(' '));
}

function matchesStatus(order, filter) {
  if (filter === 'all') return true;
  const status = normalizeOrderStatus(order);
  if (filter === 'pending') return status === 'PENDIENTE';
  if (filter === 'active') return ['PAGADO', 'EN_PREPARACION', 'ENVIADO'].includes(status);
  if (filter === 'delivered') return status === 'ENTREGADO';
  if (filter === 'finished') return status === 'FINALIZADO';
  if (filter === 'cancelled') return status === 'CANCELADO';
  if (filter === 'claim') return Boolean(buyerClaimState(order)) || status === 'EN_MEDIACION';
  return true;
}

function orderTime(order) {
  const time = new Date(order?.createdAt || order?.fecha || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export default function BuyerOrdersBrowser({ orders, loading = false, emptyLabel, onSelectOrder, onUpdateStatus, onRetryPayment, onCancelOrder }) {
  // Filtros y pagina se recuperan al volver del detalle de un pedido (la lista se desmonta al abrirlo).
  const { pathname } = useLocation();
  const viewId = `pedidos-comprador:${pathname}`;
  const [query, setQuery] = useRestoredState(viewId, 'query', '');
  const [status, setStatus] = useRestoredState(viewId, 'status', 'all');
  const [date, setDate] = useRestoredState(viewId, 'date', 'all');
  const [sort, setSort] = useRestoredState(viewId, 'sort', 'recent');
  // Categoría y vendedor (selección múltiple), igual que el filtro de la app.
  const [categories, setCategories] = useRestoredState(viewId, 'categories', []);
  const [sellers, setSellers] = useRestoredState(viewId, 'sellers', []);
  const [moreFilters, setMoreFilters] = useState(false);

  const list = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);
  const counts = useMemo(() => Object.fromEntries(
    STATUS_FILTERS.map((filter) => [filter.key, list.filter((order) => matchesStatus(order, filter.key)).length]),
  ), [list]);

  const orderSeller = (order) => (order?.vendedorNombre || order?.nombreTienda || order?.sellerName || (order?.items || []).find((item) => item?.nombreTienda || item?.sellerName)?.nombreTienda
    || (order?.items || []).find((item) => item?.sellerName)?.sellerName || '').trim();
  const orderCategories = (order) => (order?.items || []).map((item) => String(item?.categoria || item?.categoriaNombre || item?.productCategory || item?.category || '').trim()).filter(Boolean);
  const categoryOptions = useMemo(() => [...new Set(list.flatMap(orderCategories))].sort((a, b) => a.localeCompare(b, 'es')), [list]);
  const sellerOptions = useMemo(() => [...new Set(list.map(orderSeller).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [list]);
  const toggleIn = (setter) => (value) => setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));

  const visible = useMemo(() => {
    const term = normalize(query);
    const since = date === 'all' ? 0 : Date.now() - Number(date) * 86_400_000;
    const filtered = list.filter((order) => matchesStatus(order, status)
      && (!since || orderTime(order) >= since)
      && (categories.length === 0 || orderCategories(order).some((category) => categories.some((chosen) => normalize(chosen) === normalize(category))))
      && (sellers.length === 0 || sellers.some((chosen) => normalize(chosen) === normalize(orderSeller(order))))
      && (!term || searchableText(order).includes(term)));
    return [...filtered].sort((a, b) => {
      if (sort === 'oldest') return orderTime(a) - orderTime(b);
      if (sort === 'amount') return Number(b?.total || 0) - Number(a?.total || 0);
      return orderTime(b) - orderTime(a);
    });
  }, [list, query, status, date, sort, categories, sellers]);
  const { pageItems, pagerProps } = usePagedList(visible, JSON.stringify([query, status, date, sort, categories, sellers]), undefined, viewId);
  useScrollMemory(list.length > 0);

  // Mientras carga no se dice "Aún no has realizado pedidos": eso confundia a quien si tenia.
  if (loading && list.length === 0) {
    return <div className="profile-empty-state"><p>Cargando tus pedidos…</p></div>;
  }
  if (list.length === 0) {
    return <div className="profile-empty-state"><p>{emptyLabel}</p></div>;
  }

  const hasFilters = Boolean(query) || status !== 'all' || date !== 'all' || categories.length > 0 || sellers.length > 0;

  return (
    <div className="buyer-orders-browser">
      <div className="buyer-orders-toolbar">
        <label className="buyer-orders-search">
          <Search size={15} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar pedido, repuesto o vendedor"
            aria-label="Buscar pedidos"
          />
          {query && (
            <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQuery('')}><X size={14} /></button>
          )}
        </label>
        <select value={date} onChange={(event) => setDate(event.target.value)} aria-label="Filtrar por fecha">
          {DATE_FILTERS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar pedidos">
          {SORTS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
        {(categoryOptions.length > 0 || sellerOptions.length > 0) && (
          <button type="button" className="buyer-orders-more" aria-expanded={moreFilters} onClick={() => setMoreFilters((value) => !value)}>
            <SlidersHorizontal size={14} /> Filtros{categories.length + sellers.length > 0 ? ` (${categories.length + sellers.length})` : ''}
          </button>
        )}
      </div>

      {moreFilters && (
        <div className="buyer-orders-extra">
          <div>
            <strong>Categoría</strong>
            <div className="buyer-orders-extra-chips">
              {categoryOptions.length === 0 ? <small>Sin categorías registradas</small> : categoryOptions.map((category) => (
                <button key={category} type="button" className={`buyer-orders-chip ${categories.includes(category) ? 'is-active' : ''}`} aria-pressed={categories.includes(category)} onClick={() => toggleIn(setCategories)(category)}>{category}</button>
              ))}
            </div>
          </div>
          <div>
            <strong>Vendedor</strong>
            <div className="buyer-orders-extra-chips">
              {sellerOptions.length === 0 ? <small>Sin vendedores registrados</small> : sellerOptions.map((seller) => (
                <button key={seller} type="button" className={`buyer-orders-chip ${sellers.includes(seller) ? 'is-active' : ''}`} aria-pressed={sellers.includes(seller)} onClick={() => toggleIn(setSellers)(seller)}>{seller}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="buyer-orders-chips" role="tablist" aria-label="Filtrar por estado">
        {STATUS_FILTERS.filter((filter) => filter.key === 'all' || counts[filter.key] > 0).map((filter) => (
          <button
            key={filter.key}
            type="button"
            role="tab"
            aria-selected={status === filter.key}
            className={`buyer-orders-chip ${status === filter.key ? 'is-active' : ''}`}
            onClick={() => setStatus(filter.key)}
          >
            {filter.label} <span>{counts[filter.key]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="profile-empty-state">
          <p>Ningún pedido coincide con la búsqueda.</p>
          {hasFilters && (
            <button type="button" className="btn-view-details" onClick={() => { setQuery(''); setStatus('all'); setDate('all'); setCategories([]); setSellers([]); }}>
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
        <div className="profile-orders-cards-grid">
          {pageItems.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              mode="buyer"
              onSelectOrder={onSelectOrder}
              onUpdateStatus={onUpdateStatus}
              onRetryPayment={onRetryPayment}
              onCancelOrder={onCancelOrder}
            />
          ))}
        </div>
        <ListPager pagerProps={pagerProps} itemLabel="pedidos" note={recentOrdersNote(list.length)} />
        </>
      )}
    </div>
  );
}
