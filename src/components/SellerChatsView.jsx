import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, CircleUser, Clock, Info, Loader2, Lock,
  MessageCircle, MessageSquareDashed, MessagesSquare, Package, Receipt, Shield, ShieldCheck, ShoppingBag, ShoppingCart,
  Store, User, Users, X,
} from 'lucide-react';
import { getBuyerOrdersApi, getMySellerChatsApi, getSellerOrdersApi, resolveMediaUrl, startSellerChatApi } from '../services/api';
import { orderAllowsChat } from '../data/orderStatusFlow';
import { mediatorWindowForOrder } from '../data/mediationStatus';
import { orderDisplayCode } from '../data/orderIdentity';
import MediationCaseView from './MediationCaseView';

/**
 * Bandeja "Chats con vendedor" (comprador) / "Chats con compradores" (tienda), clon de
 * `mobile/components/support/DisputesCenter.tsx`: hero, "¿Cómo funciona?", el botón
 * "Elegir una compra…" que abre una hoja con una fila por producto/tienda, filtros y la lista
 * de chats. Elegir una fila crea el chat con `POST chat-vendedor` ANTES de abrirlo (el GET
 * responde 404 si la conversación no existe). Los estilos (`mchat-*`) viven en
 * `src/styles/mediation-chat.css`.
 */

const RECEIVED_ORDER_STATES = new Set(['ENTREGADO', 'RECIBIDO', 'RECEIVED', 'FINALIZADO', 'FINISHED', 'EN_MEDIACION', 'MEDIATION']);

function pedidoYaRecibido(estadoPedido) {
  return RECEIVED_ORDER_STATES.has(String(estadoPedido || '').trim().toUpperCase());
}

const dateTimeFormatter = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const dateFormatter = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' });

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date);
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}

function toList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.content)) return res.content;
  return [];
}

// Tokens de la app (`theme/colors.ts`) para los badges, inline porque dependen del estado.
const TONES = {
  warning: { color: '#9A5A00', background: '#FFF7E6' },
  primary: { color: '#0056BF', background: '#EAF2FF' },
  success: { color: '#0E7038', background: '#EAFBF1' },
  mediation: { color: '#5B3AD6', background: '#F3F0FF' },
  error: { color: '#B42318', background: '#FFF0F0' },
  muted: { color: '#5A6B7A', background: '#F3F5F7' },
};

const MEDIATION_BADGE = {
  EN_MEDIACION: { label: 'En mediación', tone: TONES.mediation, Icon: Users },
  RESUELTA: { label: 'Resuelta', tone: TONES.success, Icon: CheckCircle2 },
  CERRADA: { label: 'Cerrada', tone: TONES.muted, Icon: Lock },
};

// Etiqueta del estado del pedido para el preview del chat (mismo mapa que la app).
function orderStatusBadge(estadoPedido) {
  switch (String(estadoPedido || '').trim().toUpperCase()) {
    case 'PENDIENTE':
    case 'PAGADO':
      return { label: 'Pendiente', tone: TONES.warning };
    case 'EN_PREPARACION':
      return { label: 'En preparación', tone: TONES.warning };
    case 'ENVIADO':
      return { label: 'Enviado', tone: TONES.primary };
    case 'ENTREGADO':
    case 'RECIBIDO':
      return { label: 'Recibido', tone: TONES.success };
    case 'FINALIZADO':
      return { label: 'Finalizado', tone: TONES.success };
    case 'EN_MEDIACION':
      return { label: 'En mediación', tone: TONES.mediation };
    case 'CANCELADO':
      return { label: 'Cancelado', tone: TONES.error };
    default:
      return null;
  }
}

