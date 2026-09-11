import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, CircleAlert, Clock, Inbox, Loader2, MessageSquare, Package, PackageCheck, ShieldCheck, ShoppingBag, Store, Truck, User, Wrench } from 'lucide-react';
import { getBuyerOrdersApi, getMySellerChatsApi, getSellerOrdersApi, resolveMediaUrl, startSellerChatApi } from '../services/api';
import { MEDIATION_STATUS_LABELS } from '../data/mediationStatus';
import MediationCaseView from './MediationCaseView';

const CLOSED_STATES = ['RESUELTA', 'CERRADA'];

function toList(response) {
  return Array.isArray(response) ? response : response?.content || [];
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';
}

const RECEIVED_ORDER_STATES = ['ENTREGADO', 'RECIBIDO', 'RECEIVED', 'FINALIZADO', 'FINISHED', 'EN_MEDIACION', 'MEDIATION'];

const DELIVERED_OR_FORWARD_STATES = new Set(RECEIVED_ORDER_STATES);

function isDeliveredOrForward(status) {
  if (!status) return false;
  return DELIVERED_OR_FORWARD_STATES.has(String(status).trim().toUpperCase());
}

// Este chip replica los cuatro hitos de la barra del detalle. En particular, PAGADO se
// muestra como "Pendiente", porque la tienda todavía debe confirmar y preparar el pedido.
function timelineStatus(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'EN_PREPARACION' || normalized === 'PREPARING') return { label: 'En preparación', icon: Wrench, className: 'preparing' };
  if (normalized === 'ENVIADO' || normalized === 'SENT') return { label: 'Enviado', icon: Truck, className: 'sent' };
  if (isDeliveredOrForward(normalized)) return { label: 'Entregado/Finalizado', icon: PackageCheck, className: 'completed' };
  return { label: 'Pendiente', icon: Clock, className: 'pending' };
}

function ChatTimelineStatusBadge({ status, mediationStatus, showMediation }) {
  // La mediación es un estado visible mientras está activa. Al cerrarse, el flujo vuelve a
  // la recepción: la escalación solo es posible después de recibir el producto.
  if (showMediation && mediationStatus === 'EN_MEDIACION') {
    return <span className="seller-chat-order-status status-mediation"><CircleAlert size={12} />En mediación</span>;
  }
  const restoredStatus = CLOSED_STATES.includes(mediationStatus)
    && String(status || '').toUpperCase() === 'EN_MEDIACION'
    ? 'ENTREGADO'
    : status;
  const current = timelineStatus(restoredStatus);
  const Icon = current.icon;
  return <span className={`seller-chat-order-status status-${current.className}`}><Icon size={12} />{current.label}</span>;
}

// El backend es la fuente de verdad de `mediadorDisponible` y del plazo. El preview usa
// además el estado de ESTA suborden para explicar por qué todavía no se puede escalar.
function mediatorLine(chat) {
  if (chat.estadoMediacion === 'EN_MEDIACION') return { tone: 'ok', text: 'Mediador de RepuesTop revisando el caso' };
  if (CLOSED_STATES.includes(chat.estadoMediacion)) return { tone: 'done', text: 'Caso resuelto por el mediador' };
  const received = isDeliveredOrForward(chat.estadoPedido);
  if (!received) return { tone: 'muted', text: 'Podrás solicitar un mediador al recibir el producto; desde entonces tendrás 10 días hábiles.' };
  if (chat.mediadorDisponible) return { tone: 'ok', text: 'Puedes solicitar un mediador durante los 10 días hábiles posteriores a la recepción.' };
  return { tone: 'muted', text: 'El plazo de 10 días hábiles desde la recepción ya venció.' };
}

/**
 * Vista propia de "Chats con vendedor" (comprador) / "Chats con compradores" (vendedor).
 * Permite listar conversaciones existentes e iniciar chats a partir de compras/ventas
 * que se encuentren en estado entregado hacia adelante.
 */
