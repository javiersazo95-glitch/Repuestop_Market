import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Clock, Wrench, Truck, PackageCheck, User, Store, ChevronDown, ArrowLeft,
  MapPin, FileText, Package, CreditCard, CheckCircle2, Copy, KeyRound,
  RotateCcw, Loader2, XCircle, AlertTriangle, FileUp, Star, Lock, ExternalLink, Timer
} from 'lucide-react';
import { OrderStatusBadge } from './OrderCard';
import { resolveMediaUrl, rateOrderApi, getPublicProductApi } from '../services/api';
import { adaptProduct } from '../services/adapters';
import { activeOrderItems, deliveryMethodLabel, isCancelledItem, orderDisplayCode } from '../data/orderIdentity';
import { getControlledOrderAction, isStorePickupOrder, orderPaymentWindow } from '../data/orderStatusFlow';
import { Link } from 'react-router-dom';
import { productPath } from '../routes/paths';
import ConfirmDialog from './ConfirmDialog';
import { cancellationReasonLabel, cancellationReasonHint } from '../data/cancellationReason';
import { carrierTracking } from '../data/carrierTracking';
import { storeAutoCloseNotice } from '../data/orderDeadlines';

/**
 * Una linea de repuesto dentro del bloque de su tienda, con la ficha tecnica desplegable.
 *
 * La ficha NO viaja en el pedido: el pedido guarda lo que se compro (nombre, marca, SKU,
 * precio), no las especificaciones del producto. Se pide al abrir, igual que hace la app
 * (`ProductItem` de `order-detail-parts.tsx`), y solo entonces: en un pedido de varias lineas,
 * traerlas todas de entrada serian N peticiones que casi nadie va a mirar.
 *
 * Si el producto ya no existe -- lo dio de baja el vendedor -- se muestra lo que trae el
 * pedido y nada mas. Es un detalle opcional, no puede romper la pantalla.
 */