// Estado de la ventana de mediación para un chat, resumido en un icono + texto de ayuda
// (los mismos 6 casos de `mediatorInfo` en la app).
function mediatorInfo(chat) {
  if (chat.estadoMediacion === 'EN_MEDIACION') {
    return {
      Icon: Users,
      color: TONES.mediation.color,
      title: 'Caso en revisión por un mediador',
      body: 'Un mediador de RepuesTop está revisando este caso con la evidencia de ambas partes. Te avisaremos cuando haya una resolución; mientras tanto puedes seguir la conversación desde el chat.',
    };
  }
  if (chat.estadoMediacion === 'RESUELTA') {
    return {
      Icon: CheckCircle2,
      color: TONES.success.color,
      title: 'Mediación resuelta',
      body: 'El mediador de RepuesTop cerró este caso con una resolución. Puedes revisar el detalle dentro del chat.',
    };
  }
  if (chat.estadoMediacion === 'CERRADA') {
    return {
      Icon: Lock,
      color: TONES.muted.color,
      title: 'Mediación cerrada',
      body: 'Este caso de mediación fue cerrado. El chat queda disponible solo para consulta.',
    };
  }
  if (chat.mediadorDisponible) {
    return {
      Icon: ShieldCheck,
      color: TONES.success.color,
      title: 'Puedes pedir un mediador',
      body: chat.fechaLimiteMediador
        ? `Tienes hasta el ${formatDate(chat.fechaLimiteMediador)} para solicitar la ayuda de un mediador de RepuesTop desde el chat. Son 10 días corridos contados desde que recibiste el pedido.`
        : 'Puedes solicitar la ayuda de un mediador de RepuesTop desde el chat. El plazo es de 10 días corridos desde que recibiste el pedido.',
    };
  }
  if (!pedidoYaRecibido(chat.estadoPedido)) {
    return {
      Icon: Shield,
      color: TONES.primary.color,
      title: 'Mediador disponible al recibir el pedido',
      body: 'La ayuda de un mediador se puede solicitar una vez que recibes el producto. Desde ese momento tienes 10 días corridos para pedirla desde el chat.',
    };
  }
  return {
    Icon: Lock,
    color: TONES.muted.color,
    title: 'Plazo de mediación vencido',
    body: 'El plazo de 10 días corridos para pedir un mediador ya venció. Puedes seguir conversando con la tienda y marcar el caso como resuelto cuando lleguen a un acuerdo.',
  };
}

function MediatorInfoDialog({ info, onClose }) {
  if (typeof document === 'undefined') return null;
  const { Icon } = info;
  return createPortal(
    <div className="mchat-centered-backdrop" onClick={onClose}>
      <div className="mchat-centered" role="dialog" aria-modal="true" aria-label={info.title} onClick={(e) => e.stopPropagation()}>
        <span className="mchat-centered-icon" style={{ background: `${info.color}1A`, color: info.color }}><Icon size={24} /></span>
        <h3 className="mchat-h3">{info.title}</h3>
        <p>{info.body}</p>
        <button type="button" className="mchat-btn-primary" onClick={onClose}>Entendido</button>
      </div>
    </div>,
    document.body
  );
}

function ChatRow({ chat, isSellerMode, onOpen }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const badge = chat.estadoMediacion ? MEDIATION_BADGE[chat.estadoMediacion] : null;
  const orderBadge = orderStatusBadge(chat.estadoPedido);
  const mediator = mediatorInfo(chat);
  const photo = resolveMediaUrl(chat.productoFotoUrl);
  // La contraparte es una tienda cuando el usuario es el comprador de ese pedido.
  const counterpartIsStore = chat.viewerEsComprador == null ? !isSellerMode : chat.viewerEsComprador;
  const MediatorIcon = mediator.Icon;
  return (
    <li>
      <div className="mchat-chat-row" role="button" tabIndex={0} aria-label={`Abrir chat con ${chat.contraparteNombre}`}
        onClick={() => onOpen(chat.orderId, chat.proveedorId)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(chat.orderId, chat.proveedorId); } }}
      >
        <span className="mchat-chat-thumb">
          {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <Package size={20} />}
        </span>
        <div className="mchat-chat-copy">
          <div className="mchat-chat-title">
            {counterpartIsStore ? <Store size={15} /> : <CircleUser size={15} />}
            <strong>{chat.contraparteNombre || (counterpartIsStore ? 'Tienda' : 'Comprador')}</strong>
            {orderBadge && <span className="mchat-status-badge" style={{ color: orderBadge.tone.color, background: orderBadge.tone.background }}>{orderBadge.label}</span>}
            {chat.noLeidos > 0 && <span className="mchat-unread">{chat.noLeidos}</span>}
          </div>
          <span className="mchat-chat-line">{chat.productoNombre ?? `Pedido ${chat.codigoPedido || ''}`}</span>
          <span className="mchat-chat-line">{chat.ultimoMensaje?.trim() || 'Sin mensajes todavía'}</span>
          <div className="mchat-chat-meta">
            {badge ? (
              <span className="mchat-mediation-badge" style={{ color: badge.tone.color, background: badge.tone.background }}>
                <badge.Icon size={11} /> {badge.label}
              </span>
            ) : <span />}
            <span className="mchat-chat-date">{formatDateTime(chat.ultimoMensajeAt)}</span>
          </div>
        </div>
        <div className="mchat-chat-right">
          <button
            type="button"
            className="mchat-info-btn"
            aria-label={`Información del mediador: ${mediator.title}`}
            onClick={(event) => { event.stopPropagation(); setInfoOpen(true); }}
            style={{ color: mediator.color }}
          >
            <MediatorIcon size={16} />
          </button>
          <ChevronRight size={20} />
        </div>
      </div>
      {infoOpen && <MediatorInfoDialog info={mediator} onClose={() => setInfoOpen(false)} />}
    </li>
  );
}

