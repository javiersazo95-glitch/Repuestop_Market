import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Package, Send, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  createOrderClaimApi, createSupportTicketApi, getBuyerOrdersApi, getSellerOrdersApi,
  getSellerAccountStatusApi,
} from '../../services/api';
import { qk } from '../../services/queryKeys';
import { CONTACT_TOPICS, HELP_ROLES, TICKET_CATEGORIES, contactTopic } from '../../data/helpContent';
import { claimReasonPairs } from '../../data/claimReason';
import { profilePath } from '../../routes/paths';

// Asuntos por tema. Viajan como `motivo` del ticket (texto libre, no enum), así
// que se pueden ajustar sin romper el backoffice. Se retiró "Problemas al usar
// un cupón": la plataforma no tiene cupones.
const SUBJECTS = {
  'buyer-orders': [],
  'buyer-payment': ['Error al procesar el pago', 'Cobro duplicado en mi tarjeta', 'El pago se descontó y el pedido no aparece', 'Estado de un reembolso', 'Error al cargar el carrito de compra', 'Otro'],
  'buyer-quote': ['Vendedor no responde el chat', 'Error al aceptar cotización', 'Dudas sobre vigencia de cotización', 'Otro'],
  general: ['Problemas para iniciar sesión', 'Modificar datos de mi cuenta', 'Error al subir foto de perfil', 'Cambiar mi dirección de despacho', 'Eliminar mi cuenta', 'Otro'],
  'buyer-report': ['Publicación engañosa o con fotos que no corresponden', 'Sospecha de producto falsificado o sin procedencia', 'Producto prohibido o peligroso', 'La tienda insiste en vender fuera de RepuesTop', 'Trato irrespetuoso o acoso', 'Precio o stock que no se respeta', 'Otro'],
  'account-security': ['Creo que accedieron a mi cuenta', 'Recibí un correo o mensaje sospechoso a nombre de RepuesTop', 'Me pidieron mi clave o datos de tarjeta', 'No puedo recuperar el acceso a mi cuenta', 'Otro'],
  ads: ['Error al crear o publicar un anuncio', 'Pagué un anuncio y no se publicó', 'Quiero editar o dar de baja un anuncio', 'Dudas sobre los planes de difusión', 'Otro'],
  info: ['Cómo funciona la compra en RepuesTop', 'Cómo funcionan las cotizaciones', 'Cómo funciona la mediación', 'Quiero vender en RepuesTop', 'Otro'],
  'seller-orders': [],
  'seller-products': ['Error al crear o publicar producto', 'Problemas con las fotos del producto', 'Error al actualizar stock/inventario', 'Problemas con la carga masiva', 'Otro'],
  'seller-quote': ['Mensajes bloqueados o no cargan', 'Problema al enviar una cotización', 'Comprador no responde el chat', 'Otro'],
  'seller-payouts': ['No puedo solicitar un retiro', 'Un retiro no ha sido depositado', 'Error al validar mis datos bancarios', 'Mi saldo disponible no cuadra', 'Dudas sobre la comisión aplicada a una venta', 'Dudas sobre el Beneficio Tarifa Fundador', 'Otro'],
  'seller-store': ['Corregir el nombre o el RUT de mi tienda', 'Problemas con el logo o la portada', 'Dudas sobre la verificación de mi tienda', 'Actualizar mis métodos de envío', 'Cambiar el correo o el representante de la cuenta', 'Otro'],
  'seller-report': ['Otra tienda copió mis fotos o publicaciones', 'Publicación engañosa o producto falsificado', 'Comprador con conducta abusiva', 'Comprador que insiste en operar fuera de RepuesTop', 'Sospecha de fraude en un pedido', 'Otro'],
  'blocked-account': ['Solicitud de apelación de cuenta', 'Dudas sobre el motivo del bloqueo', 'Dificultades con una mediación en curso', 'Otro'],
};
// Los textos viven en `src/data/claimReason.js`: el mismo codigo se muestra despues
// como motivo del bloqueo en el panel del vendedor, y tenerlo escrito en dos lados
// garantizaba que se separaran.
const BUYER_CLAIMS = claimReasonPairs(
  'incompatible', 'defective', 'not_received', 'wrong_purchase', 'wrong_product',
  'buyer_remorse', 'delay_preparation', 'store_closed', 'refused_delivery',
  'no_contact', 'other',
);
const SELLER_CLAIMS = claimReasonPairs(
  'buyer_no_response', 'courier_issue', 'payout_issue', 'disputed_return',
  'out_of_stock', 'buyer_no_show', 'other',
);