function OrderProductRow({ item, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState(null);
  const [specsState, setSpecsState] = useState('idle');
  const [descExpanded, setDescExpanded] = useState(false);
  // Que la peticion ya se hizo va en un ref y NO en el estado: con `details`/`loading` en las
  // dependencias del efecto, `setLoading(true)` lo re-ejecutaba, el cleanup del anterior
  // marcaba la respuesta como cancelada y el `finally` nunca apagaba el "Cargando...". La
  // ficha se quedaba girando para siempre aunque el endpoint respondiera 200.
  const fetchedRef = useRef(false);

  const photo = resolveMediaUrl(item.imagenUrl || item.imageUrl || item.productPhotoUri || (item.imageUrls && item.imageUrls[0]));
  const name = item.nombre || item.productName || item.name || 'Repuesto de vehículo';
  const brand = item.marca || item.productBrand || item.brand || '';
  const sku = item.sku || item.productSku || '';
  const qty = Number(item.cantidad || item.quantity || 1);
  const price = Number(item.precioUnitario || item.precio || item.unitPrice || 0);
  const cancelled = isCancelledItem(item);
  const refunded = Number(item.montoReembolsado ?? item.refundedAmount ?? 0);
  const productId = item.productoId || item.productId || item.id;

  useEffect(() => {
    if (!expanded || !productId || fetchedRef.current) return undefined;
    fetchedRef.current = true;
    let cancelado = false;
    setSpecsState('loading');
    getPublicProductApi(productId)
      .then((dto) => {
        if (cancelado) return;
        setDetails(adaptProduct(dto));
        setSpecsState('done');
      })
      // Un repuesto dado de baja por el vendedor ya no responde. Es un detalle opcional: se
      // avisa y se sigue mostrando lo que el pedido guarda, no se rompe la fila.
      .catch(() => { if (!cancelado) setSpecsState('error'); });
    return () => { cancelado = true; };
  }, [expanded, productId]);

  const specs = [
    ['Categoría', details?.categoriaNombre || item.categoria || item.productCategory || null],
    // El SKU del vendedor, que es el mismo que se ve en la fila cerrada. La referencia OEM va
    // aparte y SOLO si existe: con `oemCode` -- que colapsa referenciaOem, skuProveedor y
    // codigoInterno en el primero que haya -- las dos filas mostraban el mismo valor.
    ['SKU', details?.skuProveedor || sku || null],
    ['Condición', details?.condicion || null],
    ['Compatibilidad', details?.compatibilidades?.[0]
      ? [details.compatibilidades[0].marca, details.compatibilidades[0].modelo].filter(Boolean).join(' ')
      : null],
    ['Referencia OEM', details?.referenciaOem || null],
  ].filter(([, value]) => Boolean(value));

  // El nombre es un enlace a la ficha del producto, para volver a comprarlo. Por eso la fila
  // ya NO puede ser un boton: un `<a>` dentro de un `<button>` es HTML invalido y el navegador
  // decide solo cual de los dos clics gana. El desplegable tiene su propio boton, con area de
  // toque de 34px -- un chevron de 16 es un blanco demasiado chico en un telefono.
  const productLink = productId ? productPath({ id: productId, titulo: name }) : null;

  return (
    <div className={`order-item-row order-item-row--expandable ${cancelled ? 'order-item-row--cancelled' : ''}`}>
      <div className="order-item-row-main">
        {photo
          ? <img src={photo} alt={name} className="item-table-img" />
          : <div className="item-table-fallback"><Package size={20} /></div>}
        <div className="item-table-info">
          <div className="order-item-row-title">
            {productLink ? (
              <Link to={productLink} className="item-table-name order-item-row-link" onClick={onNavigate}>
                {name}
              </Link>
            ) : (
              <strong className="item-table-name">{name}</strong>
            )}
            {cancelled && <span className="item-cancelled-badge">Cancelado</span>}
          </div>
          <span className="item-table-meta">
            {[brand, sku ? `SKU ${sku}` : null].filter(Boolean).join(' · ')}
          </span>
          {cancelled && refunded > 0 && (
            <span className="order-item-row-refund">Reembolso {formatCLP(refunded)}</span>
          )}
        </div>
        <div className="item-table-pricing">
          <span className="item-qty">x{qty}</span>
          <strong className="item-subtotal">{formatCLP(price * qty)}</strong>
        </div>
        <button
          type="button"
          className="order-item-row-toggle"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Ocultar ficha técnica' : 'Ver ficha técnica'}
        >
          <ChevronDown size={16} className={`order-item-row-chevron ${expanded ? 'is-open' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="order-item-specs">
          {specsState === 'loading' ? (
            <span className="order-item-specs-loading"><Loader2 size={13} className="spin-icon" /> Cargando ficha técnica…</span>
          ) : specsState === 'error' || specs.length === 0 ? (
            <span className="order-item-specs-loading">Este repuesto ya no tiene ficha publicada.</span>
          ) : (
            <dl className="order-item-specs-grid">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {/* La descripcion se corta a dos lineas: son textos de largo libre que el vendedor
              escribe, y uno largo empuja la accion de la tienda fuera de la pantalla. */}
          {details?.descripcion && (
            <div className="order-item-specs-desc">
              <p className={descExpanded ? '' : 'is-clamped'}>{details.descripcion}</p>
              <button type="button" onClick={() => setDescExpanded((prev) => !prev)}>
                {descExpanded ? 'ver menos' : 'ver más'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SELLER_CANCEL_REASONS = [
  { code: 'SIN_STOCK', label: 'Sin stock disponible' },
  { code: 'ERROR_PRECIO', label: 'Error en el precio publicado' },
  { code: 'PRODUCTO_NO_DISPONIBLE', label: 'Producto dañado o no disponible' },
  { code: 'IMPOSIBILIDAD_DESPACHO', label: 'Imposibilidad de despacho a la dirección' },
  { code: 'OTRO', label: 'Otro motivo (especificar)' },
];

// `Pedido.valorEnvioInformado` es NUMERIC(12,2): mas de 10 digitos enteros no entra en
// la columna. Se corta en 9 en el formulario, que ya es un flete imposible.
const MAX_SHIPPING_FEE_DIGITS = 9;

// Numero de seguimiento. No se valida por empresa a proposito: los formatos cambian y
// "Delivery propio" no tiene ninguno. Este es el superset que cubre a las que ofrecemos
// -Chilexpress y Starken numericas de 9 a 12, Blue Express alfanumerica de ~10 a 13,
// Correos de Chile nacional numerica e internacional tipo RR123456789CL-, y deja fuera
// espacios y simbolos, que nunca son parte del codigo.
const TRACKING_MIN_LENGTH = 6;
const TRACKING_MAX_LENGTH = 30;
const OTHER_COURIER = '__OTRO__';

const COMMON_COURIERS = [
  'Starken',
  'Chilexpress',
  'Blue Express',
  'Correos de Chile',
  'Varmontt',
  'Pullman Cargo',
  'Transportes Chevalier',
  'Delivery Propio / Directo',
];


function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function formatDate(value) {
  if (!value) return 'Fecha no especificada';
  return new Date(value).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TIMELINE_STEPS = [
  { key: 'PENDIENTE', label: 'Pendiente', icon: Clock },
  { key: 'EN_PREPARACION', label: 'En preparación', icon: Wrench },
  { key: 'ENVIADO', label: 'Enviado', icon: Truck },
  { key: 'FINALIZADO', label: 'Entregado/Finalizado', icon: PackageCheck },
];

function getTimelineIndex(status) {
  const norm = String(status || '').toUpperCase();
  if (norm === 'EN_PREPARACION' || norm === 'PREPARING') return 1;
  if (norm === 'ENVIADO' || norm === 'SENT') return 2;
  if (norm === 'ENTREGADO' || norm === 'RECEIVED' || norm === 'FINALIZADO' || norm === 'FINISHED') return 3;
  return 0; // PENDIENTE / PAGADO
}

/**
 * El detalle de un pedido, en modal o como pagina.
 *
 * Es UN solo componente con dos envoltorios y no dos componentes: aca viven ~25 `useState`
 * -- los dialogos de cancelacion y despacho, la calificacion, el PIN, la tienda en curso --, y
 * repartirlos entre una vista y un contenedor es exactamente donde se rompen las cosas que ya
 * estan validadas. Lo unico que cambia entre `layout="modal"` y `layout="page"` es el chrome:
 * velo y portal contra cabecera con boton de volver.
 *
 * Los subdialogos siguen siendo modales en los dos casos. Son interrupciones legitimas -- piden
 * un dato y se cierran --; lo que desaparece en `page` es el modal SOBRE modal.
 */
export default function OrderDetailView({
  order,
  mode = 'buyer',
  layout = 'modal',
  sellerId,
  userId,
  onClose,
  onUpdateStatus,
  onRetryPayment,
  onCancelBuyerSubOrder,
  onCancelSellerOrder,
  onRegisterDispatch,
  autoOpenRating = false,
  onRatingPromptShown,
  onOrderRated,
  readOnly = false,
}) {
  const rawStatus = order?.estado || order?.status || 'PENDIENTE';
  const normStatus = String(rawStatus).toUpperCase();
  const [isUpdating, setIsUpdating] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [pickupPin, setPickupPin] = useState('');
  const [statusError, setStatusError] = useState('');
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [retryError, setRetryError] = useState('');
  // La tienda que el comprador esta cancelando. Es por suborden, asi que hay que saber
  // CUAL, no solo que se pulso "cancelar".
  const [storeToCancel, setStoreToCancel] = useState(null);
  const [isCancellingStore, setIsCancellingStore] = useState(false);
  const [storeCancelError, setStoreCancelError] = useState('');
  const [confirmStatusAdvance, setConfirmStatusAdvance] = useState(false);
  // La tienda cuya recepcion/finalizacion el comprador esta confirmando. Igual que la
  // cancelacion: es por subordén, asi que hay que saber CUAL y no solo que se pulso.
  const [storeToAdvance, setStoreToAdvance] = useState(null);
  const [isAdvancingStore, setIsAdvancingStore] = useState(false);
  const [storeAdvanceError, setStoreAdvanceError] = useState('');
  const [now, setNow] = useState(Date.now());

  // Seller Cancelation Modal State
  const [showSellerCancelModal, setShowSellerCancelModal] = useState(false);
  const [sellerCancelReason, setSellerCancelReason] = useState('SIN_STOCK');
  const [sellerCancelDetail, setSellerCancelDetail] = useState('');
  const [isCancellingSeller, setIsCancellingSeller] = useState(false);
  const [sellerCancelError, setSellerCancelError] = useState('');

  // Seller Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  // El courier se ELIGE de la lista; "Otro" abre un campo libre. Antes era un input con
  // `<datalist>`, que el navegador pinta como una lista negra fuera del modal y ademas
  // dejaba escribir cualquier cosa encima de la sugerencia.
  // Sin empresa conocida se arranca en el placeholder, no en "Otra": abriendo con
  // "Otra" ya seleccionada el vendedor no se entera de que hay una lista debajo.
  // (Ojo: `order.courier` suele traer el METODO de envio -"Envio fuera de la comuna"-,
  // que no es un courier, asi que casi nunca calza con la lista.)
  const initialCourier = COMMON_COURIERS.includes(order?.courier) ? order.courier : '';
  const [dispatchCourierChoice, setDispatchCourierChoice] = useState(initialCourier);
  const [dispatchCourierOther, setDispatchCourierOther] = useState('');
  const dispatchCourier = dispatchCourierChoice === OTHER_COURIER ? dispatchCourierOther : dispatchCourierChoice;
  const [dispatchTrackingNumber, setDispatchTrackingNumber] = useState(order?.trackingNumber || '');
  const [dispatchShippingFee, setDispatchShippingFee] = useState(order?.shippingFee || '');
  const [dispatchVoucherFile, setDispatchVoucherFile] = useState(null);
  const [isRegisteringDispatch, setIsRegisteringDispatch] = useState(false);
  const [dispatchError, setDispatchError] = useState('');

  // Buyer Rating Modal State (A4)
  const [showRatingModal, setShowRatingModal] = useState(false);
  // Arranca en 0: precargar 5 estrellas es poner una opinion en boca del comprador y
  // ademas hace que "Guardar" sea valido sin que haya tocado nada.
  // La tienda que se esta calificando. La nota es POR TIENDA: con dos vendedores, una sola
  // estrella no dice a cual se le puso.
  const [storeToRate, setStoreToRate] = useState(null);
  const [sellerRating, setSellerRating] = useState(0);
  const [productRatings, setProductRatings] = useState({});
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [ratingSuccess, setRatingSuccess] = useState(false);

  // Cuando el pedido se marca recibido desde la TARJETA del listado, el modal ni
  // existia: el padre lo abre despues y avisa por aca para ofrecer la calificacion.
  useEffect(() => {
    if (!autoOpenRating) return;
    setProductRatings({});
    setSellerRating(0);
    setRatingError('');
    setRatingSuccess(false);
    setShowRatingModal(true);
    onRatingPromptShown?.();
  }, [autoOpenRating, onRatingPromptShown]);

  // El reloj corre por minuto solo mientras haya un plazo de pago que mostrar.
  const showsPaymentWindow = mode !== 'seller' && normStatus === 'PENDIENTE' && Boolean(onRetryPayment);
  useEffect(() => {
    if (!showsPaymentWindow) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, [showsPaymentWindow]);

  if (!order) return null;

  const isSeller = mode === 'seller';
  // Solo el comprador paga, y solo mientras el pedido siga sin pagarse.
  const canRetryPayment = !isSeller && normStatus === 'PENDIENTE' && Boolean(onRetryPayment);
  const paymentWindow = canRetryPayment ? orderPaymentWindow(order, now) : null;
  // Hasta que la tienda despacha. Despues ya no es cancelar, es devolver -- que es otro
  // flujo-. Es la misma ventana que usan Falabella ("En preparacion") y Mercado Libre
  // (hasta que el vendedor despacha).
  //
  // Se mide contra el estado de SU suborden y no contra el del pedido: que la otra tienda
  // ya haya despachado no tiene nada que ver con esta compra. Sin suborden -pedido de una
  // sola tienda, o historico sin la fila- se cae al estado del pedido.
  const CANCELLABLE_BY_BUYER = ['PENDIENTE', 'PAGADO', 'EN_PREPARACION'];
  const canBuyerCancelStore = (seller) => {
    // `seller.id` se cae al NOMBRE de la tienda cuando el item no trae `proveedorId`, y
    // ese nombre no sirve como id en el endpoint. Sin id real no se ofrece el boton.
    if (isSeller || !onCancelBuyerSubOrder) return false;
    if (!Number.isFinite(Number(seller?.id))) return false;
    const estado = String(seller.subOrder?.estado || normStatus || '').toUpperCase();
    return CANCELLABLE_BY_BUYER.includes(estado);
  };
  // Confirmar la recepcion y finalizar, POR TIENDA. Antes el comprador cerraba el pedido
  // completo de una vez: confirmaba la recepcion de las dos tiendas aunque solo le hubiera
  // llegado una. Ahora cada bloque mueve su propia subordén y el estado del pedido se sigue
  // derivando en el backend (el menos avanzado de las vivas), que es lo que el timeline de
  // arriba muestra.
  //
  // Solo con mas de una tienda: con una sola, la accion vive en el pie del modal como
  // siempre. Es la accion principal del comprador y meterla dentro de la tarjeta del vendedor
  // la esconde sin ganar nada, porque no hay ninguna ambiguedad que resolver.
  const buyerStoreAction = (seller) => {
    if (isSeller || !showSubOrders || !onUpdateStatus) return null;
    if (!Number.isFinite(Number(seller?.id))) return null;
    const estado = String(seller.subOrder?.estado || '').toUpperCase();
    if (estado === 'ENVIADO') {
      return {
        nextStatus: 'ENTREGADO',
        label: isStorePickup ? 'Confirmar retiro' : 'Confirmar recepción',
        title: isStorePickup ? `¿Confirmar el retiro en ${seller.name}?` : `¿Confirmar lo que envió ${seller.name}?`,
        message: `Confirma únicamente si ya tienes en tus manos los repuestos de ${seller.name}. El resto del pedido sigue su curso. Esta acción no se puede deshacer.`,
      };
    }
    if (estado === 'ENTREGADO') {
      return {
        nextStatus: 'FINALIZADO',
        label: 'Finalizar compra',
        title: `¿Finalizar tu compra a ${seller.name}?`,
        message: `Se cierra definitivamente lo de ${seller.name} y se habilita su pago. Las otras tiendas del pedido no se ven afectadas.`,
      };
    }
    return null;
  };

  // Solo PENDIENTE y PAGADO: `PedidoCancelacionSupport` corta ahi ("Solo se pueden
  // cancelar pedidos pendientes") y con EN_PREPARACION el boton salia igual y el POST
  // moria en 400. Si el backend amplia la ventana, hay que ampliarla aca tambien.
  // Tienda bloqueada: el pedido se ve completo pero no se puede mover. `PedidoEnvioSupport`
  // rechaza el despacho del lado del servidor, asi que dejar los botones solo produce un
  // error a mitad de camino.
  const sellerReadOnly = isSeller && readOnly;
  // El vendedor que ya cancelo todas sus lineas no tiene nada que cancelar: el boton le
  // ofrecia repetir una accion sobre una venta que ya no existe. Mismo criterio que
  // `getControlledOrderAction`, que le oculta "Confirmar pedido" por la misma razon.
  const canSellerCancel = isSeller && !sellerReadOnly && ['PENDIENTE', 'PAGADO'].includes(normStatus)
    && Boolean(onCancelSellerOrder)
    && (!Array.isArray(order?.items) || order.items.length === 0 || activeOrderItems(order).length > 0);
  const cancellationReason = normStatus === 'CANCELADO' ? cancellationReasonLabel(order, isSeller ? 'seller' : 'buyer') : null;
  // La explicacion esta escrita para el comprador ("si pagaste, el reembolso...").
  // Al vendedor le basta la etiqueta: el motivo lo declaro el.
  const cancellationHint = cancellationReason && mode !== 'seller' ? cancellationReasonHint(order) : null;

  const orderIdShort = orderDisplayCode(order, isSeller ? 'seller' : 'buyer');
  const items = order.items || [];

  // `PedidoPostVentaSupport` solo acepta calificar pedidos ENTREGADO/FINALIZADO y rechaza
  // la segunda calificacion con "Este pedido ya ha sido calificado". Sin esta condicion el
  // boton seguia ahi despues de calificar y el reintento moria en un 400.
  const alreadyRated = items.some((item) => item.sellerRating != null || item.productRating != null);
  const RATEABLE = ['ENTREGADO', 'FINALIZADO', 'RECEIVED'];
  // Calificable POR TIENDA: sus lineas vivas, sin nota todavia, y su subordén ya entregada. Se
  // mide contra el estado de la subordén y no contra el del pedido, que es el DERIVADO -- el
  // menos avanzado --: con una tienda entregada y otra en viaje no se podia calificar ninguna.
  const canRateStore = (block) => {
    if (isSeller || !block) return false;
    const vivos = (block.items || []).filter((item) => !isCancelledItem(item));
    if (vivos.length === 0) return false;
    if (vivos.some((item) => item.sellerRating != null || item.productRating != null)) return false;
    return RATEABLE.includes(String(block.estado || normStatus || '').toUpperCase());
  };
  // `PedidoPostVentaSupport` exige calificar TODOS los items del pedido: si falta uno
  // responde "Debes calificar todos los productos del pedido". Se bloquea el envio
  // hasta tenerlos, en vez de mandar el 400 y mostrarlo como error del servidor.
  // Los repuestos que entran en la calificacion abierta: los de esa tienda, o todos cuando se
  // califica el pedido entero (una sola tienda, o desde la tarjeta del listado). Los CANCELADOS
  // se excluyen: el comprador nunca los recibio y el backend ya dejo de pedirlos.
  //
  // Va ANTES de `ratingComplete`, que lo usa. `no-undef` no ve un const leido antes de su
  // declaracion -- la variable existe -- y la pantalla revienta al abrirse con "Cannot access
  // before initialization".
  const ratingItems = (storeToRate ? storeToRate.items : items).filter((item) => !isCancelledItem(item));
  const ratingComplete = sellerRating > 0
    && ratingItems.length > 0
    && ratingItems.every((item) => Number(productRatings[item.productoId || item.id]) > 0);
  const canRateOrder = RATEABLE.includes(normStatus) && !alreadyRated;

  const buyerName = order.compradorNombre || order.buyerName || order.usuarioNombre || 'Cliente RepuesTop';
  const buyerPhone = order.compradorTelefono || order.buyerPhone || order.telefono || '—';
  const buyerRut = order.facturaRut || order.compradorRut || order.taxId || order.rutEmpresa || '—';

  const sellerName = order.vendedorNombre || order.sellerName || order.nombreTienda || 'Tienda RepuesTop';
  const deliveryAddress = [
    order.compradorDireccion || order.direccionEntrega || order.address,
    order.compradorComuna || order.comuna,
    order.compradorRegion || order.region,
  ].filter(Boolean).join(', ') || 'Dirección de envío no registrada';
  const isStorePickup = isStorePickupOrder(order);
  const copyAddress = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(deliveryAddress).then(() => {
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 1500);
    });
  };

  // `??` y no `||`: un subtotal de CERO es legitimo (el vendedor cancelo todas sus lineas)
  // y con `||` se caia a `order.total`, o sea al monto de la venta anulada.
  const subtotal = Number(order.subtotal ?? order.total ?? 0);
  const shippingFee = Number(order.shippingFee || order.costoEnvio || 0);
  const totalSeller = Number(order.totalVendedor ?? order.totalSeller ?? (subtotal * 0.93));
  const totalBuyer = Number(order.total || (subtotal + shippingFee));
  // Los manda el backend y la web los ignoraba: `montoReembolsado` es lo que se devuelve por
  // las lineas canceladas y `totalActivo` lo que queda realmente por pagar.
  const refundAmount = Number(order.montoReembolsado || order.refundedAmount || 0);
  const totalActive = Number(order.totalActivo ?? order.activeTotal ?? Math.max(0, totalBuyer - refundAmount));

  const commissionRate = order.commissionRate ? order.commissionRate * 100 : subtotal > 250000 ? 5 : subtotal > 100000 ? 7 : 10;
  const repuestopFee = order.commissionSeller || Math.round(subtotal * (commissionRate / 100) * 1.19);
  const paymentProcessingFee = Number(order.comisionPasarela ?? Math.max(0, Math.round(subtotal * 0.025 * 1.19)));

  const timelineIndex = getTimelineIndex(normStatus);
  const controlledAction = getControlledOrderAction(order, mode);

  // Ruta B fase 2: el avance de CADA tienda. El backend lo manda solo al comprador; al
  // vendedor le llega `undefined` a proposito, porque su DTO esta acotado a el y esta lista
  // le pintaria la otra tienda dentro de su propia venta.
  //
  // `estado` de arriba sigue siendo el DERIVADO -el menos avanzado de las subordenes vivas-
  // y asi se queda: es la promesa que se le hace al comprador ("tu pedido esta completo
  // cuando llego todo"). Esto es el desglose de esa unica cifra, no su reemplazo.
  const subOrders = Array.isArray(order?.subordenes) ? order.subordenes : [];
  // Con UNA tienda -que son casi todos los pedidos- no se pinta nada nuevo: el desglose de
  // un solo bloque repite lo que la pildora de arriba ya dice.
  const showSubOrders = subOrders.length > 1;
  // Con mas de una tienda, confirmar y finalizar dejan de vivir en el pie del modal: cada
  // bloque tiene el suyo. Un boton suelto abajo no dice a que tienda le pega.
  const subOrderByStore = new Map(subOrders.map((sub) => [String(sub.proveedorId), sub]));
  // El orden manda: el del backend es el de creacion del checkout y es estable. Si las
  // tarjetas se ordenaran por los items, se reacomodarian solas segun lo que devuelva la BD.
  const subOrderIndex = new Map(subOrders.map((sub, i) => [String(sub.proveedorId), i]));

  const sellers = [...new Map(items.map((item) => {
    const name = item.proveedorNombre || item.sellerName || sellerName;
    const id = item.proveedorId || item.sellerId || name;
    const subOrder = subOrderByStore.get(String(id));
    return [String(id), {
      id,
      name,
      subOrder,
      // El PIN que el comprador le dicta a ESTA tienda. Sale de la suborden, que es donde
      // lo escribe el backend al despachar: con dos tiendas cada una genera el suyo y solo
      // cuando le toca, asi que la que todavia no despacha viene sin codigo.
      //
      // Se cae a `order.codigoRetiro` SOLO con una tienda. Ese campo plano ya no sale de un
      // PIN del pedido -no existe: cada tienda genera el suyo desde V2026090103- sino de la
      // unica suborden viva, y el backend lo manda NULO cuando hay varias. Con dos, un codigo
      // que no dice de quien es pinta un PIN bajo la tienda equivocada, que es peor que
      // ninguno.
      pickupCode: subOrder?.codigoRetiro || (subOrders.length <= 1 ? order.codigoRetiro : null),
      logo: resolveMediaUrl(item.proveedorLogoUrl || item.sellerLogoUrl),
      phone: item.proveedorTelefono || item.sellerPhone || '',
      email: item.proveedorEmail || item.sellerEmail || '',
      address: [
        item.proveedorDireccion || item.sellerAddress,
        item.proveedorComuna || item.sellerCity,
        item.proveedorRegion || item.sellerRegion,
      ].filter(Boolean).join(', '),
      giro: item.proveedorGiro || '',
      horario: item.proveedorHorario || '',
    }];
  })).values()]
    .sort((a, b) => (subOrderIndex.get(String(a.id)) ?? 0) - (subOrderIndex.get(String(b.id)) ?? 0));

  // Un BLOQUE por tienda: sus repuestos, su entrega, su plata y sus acciones, todo junto.
  //
  // Antes eso vivia en tres tarjetas separadas -"Participantes", "Repuestos en el Pedido" y
  // "Entrega y Despacho"-, asi que para saber que le compro a una tienda, como le llega y si
  // puede cancelarla, el comprador tenia que cruzar tres bloques a ojo. Es como lo resuelven
  // Mercado Libre (un paquete por vendedor) y Falabella (el estado al lado del producto).
  //
  // Aplica a TODO el modo comprador, con una tienda o con cinco: dejar dos diseños distintos
  // segun cuantas tiendas tenga el pedido obliga al usuario a reaprender la pantalla. Con una
  // sola es un unico bloque, que es exactamente lo que necesita.
  //
  // Al VENDEDOR no se le toca nada: su DTO ya viene acotado a el -- no tiene con quien agrupar --
  // y ademas necesita la tarjeta del comprador con la direccion para despachar.
  const groupedByStore = true;
  const storeBlocks = sellers.map((seller) => {
    const storeItems = items.filter(
      (item) => String(item.proveedorId ?? item.sellerId ?? '') === String(seller.id),
    );
    // El subtotal cuenta solo las lineas VIVAS: una cancelada ya se reembolso y sumarla
    // prometeria un cobro que no existe. Se usa `??` y no `||` porque un cero es legitimo.
    const subtotalStore = storeItems
      .filter((item) => !isCancelledItem(item))
      .reduce((sum, item) => sum + Number(item.precioUnitario ?? item.precio ?? item.unitPrice ?? 0)
        * Number(item.cantidad ?? item.quantity ?? 1), 0);
    const refundStore = storeItems.reduce(
      (sum, item) => sum + Number(item.montoReembolsado ?? item.refundedAmount ?? 0), 0);
    // Al VENDEDOR el backend no le manda `subordenes` -- su respuesta esta acotada a el y esa
    // lista le pintaria la otra tienda dentro de su propia venta --, asi que sus datos se leen
    // del pedido, que para el YA viene acotado a lo suyo desde la fase 3.1: su estado, su
    // envio, su courier y su tracking. Sin este respaldo su bloque salia sin seguimiento y con
    // el envio en cero.
    const subOrder = seller.subOrder;
    const estado = String(subOrder?.estado || (isSeller ? normStatus : '')).toUpperCase();
    const isCancelledStore = estado === 'CANCELADO';
    return {
      ...seller,
      items: storeItems,
      estado,
      isCancelledStore,
      subtotalStore,
      refundStore,
      trackingStore: subOrder?.trackingNumber || (isSeller ? order.trackingNumber : null),
      courierStore: subOrder?.courier || (isSeller ? order.courier : null),
      // Los dos relojes de ESTA tienda, con los que se anuncia lo que el backend va a hacer
      // solo. Al vendedor le llegan planos en el pedido, que desde la fase 3.1 ya viene
      // acotado a el; al comprador, uno por subordén. Los del pedido NO sirven para el
      // comprador: son los de la tienda mas atrasada del carrito.
      updatedAtStore: subOrder?.updatedAt || (isSeller ? order.updatedAt : null),
      entregadoAtStore: subOrder?.entregadoAt || (isSeller ? order.entregadoAt : null),
      // El envio de ESTA tienda. El del pedido es la SUMA de todas, asi que solo sirve de
      // respaldo para el vendedor, donde ya viene acotado al suyo.
      shippingStore: Number(subOrder?.costoEnvio ?? (isSeller ? shippingFee : 0)),
    };
  }).filter((block) => block.items.length > 0);


  // Desde que el detalle del comprador se arma por bloques -- con UNA tienda o con cinco --, sus
  // acciones viven siempre dentro del bloque de su tienda. La condicion miraba `showSubOrders`,
  // que es `> 1`, asi que en un pedido de una sola tienda el boton global sobrevivia y mandaba
  // la transicion sin `proveedorId`.
  const buyerActionsPerStore = groupedByStore && !isSeller && storeBlocks.length > 0;

  const openRatingModal = (block = null) => {
    setStoreToRate(block);
    setProductRatings({});
    setSellerRating(0);
    setRatingError('');
    setRatingSuccess(false);
    setShowRatingModal(true);
  };

  // Avanza el estado de verdad. La confirmacion previa la pide `handleStatusSubmit`.
  const runStatusUpdate = async (pin) => {
    setIsUpdating(true);
    setStatusError('');
    try {
      await onUpdateStatus(order.id, controlledAction.nextStatus, controlledAction.requiresPin ? pin : undefined);
      setPickupPin('');
      setConfirmStatusAdvance(false);
      // Ofrecer la calificacion no se decide aca: lo hace el padre via `autoOpenRating`,
      // porque el comprador tambien puede marcar recibido desde la tarjeta del listado
      // y ahi este modal ni existe. Un solo camino evita que se abra dos veces.
    } catch (error) {
      setStatusError(error.message || 'No se pudo actualizar el estado del pedido.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusSubmit = async () => {
    if (!onUpdateStatus || !controlledAction?.nextStatus || controlledAction.disabled) return;
    const pin = pickupPin.trim();
    if (controlledAction.requiresPin && !/^\d{6}$/.test(pin)) {
      setStatusError('Ingresa el código de retiro de 6 dígitos entregado al comprador.');
      return;
    }
    // Con PIN la confirmacion es el PIN mismo; sin PIN se pregunta con `ConfirmDialog`.
    // Antes esto era un `window.confirm`, que en un navegador embebido devuelve `false`
    // sin abrir nada: el boton quedaba mudo y parecia que no estaba cableado.
    if (!controlledAction.requiresPin) {
      setStatusError('');
      setConfirmStatusAdvance(true);
      return;
    }
    await runStatusUpdate(pin);
  };

  const handleSellerCancelSubmit = async (e) => {
    e.preventDefault();
    if (!onCancelSellerOrder) return;
    if (sellerCancelReason === 'OTRO' && !sellerCancelDetail.trim()) {
      setSellerCancelError('Por favor describe el motivo de la cancelación.');
      return;
    }
    setIsCancellingSeller(true);
    setSellerCancelError('');
    try {
      await onCancelSellerOrder(order, {
        reasonCode: sellerCancelReason,
        reasonDetail: sellerCancelDetail.trim() || undefined,
      });
      setShowSellerCancelModal(false);
      onClose?.();
    } catch (err) {
      setSellerCancelError(err?.message || 'No se pudo cancelar el pedido.');
    } finally {
      setIsCancellingSeller(false);
    }
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!onRegisterDispatch) return;
    if (!dispatchCourier.trim() || !dispatchTrackingNumber.trim()) {
      setDispatchError('Por favor completa la empresa de transporte y el número de seguimiento.');
      return;
    }
    if (dispatchTrackingNumber.trim().length < TRACKING_MIN_LENGTH) {
      setDispatchError(`El número de seguimiento debe tener al menos ${TRACKING_MIN_LENGTH} caracteres.`);
      return;
    }
    setIsRegisteringDispatch(true);
    setDispatchError('');
    try {
      await onRegisterDispatch(order, {
        courier: dispatchCourier.trim(),
        trackingNumber: dispatchTrackingNumber.trim(),
        valorEnvio: dispatchShippingFee ? Number(dispatchShippingFee) : undefined,
        comprobante: dispatchVoucherFile || undefined,
      });
      setShowDispatchModal(false);
    } catch (err) {
      setDispatchError(err?.message || 'No se pudo registrar el envío.');
    } finally {
      setIsRegisteringDispatch(false);
    }
  };

  // Se muestra solo el nombre del archivo. La miniatura en base64 obligaba a leer la
  // imagen completa en memoria para pintarla recortada dentro de una caja chica, y el
  // comprobante no se revisa aca: se sube y se ve despues en el pedido.
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDispatchVoucherFile(file);
  };

  // Por PORTAL a `document.body`, igual que los subdialogos de mas abajo.
  //
  // El velo es `position: fixed`, pero un ancestro con `transform`, `filter` o `backdrop-filter`
  // se convierte en su bloque contenedor: el `fixed` deja de medirse contra la ventana y pasa a
  // medirse contra ESE elemento. El sintoma es que el velo tiñe solo una zona central y los
  // bordes de la pantalla se ven sin oscurecer -- que es exactamente lo que pasaba montandolo
  // dentro del arbol del panel de perfil. Subir la opacidad no lo arregla: el problema no es el
  // color, es que la caja no cubre la ventana.
  const isPage = layout === 'page';

  const contenido = (
      <div className={isPage ? 'order-page-container' : 'order-modal-container'} onClick={isPage ? undefined : (e) => e.stopPropagation()}>
        {/* Header */}
        <div className="order-modal-header">
          <div className="order-modal-title-group">
            {/* En pagina el icono cede su lugar al boton de volver: es la salida principal y
                tiene que estar donde el ojo empieza a leer. En modal la salida es la X. */}
            {isPage ? (
              <button type="button" className="order-page-back" onClick={onClose} aria-label="Volver">
                <ArrowLeft size={20} />
              </button>
            ) : (
              <div className="order-modal-icon-badge">
                <Package size={22} />
              </div>
            )}
            <div>
              <h2>{isSeller ? "Detalles de la Venta" : "Detalles del Pedido"} {orderIdShort}</h2>
              <span className="order-modal-subtitle">
                {formatDate(order.createdAt || order.fecha)} · {order.source === 'quote' ? 'Cotización' : 'Carrito'}
                {/* El numero de arriba es el de cada rol y NO identifica el pedido para un
                    tercero: el del comprador es su propia secuencia y el del vendedor es su
                    parte. Este es el unico que sirve para escribirle a soporte. */}
                {order.codigoSoporte && <> · <span className="order-support-code">Código: {order.codigoSoporte}</span></>}
              </span>
            </div>
          </div>
          <div className="order-modal-header-actions">
            <OrderStatusBadge status={rawStatus} size="medium" />
            {!isPage && (
              <button type="button" className="btn-close-modal" onClick={onClose}>
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <div className={isPage ? 'order-page-body' : 'order-modal-body'}>
          {/* Timeline Step-by-Step Progress Bar */}
          <div className="order-timeline-card">
            <h3 className="section-subtitle">Estado del Pedido</h3>
            <div className="order-timeline-steps">
              {TIMELINE_STEPS.map((step, idx) => {
                const StepIcon = step.icon;
                const isCompleted = idx <= timelineIndex;
                const isCurrent = idx === timelineIndex;
                return (
                  <div
                    key={step.key}
                    className={`timeline-step-item ${isCompleted ? 'step-completed' : ''} ${isCurrent ? 'step-current' : ''}`}
                  >
                    <div className="step-icon-wrapper">
                      <StepIcon size={16} />
                    </div>
                    <span className="step-label">{step.label}</span>
                    {idx < TIMELINE_STEPS.length - 1 && <div className="step-line" />}
                  </div>
                );
              })}
            </div>
          </div>


          {/* A donde va el pedido y a quien. Una sola tarjeta, para el comprador: antes esto
              estaba partido entre su propia tarjeta de "participante" y el bloque de entrega,
              que ademas repetia el metodo de envio del pedido -- que con dos tiendas es la
              concatenacion de los dos y no significa nada. */}
          {(
            <div className="details-card-block order-delivery-summary">
              <h3 className="section-subtitle">
                <MapPin size={16} />
                <span>{isSeller ? 'Despachar a' : 'Entrega'}</span>
              </h3>
              <div className="order-delivery-summary-rows">
                {/* En un retiro en tienda NO hay direccion de despacho, pero el bloque se monta
                    igual: es donde el vendedor ve a quien le entrega y el comprador su propio
                    documento. Ocultarlo entero dejaba al vendedor de un retiro sin un solo dato
                    de la persona que va a ir a buscar el repuesto. */}
                {!isStorePickup && (
                <div className="order-delivery-summary-row">
                  <MapPin size={14} />
                  <span>{deliveryAddress}</span>
                  <button
                    type="button"
                    className="order-delivery-copy"
                    onClick={copyAddress}
                    title="Copiar dirección"
                    aria-label="Copiar dirección"
                  >
                    {addressCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                )}
                <div className="order-delivery-summary-row">
                  <User size={14} />
                  <span>{buyerName}{buyerPhone && buyerPhone !== '—' ? ` · ${buyerPhone}` : ''}</span>
                </div>
                {(order.tipoDocumentoTributario || order.tipoDocumento || order.documentType) && (
                  <div className="order-delivery-summary-row">
                    <FileText size={14} />
                    <span>{String(order.tipoDocumentoTributario || order.tipoDocumento || order.documentType).toUpperCase() === 'FACTURA'
                      ? `Factura · RUT ${buyerRut}`
                      : 'Boleta electrónica'}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delivery Details Block. Ya no se monta para nadie: el metodo y su costo viven en el
              bloque de la venta, y la direccion del comprador en "Entrega". Se conserva el
              codigo por si hiciera falta volver a una vista plana. */}

          {/* Un bloque por tienda: sus repuestos, su entrega, su plata y sus acciones juntos.
              Es la vista del comprador cuando compro a varias tiendas. */}
          {groupedByStore && (
            <div className="details-card-block order-products-block">
              <h3 className="section-subtitle">
                <Store size={16} />
                <span>
                  {isSeller
                    ? 'Tu venta'
                    : `Tu compra${storeBlocks.length > 1 ? ` (${storeBlocks.length} tiendas)` : ''}`}
                </span>
              </h3>

              <div className="order-store-blocks">
                {storeBlocks.map((block) => {
                  const accion = buyerStoreAction(block);
                  const puedeCancelar = canBuyerCancelStore(block);
                  return (
                    <article
                      key={block.id}
                      className={`order-store-block ${block.isCancelledStore ? 'order-store-block--cancelled' : ''}`}
                    >
                      <header className="order-store-block-head">
                        <span className="order-store-block-name">
                          {block.logo
                            ? <img src={block.logo} alt="" className="order-store-block-logo" />
                            : <Store size={15} />}
                          <span className="order-store-block-identity">
                            <strong>{block.name}</strong>
                            {/* Lo justo para llegar o llamar. El correo se omite a proposito:
                                para escribirle a la tienda estan el chat y el centro de ayuda,
                                y una tarjeta por dato era lo que hacia ilegible la pantalla. */}
                            {/* Solo para el COMPRADOR: es el contacto de la tienda a la que le
                                compro. Al vendedor esta es su propia tienda, asi que repetirle
                                su direccion y su telefono ocupa el lugar donde deberia estar la
                                informacion del comprador -- que vive en el bloque de arriba. */}
                            {!isSeller && (block.address || block.phone) && (
                              <small>{[block.address, block.phone].filter(Boolean).join(' · ')}</small>
                            )}
                          </span>
                        </span>
                        {block.estado && (
                          <OrderStatusBadge
                            status={block.estado === 'ENVIADO' && isStorePickup ? 'LISTO_RETIRO' : block.estado}
                            size="small"
                          />
                        )}
                      </header>

                      <div className="order-items-table">
                        {block.items.map((item, i) => (
                          <OrderProductRow key={item.id || i} item={item} onNavigate={onClose} />
                        ))}
                      </div>

                      {/* Como llega LO DE ESTA TIENDA. El seguimiento y el PIN son suyos: el
                          pedido guarda los del ultimo que despacho y el codigo es por tienda. */}
                      <div className="order-store-block-delivery">
                        <span>
                          <Truck size={13} />
                          {isStorePickup ? 'Retiro en tienda' : deliveryMethodLabel(order)}
                          {!isStorePickup && block.shippingStore > 0 && (
                            <strong className="order-store-block-amount">{formatCLP(block.shippingStore)}</strong>
                          )}
                        </span>
                        {block.trackingStore && (() => {
                          // El enlace directo al portal del courier. `carrierTracking` devuelve
                          // null seguido -- el nombre del courier es texto libre que escribe el
                          // vendedor --, asi que el numero se muestra IGUAL sin enlace: es el
                          // dato, el boton es la comodidad.
                          const carrier = carrierTracking(block.courierStore, block.trackingStore);
                          return (
                            <span>
                              <Package size={13} /> Seguimiento: <strong>{block.trackingStore}</strong>
                              {block.courierStore ? ` · ${block.courierStore}` : ''}
                              {carrier && (
                                <a
                                  className="order-store-block-tracklink"
                                  href={carrier.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Ver en {carrier.name}
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </span>
                          );
                        })()}
                        {isStorePickup && block.pickupCode && !block.isCancelledStore && (
                          <span className="order-store-block-pin">
                            <KeyRound size={13} /> Código de retiro:
                            <strong>{block.pickupCode}</strong>
                          </span>
                        )}
                      </div>

                      {/* Lo que va a pasar SOLO si nadie hace nada. Desde `PedidoAutoCierreJob`
                          el pedido ya no espera un clic: a los 10 dias se da por recibido y 72
                          horas despues del "entregado" se cierra y se le paga al vendedor.
                          Anunciarlo no es cortesia -- sin el aviso, el comprador se entera de
                          que perdio la ventana para reclamar cuando ya la perdio, que es justo
                          lo que el cierre automatico viene a evitar.

                          Al vendedor no se le muestra: para el, el plazo ya lo dice su boton de
                          finalizar (`sellerFinalizationAvailability`), y el aviso esta escrito
                          para quien tiene que decidir si reclama. */}
                      {!isSeller && !block.isCancelledStore && (() => {
                        const aviso = storeAutoCloseNotice({
                          estado: block.estado,
                          updatedAt: block.updatedAtStore,
                          entregadoAt: block.entregadoAtStore,
                          isStorePickup,
                        });
                        if (!aviso) return null;
                        return (
                          <div className={`order-store-block-deadline ${aviso.urgent ? 'order-store-block-deadline--urgent' : ''}`}>
                            <Timer size={13} />
                            <span>
                              <strong>{aviso.label}.</strong> {aviso.detail}
                            </span>
                          </div>
                        );
                      })()}

                      {/* El envio se dice UNA vez, en la fila de la entrega de arriba: repetirlo
                          aca hacia leer dos cobros distintos por el mismo despacho. */}
                      <div className="order-store-block-totals">
                        {block.isCancelledStore ? (
                          <span className="order-store-block-refund">
                            Cancelado · Reembolso {formatCLP(block.refundStore)}
                          </span>
                        ) : (
                          <span>Repuestos <strong>{formatCLP(block.subtotalStore)}</strong></span>
                        )}
                      </div>

                      {/* Las acciones de ESTA tienda, dentro de su bloque. Un boton al pie del
                          modal no diria a cual le pega. Una tienda cancelada no ofrece ninguna:
                          el bloque queda solo como comprobante de lo que se devolvio. */}
                      {!isSeller && !block.isCancelledStore && (accion || puedeCancelar || canRateStore(block)) && (
                        <div className="order-store-block-actions">
                          {/* La calificacion tambien es POR TIENDA: se evalua a ese vendedor con
                              SUS repuestos. Un boton global calificaba a "Tienda RepuesTop" -- un
                              nombre generico -- y mezclaba los productos de las dos. */}
                          {canRateStore(block) && (
                            <button
                              type="button"
                              className="btn-auth-secondary"
                              onClick={() => openRatingModal(block)}
                            >
                              <Star size={14} />
                              <span>Calificar</span>
                            </button>
                          )}
                          {accion && (
                            <button
                              type="button"
                              className="btn-auth-primary"
                              onClick={() => { setStoreAdvanceError(''); setStoreToAdvance(block); }}
                            >
                              <PackageCheck size={14} />
                              <span>{accion.label}</span>
                            </button>
                          )}
                          {puedeCancelar && (
                            <button
                              type="button"
                              className="btn-auth-danger"
                              onClick={() => { setStoreCancelError(''); setStoreToCancel(block); }}
                            >
                              <XCircle size={14} />
                              <span>Cancelar esta compra</span>
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}


          {/* Financial Breakdown Section */}
          <div className="details-card-block financial-summary-block">
            <h3 className="section-subtitle">
              <CreditCard size={16} />
              <span>Desglose Financiero</span>
            </h3>

            <div className="financial-rows-list">
              <div className="financial-row">
                <span>Subtotal Repuestos</span>
                <strong>{formatCLP(subtotal)}</strong>
              </div>
              {shippingFee > 0 && (
                <div className="financial-row">
                  <span>Costo de Envío</span>
                  <strong>{formatCLP(shippingFee)}</strong>
                </div>
              )}

              {isSeller && (
                <>
                  {repuestopFee > 0 && (
                    <div className="financial-row deduction-row">
                      <span>Comisión RepuesTop ({commissionRate}% + IVA)</span>
                      <strong className="negative-text">-{formatCLP(repuestopFee)}</strong>
                    </div>
                  )}
                  {paymentProcessingFee > 0 && (
                    <div className="financial-row deduction-row">
                      <span>Procesador de pago</span>
                      <strong className="negative-text">-{formatCLP(paymentProcessingFee)}</strong>
                    </div>
                  )}
                </>
              )}

              {/* Al comprador se le cobró el pedido completo y se le devuelve lo cancelado.
                  Antes solo se mostraba "Total Pagado" con el monto original, sin una sola
                  mención del reembolso: la pantalla afirmaba que pagó por algo que ya no le
                  va a llegar. `montoReembolsado` y `totalActivo` los calcula y envía el
                  backend desde siempre; nadie los leía. */}
              {!isSeller && refundAmount > 0 && (
                <>
                  <div className="financial-row deduction-row">
                    <span>Productos cancelados</span>
                    <strong className="negative-text">-{formatCLP(refundAmount)}</strong>
                  </div>
                  <div className="financial-row">
                    <span>Total Pagado</span>
                    <strong>{formatCLP(totalBuyer)}</strong>
                  </div>
                </>
              )}

              <div className="financial-row total-highlight-row">
                <span>{isSeller ? 'Monto Neto a Recibir' : refundAmount > 0 ? 'Total Final' : 'Total Pagado'}</span>
                <strong className="total-highlight-amount">
                  {formatCLP(isSeller ? totalSeller : refundAmount > 0 ? totalActive : totalBuyer)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Motivo de Cancelación */}
        {cancellationReason && (
          <div className="order-cancellation-block">
            <strong>{cancellationReason}</strong>
            {cancellationHint && <span>{cancellationHint}</span>}
          </div>
        )}

        {statusError && (
          <div className="auth-alert alert-error" style={{ margin: '0 24px 12px' }}>
            <AlertTriangle size={16} />
            <span>{statusError}</span>
          </div>
        )}

        {/* Plazo de Pago */}
        {paymentWindow && (
          <p className={`order-payment-window in-modal ${paymentWindow.expired ? 'is-expired' : ''}`}>
            <Clock size={14} />
            <span>
              {paymentWindow.expired
                ? 'El plazo para pagar venció. Este pedido se cancela y la unidad vuelve al stock; puedes volver a comprarla.'
                : `${paymentWindow.label}. Pasado ese plazo el pedido se cancela y la unidad vuelve al stock.`}
            </span>
          </p>
        )}

        <div className="order-modal-footer">
          {/* Acción principal del Vendedor */}
          {/* Accion principal del pedido. Vale para los DOS roles: estaba condicionada a
              `isSeller`, asi que al comprador no le aparecian "Marcar recibido" ni
              "Finalizar pedido" en el detalle, solo en la tarjeta del listado. */}
          {sellerReadOnly && (
            <span className="order-controlled-wait order-controlled-wait--modal">
              <Lock size={15} />
              Cuenta bloqueada: solo lectura
            </span>
          )}

          {controlledAction && !controlledAction.disabled && !sellerReadOnly && !buyerActionsPerStore && (
            // `waiting` no es una accion: es "ya hiciste tu parte, ahora le toca al
            // otro". Viene sin `nextStatus`, asi que pintarlo como boton primario
            // dejaba uno que al clickearlo no hacia nada. La tarjeta del pedido ya lo
            // resuelve con `.order-controlled-wait`; aca se usa el mismo aviso.
            controlledAction.waiting ? (
              <span className="order-controlled-wait order-controlled-wait--modal">
                <Clock size={15} />
                {controlledAction.label}
              </span>
            ) : isSeller && normStatus === 'EN_PREPARACION' && !isStorePickup ? (
              <button
                type="button"
                className="btn-auth-primary"
                onClick={() => {
                  setDispatchCourierChoice(initialCourier);
                  setDispatchCourierOther('');
                  setDispatchTrackingNumber(order?.trackingNumber || '');
                  setDispatchShippingFee(order?.shippingFee || '');
                  setDispatchError('');
                  setShowDispatchModal(true);
                }}
              >
                <Truck size={16} />
                <span>Registrar Envío / Despacho</span>
              </button>
            ) : controlledAction.requiresPin ? (
              /* El PIN es la unica prueba de que se entrego a la persona correcta, asi que el
                 campo se pinta como tal -- seis casillas monoespaciadas y una etiqueta que dice
                 de donde sale el numero-, y no como un input suelto al lado del boton. */
              <div className="order-pin-entry">
                <label className="order-pin-field" htmlFor="order-pickup-pin">
                  <span className="order-pin-label"><KeyRound size={13} /> Código de retiro</span>
                  <input
                    id="order-pickup-pin"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    aria-label="Código de retiro de 6 dígitos"
                    value={pickupPin}
                    onChange={(e) => setPickupPin(e.target.value.replace(/\D/g, ''))}
                  />
                  <small>Te lo dicta el comprador al retirar</small>
                </label>
                <button
                  type="button"
                  className="btn-auth-primary order-pin-submit"
                  disabled={isUpdating || pickupPin.trim().length !== 6}
                  onClick={handleStatusSubmit}
                >
                  {isUpdating ? <Loader2 size={16} className="spin-icon" /> : <CheckCircle2 size={16} />}
                  <span>{controlledAction.label}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-auth-primary"
                disabled={isUpdating}
                onClick={handleStatusSubmit}
              >
                {isUpdating ? <Loader2 size={16} className="spin-icon" /> : <CheckCircle2 size={16} />}
                <span>{controlledAction.label}</span>
              </button>
            )
          )}

          {/* Retomar pago (Comprador) */}
          {canRetryPayment && (
            <button
              type="button"
              className="btn-auth-primary"
              disabled={isRetryingPayment}
              onClick={async () => {
                if (isRetryingPayment) return;
                setIsRetryingPayment(true);
                setRetryError('');
                try {
                  await onRetryPayment(order);
                } catch (err) {
                  setRetryError(err?.message || 'No se pudo regenerar el intento de pago.');
                } finally {
                  setIsRetryingPayment(false);
                }
              }}
            >
              {isRetryingPayment ? <Loader2 size={16} className="spin-icon" /> : <RotateCcw size={16} />}
              {isRetryingPayment ? 'Abriendo pago…' : 'Retomar pago'}
            </button>
          )}

          {/* Cancelar pedido (Vendedor) */}
          {canSellerCancel && (
            <button
              type="button"
              className="btn-auth-danger"
              onClick={() => {
                setSellerCancelReason('SIN_STOCK');
                setSellerCancelDetail('');
                setSellerCancelError('');
                setShowSellerCancelModal(true);
              }}
            >
              <XCircle size={16} />
              <span>Cancelar Pedido</span>
            </button>
          )}

          {/* Confirmar Recepción (Comprador). Con mas de una tienda esto se reemplaza por el
              boton de cada bloque: uno solo aca confirmaria las dos de una vez, que es
              justo lo que la fase 3 vino a partir. */}
          {!isSeller && !buyerActionsPerStore
            && (normStatus === 'ENVIADO' || normStatus === 'LISTO_PARA_RETIRO' || normStatus === 'DISPATCHED') && (
            <button
              type="button"
              className="btn-auth-primary"
              disabled={isUpdating}
              onClick={async () => {
                setIsUpdating(true);
                setStatusError('');
                try {
                  await onUpdateStatus(order.id, 'ENTREGADO');
                } catch (err) {
                  setStatusError(err?.message || 'No se pudo confirmar la recepción.');
                } finally {
                  setIsUpdating(false);
                }
              }}
            >
              {isUpdating ? <Loader2 size={16} className="spin-icon" /> : <PackageCheck size={16} />}
              <span>Confirmar Recepción</span>
            </button>
          )}

          {/* Calificar Compra (Comprador) */}
          {/* Con bloques por tienda la calificacion vive en cada uno: un boton al pie no dice
              a que vendedor se le esta poniendo la nota. */}
          {!isSeller && !groupedByStore && canRateOrder && (
            <button
              type="button"
              className="btn-auth-primary"
              onClick={() => openRatingModal()}
            >
              <Star size={16} />
              <span>Calificar Compra</span>
            </button>
          )}

          <button type="button" className="btn-auth-secondary" onClick={onClose}>
            {isPage ? 'Volver a mis pedidos' : 'Cerrar'}
          </button>
        </div>

        {/* Modal de Cancelación por parte del Vendedor (A2, C1) */}
        {showSellerCancelModal && createPortal(
          <div className="commission-modal-backdrop order-subdialog-backdrop" onClick={() => !isCancellingSeller && setShowSellerCancelModal(false)}>
            <form className="commission-modal-card order-subdialog-card" onSubmit={handleSellerCancelSubmit} onClick={(e) => e.stopPropagation()}>
              <div className="commission-modal-header">
                <div className="commission-icon-badge order-subdialog-badge-danger">
                  <XCircle size={22} />
                </div>
                <div className="order-subdialog-heading">
                  <h3>Cancelar pedido #{orderIdShort}</h3>
                  <span>Indica el motivo de la cancelación para el cliente</span>
                </div>
              </div>

              {sellerCancelError && <p className="confirm-dialog-error">{sellerCancelError}</p>}

              <label className="order-subdialog-field">
                <span>Motivo de la cancelación *</span>
                <select value={sellerCancelReason} onChange={(e) => setSellerCancelReason(e.target.value)}>
                  {SELLER_CANCEL_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </select>
              </label>

              <label className="order-subdialog-field">
                <span>Detalle o explicación {sellerCancelReason === 'OTRO' ? '*' : '(opcional)'}</span>
                <textarea
                  required={sellerCancelReason === 'OTRO'}
                  rows={3}
                  maxLength={300}
                  placeholder={sellerCancelReason === 'OTRO' ? 'Escribe aquí la razón de la cancelación...' : 'Información adicional para el cliente...'}
                  value={sellerCancelDetail}
                  onChange={(e) => setSellerCancelDetail(e.target.value)}
                />
              </label>

              <div className="confirm-dialog-actions">
                <button type="button" className="btn-auth-secondary" onClick={() => setShowSellerCancelModal(false)} disabled={isCancellingSeller}>
                  Volver
                </button>
                <button type="submit" className="btn-auth-danger" disabled={isCancellingSeller}>
                  {isCancellingSeller && <Loader2 size={16} className="spin-icon" />}
                  {isCancellingSeller ? 'Cancelando...' : 'Confirmar cancelación'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

        {/* Modal de Registro de Despacho (A3) */}
        {showDispatchModal && createPortal(
          <div className="commission-modal-backdrop order-subdialog-backdrop" onClick={() => !isRegisteringDispatch && setShowDispatchModal(false)}>
            <form className="commission-modal-card order-subdialog-card" onSubmit={handleDispatchSubmit} onClick={(e) => e.stopPropagation()}>
              <div className="commission-modal-header">
                <div className="commission-icon-badge">
                  <Truck size={22} />
                </div>
                <div className="order-subdialog-heading">
                  <h3>Registrar despacho de envío</h3>
                  <span>Pedido {orderIdShort} · Destino: {order.compradorComuna || 'Chile'}</span>
                </div>
              </div>

              {dispatchError && <p className="confirm-dialog-error">{dispatchError}</p>}

                <label className="order-subdialog-field">
                  <span>Empresa de transporte (courier) *</span>
                  <select
                    value={dispatchCourierChoice}
                    onChange={(e) => setDispatchCourierChoice(e.target.value)}
                  >
                    <option value="" disabled>Selecciona una empresa…</option>
                    {COMMON_COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value={OTHER_COURIER}>Otra (especificar)</option>
                  </select>
                  {dispatchCourierChoice === OTHER_COURIER && (
                    <input
                      type="text"
                      required
                      maxLength={120}
                      placeholder="Nombre de la empresa de transporte"
                      value={dispatchCourierOther}
                      onChange={(e) => setDispatchCourierOther(e.target.value)}
                    />
                  )}
                </label>

                <label className="order-subdialog-field">
                  <span>Número de orden de flete / seguimiento *</span>
                  <input
                    type="text"
                    required
                    maxLength={TRACKING_MAX_LENGTH}
                    placeholder="Ej: 990012345678"
                    value={dispatchTrackingNumber}
                    onChange={(e) => setDispatchTrackingNumber(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, TRACKING_MAX_LENGTH)
                    )}
                  />
                  <small className="order-subdialog-hint">
                    Solo números y letras, sin espacios. Entre {TRACKING_MIN_LENGTH} y {TRACKING_MAX_LENGTH} caracteres.
                  </small>
                </label>

                <label className="order-subdialog-field">
                  <span>Valor del envío (opcional)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: 4500"
                    value={dispatchShippingFee}
                    onChange={(e) => setDispatchShippingFee(e.target.value.replace(/\D/g, '').slice(0, MAX_SHIPPING_FEE_DIGITS))}
                  />
                </label>

                <div className="order-subdialog-field">
                  <span>Comprobante de envío / voucher (opcional)</span>
                  <div className="order-subdialog-filedrop">
                    <label>
                      <FileUp size={20} />
                      <span>{dispatchVoucherFile ? dispatchVoucherFile.name : 'Adjuntar foto o PDF del comprobante'}</span>
                      <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} />
                    </label>
                    {dispatchVoucherFile && (
                      <button
                        type="button"
                        className="order-subdialog-fileclear"
                        aria-label="Quitar archivo"
                        title="Quitar archivo"
                        onClick={() => setDispatchVoucherFile(null)}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="confirm-dialog-actions">
                  <button type="button" className="btn-auth-secondary" onClick={() => setShowDispatchModal(false)} disabled={isRegisteringDispatch}>
                    Volver
                  </button>
                  <button
                    type="submit"
                    className="btn-auth-primary"
                    disabled={isRegisteringDispatch || !dispatchCourier.trim() || dispatchTrackingNumber.trim().length < TRACKING_MIN_LENGTH}
                  >
                    {isRegisteringDispatch && <Loader2 size={16} className="spin-icon" />}
                    {isRegisteringDispatch ? 'Registrando...' : 'Confirmar envío'}
                  </button>
                </div>
            </form>
          </div>,
          document.body
        )}

        {/* Modal de Calificación de Pedido para el Comprador (A4) */}
        {showRatingModal && createPortal(
          <div className="commission-modal-backdrop order-subdialog-backdrop" onClick={() => !isSubmittingRating && setShowRatingModal(false)}>
            <div className="commission-modal-card order-subdialog-card order-subdialog-card--wide" onClick={(e) => e.stopPropagation()}>
              <div className="commission-modal-header">
                <div className="commission-icon-badge order-subdialog-badge-star">
                  <Star size={22} />
                </div>
                <div className="order-subdialog-heading">
                  {/* `orderDisplayCode` YA devuelve el numero con su almohadilla, asi que el
                      texto no debe agregar otra: salia "Calificar compra # #19". */}
                  <h3>{storeToRate ? `Calificar a ${storeToRate.name}` : `Calificar compra ${orderIdShort}`}</h3>
                  <span>Tu opinión ayuda a mantener la calidad en RepuesTop</span>
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (isSubmittingRating) return;
                  setIsSubmittingRating(true);
                  setRatingError('');
                  try {
                    const effectiveUserId = userId || order?.compradorId || order?.usuarioId;
                    if (!effectiveUserId) throw new Error('No se pudo identificar tu cuenta de usuario.');
                    // Solo los repuestos de la tienda calificada, y sin los cancelados. El
                    // backend deduce de aqui a que tienda corresponde la nota.
                    const itemsPayload = ratingItems.map((item) => {
                      const pId = item.productoId || item.id;
                      return {
                        productoId: Number(pId) || 0,
                        sellerRating: Number(sellerRating),
                        productRating: Number(productRatings[pId]),
                      };
                    });
                    const actualizado = await rateOrderApi(effectiveUserId, order.id, itemsPayload);
                    // El pedido en pantalla tiene que quedarse con las notas recien puestas: sin
                    // esto, `canRateStore` seguia viendo los items sin calificar y el boton
                    // "Calificar" se quedaba en la tarjeta hasta cerrar y reabrir el modal.
                    // El backend devuelve el pedido completo, asi que se mezcla tal cual.
                    if (actualizado) onOrderRated?.(actualizado);
                    setRatingSuccess(true);
                    setTimeout(() => {
                      setShowRatingModal(false);
                    }, 1400);
                  } catch (err) {
                    setRatingError(err?.message || 'No se pudo guardar la calificación.');
                  } finally {
                    setIsSubmittingRating(false);
                  }
                }}
                className="order-subdialog-form"
              >
                {ratingSuccess ? (
                  <div className="order-subdialog-success">
                    <CheckCircle2 size={40} />
                    <h4>¡Muchas gracias por tu calificación!</h4>
                    <p>Tus valoraciones fueron registradas con éxito.</p>
                  </div>
                ) : (
                  <>
                    {ratingError && <p className="confirm-dialog-error">{ratingError}</p>}

                    {/* Vendedor */}
                    <section className="order-rating-block">
                      <header>
                        <span className="order-rating-eyebrow">Vendedor</span>
                        {/* La tienda que se esta calificando. `sellerName` se cae a "Tienda
                            RepuesTop" cuando el pedido no trae un nombre unico -- que es
                            justamente el caso de dos vendedores --, asi que el comprador ponia
                            estrellas sin saber a quien. */}
                        <strong className="order-rating-subject">{storeToRate?.name || sellerName}</strong>
                      </header>
                      <div className="order-rating-stars">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className={`order-rating-star ${star <= sellerRating ? 'is-on' : ''}`}
                            aria-label={`${star} de 5`}
                            onClick={() => setSellerRating(star)}
                          >
                            <Star size={26} fill={star <= sellerRating ? 'currentColor' : 'none'} />
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Un bloque por repuesto */}
                    <div className="order-rating-products">
                      <span className="order-rating-eyebrow">{ratingItems.length > 1 ? 'Los repuestos' : 'El repuesto'}</span>
                      {ratingItems.map((item, idx) => {
                        const pId = item.productoId || item.id || idx;
                        const currentProductRating = productRatings[pId] || 0;
                        const pName = item.nombre || item.productName || item.name || 'Repuesto';
                        const pPhoto = resolveMediaUrl(
                          item.imagenUrl || item.imageUrl || (item.imageUrls && item.imageUrls[0])
                        );
                        return (
                          <div key={pId} className="order-rating-product-row">
                            <div className="order-rating-product-head">
                              {pPhoto
                                ? <img src={pPhoto} alt="" className="order-rating-product-thumb" />
                                : <span className="order-rating-product-thumb order-rating-product-thumb--empty"><Package size={16} /></span>}
                              <span className="order-rating-product-name" title={pName}>{pName}</span>
                            </div>
                            <div className="order-rating-stars order-rating-stars--sm">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  className={`order-rating-star ${star <= currentProductRating ? 'is-on' : ''}`}
                                  aria-label={`${star} de 5`}
                                  onClick={() => setProductRatings((prev) => ({ ...prev, [pId]: star }))}
                                >
                                  <Star size={20} fill={star <= currentProductRating ? 'currentColor' : 'none'} />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="confirm-dialog-actions">
                      <button type="button" className="btn-auth-secondary" onClick={() => setShowRatingModal(false)} disabled={isSubmittingRating}>
                        Ahora no
                      </button>
                      <button type="submit" className="btn-auth-primary" disabled={isSubmittingRating || !ratingComplete}>
                        {isSubmittingRating ? <Loader2 size={16} className="spin-icon" /> : <Star size={16} />}
                        <span>Enviar calificación</span>
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>,
          document.body
        )}

        <ConfirmDialog
          isOpen={confirmStatusAdvance}
          tone="primary"
          title={controlledAction?.title || '¿Confirmar?'}
          message={controlledAction?.message || ''}
          confirmLabel={controlledAction?.label || 'Confirmar'}
          cancelLabel="Volver"
          isBusy={isUpdating}
          error={statusError}
          onCancel={() => { if (!isUpdating) { setConfirmStatusAdvance(false); setStatusError(''); } }}
          onConfirm={() => runStatusUpdate(pickupPin.trim())}
        />

        <ConfirmDialog
          isOpen={Boolean(storeToAdvance)}
          tone="primary"
          title={buyerStoreAction(storeToAdvance || {})?.title || '¿Confirmar?'}
          message={buyerStoreAction(storeToAdvance || {})?.message || ''}
          confirmLabel={buyerStoreAction(storeToAdvance || {})?.label || 'Confirmar'}
          cancelLabel="Volver"
          isBusy={isAdvancingStore}
          error={storeAdvanceError}
          onCancel={() => { if (!isAdvancingStore) { setStoreToAdvance(null); setStoreAdvanceError(''); } }}
          onConfirm={async () => {
            const accion = buyerStoreAction(storeToAdvance || {});
            if (!accion) return;
            setIsAdvancingStore(true);
            setStoreAdvanceError('');
            try {
              // El tercer argumento es el PIN y va vacio: el retiro en tienda solo lo exige
              // cuando lo marca el VENDEDOR. Confirmandolo el comprador, el PIN no prueba
              // nada que el propio comprador no este afirmando ya.
              await onUpdateStatus(order.id, accion.nextStatus, undefined, storeToAdvance.id);
              setStoreToAdvance(null);
            } catch (err) {
              setStoreAdvanceError(err?.message || 'No se pudo actualizar el estado de esta tienda.');
            } finally {
              setIsAdvancingStore(false);
            }
          }}
        />

        <ConfirmDialog
          isOpen={Boolean(storeToCancel)}
          title={showSubOrders ? `¿Cancelar tu compra a ${storeToCancel?.name || 'esta tienda'}?` : '¿Cancelar este pedido?'}
          message={showSubOrders
            ? `Se cancelan solo los repuestos de ${storeToCancel?.name || 'esta tienda'} y se te devuelve lo que pagaste por ellos${isStorePickup ? '' : ', incluido su envío'}. El resto del pedido sigue su curso. No se puede deshacer.`
            : 'Las unidades vuelven al stock y se te devuelve lo que pagaste. Esta acción no se puede deshacer; si aún quieres el repuesto tendrás que comprarlo de nuevo.'}
          confirmLabel="Sí, cancelar"
          cancelLabel="No, mantenerla"
          isBusy={isCancellingStore}
          error={storeCancelError}
          onCancel={() => { if (!isCancellingStore) { setStoreToCancel(null); setStoreCancelError(''); } }}
          onConfirm={async () => {
            setIsCancellingStore(true);
            setStoreCancelError('');
            try {
              await onCancelBuyerSubOrder(order, storeToCancel.id);
              setStoreToCancel(null);
              onClose?.();
            } catch (err) {
              setStoreCancelError(err?.message || 'No se pudo cancelar la compra.');
            } finally {
              setIsCancellingStore(false);
            }
          }}
        />
        {retryError && <p className="order-modal-retry-error">{retryError}</p>}
      </div>
  );

  if (isPage) return contenido;

  // Por PORTAL a `document.body`. El velo es `position: fixed`, pero un ancestro con
  // `transform`, `filter` o `backdrop-filter` se convierte en su bloque contenedor: el `fixed`
  // deja de medirse contra la ventana y tiñe solo una zona central, dejando los bordes de la
  // pantalla sin oscurecer. Subir la opacidad no lo arregla -- la caja no cubre la ventana.
  return createPortal(
    <div className="order-modal-backdrop" onClick={onClose}>
      {contenido}
    </div>,
    document.body
  );
}
