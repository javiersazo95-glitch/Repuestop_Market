import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, CircleUserRound, FileText, Headphones,
  HelpCircle, Loader2, Package, Send, ShieldCheck, ShoppingBag, Wrench
} from 'lucide-react';
import { createOrderClaimApi, createSupportTicketApi, getBuyerOrdersApi, getSellerOrdersApi } from '../services/api';

const BUYER_FAQS = [
  ['¿Cómo sigo mi pedido?', 'Ingresa a Pedidos y abre el detalle. Allí verás el estado, el envío y el historial de la compra.'],
  ['¿Qué hago si no encuentro mi repuesto?', 'Revisa el vehículo, usa filtros y prueba pedir una cotización desde la ficha del producto o el chat de cotización.'],
  ['¿Cómo abro un reclamo?', 'Desde el detalle del pedido puedes iniciar un reclamo si hubo un problema con el producto, el envío o la entrega.'],
  ['¿Qué pasa con la comisión y el envío?', 'En el carrito y en el detalle del pedido se muestran los cargos adicionales antes de confirmar la compra.'],
];
const SELLER_FAQS = [
  ['¿Cómo respondo una cotización?', 'En Mensajes puedes revisar cada conversación, completar el precio, stock y condiciones, y luego enviar la respuesta.'],
  ['¿Cómo registro un envío?', 'En Pedidos abre la orden correspondiente y completa los datos de despacho según el método de envío que configuraste.'],
  ['¿Cómo publico un producto?', 'Usa Crear producto y completa compatibilidad, fotos, stock, precio y método de despacho antes de guardar.'],
  ['¿Qué hago si mi cuenta fue bloqueada?', 'Revisa la pantalla de bloqueo y solicita revisión. También puedes abrir un ticket para que soporte evalúe tu caso.'],
];
const GUEST_FAQS = [
  ['¿Qué puedo hacer como invitado?', 'Puedes explorar repuestos, revisar compatibilidades y conocer cómo funciona RepuesTop antes de crear una cuenta.'],
  ['¿Por qué conviene registrarme?', 'Al registrarte puedes cotizar, comprar, guardar tus datos, hacer seguimiento de pedidos y recibir notificaciones importantes.'],
  ['¿Puedo comprar sin cuenta?', 'No. Para proteger tus compras y coordinar el despacho necesitas crear una cuenta o iniciar sesión.'],
  ['¿RepuesTop vende directamente los repuestos?', 'RepuesTop conecta compradores con vendedores de repuestos. La plataforma te ayuda a encontrar, cotizar y comprar.'],
];

const TOPICS = {
  COMPRADOR: [
    ['Pedido o despacho', 'buyer-orders'], ['Pago o carrito', 'buyer-payment'], ['Cotización', 'buyer-quote'], ['Cuenta o perfil', 'general'],
  ],
  VENDEDOR: [
    ['Pedidos o envío', 'seller-orders'], ['Productos', 'seller-products'], ['Mensajes o cotización', 'seller-quote'], ['Cuenta bloqueada', 'blocked-account'],
  ],
};
const SUBJECTS = {
  'buyer-orders': [],
  'buyer-payment': ['Error al procesar el pago', 'Cobro duplicado en mi tarjeta', 'Problemas al usar un cupón', 'Error al cargar el carrito de compra', 'Otro'],
  'buyer-quote': ['Vendedor no responde el chat', 'Error al aceptar cotización', 'Dudas sobre vigencia de cotización', 'Otro'],
  general: ['Problemas para iniciar sesión', 'Modificar datos de mi cuenta', 'Error al subir foto de perfil', 'Eliminar mi cuenta', 'Otro'],
  'seller-orders': [],
  'seller-products': ['Error al crear o publicar producto', 'Problemas con las fotos del producto', 'Error al actualizar stock/inventario', 'Otro'],
  'seller-quote': ['Mensajes bloqueados o no cargan', 'Problema al enviar una cotización', 'Comprador no responde el chat', 'Otro'],
  'blocked-account': ['Solicitud de apelación de cuenta', 'Dudas sobre el motivo del bloqueo', 'Dificultades con una mediación en curso', 'Otro'],
};
const BUYER_CLAIMS = [
  ['Pieza incompatible con mi vehículo/modelo', 'incompatible'], ['Pieza en mal estado / Defectuosa / Dañada', 'defective'],
  ['El producto no ha llegado / Retraso en la entrega', 'not_received'], ['Me equivoqué de compra / Quiero cancelar el pedido', 'wrong_purchase'],
  ['Producto incorrecto o incompleto (faltan piezas)', 'wrong_product'], ['Me arrepentí de la compra / Solicitar devolución', 'buyer_remorse'],
  ['El vendedor tarda demasiado en preparar o enviar el producto', 'delay_preparation'], ['Fui a retirar y el local estaba cerrado', 'store_closed'],
  ['El vendedor se niega a entregar el producto', 'refused_delivery'], ['No logro contactar al vendedor', 'no_contact'], ['Otro', 'other'],
];
const SELLER_CLAIMS = [
  ['El comprador no responde o rechazó la entrega', 'buyer_no_response'], ['Problema con la empresa de transporte (Courier)', 'courier_issue'],
  ['Error en la liquidación o procesamiento del pago', 'payout_issue'], ['Devolución de producto dañada o incompleta', 'disputed_return'],
  ['Problema con el stock / No puedo procesar el pedido', 'out_of_stock'], ['El comprador no se ha presentado a retirar', 'buyer_no_show'], ['Otro', 'other'],
];