function normalizedStatus(order) {
  const value = String(order.status || order.estado || '').toUpperCase();
  return { PENDIENTE: 'pending', PAGADO: 'pending', EN_PREPARACION: 'preparing', ENVIADO: 'sent', ENTREGADO: 'received', RECIBIDO: 'received', FINALIZADO: 'finished', EN_MEDIACION: 'mediation', MEDIATION: 'mediation', CANCELADO: 'cancelled' }[value] || value.toLowerCase();
}

/** Motivos de reclamo posibles según el estado del pedido y el método de entrega. */
function orderClaimOptions(order, reportType) {
  if (!order) return reportType === HELP_ROLES.SELLER ? SELLER_CLAIMS : BUYER_CLAIMS;
  const status = normalizedStatus(order);
  const terms = String(order.deliveryTerms || order.terminosEntrega || order.shipping?.method || order.metodoEnvio || '').toLowerCase();
  const pickup = terms.includes('retiro') || terms.includes('tienda') || terms.includes('store_pickup');
  if (reportType === HELP_ROLES.SELLER) {
    if (['pending', 'preparing'].includes(status)) return claimReasonPairs('payout_issue', 'out_of_stock', 'other');
    if (status === 'sent') return pickup ? claimReasonPairs('buyer_no_show', 'other') : claimReasonPairs('courier_issue', 'buyer_no_response', 'other');
    return claimReasonPairs('payout_issue', 'disputed_return', 'other');
  }
  if (['pending', 'preparing'].includes(status)) return claimReasonPairs('wrong_purchase', 'delay_preparation', 'other');
  if (status === 'sent') return pickup ? claimReasonPairs('store_closed', 'refused_delivery', 'no_contact', 'other') : claimReasonPairs('not_received', 'other');
  return claimReasonPairs('incompatible', 'defective', 'wrong_product', 'buyer_remorse', 'other');
}

// Con la tienda bloqueada casi todos los temas pierden sentido: el vendedor no puede
// despachar, publicar ni retirar dinero, asi que un ticket de "Retiros, pagos y
// comisiones" solo consume a un agente para responderle que su cuenta esta bloqueada.
// Se dejan los que SI aplican, empezando por la apelacion, que es la salida real.
// Soporte queda abierto a proposito -`JwtAuthenticationFilter` lo permite siempre-
// porque es el unico canal que le queda a una cuenta bloqueada.
const BLOCKED_SELLER_TOPICS = ['blocked-account', 'account-security', 'general', 'info'];

/**
 * Formulario de consulta o reclamo. Migrado desde SupportHelpPanel sin cambiar
 * lo que se envía al backend: un tema de pedidos crea un reclamo sobre la orden
 * y el resto crea un ticket de soporte.
 */
