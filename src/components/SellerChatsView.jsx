import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, CircleAlert, Clock, Inbox, Loader2, MessageSquare, Package, PackageCheck, ShieldCheck, Store, Truck, User, Wrench } from 'lucide-react';
import { getMySellerChatsApi, resolveMediaUrl } from '../services/api';
import { MEDIATION_STATUS_LABELS } from '../data/mediationStatus';
import MediationCaseView from './MediationCaseView';

const CLOSED_STATES = ['RESUELTA', 'CERRADA'];

function toList(response) {
  return Array.isArray(response) ? response : response?.content || [];
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';
}

const RECEIVED_ORDER_STATES = ['ENTREGADO', 'RECEIVED', 'FINALIZADO', 'FINISHED'];

// Este chip replica los cuatro hitos de la barra del detalle. En particular, PAGADO se
// muestra como "Pendiente", porque la tienda todavía debe confirmar y preparar el pedido.
function timelineStatus(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'EN_PREPARACION' || normalized === 'PREPARING') return { label: 'En preparación', icon: Wrench, className: 'preparing' };
  if (normalized === 'ENVIADO' || normalized === 'SENT') return { label: 'Enviado', icon: Truck, className: 'sent' };
  if (RECEIVED_ORDER_STATES.includes(normalized)) return { label: 'Entregado/Finalizado', icon: PackageCheck, className: 'completed' };
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
  const received = RECEIVED_ORDER_STATES.includes(String(chat.estadoPedido || '').toUpperCase());
  if (!received) return { tone: 'muted', text: 'Podrás solicitar un mediador al recibir el producto; desde entonces tendrás 10 días hábiles.' };
  if (chat.mediadorDisponible) return { tone: 'ok', text: 'Puedes solicitar un mediador durante los 10 días hábiles posteriores a la recepción.' };
  return { tone: 'muted', text: 'El plazo de 10 días hábiles desde la recepción ya venció.' };
}

/**
 * Vista propia de "Chats con vendedor" (comprador) / "Chats con compradores" (vendedor).
 * Antes vivía como una pestaña dentro de "Reportes/Soporte"; ahora es un menú aparte por
 * sección. `mode` decide el rol y el texto.
 */
export default function SellerChatsView({ user, mode = 'buyer' }) {
  const userId = user?.userId ?? user?.id;
  const isSellerMode = mode === 'seller';
  const rol = isSellerMode ? 'vendedor' : 'comprador';

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