function normalizedStatus(order) {
  const value = String(order.status || order.estado || '').toUpperCase();
  return { PENDIENTE: 'pending', PAGADO: 'pending', EN_PREPARACION: 'preparing', ENVIADO: 'sent', ENTREGADO: 'received', RECIBIDO: 'received', FINALIZADO: 'finished', EN_MEDIACION: 'mediation', MEDIATION: 'mediation', CANCELADO: 'cancelled' }[value] || value.toLowerCase();
}
function orderClaimOptions(order, reportType) {
  if (!order) return reportType === 'VENDEDOR' ? SELLER_CLAIMS : BUYER_CLAIMS;
  const status = normalizedStatus(order);
  const terms = String(order.deliveryTerms || order.terminosEntrega || order.shipping?.method || order.metodoEnvio || '').toLowerCase();
  const pickup = terms.includes('retiro') || terms.includes('tienda') || terms.includes('store_pickup');
  if (reportType === 'VENDEDOR') {
    if (['pending', 'preparing'].includes(status)) return [['Error en la liquidación o procesamiento del pago', 'payout_issue'], ['Problema con el stock / No puedo procesar el pedido', 'out_of_stock'], ['Otro', 'other']];
    if (status === 'sent') return pickup ? [['El comprador no se ha presentado a retirar', 'buyer_no_show'], ['Otro', 'other']] : [['Problema con la empresa de transporte (Courier)', 'courier_issue'], ['El comprador no responde o rechazó la entrega', 'buyer_no_response'], ['Otro', 'other']];
    return [['Error en la liquidación o procesamiento del pago', 'payout_issue'], ['Devolución de producto dañada o incompleta', 'disputed_return'], ['Otro', 'other']];
  }
  if (['pending', 'preparing'].includes(status)) return [['Me equivoqué de compra / Quiero cancelar el pedido', 'wrong_purchase'], ['El vendedor tarda demasiado en preparar o enviar el producto', 'delay_preparation'], ['Otro', 'other']];
  if (status === 'sent') return pickup ? [['Fui a retirar y el local estaba cerrado', 'store_closed'], ['El vendedor se niega a entregar el producto', 'refused_delivery'], ['No logro contactar al vendedor', 'no_contact'], ['Otro', 'other']] : [['El producto no ha llegado / Retraso en la entrega', 'not_received'], ['Otro', 'other']];
  return [['Pieza incompatible con mi vehículo/modelo', 'incompatible'], ['Pieza en mal estado / Defectuosa / Dañada', 'defective'], ['Producto incorrecto o incompleto (faltan piezas)', 'wrong_product'], ['Me arrepentí de la compra / Solicitar devolución', 'buyer_remorse'], ['Otro', 'other']];
}