export default function HelpContactForm({ user, reportType, initialTopic = null, onTopicChange }) {
  const navigate = useNavigate();
  const sellerId = reportType === HELP_ROLES.SELLER ? user?.sellerId : null;
  const accountStatusQuery = useQuery({
    queryKey: qk.sellerAccountStatus(sellerId),
    queryFn: ({ signal }) => getSellerAccountStatusApi(sellerId, { signal }),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
    retry: false,
  });
  const isBlockedSeller = Boolean(accountStatusQuery.data?.sellerBlocked ?? user?.sellerBlocked);

  const allTopics = CONTACT_TOPICS[reportType] || CONTACT_TOPICS[HELP_ROLES.BUYER];
  const topics = isBlockedSeller
    ? allTopics.filter((item) => BLOCKED_SELLER_TOPICS.includes(item.id))
    : allTopics;
  // Un tema que no existe para este rol (por ejemplo `?tema=seller-products`
  // abierto con sesión de comprador) caería en un selector vacío: se ignora.
  const validInitialTopic = topics.some((item) => item.id === initialTopic) ? initialTopic : topics[0].id;

  const [topic, setTopic] = useState(validInitialTopic);
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [detail, setDetail] = useState('');
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [claimType, setClaimType] = useState('');
  const [customClaimType, setCustomClaimType] = useState('');
  const [target, setTarget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedId, setSubmittedId] = useState('');

  const topicMeta = contactTopic(reportType, topic);
  const isOrdersTopic = topic === 'buyer-orders' || topic === 'seller-orders';
  const selectedOrder = orders.find((order) => String(order.id) === String(selectedOrderId));
  const claimOptions = useMemo(() => orderClaimOptions(selectedOrder, reportType), [selectedOrder, reportType]);

  useEffect(() => {
    setSubject(''); setCustomSubject(''); setSelectedOrderId(''); setClaimType(''); setCustomClaimType(''); setTarget('');
    onTopicChange?.(topic);
  }, [topic]); // eslint-disable-line react-hooks/exhaustive-deps

  // El estado de bloqueo llega despues del primer render: si el tema elegido ya no
  // esta en la lista recortada, el selector quedaria mostrando un valor que no existe
  // entre sus opciones (en blanco) y se enviaria igual al backend.
  useEffect(() => {
    if (!topics.some((item) => item.id === topic)) {
      setTopic(topics[0].id);
    }
  }, [topics, topic]);

  useEffect(() => {
    if (!isOrdersTopic) return;
    const request = reportType === HELP_ROLES.SELLER
      ? getSellerOrdersApi(user?.sellerId)
      : getBuyerOrdersApi(user?.userId ?? user?.id);
    request
      .then((response) => setOrders(Array.isArray(response) ? response : response?.content || []))
      .catch(() => setOrders([]));
  }, [isOrdersTopic, reportType, user?.sellerId, user?.userId, user?.id]);

  const availableOrders = orders.filter((order) => {
    const status = normalizedStatus(order);
    return !['mediation', 'cancelled'].includes(status) && !order.claimReason && !order.motivoReclamo;
  });
  const finalSubject = subject === 'other' ? customSubject.trim() : subject;
  const finalClaim = claimType === 'other' ? customClaimType.trim() : claimType;
  const canSubmit = detail.trim().length > 0 && detail.trim().length <= 500
    && (isOrdersTopic ? selectedOrderId && finalClaim : finalSubject)
    && (!topicMeta.target || target.trim().length > 0);

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true); setError('');
    try {
      if (isOrdersTopic) {
        await createOrderClaimApi(user?.userId ?? user?.id, selectedOrderId, { motivo: finalClaim, descripcion: detail.trim() });
        setSubmittedId(`Reclamo pedido #${String(selectedOrderId).slice(0, 8)}`);
      } else {
        const ticket = await createSupportTicketApi({
          usuarioId: user?.userId ?? user?.id,
          nombreReportante: user?.userName || user?.nombre || user?.storeName || 'Usuario',
          tipoReportante: reportType,
          // Categoría real del enum CategoriaTicket: de ella dependen la
          // prioridad y el SLA que asigna el backoffice.
          categoria: topicMeta.categoria,
          // Valor real del enum PlataformaTicket del backend (no una copia del
          // valor que usa la app móvil): así el backoffice etiqueta y filtra
          // correctamente los tickets creados desde la web como "Sitio Web".
          plataforma: 'SITIO_WEB',
          motivo: finalSubject,
          detalle: topicMeta.target
            ? `${topicMeta.target}: ${target.trim()}

${detail.trim()}`
            : detail.trim(),
          // El backend manda un correo de confirmación con el número de ticket
          // cuando viene `correoContacto`. Se envía solo en los casos que se
          // siguen (ayuda y fallas), no en consultas informativas.
          correoContacto: topicMeta.categoria === TICKET_CATEGORIES.CONSULTA ? undefined : user?.email,
          sellerId: user?.sellerId ? Number(user.sellerId) : undefined,
          contexto: `topic=${topic} | sourceRoute=help-center`,
        });
        setSubmittedId(ticket?.externalId || ticket?.id || 'Solicitud registrada');
      }
      setDetail('');
    } catch (requestError) {
      setError(requestError.message || 'No se pudo procesar tu solicitud. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedId) {
    return (
      <section className="help-section support-success help-success">
        <CheckCircle2 />
        <h2>Consulta enviada</h2>
        <p>Nuestro equipo revisará tu caso. Número de consulta: <strong>{submittedId}</strong></p>
        <div>
          <button type="button" onClick={() => navigate(profilePath('consultas'))}>Ver mis consultas</button>
          <button type="button" className="secondary" onClick={() => setSubmittedId('')}>Enviar otra consulta</button>
        </div>
      </section>
    );
  }

  return (
    <form className="help-section support-ticket-form" onSubmit={submit}>
      <div className="support-form-grid">
        <label>
          Tema
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            {topics.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <small>
            {isBlockedSeller
              ? 'Tu cuenta está bloqueada: solo puedes abrir los casos relacionados con eso.'
              : 'Sirve para derivar tu caso más rápido.'}
          </small>
        </label>

        {isOrdersTopic ? (
          <label>
            Selecciona el pedido con problemas
            <select
              value={selectedOrderId}
              onChange={(event) => { setSelectedOrderId(event.target.value); setClaimType(''); }}
            >
              <option value="">Elige un pedido</option>
              {availableOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  Pedido #{String(order.id).slice(0, 8)} · {order.total ? `$${Number(order.total).toLocaleString('es-CL')}` : normalizedStatus(order)}
                </option>
              ))}
            </select>
            <small>Selecciona la compra asociada a tu consulta o reclamo.</small>
          </label>
        ) : (
          <label>
            Asunto
            <select
              value={subject}
              onChange={(event) => { const value = event.target.value; setSubject(value === 'Otro' ? 'other' : value); setCustomSubject(''); }}
            >
              <option value="">Selecciona el asunto</option>
              {(SUBJECTS[topic] || []).map((item) => (
                <option key={item} value={item === 'Otro' ? 'other' : item}>{item}</option>
              ))}
            </select>
          </label>
        )}

        {isOrdersTopic && selectedOrderId && (
          <label>
            Motivo del reclamo
            <select value={claimType} onChange={(event) => setClaimType(event.target.value)}>
              <option value="">Selecciona el motivo</option>
              {claimOptions.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}

        {topicMeta.target && (
          <label>
            {topicMeta.target}
            <input
              maxLength="200"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="Nombre de la tienda, título de la publicación o enlace"
            />
            <small>Sin este dato no podemos revisar la denuncia.</small>
          </label>
        )}

        {!isOrdersTopic && subject === 'other' && (
          <label>
            Especifica el asunto
            <input maxLength="100" value={customSubject} onChange={(event) => setCustomSubject(event.target.value)} placeholder="Escribe el asunto de tu consulta" />
          </label>
        )}

        {isOrdersTopic && claimType === 'other' && (
          <label>
            Describe el motivo
            <input maxLength="100" value={customClaimType} onChange={(event) => setCustomClaimType(event.target.value)} placeholder="Escribe el motivo de tu reclamo" />
          </label>
        )}
      </div>

      <label className="support-detail-field">
        {isOrdersTopic && selectedOrderId ? 'Explica el problema' : 'Detalle'}
        <textarea
          rows="6"
          maxLength="500"
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          placeholder={isOrdersTopic ? 'Cuéntanos con detalle qué ocurrió con tu pedido...' : 'Explica qué pasó, desde cuándo y qué esperabas ver'}
        />
        <small>{detail.length} / 500</small>
      </label>

      {error && <div className="auth-alert alert-error"><AlertTriangle /><span>{error}</span></div>}

      <button className="support-submit-button" type="submit" disabled={!canSubmit || submitting}>
        {submitting ? <Loader2 className="spin-icon" /> : isOrdersTopic ? <ShoppingBag /> : <Send />}
        {submitting ? 'Enviando...' : isOrdersTopic ? 'Enviar reclamo' : 'Enviar consulta'}
      </button>

      {isOrdersTopic && availableOrders.length === 0 && (
        <div className="support-no-orders"><Package /> No tienes pedidos disponibles para reclamo.</div>
      )}
    </form>
  );
}



