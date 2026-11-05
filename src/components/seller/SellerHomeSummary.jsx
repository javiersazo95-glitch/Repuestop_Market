import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Banknote, Box, ChevronRight, MessageCircle, MessageSquare, PackagePlus, Send, Sparkles, Store, Timer, Truck, Wallet } from 'lucide-react';
import { getSellerBalanceApi, getSellerInventorySummaryApi, resolveMediaUrl } from '../../services/api';
import '../../styles/seller-home.css';

const LOW_STOCK_THRESHOLD = 2;
const formatCLP = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const orderLabel = (order) => (order.numeroPedidoFormato || order.numeroPedido ? `#${order.numeroPedidoFormato || order.numeroPedido}` : `#${order.id}`);
const itemName = (item) => item?.nombre || item?.name || item?.productName || 'Pedido de repuestos';

/**
 * Resumen de la tienda en el celular: el inicio del vendedor de la app (`mobile/app/(seller)/index.tsx`) con la
 * prioridad del día, el producto más vendido, las cifras, "Tu siguiente movimiento" y los accesos rápidos.
 * Los pedidos y las conversaciones llegan del panel; el saldo y el inventario se piden aquí.
 */
export default function SellerHomeSummary({
  sellerId, storeName, city, isOpen, orders, openChats, quoteSentCount, loading,
  onOpenOrders, onOpenChats, onOpenProducts, onOpenWithdrawals, onPublish, onOpenProduct,
}) {
  const [saldo, setSaldo] = useState(undefined); // undefined = cargando, null = falló
  const [inventory, setInventory] = useState({ published: 0, lowStock: 0, lowStockSample: [] });

  useEffect(() => {
    if (!sellerId) return undefined;
    let active = true;
    getSellerBalanceApi(sellerId).then((value) => { if (active) setSaldo(value); }).catch(() => { if (active) setSaldo(null); });
    getSellerInventorySummaryApi(sellerId, { umbralBajoStock: LOW_STOCK_THRESHOLD })
      .then((summary) => {
        if (!active || !summary) return;
        setInventory({
          published: summary.publicados ?? summary.total ?? 0,
          lowStock: summary.bajoStock ?? 0,
          lowStockSample: Array.isArray(summary.muestraBajoStock) ? summary.muestraBajoStock : [],
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [sellerId]);

  const paid = useMemo(() => (orders || []).filter((order) => !['FALLIDO', 'FAILED'].includes(String(order.estadoPago || '').toUpperCase())), [orders]);
  const pendingOrders = useMemo(() => paid.filter((order) => order.estado === 'PAGADO'), [paid]);
  const preparingOrders = useMemo(() => paid.filter((order) => order.estado === 'EN_PREPARACION'), [paid]);
  const mainMetric = pendingOrders.length + preparingOrders.length;

  const bestProduct = useMemo(() => {
    const totals = new Map();
    paid.filter((order) => !['CANCELADO', 'PENDIENTE'].includes(order.estado)).forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.productoId || item.productId || `${itemName(item)}-${item.sku}`;
        const current = totals.get(key);
        totals.set(key, { item: current?.item ?? item, quantity: (current?.quantity ?? 0) + Number(item.cantidad ?? item.quantity ?? 1) });
      });
    });
    return [...totals.values()].sort((a, b) => b.quantity - a.quantity)[0] ?? null;
  }, [paid]);
  const bestImage = resolveMediaUrl(bestProduct?.item?.imagen || bestProduct?.item?.productPhotoUri || bestProduct?.item?.imagenUrl);
  const bestId = bestProduct?.item?.productoId || bestProduct?.item?.productId;

  const metrics = [
    { id: 'attention', label: 'Pedidos activos', value: mainMetric, helper: `${pendingOrders.length} por confirmar · ${preparingOrders.length} por enviar`, icon: Box, tone: 'blue', onClick: onOpenOrders },
    {
      id: 'revenue', label: 'Disponible para retirar', value: saldo ? formatCLP(Math.max(0, saldo.disponible)) : '—',
      helper: saldo === undefined ? 'Cargando saldo…' : saldo
        ? `Por liberar ${formatCLP((saldo.retenido || 0) + (saldo.enCurso || 0))} · Retirado ${formatCLP(saldo.retirado)}${saldo.cargos < 0 ? ` · Cargos -${formatCLP(Math.abs(saldo.cargos))}` : ''}`
        : 'No pudimos cargar tu saldo',
      icon: Banknote, tone: 'green', onClick: onOpenWithdrawals,
    },
    { id: 'messages', label: 'Mensajes abiertos', value: openChats.length, helper: `${quoteSentCount} cotizaciones enviadas`, icon: MessageCircle, tone: 'amber', onClick: onOpenChats },
    { id: 'stock', label: 'Inventario visible', value: inventory.published, helper: `${inventory.lowStock} con bajo stock`, icon: Box, tone: inventory.lowStock > 0 ? 'red' : 'purple', onClick: onOpenProducts },
  ];

  const attention = [
    ...pendingOrders.slice(0, 2).map((order) => ({ id: `p-${order.id}`, title: `Confirmar pedido ${orderLabel(order)}`, subtitle: itemName(order.items?.[0]), meta: `${formatCLP(order.totalVendedor ?? order.total)} · Por confirmar`, icon: Timer, tone: 'amber', onClick: onOpenOrders })),
    ...preparingOrders.slice(0, 2).map((order) => ({ id: `s-${order.id}`, title: `Registrar envío ${orderLabel(order)}`, subtitle: itemName(order.items?.[0]), meta: `${formatCLP(order.totalVendedor ?? order.total)} · Por enviar`, icon: Truck, tone: 'blue', onClick: onOpenOrders })),
    ...openChats.slice(0, 2).map((chat) => ({ id: `c-${chat.id}`, title: chat.cotizacion ? 'Responder conversación' : 'Nueva consulta', subtitle: chat.productoNombre || chat.productName || chat.titulo || 'Cotización', meta: chat.compradorNombre || chat.buyerName || 'Comprador', icon: MessageSquare, tone: 'purple', onClick: onOpenChats })),
    ...inventory.lowStockSample.slice(0, 1).map((product) => ({ id: `l-${product.id}`, title: 'Reponer stock crítico', subtitle: product.nombre || product.titulo || product.name, meta: `${product.stock ?? 0} unidades disponibles`, icon: AlertCircle, tone: 'red', onClick: onOpenProducts })),
  ].slice(0, 4);

  const quick = [
    { id: 'publish', label: 'Publicar', subtitle: 'Nuevo repuesto', icon: PackagePlus, tone: 'blue', onClick: onPublish },
    { id: 'shipping', label: 'Enviar', subtitle: `${preparingOrders.length} preparados`, icon: Send, tone: 'green', onClick: onOpenOrders },
    { id: 'reply', label: 'Responder', subtitle: `${openChats.length} abiertos`, icon: MessageSquare, tone: 'amber', onClick: onOpenChats },
    { id: 'withdraw', label: 'Retirar dinero', subtitle: 'Ver pedidos disponibles', icon: Wallet, tone: 'green', onClick: onOpenWithdrawals, highlight: true },
  ];

  return (
    <div className="sh">
      <section className="sh-hero">
        <div className="sh-identity">
          <span className="sh-avatar"><Store size={26} /></span>
          <span className="sh-identity-copy"><small>Panel vendedor · {city || 'Sin ciudad'}</small><strong>{storeName || 'Tu tienda'}</strong></span>
          {isOpen != null && <span className={`sh-chip ${isOpen ? 'is-green' : 'is-red'}`}>{isOpen ? 'Abierta' : 'Cerrada'}</span>}
        </div>
        <div className="sh-hero-stats">
          <div className="sh-priority">
            <small>Prioridad ahora</small>
            <b>{mainMetric}</b>
            <strong>pedidos necesitan gestión</strong>
          </div>
          <div className="sh-top">
            <small>Top venta</small>
            <button type="button" className="sh-top-card" disabled={!bestId} onClick={() => bestId && onOpenProduct?.(bestId)} aria-label={bestProduct ? `Abrir ${itemName(bestProduct.item)} en mi inventario` : 'Aún no hay un producto más vendido'}>
              <span className="sh-top-thumb">{bestImage ? <img src={bestImage} alt="" /> : <Box size={30} />}</span>
              <strong>{bestProduct ? itemName(bestProduct.item) : 'Aún sin ventas'}</strong>
              {bestProduct && <span className="sh-top-meta">{bestProduct.quantity} vendidos <ChevronRight size={13} /></span>}
            </button>
          </div>
        </div>
      </section>

      <div className="sh-metrics">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <button key={metric.id} type="button" className="sh-metric" onClick={metric.onClick}>
              <span className={`sh-icon is-${metric.tone}`}><Icon size={18} /></span>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </button>
          );
        })}
      </div>

      <div className="sh-section-head">
        <span><h3>Tu siguiente movimiento</h3><small>Ordenado por urgencia operativa</small></span>
        <button type="button" className="sh-arrow" onClick={onOpenOrders} aria-label="Ver todos los pedidos"><ArrowRight size={18} /></button>
      </div>
      {attention.length > 0 ? (
        <div className="sh-list">
          {attention.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" className="sh-attention" onClick={item.onClick}>
                <span className={`sh-icon is-${item.tone} is-round`}><Icon size={20} /></span>
                <span className="sh-attention-copy"><strong>{item.title}</strong><small>{item.subtitle}</small><em className={`is-${item.tone}`}>{item.meta}</em></span>
                <ChevronRight size={16} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="sh-calm">
          <Sparkles size={28} />
          <span><strong>{loading ? 'Cargando…' : 'Todo bajo control'}</strong><small>No hay pedidos, mensajes ni stock crítico esperando atención.</small></span>
        </div>
      )}

      <div className="sh-section-head"><span><h3>Accesos rápidos</h3><small>Las acciones que más mueven tu tienda</small></span></div>
      <div className="sh-quick">
        {quick.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.id} type="button" className={`sh-quick-action ${action.highlight ? 'is-highlight' : ''}`} onClick={action.onClick}>
              <span className={`sh-icon is-${action.tone}`}><Icon size={18} /></span>
              <span><strong>{action.label}</strong><small>{action.subtitle}</small></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
