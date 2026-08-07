import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp, Banknote, CheckCircle2, ChevronDown, Clock3, Filter, Search,
  ShoppingBag, SlidersHorizontal, X,
} from 'lucide-react';
import OrderCard from './OrderCard';
import { getSellerWithdrawalDetailApi, getSellerWithdrawalsApi } from '../services/api';

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'preparing', label: 'En preparación' },
  { value: 'sent', label: 'Enviado' },
  { value: 'received', label: 'Recibido' },
  { value: 'finished', label: 'Finalizado' },
];

const SOURCE_FILTERS = [
  { value: 'cart', label: 'Carrito' },
  { value: 'quote', label: 'Cotización' },
];

const DATE_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: '7 días' },
  { value: 'month', label: '30 días' },
];

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function canonicalStatus(order) {
  const status = String(order?.estado || order?.status || '').toUpperCase();
  if (status === 'PENDIENTE' || status === 'PAGADO' || status === 'PENDING') return 'pending';
  if (status === 'EN_PREPARACION' || status === 'PREPARING') return 'preparing';
  if (status === 'ENVIADO' || status === 'SENT') return 'sent';
  if (status === 'ENTREGADO' || status === 'RECEIVED') return 'received';
  if (status === 'FINALIZADO' || status === 'FINISHED') return 'finished';
  if (status === 'EN_MEDIACION' || status === 'MEDIATION') return 'mediation';
  if (status === 'CANCELADO' || status === 'CANCELLED') return 'cancelled';
  return status.toLowerCase();
}

function canonicalSource(order) {
  const source = String(order?.source || order?.origen || '').toLowerCase();
  return source === 'quote' || source.includes('cotiz') || order?.quoteChatId ? 'quote' : 'cart';
}

function matchesDate(createdAt, filter) {
  if (filter === 'all') return true;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (filter === 'today') return date.toDateString() === now.toDateString();
  const elapsed = now.getTime() - date.getTime();
  return elapsed >= 0 && elapsed <= (filter === 'week' ? 7 : 30) * 24 * 60 * 60 * 1000;
}

function toggleValue(values, value) {
  return values.includes(value) ? values.filter((current) => current !== value) : [...values, value];
}

function searchableOrderText(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return [
    order?.id, order?.compradorNombre, order?.buyerName, order?.deliveryTerms,
    order?.tipoEnvio, canonicalSource(order), canonicalStatus(order),
    ...items.flatMap((item) => [
      item?.nombre, item?.name, item?.productName, item?.marca, item?.brand,
      item?.productBrand, item?.sku, item?.categoria, item?.category,
    ]),
  ].filter(Boolean).join(' ');
}

function isPaidOrder(order) {
  if (String(order?.paymentStatus || '').toLowerCase() === 'paid') return true;
  return ['PAGADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'FINALIZADO', 'EN_MEDIACION'].includes(
    String(order?.estado || order?.status || '').toUpperCase()
  );
}

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