function PickEntryRow({ entry, isSellerMode, isStarting, onPick }) {
  const mediator = mediatorWindowForOrder(entry.order);
  const photo = resolveMediaUrl(entry.photo);
  return (
    <button
      type="button"
      className="mchat-pick-row"
      disabled={isStarting}
      aria-busy={isStarting}
      aria-label={`Escribir a ${entry.counterpartName} sobre ${entry.productName}`}
      onClick={() => onPick(entry)}
    >
      <span className="mchat-pick-thumb">
        {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <Package size={22} />}
      </span>
      <span className="mchat-pick-copy">
        <strong>{entry.productName}</strong>
        <span className="mchat-pick-inline">
          {isSellerMode ? <User size={13} /> : <Store size={13} />}
          <span>{entry.counterpartName}</span>
        </span>
        <span className="mchat-pick-inline"><span>Pedido {entry.orderCode} · {formatDate(entry.orderDate)}</span></span>
        <span className={`mchat-mediator-pill ${mediator.available ? 'is-available' : 'is-locked'}`}>
          {mediator.available ? <ShieldCheck size={12} /> : <Clock size={12} />}
          {mediator.available
            ? `Mediador disponible hasta ${formatDate(mediator.limit)} (10 días corridos)`
            : mediator.limit
              ? 'Plazo de mediación vencido (10 días corridos)'
              : 'Mediador disponible al recibir el pedido'}
        </span>
      </span>
      {isStarting ? <Loader2 size={20} className="spin-icon" /> : <MessageCircle size={20} />}
    </button>
  );
}