export default function SellerChatsView({ user, mode = 'buyer', orders: initialOrders }) {
  const userId = user?.userId ?? user?.id;
  const sellerId = user?.sellerId || user?.proveedorId || user?.tiendaId || user?.userId || user?.id;
  const isSellerMode = mode === 'seller';
  const rol = isSellerMode ? 'vendedor' : 'comprador';

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Carga de órdenes para el selector desplegable
  const [orders, setOrders] = useState(Array.isArray(initialOrders) ? initialOrders : []);
  const [loadingOrders, setLoadingOrders] = useState(!Array.isArray(initialOrders));
  const [selectedItemKey, setSelectedItemKey] = useState('');
  const [startingChat, setStartingChat] = useState(false);
  const [startChatError, setStartChatError] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const openCaseId = searchParams.get('caso');
  const openCaseTienda = searchParams.get('tienda');
  const openCase = (orderId, proveedorId) => {
    const next = new URLSearchParams(searchParams);
    next.set('caso', String(orderId));
    if (proveedorId) next.set('tienda', String(proveedorId)); else next.delete('tienda');
    setSearchParams(next);
  };
  const closeCase = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('caso');
    next.delete('tienda');
    setSearchParams(next);
  };

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const res = await getMySellerChatsApi(userId, rol);
      setChats(toList(res));
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron cargar tus conversaciones.');
    } finally {
      setLoading(false);
    }
  }, [userId, rol]);

  useEffect(() => { load(); }, [load]);

  // Si llegan initialOrders desde props, sincronizar
  useEffect(() => {
    if (Array.isArray(initialOrders)) {
      setOrders(initialOrders);
      setLoadingOrders(false);
    }
  }, [initialOrders]);

  // Si no se pasaron órdenes desde props, cargarlas según el rol
  useEffect(() => {
    if (Array.isArray(initialOrders)) return;
    let active = true;
    setLoadingOrders(true);
    const fetchOrders = isSellerMode
      ? (sellerId ? getSellerOrdersApi(sellerId) : Promise.resolve([]))
      : (userId ? getBuyerOrdersApi(userId) : Promise.resolve([]));

    fetchOrders
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : res?.content || [];
        setOrders(list);
      })
      .catch(() => {
        if (active) setOrders([]);
      })
      .finally(() => {
        if (active) setLoadingOrders(false);
      });

    return () => { active = false; };
  }, [initialOrders, isSellerMode, sellerId, userId]);

  // Extraer compras/ventas y repuestos en estado entregado hacia adelante
  const eligibleOrderGroups = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    const groups = [];

    for (const order of orders) {
      if (!order || String(order.estado || order.status || '').toUpperCase() === 'CANCELADO') continue;

      const subOrders = Array.isArray(order.subordenes) ? order.subordenes : [];
      const subOrderByStore = new Map(subOrders.map((sub) => [String(sub.proveedorId), sub]));
      const rawItems = Array.isArray(order.items) ? order.items : [];

      const eligibleItems = [];

      if (rawItems.length > 0) {
        for (let idx = 0; idx < rawItems.length; idx++) {
          const item = rawItems[idx];
          if (String(item.estado || '').toUpperCase() === 'CANCELADO') continue;

          const storeId = item.proveedorId != null ? String(item.proveedorId) : null;
          const subOrder = storeId ? subOrderByStore.get(storeId) : null;

          // Para comprador: el estado efectivo es el de la suborden de la tienda si existe, o el del pedido
          // Para vendedor: el pedido ya viene acotado a su suborden desde el backend
          const effectiveStatus = isSellerMode
            ? (order.estado || order.status)
            : (subOrder?.estado || order.estado || order.status);

          if (isDeliveredOrForward(effectiveStatus)) {
            const counterpartName = isSellerMode
              ? (order.compradorNombre || 'Comprador')
              : (item.proveedorNombre || subOrder?.nombreTienda || 'Tienda');

            eligibleItems.push({
              key: `${order.id}-${item.productoId || item.id || idx}-${storeId || '0'}`,
              orderId: order.id,
              orderCode: order.codigoSoporte || order.numeroPedidoComprador || order.id,
              orderDate: order.createdAt || order.fecha,
              productId: item.productoId || item.id,
              productName: item.nombre || 'Repuesto del pedido',
              productPhoto: item.imagenUrl || item.fotoUrl || null,
              proveedorId: storeId ? Number(storeId) : (isSellerMode ? Number(sellerId) : null),
              counterpartName,
              status: effectiveStatus,
            });
          }
        }
      } else {
        // Respaldo para pedidos sin array explícito de items
        const effectiveStatus = order.estado || order.status;
        if (isDeliveredOrForward(effectiveStatus)) {
          eligibleItems.push({
            key: `order-${order.id}`,
            orderId: order.id,
            orderCode: order.codigoSoporte || order.numeroPedidoComprador || order.id,
            orderDate: order.createdAt || order.fecha,
            productId: null,
            productName: `Pedido #${order.codigoSoporte || order.id}`,
            productPhoto: null,
            proveedorId: isSellerMode ? Number(sellerId) : null,
            counterpartName: isSellerMode ? (order.compradorNombre || 'Comprador') : (order.proveedorNombre || 'Tienda'),
            status: effectiveStatus,
          });
        }
      }

      if (eligibleItems.length > 0) {
        groups.push({
          orderId: order.id,
          orderCode: order.codigoSoporte || order.numeroPedidoComprador || order.id,
          orderDate: order.createdAt || order.fecha,
          items: eligibleItems,
        });
      }
    }

    return groups;
  }, [orders, isSellerMode, sellerId]);

  const allEligibleItems = useMemo(() => {
    return eligibleOrderGroups.flatMap((g) => g.items);
  }, [eligibleOrderGroups]);

  const selectedItem = useMemo(() => {
    return allEligibleItems.find((item) => item.key === selectedItemKey) || null;
  }, [allEligibleItems, selectedItemKey]);

  // Detectar si ya existe conversación abierta para la orden y tienda seleccionadas
  const existingChat = useMemo(() => {
    if (!selectedItem) return null;
    return chats.find((c) => {
      const sameOrder = String(c.orderId) === String(selectedItem.orderId);
      if (!sameOrder) return false;
      if (!selectedItem.proveedorId || !c.proveedorId) return true;
      return String(c.proveedorId) === String(selectedItem.proveedorId);
    });
  }, [chats, selectedItem]);

  const handleStartOrOpenChat = async () => {
    if (!selectedItem || startingChat) return;
    setStartChatError('');

    if (existingChat) {
      openCase(selectedItem.orderId, selectedItem.proveedorId);
      return;
    }

    setStartingChat(true);
    try {
      await startSellerChatApi(selectedItem.orderId, selectedItem.proveedorId);
      await load();
      openCase(selectedItem.orderId, selectedItem.proveedorId);
    } catch (err) {
      setStartChatError(err.message || 'No se pudo iniciar la conversación con el vendedor.');
    } finally {
      setStartingChat(false);
    }
  };

  // Respaldo del filtro por rol del backend.
  const wantsBuyer = !isSellerMode;
  const visibleChats = useMemo(
    () => chats
      .filter((chat) => chat.viewerEsComprador == null || chat.viewerEsComprador === wantsBuyer)
      .sort((a, b) => new Date(b.ultimoMensajeAt || 0) - new Date(a.ultimoMensajeAt || 0)),
    [chats, wantsBuyer],
  );

  if (openCaseId) {
    return (
      <section className="profile-panel profile-cases-panel dispute-workspace">
        <MediationCaseView
          key={`${openCaseId}-${openCaseTienda || ''}`}
          pedidoId={openCaseId}
          proveedorId={openCaseTienda || undefined}
          user={user}
          mode={mode}
          onClose={closeCase}
          onChanged={load}
        />
      </section>
    );
  }

  const title = isSellerMode ? 'Chats con compradores' : 'Chats con vendedor';
  const subtitle = isSellerMode
    ? 'Conversaciones de tus compradores sobre los pedidos que vendiste.'
    : 'Escríbele a la tienda sobre cualquier compra: dudas, fallas o incompatibilidades.';

  return (
    <section className="profile-panel profile-cases-panel">
      <div className="profile-cases-header">
        <div>
          <h2 className="profile-panel-title"><MessageSquare size={19} /> {title}</h2>
          <p>{subtitle}</p>
        </div>
        <span>{visibleChats.length} {visibleChats.length === 1 ? 'conversación' : 'conversaciones'}</span>
      </div>

      {/* Selector desplegable de repuestos en compras/ventas entregadas */}
      <div className="seller-chat-picker-box">
        <div className="seller-chat-picker-header">
          <div>
            <h3>
              <ShoppingBag size={18} />
              {isSellerMode
                ? 'Elegir una venta para escribir al comprador'
                : 'Elegir una compra para escribir a la tienda'}
            </h3>
            <p>
              {isSellerMode
                ? 'Solo se muestran las ventas que se encuentran en estado entregada hacia adelante.'
                : 'Solo se muestran las compras que se encuentran en estado entregada hacia adelante.'}
            </p>
          </div>
          <span className="seller-chat-picker-badge">
            {allEligibleItems.length} {allEligibleItems.length === 1 ? 'repuesto entregado' : 'repuestos entregados'}
          </span>
        </div>

        {loadingOrders ? (
          <div className="seller-chat-picker-loading">
            <Loader2 size={16} className="spin-icon" />
            <span>Cargando tus {isSellerMode ? 'ventas' : 'compras'}...</span>
          </div>
        ) : allEligibleItems.length === 0 ? (
          <div className="seller-chat-picker-empty">
            <p>
              {isSellerMode
                ? 'No tienes ventas en estado entregado o posterior disponibles para iniciar un chat.'
                : 'No tienes compras en estado entregado o posterior disponibles para iniciar un chat.'}
            </p>
            <small>
              {isSellerMode
                ? 'Los chats con compradores se habilitan una vez que el producto es entregado al cliente.'
                : 'Los chats con tiendas se habilitan una vez que recibes el producto.'}
            </small>
          </div>
        ) : (
          <div className="seller-chat-picker-controls">
            <label htmlFor="seller-chat-order-select" className="sr-only">
              {isSellerMode ? 'Seleccionar venta entregada' : 'Seleccionar compra entregada'}
            </label>
            <select
              id="seller-chat-order-select"
              className="seller-chat-picker-select"
              value={selectedItemKey}
              onChange={(e) => {
                setSelectedItemKey(e.target.value);
                setStartChatError('');
              }}
            >
              <option value="">
                {isSellerMode
                  ? '-- Selecciona una venta / repuesto entregado para chatear --'
                  : '-- Selecciona una compra / repuesto entregado para chatear --'}
              </option>
              {eligibleOrderGroups.map((group) => (
                <optgroup
                  key={group.orderId}
                  label={`Pedido #${group.orderCode} · ${formatDate(group.orderDate)}`}
                >
                  {group.items.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.productName} · {isSellerMode ? `Comprador: ${item.counterpartName}` : item.counterpartName} ({timelineStatus(item.status).label})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {selectedItem && (
              <div className="seller-chat-preview-card">
                <div className="seller-chat-preview-media">
                  {selectedItem.productPhoto ? (
                    <img src={resolveMediaUrl(selectedItem.productPhoto)} alt="" />
                  ) : (
                    <Package size={22} />
                  )}
                </div>

                <div className="seller-chat-preview-info">
                  <h4>{selectedItem.productName}</h4>
                  <div className="seller-chat-preview-meta">
                    <span>
                      {isSellerMode ? <User size={13} /> : <Store size={13} />}
                      <strong>{selectedItem.counterpartName}</strong>
                    </span>
                    <span>· Pedido #{selectedItem.orderCode}</span>
                    <span>· {formatDate(selectedItem.orderDate)}</span>
                  </div>
                  <div className="seller-chat-preview-status">
                    <ChatTimelineStatusBadge status={selectedItem.status} />
                    {existingChat && (
                      <span className="seller-chat-active-indicator">
                        <MessageSquare size={12} /> Conversación ya iniciada
                      </span>
                    )}
                  </div>
                </div>

                <div className="seller-chat-preview-actions">
                  <button
                    type="button"
                    className="btn-auth-primary seller-chat-start-button"
                    onClick={handleStartOrOpenChat}
                    disabled={startingChat}
                  >
                    {startingChat ? (
                      <>
                        <Loader2 size={16} className="spin-icon" /> Iniciando chat...
                      </>
                    ) : existingChat ? (
                      <>
                        <MessageSquare size={16} /> Ver chat abierto
                      </>
                    ) : (
                      <>
                        <MessageSquare size={16} />
                        {isSellerMode ? 'Iniciar chat con el comprador' : 'Iniciar chat con el vendedor'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {startChatError && (
              <div className="auth-alert alert-error" style={{ marginTop: '10px' }}>
                <CircleAlert size={16} />
                <span>{startChatError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <div className="auth-alert alert-error"><CircleAlert size={16} /><span>{error}</span></div>}

      {loading ? (
        <div className="profile-loading-state"><Loader2 size={18} className="spin-icon" /><span>Cargando conversaciones...</span></div>
      ) : visibleChats.length === 0 ? (
        <div className="profile-empty-state profile-cases-empty">
          <Inbox />
          <span>
            {isSellerMode
              ? 'Todavía no tienes conversaciones con compradores.'
              : 'Todavía no tienes conversaciones con tiendas. Ábrelas desde el detalle de una compra.'}
          </span>
        </div>
      ) : (
        <ul className="case-rows">
          {visibleChats.map((chat) => {
            const estadoLabel = chat.estadoMediacion
              ? (MEDIATION_STATUS_LABELS[chat.estadoMediacion] || chat.estadoMediacion)
              : 'Chat abierto';
            const mediator = mediatorLine(chat);
            const photo = resolveMediaUrl(chat.productoFotoUrl);
            const counterpartIsStore = chat.viewerEsComprador == null ? !isSellerMode : chat.viewerEsComprador;
            return (
              <li key={chat.conversationId || chat.orderId}>
                <article
                  className="case-row clickable seller-chat-row"
                  onClick={() => openCase(chat.orderId, chat.proveedorId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCase(chat.orderId, chat.proveedorId); }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="seller-chat-thumb">
                    {photo ? <img src={photo} alt="" /> : <Package size={18} />}
                  </span>

                  <div className="case-row-main">
                    <div className="seller-chat-counterpart">
                      <strong>
                        {counterpartIsStore ? <Store size={13} /> : <User size={13} />} {chat.contraparteNombre || `Pedido ${chat.codigoPedido || ''}`}
                      </strong>
                      <ChatTimelineStatusBadge
                        status={chat.estadoPedido}
                        mediationStatus={chat.estadoMediacion}
                        showMediation
                      />
                    </div>
                    <p>{chat.ultimoMensaje?.trim() || chat.productoNombre || 'Sin mensajes todavía.'}</p>
                    <small className={`seller-chat-mediator tone-${mediator.tone}`}>
                      <ShieldCheck size={12} /> {mediator.text}
                    </small>
                  </div>

                  <div className="case-row-meta">
                    <span className={`profile-ticket-status status-${String(chat.estadoMediacion || 'chat').toLowerCase()}`}>{estadoLabel}</span>
                    {chat.codigoPedido && <span className="case-row-id">Pedido {chat.codigoPedido}</span>}
                    {chat.noLeidos > 0 && <span className="seller-chat-unread">{chat.noLeidos}</span>}
                    <time>{formatDate(chat.ultimoMensajeAt)}</time>
                  </div>

                  <span className="case-row-action"><MessageSquare size={13} /> Ver chat <ChevronRight size={16} /></span>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