export default function SellerOrdersPanel({ orders = [], sellerId, onSelectOrder, onUpdateStatus }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [sources, setSources] = useState([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [withdrawalDatesByOrder, setWithdrawalDatesByOrder] = useState({});

  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;
    getSellerWithdrawalsApi(sellerId)
      .then((withdrawals) => Promise.all((Array.isArray(withdrawals) ? withdrawals : [])
        .filter((withdrawal) => String(withdrawal.estado || '').toUpperCase() === 'SOLICITADO')
        .map((withdrawal) => getSellerWithdrawalDetailApi(sellerId, withdrawal.retiroId))))
      .then((details) => {
        if (cancelled) return;
        setWithdrawalDatesByOrder(Object.fromEntries(details.flatMap((withdrawal) =>
          (withdrawal?.pedidos || []).map((order) => [String(order.pedidoId), withdrawal.fechaEfectiva]))));
      })
      .catch(() => { if (!cancelled) setWithdrawalDatesByOrder({}); });
    return () => { cancelled = true; };
  }, [sellerId]);

  const activeFilterCount = statuses.length + sources.length + (dateFilter === 'all' ? 0 : 1);

  const summary = useMemo(() => {
    const inProgress = orders.filter((order) => ['pending', 'preparing', 'sent'].includes(canonicalStatus(order))).length;
    const completed = orders.filter((order) => ['received', 'finished'].includes(canonicalStatus(order))).length;
    const revenue = orders.filter(isPaidOrder).reduce(
      (total, order) => total + Number(order.totalVendedor ?? order.totalSeller ?? order.netoProveedor ?? 0),
      0
    );
    return { inProgress, completed, revenue };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const query = normalizeText(searchQuery);
    return orders.filter((order) => {
      if (query && !normalizeText(searchableOrderText(order)).includes(query)) return false;
      if (statuses.length && !statuses.includes(canonicalStatus(order))) return false;
      if (sources.length && !sources.includes(canonicalSource(order))) return false;
      return matchesDate(order.createdAt || order.fecha, dateFilter);
    }).sort((left, right) => {
      const leftTime = new Date(left.createdAt || left.fecha || 0).getTime();
      const rightTime = new Date(right.createdAt || right.fecha || 0).getTime();
      return sortBy === 'newest' ? rightTime - leftTime : leftTime - rightTime;
    });
  }, [dateFilter, orders, searchQuery, sortBy, sources, statuses]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatuses([]);
    setSources([]);
    setDateFilter('all');
  };

  return (
    <div className="seller-orders-screen">
      <section className="seller-orders-summary">
        <header><div><h2>Resumen rápido</h2><p>{orders.length ? 'Vista alimentada desde pedidos reales' : 'Aún no hay pedidos registrados'}</p></div></header>
        <div className="seller-orders-summary-grid">
          <article className="orders-summary-amber"><span><Clock3 size={19} /></span><small>En curso</small><strong>{summary.inProgress}</strong></article>
          <article className="orders-summary-purple"><span><CheckCircle2 size={19} /></span><small>Completados</small><strong>{summary.completed}</strong></article>
          <article className="orders-summary-green"><span><Banknote size={19} /></span><small>Mis ganancias</small><strong>{formatCLP(summary.revenue)}</strong></article>
        </div>
      </section>

      <section className="seller-orders-tools">
        <div className="seller-orders-search"><Search size={18} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar pedido, cliente, repuesto o SKU..." />{searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}</div>
        <button type="button" className={`seller-orders-filter-trigger ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen((current) => !current)} aria-expanded={filtersOpen}><Filter size={18} /><span>Filtros</span>{activeFilterCount > 0 && <b>{activeFilterCount}</b>}<ChevronDown size={15} /></button>
      </section>

      {filtersOpen && <section className="seller-orders-filter-panel">
        <div><strong>Estado</strong><div className="seller-orders-chip-group">{STATUS_FILTERS.map((filter) => <button type="button" key={filter.value} className={statuses.includes(filter.value) ? 'active' : ''} onClick={() => setStatuses((current) => toggleValue(current, filter.value))}>{filter.label}</button>)}</div></div>
        <div><strong>Origen</strong><div className="seller-orders-chip-group">{SOURCE_FILTERS.map((filter) => <button type="button" key={filter.value} className={`${filter.value} ${sources.includes(filter.value) ? 'active' : ''}`} onClick={() => setSources((current) => toggleValue(current, filter.value))}>{filter.label}</button>)}</div></div>
        <div><strong>Fecha</strong><div className="seller-orders-chip-group">{DATE_FILTERS.map((filter) => <button type="button" key={filter.value} className={dateFilter === filter.value ? 'active' : ''} onClick={() => setDateFilter(filter.value)}>{filter.label}</button>)}</div></div>
        {activeFilterCount > 0 && <button type="button" className="seller-orders-clear-filters" onClick={() => { setStatuses([]); setSources([]); setDateFilter('all'); }}><X size={15} /> Limpiar filtros</button>}
      </section>}

      <div className="seller-orders-list-heading">
        <div><h3>Pedidos visibles ({visibleOrders.length})</h3><span>{activeFilterCount ? 'Filtros aplicados' : 'Todos los pedidos'}</span></div>
        <label><ArrowDownUp size={16} /><span>Ordenar</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="newest">Más nuevos primero</option><option value="oldest">Más antiguos primero</option></select></label>
      </div>

      {!orders.length ? <div className="seller-orders-empty"><span><ShoppingBag size={27} /></span><strong>Aún no hay pedidos pagados</strong><p>Cuando un comprador complete un pago, el pedido aparecerá aquí con su detalle real.</p></div> : !visibleOrders.length ? <div className="seller-orders-empty"><span><SlidersHorizontal size={27} /></span><strong>No encontramos pedidos</strong><p>Ajusta la búsqueda o limpia los filtros para volver a ver tus pedidos.</p><button type="button" onClick={clearFilters}>Limpiar filtros</button></div> : <div className="profile-orders-cards-grid seller-orders-card-grid">{visibleOrders.map((order) => <OrderCard key={order.id} order={order} mode="seller" withdrawalDate={withdrawalDatesByOrder[String(order.id)]} onSelectOrder={onSelectOrder} onUpdateStatus={onUpdateStatus} />)}</div>}
    </div>
  );
}