export default function SellerChatsView({ user, mode = 'buyer', orders: initialOrders }) {
  const userId = user?.userId || user?.id;
  const sellerId = user?.sellerId || user?.proveedorId || user?.tiendaId || user?.userId || user?.id;
  const isSellerMode = mode === 'seller';
  const rol = isSellerMode ? 'vendedor' : 'comprador';

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState(Array.isArray(initialOrders) ? initialOrders : []);
  const [filter, setFilter] = useState('all');
  const [showHelp, setShowHelp] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Fila del picker cuyo chat se está creando (spinner y sin doble clic).
  const [startingKey, setStartingKey] = useState(null);
  const [startChatError, setStartChatError] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const openCaseId = searchParams.get('caso');
  const openCaseTienda = searchParams.get('tienda');
  // Viene del checklist del vendedor ("Avisar al comprador"): un mensaje ya armado para no
  // obligarlo a copiar y pegar. Por `state`, no por query param, para no dejarlo en la URL.
  const openCaseDraftMessage = location.state?.draftMessage || '';
  const openCase = (orderId, proveedorId) => {
    const next = new URLSearchParams(searchParams);
    next.set('caso', String(orderId));
    if (proveedorId) next.set('tienda', String(proveedorId)); else next.delete('tienda');
    setSearchParams(next);
  };
  const closeCase = () => {
    // Si el chat se abrio desde otra vista (detalle del pedido, tarjeta), "volver" regresa
    // alli; si se abrio desde esta bandeja, se cierra el caso y se queda en la lista.
    const from = location.state?.from;
    if (from && from !== `${location.pathname}${location.search}`) { navigate(from); return; }
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
    if (Array.isArray(initialOrders)) setOrders(initialOrders);
  }, [initialOrders]);

  // Si no se pasaron órdenes desde props, cargarlas según el rol
  useEffect(() => {
    if (Array.isArray(initialOrders)) return undefined;
    let active = true;
    const fetchOrders = isSellerMode
      ? (sellerId ? getSellerOrdersApi(sellerId) : Promise.resolve([]))
      : (userId ? getBuyerOrdersApi(userId) : Promise.resolve([]));
    fetchOrders
      .then((res) => { if (active) setOrders(toList(res)); })
      .catch(() => { if (active) setOrders([]); });
    return () => { active = false; };
  }, [initialOrders, isSellerMode, sellerId, userId]);

  // Chats ya iniciados, por (pedido, tienda). Para pedidos de una sola tienda el
  // proveedorId puede venir null; se indexa también por pedido a secas.
  const startedKeys = useMemo(() => {
    const set = new Set();
    for (const c of chats) {
      set.add(`o:${c.orderId}`);
      if (c.proveedorId) set.add(`o:${c.orderId}:s:${c.proveedorId}`);
    }
    return set;
  }, [chats]);

  // El picker muestra un producto por tienda de cada compra SIN chat iniciado con esa
  // tienda, de la más nueva a la más antigua. Solo pedidos con el pago aprobado y no
  // cancelados (`orderAllowsChat`): el chat postventa nace con la venta, igual que en la app
  // y en el backend.
  const pickableEntries = useMemo(() => {
    const rows = [];
    const sorted = [...orders].sort((a, b) => new Date(b.createdAt || b.fecha || 0) - new Date(a.createdAt || a.fecha || 0));
    for (const order of sorted) {
      if (!order) continue;
      const orderStatus = order.estado || order.status;
      if (!orderAllowsChat(orderStatus)) continue;
      const subOrders = Array.isArray(order.subordenes) ? order.subordenes : [];
      const subOrderByStore = new Map(subOrders.map((sub) => [String(sub.proveedorId), sub]));
      const items = Array.isArray(order.items) ? order.items : [];
      const bySeller = new Map();
      for (const item of items) {
        if (String(item.estado || '').toUpperCase() === 'CANCELADO') continue;
        const sid = item.proveedorId != null ? String(item.proveedorId) : '';
        if (bySeller.has(sid)) continue;
        bySeller.set(sid, {
          counterpartName: isSellerMode
            ? (order.compradorNombre || 'Comprador')
            : (item.proveedorNombre || subOrderByStore.get(sid)?.nombreTienda || order.proveedorNombre || 'Tienda'),
          productName: item.nombre || item.productName || 'Producto del pedido',
          photo: item.imagenUrl || item.fotoUrl || item.imageUrl || null,
        });
      }
      if (bySeller.size === 0) {
        // Respaldo para pedidos sin array explícito de items.
        bySeller.set('', {
          counterpartName: isSellerMode ? (order.compradorNombre || 'Comprador') : (order.proveedorNombre || 'Tienda'),
          productName: `Pedido ${orderDisplayCode(order, isSellerMode ? 'seller' : 'buyer')}`,
          photo: null,
        });
      }
      const multi = bySeller.size > 1;
      for (const [sid, info] of bySeller) {
        // Para el comprador, en un carrito de varias tiendas, la subórden cancelada o sin pagar
        // no ofrece chat (el vendedor ya recibe el pedido acotado a su tienda).
        if (!isSellerMode && multi && sid && !orderAllowsChat(subOrderByStore.get(sid)?.estado ?? orderStatus)) continue;
        const started = multi
          ? startedKeys.has(`o:${order.id}:s:${sid}`)
          : startedKeys.has(`o:${order.id}`);
        if (started) continue;
        rows.push({
          key: `${order.id}:${sid || '_'}`,
          order,
          orderId: order.id,
          orderCode: orderDisplayCode(order, isSellerMode ? 'seller' : 'buyer'),
          orderDate: order.createdAt || order.fecha,
          proveedorId: multi && sid ? Number(sid) : (isSellerMode ? Number(sellerId) : (sid ? Number(sid) : null)),
          counterpartName: info.counterpartName,
          productName: info.productName,
          photo: info.photo,
        });
      }
    }
    return rows;
  }, [orders, startedKeys, isSellerMode, sellerId]);

  // Hay pedidos, pero ninguno con el pago aprobado: el picker lo dice en vez de parecer vacío.
  const noneEligible = orders.length > 0 && !orders.some((o) => orderAllowsChat(o?.estado || o?.status));

  const pickEntry = async (entry) => {
    if (startingKey) return;
    setStartingKey(entry.key);
    setStartChatError('');
    try {
      // Crea (o retoma) la conversación ANTES de abrirla: así el chat se abre con la
      // contraparte y el compositor listos.
      await startSellerChatApi(entry.orderId, entry.proveedorId);
      await load();
      setPickerOpen(false);
      openCase(entry.orderId, entry.proveedorId);
    } catch (err) {
      setStartChatError(err.message || 'No se pudo abrir el chat.');
    } finally {
      setStartingKey(null);
    }
  };

  // Respaldo del filtro por rol del backend.
  const wantsBuyer = !isSellerMode;
  const visibleChats = useMemo(
    () => chats
      .filter((chat) => chat.viewerEsComprador == null || chat.viewerEsComprador === wantsBuyer)
      .sort((a, b) => new Date(b.ultimoMensajeAt || 0) - new Date(a.ultimoMensajeAt || 0)),
    [chats, wantsBuyer]
  );
  const filteredChats = useMemo(() => visibleChats.filter((c) => {
    if (filter === 'chat') return c.estadoMediacion == null;
    if (filter === 'EN_MEDIACION') return c.estadoMediacion === 'EN_MEDIACION';
    return true;
  }), [visibleChats, filter]);

  if (openCaseId) {
    return (
      <section className="profile-panel profile-cases-panel mchat-workspace">
        <MediationCaseView
          key={`${openCaseId}-${openCaseTienda || ''}`}
          pedidoId={openCaseId}
          proveedorId={openCaseTienda || undefined}
          user={user}
          mode={mode}
          initialDraft={openCaseDraftMessage}
          onClose={closeCase}
          onChanged={load}
        />
      </section>
    );
  }

  const pickerEmptyText = isSellerMode
    ? (orders.length === 0
      ? 'Todavía no tienes pedidos registrados.'
      : noneEligible
        ? 'Podrás escribir al comprador cuando el pago de la venta esté aprobado.'
        : 'Ya tienes un chat abierto con todos los compradores de tus pedidos. Búscalo en la lista.')
    : (orders.length === 0
      ? 'Todavía no tienes compras registradas.'
      : noneEligible
        ? 'Podrás escribir a la tienda cuando el pago de tu compra esté aprobado.'
        : 'Ya tienes un chat abierto con todas las tiendas de tus compras. Búscalo en la lista.');

  return (
    <section className="profile-panel profile-cases-panel mchat-inbox">
      <div className="mchat-hero">
        <span className="mchat-hero-icon"><MessagesSquare size={26} /></span>
        <div>
          <h2 className="mchat-h2">{isSellerMode ? 'Chats con compradores' : 'Chats con vendedor'}</h2>
          <p className="mchat-caption mchat-muted">
            {isSellerMode
              ? 'Responde consultas y reclamos de tus compradores sobre cada pedido.'
              : 'Escríbele a la tienda sobre cualquier compra: dudas, fallas o incompatibilidades.'}
          </p>
        </div>
      </div>

      <button type="button" className="mchat-help-toggle" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>
        <Info size={16} />
        <span>¿Cómo funciona? {showHelp ? 'Ocultar' : 'Ver'}</span>
        {showHelp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {showHelp && (
        <div className="mchat-help-box">
          {isSellerMode
            ? '1. Toca "Elegir un pedido" y selecciona el producto sobre el que quieres hablar.'
            : '1. Toca "Elegir una compra" y selecciona el producto sobre el que quieres hablar.'}
          <br />
          2. El primer mensaje deja el chat guardado en esta lista para retomarlo cuando quieras.
          <br />
          {isSellerMode
            ? '3. Si no llegan a acuerdo, una vez que el comprador reciba el pedido tiene 10 días corridos '
            : '3. Si no llegan a acuerdo, una vez que recibas el pedido tienes 10 días corridos '}
          para pedir un mediador de RepuesTop desde el chat. Pasado ese plazo el chat sigue abierto, pero sin mediador.
          <br />
          El soporte, los reclamos y la mediación de RepuesTop solo cubren compras pagadas dentro de RepuesTop.
        </div>
      )}

      <button
        type="button"
        className="mchat-picker-button"
        onClick={() => { setStartChatError(''); setPickerOpen(true); }}
        aria-label={isSellerMode ? 'Elegir un pedido para escribirle al comprador' : 'Elegir una compra para escribirle a la tienda'}
      >
        {isSellerMode ? <Receipt size={20} /> : <ShoppingBag size={20} />}
        <strong>{isSellerMode ? 'Elegir un pedido para escribir al comprador' : 'Elegir una compra para escribir a la tienda'}</strong>
        <span className="mchat-picker-count">{pickableEntries.length}</span>
        <ChevronRight size={18} />
      </button>

      <div className="mchat-filter-row" role="tablist" aria-label="Filtrar conversaciones">
        {[['all', 'Todos'], ['chat', 'Solo chat'], ['EN_MEDIACION', 'En mediación']].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={`mchat-filter-chip ${filter === value ? 'is-selected' : ''}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredChats.length > 0 && <span className="mchat-eyebrow">Tus conversaciones</span>}

      {error && <div className="mchat-inline-error"><AlertTriangle size={16} /><span>{error}</span></div>}

      {loading ? (
        <div className="mchat-inbox-loading"><Loader2 size={18} className="spin-icon" /><span>Cargando conversaciones...</span></div>
      ) : filteredChats.length === 0 ? (
        <div className="mchat-inbox-empty">
          <MessageSquareDashed size={44} />
          <strong>{chats.length === 0 ? (isSellerMode ? 'Todavía no tienes chats con compradores' : 'Todavía no tienes chats con vendedores') : 'Sin resultados'}</strong>
          <p className="mchat-body mchat-muted">
            {chats.length === 0
              ? (isSellerMode
                ? 'Toca "Elegir un pedido" arriba y selecciona el producto sobre el que quieres hablar.'
                : 'Toca "Elegir una compra" arriba y selecciona el producto sobre el que quieres hablar.')
              : 'Prueba con otro filtro.'}
          </p>
        </div>
      ) : (
        <ul className="mchat-chat-list">
          {filteredChats.map((chat) => (
            <ChatRow key={chat.conversationId || `${chat.orderId}-${chat.proveedorId || ''}`} chat={chat} isSellerMode={isSellerMode} onOpen={openCase} />
          ))}
        </ul>
      )}

      {pickerOpen && typeof document !== 'undefined' && createPortal(
        <div className="mchat-sheet-backdrop" onClick={() => !startingKey && setPickerOpen(false)}>
          <section className="mchat-sheet" role="dialog" aria-modal="true" aria-label={isSellerMode ? 'Elige un pedido' : 'Elige una compra'} onClick={(e) => e.stopPropagation()}>
            <header className="mchat-sheet-header">
              <div>
                <h3 className="mchat-h3">{isSellerMode ? 'Elige un pedido' : 'Elige una compra'}</h3>
                <span className="mchat-caption mchat-muted">
                  {isSellerMode
                    ? 'Selecciona el producto para hablar con el comprador que lo pidió.'
                    : 'Selecciona el producto para hablar con la tienda que te lo vendió.'}
                </span>
              </div>
              <button type="button" className="mchat-sheet-close" onClick={() => setPickerOpen(false)} aria-label="Cerrar"><X size={18} /></button>
            </header>
            {startChatError && (
              <div className="mchat-inline-error" style={{ margin: '12px 16px 0' }}><AlertTriangle size={16} /><span>{startChatError}</span></div>
            )}
            {pickableEntries.length === 0 ? (
              <div className="mchat-pick-empty">
                <ShoppingCart size={40} />
                <span>{pickerEmptyText}</span>
              </div>
            ) : (
              <div className="mchat-sheet-body mchat-pick-list">
                {pickableEntries.map((entry) => (
                  <PickEntryRow
                    key={entry.key}
                    entry={entry}
                    isSellerMode={isSellerMode}
                    isStarting={startingKey === entry.key}
                    onPick={(picked) => void pickEntry(picked)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>,
        document.body
      )}
    </section>
  );
}