export default function SupportHelpPanel({ user, role, onViewCases, standalone = false, onBack }) {
  const isGuest = !user;
  const reportType = ['SELLER', 'PROVIDER', 'PROVEEDOR'].includes(String(role || user?.role || '').toUpperCase()) ? 'VENDEDOR' : 'COMPRADOR';
  const faqs = isGuest ? GUEST_FAQS : reportType === 'VENDEDOR' ? SELLER_FAQS : BUYER_FAQS;
  const topics = TOPICS[reportType];
  const [openFaq, setOpenFaq] = useState(0);
  const [topic, setTopic] = useState(topics[0][1]);
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [detail, setDetail] = useState('');
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [claimType, setClaimType] = useState('');
  const [customClaimType, setCustomClaimType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedId, setSubmittedId] = useState('');
  const isOrdersTopic = topic === 'buyer-orders' || topic === 'seller-orders';
  const selectedOrder = orders.find((order) => String(order.id) === String(selectedOrderId));
  const claimOptions = useMemo(() => orderClaimOptions(selectedOrder, reportType), [selectedOrder, reportType]);

  useEffect(() => {
    setSubject(''); setCustomSubject(''); setSelectedOrderId(''); setClaimType(''); setCustomClaimType('');
  }, [topic]);
  useEffect(() => {
    if (!isOrdersTopic || isGuest) return;
    const request = reportType === 'VENDEDOR' ? getSellerOrdersApi(user?.sellerId) : getBuyerOrdersApi(user?.userId ?? user?.id);
    request.then((response) => setOrders(Array.isArray(response) ? response : response?.content || [])).catch(() => setOrders([]));
  }, [isOrdersTopic, isGuest, reportType, user?.sellerId, user?.userId, user?.id]);

  const availableOrders = orders.filter((order) => {
    const status = normalizedStatus(order);
    return !['mediation', 'cancelled'].includes(status) && !order.claimReason && !order.motivoReclamo;
  });
  const finalSubject = subject === 'other' ? customSubject.trim() : subject;
  const finalClaim = claimType === 'other' ? customClaimType.trim() : claimType;
  const canSubmit = detail.trim().length > 0 && detail.trim().length <= 500 && (isOrdersTopic ? selectedOrderId && finalClaim : finalSubject);

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
          categoria: topic === 'seller-products' || topic === 'buyer-payment' ? 'FALLA_TECNICA' : 'SOLICITUD_AYUDA',
          // Valor real del enum PlataformaTicket del backend (no una copia del
          // valor que usa la app móvil): así el backoffice etiqueta y filtra
          // correctamente los tickets creados desde la web como "Sitio Web".
          plataforma: 'SITIO_WEB',
          motivo: finalSubject,
          detalle: detail.trim(),
          sellerId: user?.sellerId ? Number(user.sellerId) : undefined,
          contexto: `topic=${topic} | sourceRoute=web-profile`,
        });
        setSubmittedId(ticket?.externalId || ticket?.id || 'Solicitud registrada');
      }
      setDetail('');
    } catch (requestError) { setError(requestError.message || 'No se pudo procesar tu solicitud. Intenta nuevamente.'); }
    finally { setSubmitting(false); }
  };

  if (submittedId) return <section className={`profile-panel support-help-panel support-success ${standalone ? 'standalone' : ''}`}><CheckCircle2 /><h2>Consulta enviada</h2><p>Nuestro equipo revisará tu caso. Número de consulta: <strong>{submittedId}</strong></p><div><button type="button" onClick={onViewCases}>Ver mis consultas</button><button type="button" className="secondary" onClick={() => setSubmittedId('')}>Enviar otra consulta</button></div></section>;

  return <section className={`profile-panel support-help-panel ${standalone ? 'standalone' : ''}`}>
    {standalone && onBack && <button type="button" className="support-back" onClick={onBack}>Volver</button>}
    <header className="support-help-hero"><span><Wrench /></span><div><h2>Centro de ayuda</h2><p>Resuelve dudas rápidas o envía una consulta con el contexto de tu caso.</p></div></header>
    <div className="support-help-section"><div className="support-section-title"><div><h3>Preguntas frecuentes</h3><p>{isGuest ? 'Respuestas para invitados' : reportType === 'VENDEDOR' ? 'Respuestas para vendedores' : 'Respuestas para compradores'}</p></div><HelpCircle /></div><div className="support-faq-list">{faqs.map(([question, answer], index) => <article key={question} className={openFaq === index ? 'open' : ''}><button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)}><strong>{question}</strong><ChevronDown /></button>{openFaq === index && <p>{answer}</p>}</article>)}</div></div>
    {!isGuest && <form className="support-help-section support-ticket-form" onSubmit={submit}>
      <div className="support-section-title"><div><h3>Emitir consulta o reclamo</h3><p>Envía tu caso al equipo de soporte con el mayor contexto posible.</p></div><FileText /></div>
      <div className="support-ticket-meta"><span><CircleUserRound /><small>Usuario</small><strong>{user?.userName || user?.nombre || user?.storeName || 'Usuario'}</strong></span><span><ShieldCheck /><small>Rol</small><strong>{reportType === 'VENDEDOR' ? 'Vendedor' : 'Comprador'}</strong></span></div>
      <div className="support-form-grid">
        <label>Tema<select value={topic} onChange={(event) => setTopic(event.target.value)}>{topics.map(([label, value]) => <option key={value} value={value}>{label}</option>)}</select><small>Sirve para derivar tu caso más rápido.</small></label>
        {isOrdersTopic ? <label>Selecciona el pedido con problemas<select value={selectedOrderId} onChange={(event) => { setSelectedOrderId(event.target.value); setClaimType(''); }}><option value="">Elige un pedido</option>{availableOrders.map((order) => <option key={order.id} value={order.id}>Pedido #{String(order.id).slice(0,8)} · {order.total ? `$${Number(order.total).toLocaleString('es-CL')}` : normalizedStatus(order)}</option>)}</select><small>Selecciona la compra asociada a tu consulta o reclamo.</small></label> : <label>Asunto<select value={subject} onChange={(event) => { const value = event.target.value; setSubject(value === 'Otro' ? 'other' : value); setCustomSubject(''); }}><option value="">Selecciona el asunto</option>{(SUBJECTS[topic] || []).map((item) => <option key={item} value={item === 'Otro' ? 'other' : item}>{item}</option>)}</select></label>}
        {isOrdersTopic && selectedOrderId && <label>Motivo del reclamo<select value={claimType} onChange={(event) => setClaimType(event.target.value)}><option value="">Selecciona el motivo</option>{claimOptions.map(([label,value]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        {!isOrdersTopic && subject === 'other' && <label>Especifica el asunto<input maxLength="100" value={customSubject} onChange={(event) => setCustomSubject(event.target.value)} placeholder="Escribe el asunto de tu consulta" /></label>}
        {isOrdersTopic && claimType === 'other' && <label>Describe el motivo<input maxLength="100" value={customClaimType} onChange={(event) => setCustomClaimType(event.target.value)} placeholder="Escribe el motivo de tu reclamo" /></label>}
      </div>
      <label className="support-detail-field">{isOrdersTopic && selectedOrderId ? 'Explica el problema' : 'Detalle'}<textarea rows="6" maxLength="500" value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={isOrdersTopic ? 'Cuéntanos con detalle qué ocurrió con tu pedido...' : 'Explica qué pasó, desde cuándo y qué esperabas ver'} /><small>{detail.length} / 500</small></label>
      {error && <div className="auth-alert alert-error"><AlertTriangle /><span>{error}</span></div>}
      <button className="support-submit-button" type="submit" disabled={!canSubmit || submitting}>{submitting ? <Loader2 className="spin-icon" /> : isOrdersTopic ? <ShoppingBag /> : <Send />}{submitting ? 'Enviando...' : isOrdersTopic ? 'Enviar reclamo' : 'Enviar consulta'}</button>
      {isOrdersTopic && availableOrders.length === 0 && <div className="support-no-orders"><Package /> No tienes pedidos disponibles para reclamo.</div>}
    </form>}
  </section>;
}
