import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShoppingCart } from 'lucide-react';
import {
  getBuyerOrderByRefApi, getSellerOrderByNumberApi, retryOrderPaymentApi, confirmOrderPaymentApi, updateOrderStatusApi,
  cancelSellerOrderApi, cancelBuyerSubOrderApi, registerOrderDispatchApi, registerSaleReceiptApi,
  declareOrderDeliveryApi, createOrderClaimApi,
} from '../services/api';
import { qk } from '../services/queryKeys';
import OrderDetailView from './OrderDetailView';
import SellerOrdersPanel from './SellerOrdersPanel';
import { EmptyState } from './ProfileDashboard';
import BuyerOrdersBrowser from './BuyerOrdersBrowser';
import { currentPathForBack, profileOrderPath, profilePurchasePath, ROUTES } from '../routes/paths';
import { normalizeOrderNumber, orderMatchesRef, orderNumberRef } from '../data/orderIdentity';

/**
 * Pestañas "Pedidos recibidos"/"Mis Pedidos" y "Mis compras" del panel de
 * perfil, mas el detalle (`/perfil/pedidos/:id`, `/perfil/compras/:id`) que
 * ocupa el lugar del listado dentro del mismo panel. Extraido de
 * ProfileDashboard: es el dominio mas grande e interconectado del panel
 * (retomar pago, cancelar, despachar, declarar entrega, reclamar, calificar),
 * pero resulto ser genuinamente autocontenido -- ningun otro tab (productos,
 * cotizaciones, resumen) toca `selectedOrder`, `ratingPromptOrderId` ni
 * `paymentBannerOrder`. `orders`/`purchases` siguen viniendo del padre porque
 * Resumen tambien los usa para sus KPIs.
 */
export default function ProfileOrdersPanel({
  activeTab,
  sellerOrdersPreset = null,
  isSeller,
  isSellerBlocked,
  sellerComplianceMode = false,
  sellerComplianceDeadlines = [],
  isBuyerBlocked = false,
  user,
  effectiveUserId,
  effectiveSellerId,
  orders,
  purchases,
  ordersLoading,
  purchasesLoading,
  detailOrderId,
  detailPurchaseId,
  deepLinkOrderId,
  onClearDeepLink,
  paymentStatus,
  paymentOrderId,
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // H59 fase 3: la tienda suspendida sin fraude (modo cumplimiento) sigue completando sus ventas
  // ya pagadas; solo el bloqueo por fraude deja el panel en solo lectura.
  const sellerActionsLocked = Boolean(isSellerBlocked) && !sellerComplianceMode;
  // H59 fase 5: el comprador suspendido gestiona lo ya pagado, pero no paga ni califica.

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [ratingPromptOrderId, setRatingPromptOrderId] = useState(null);
  const [paymentBannerOrder, setPaymentBannerOrder] = useState(null);

  // Notificacion de pedido: abre el detalle apenas la lista este cargada. Se usa una
  // marca para no reabrirlo si el usuario lo cierra y la URL sigue teniendo `?pedido=`.
  const openedDeepLinkRef = useRef(null);
  // `?pedido=<id>` es el enlace que genera la campana de notificaciones y viaja en correos ya
  // enviados, asi que sigue funcionando: en vez de abrir el popup, REDIRIGE a la ruta del
  // detalle. Se hace con `replace` para que el "atras" del navegador lleve al listado y no de
  // vuelta a la URL con el parametro, que volveria a redirigir.
  useEffect(() => {
    if (!deepLinkOrderId) {
      openedDeepLinkRef.current = null;
      return;
    }
    if (openedDeepLinkRef.current === deepLinkOrderId) return;
    openedDeepLinkRef.current = deepLinkOrderId;
    onClearDeepLink?.('pedido');
    // O72: la URL lleva el numero publico. Si el enlace trae el id (notificaciones y correos
    // anteriores), se navega igual y el detalle lo resuelve contra la lista y redirige al numero.
    navigate(profileOrderPath(normalizeOrderNumber(deepLinkOrderId) || deepLinkOrderId), { replace: true });
  }, [deepLinkOrderId, navigate, onClearDeepLink]);

  // plan_retorno_flow.md Fase 3: PagoController redirige aqui con
  // ?status=pending|failure&orderId=... cuando el pago no quedo aprobado. Se busca
  // primero en el listado ya cargado; si no aparece (recien creado, otra pestaña)
  // se trae por id directo con el endpoint nuevo.
  useEffect(() => {
    if (!paymentOrderId || !paymentStatus || paymentStatus === 'success') {
      setPaymentBannerOrder(null);
      return undefined;
    }
    const found = orders.find((o) => orderMatchesRef(o, paymentOrderId));
    if (found) {
      setPaymentBannerOrder(found);
      return undefined;
    }
    if (!effectiveUserId) return undefined;
    let active = true;
    // O72: PagoController devuelve el numero publico en `orderId`; se resuelve por numero.
    getBuyerOrderByRefApi(effectiveUserId, paymentOrderId)
      .then((order) => { if (active) setPaymentBannerOrder(order); })
      .catch(() => {});
    return () => { active = false; };
  }, [paymentStatus, paymentOrderId, orders, effectiveUserId]);

  const handleUpdateOrderStatus = async (orderId, newStatus, pin, proveedorId) => {
    try {
      const updatedOrder = await updateOrderStatusApi(orderId, newStatus, pin, proveedorId);
      queryClient.invalidateQueries({ queryKey: isSeller ? qk.sellerOrders(effectiveSellerId) : qk.buyerOrders(effectiveUserId) });
      const merged = { ...updatedOrder, estado: updatedOrder?.estado || newStatus, status: updatedOrder?.status || newStatus };
      setSelectedOrder((prevSelected) => String(prevSelected?.id) === String(orderId)
        ? { ...prevSelected, ...merged }
        : prevSelected);
      // Al confirmar la recepcion se ofrece calificar en el acto, igual que la app.
      // Tiene que vivir aca y no en el modal porque el comprador suele marcar recibido
      // desde la TARJETA del listado, sin haber abierto el detalle.
      //
      // Se decide por el estado que DEVOLVIO el backend -el derivado-, no por el que se
      // pidio: con la recepcion por tienda, confirmar la primera deja el pedido todavia en
      // ENVIADO, y `PedidoPostVentaSupport` exige calificar TODOS los items de un pedido
      // ENTREGADO/FINALIZADO. Mirando `newStatus` el modal se abria con la segunda tienda en
      // viaje y el POST moria en 400.
      const estadoResultante = String(updatedOrder?.estado || updatedOrder?.status || newStatus).toUpperCase();
      if (!isSeller && ['ENTREGADO', 'RECEIVED'].includes(estadoResultante)) {
        const base = orders.find((candidate) => String(candidate.id) === String(orderId)) || {};
        setSelectedOrder({ ...base, ...merged });
        setRatingPromptOrderId(orderId);
      }
      return updatedOrder;
    } catch (err) {
      console.warn('No se pudo actualizar el estado del pedido:', err);
      throw err;
    }
  };

  /**
   * Igual que `handleUpdateOrderStatus` pero con semantica de COMPRADOR: lo usa el vendedor
   * cuando gestiona una de sus compras desde "Mis compras". Refresca la lista de compras y
   * ofrece calificar al recibir, sin importar que `isSeller` sea true.
   */
  const handlePurchaseUpdateStatus = async (orderId, newStatus, pin, proveedorId) => {
    try {
      const updatedOrder = await updateOrderStatusApi(orderId, newStatus, pin, proveedorId);
      queryClient.invalidateQueries({ queryKey: qk.buyerOrders(effectiveUserId) });
      const merged = { ...updatedOrder, estado: updatedOrder?.estado || newStatus, status: updatedOrder?.status || newStatus };
      setSelectedOrder((prevSelected) => String(prevSelected?.id) === String(orderId)
        ? { ...prevSelected, ...merged }
        : prevSelected);
      const estadoResultante = String(updatedOrder?.estado || updatedOrder?.status || newStatus).toUpperCase();
      if (['ENTREGADO', 'RECEIVED'].includes(estadoResultante)) {
        const base = purchases.find((candidate) => String(candidate.id) === String(orderId)) || {};
        setSelectedOrder({ ...base, ...merged });
        setRatingPromptOrderId(orderId);
      }
      return updatedOrder;
    } catch (err) {
      console.warn('No se pudo actualizar el estado de la compra:', err);
      throw err;
    }
  };

  /**
   * "Retomar pago" de un pedido que quedo en PENDIENTE.
   *
   * Equivalente de `retryOrderPayment()` del movil, sin su sondeo: alla Flow se
   * abre en un navegador incrustado y la pantalla sigue viva, asi que sondea
   * `confirmar-pago` 60 veces. Aca la pagina se va ENTERA a Flow, asi que no hay
   * donde sondear; la confirmacion se hace al volver, con el `?status=success`
   * del efecto de mas abajo.
   */
  const handleRetryPayment = async (order) => {
    const orderId = order?.id;
    if (!effectiveUserId || !orderId) return;
    const renewed = await retryOrderPaymentApi(effectiveUserId, orderId);

    // Si es un token mock de prueba o local, simula la confirmación inmediata sin redireccionar fuera
    const isMock = Boolean(renewed?.urlPago && /mock_flow_token_/i.test(renewed.urlPago));
    if (isMock) {
      try {
        const confirmed = await confirmOrderPaymentApi(effectiveUserId, orderId);
        queryClient.invalidateQueries({ queryKey: qk.buyerOrders(effectiveUserId) });
        if (confirmed && selectedOrder && String(selectedOrder.id) === String(orderId)) {
          setSelectedOrder(confirmed);
        }
        return;
      } catch (err) {
        console.warn('Error confirmando pago simulado al retomar:', err);
      }
    }

    if (!renewed?.urlPago) {
      throw new Error('No se recibió la URL de pago desde la pasarela.');
    }
    window.location.href = renewed.urlPago;
  };

  /**
   * El comprador desiste de un pedido que todavia no paga. Va por la transicion de
   * estado y no por el endpoint de cancelacion, que es del vendedor y exige motivo.
   * El backend solo lo permite en PENDIENTE: ya pagado hay que reembolsar.
   */
  const handleCancelOrder = async (order) => {
    if (!order?.id) return;
    await handleUpdateOrderStatus(order.id, 'CANCELADO');
  };

  // Abrir un pedido es NAVEGAR, no levantar un popup: asi el "atras" del navegador vuelve al
  // listado, la URL se puede compartir y los dialogos que el detalle abre dejan de ser un modal
  // encima de otro modal.
  // O72: la URL lleva el numero publico del pedido, nunca el id de la tabla.
  const openOrderDetail = (order) => {
    if (!order?.id) return;
    navigate(profileOrderPath(orderNumberRef(order)));
  };

  // El vendedor abre una de SUS compras: mismo patron, otra ruta y otra lista de origen.
  const openPurchaseDetail = (order) => {
    if (!order?.id) return;
    navigate(profilePurchasePath(orderNumberRef(order)));
  };

  // El detalle abierto: puede ser un pedido recibido (`detailOrderId`) o una compra
  // (`detailPurchaseId`). Solo uno llega a la vez.
  const activeDetailId = detailOrderId || detailPurchaseId;
  const detailIsPurchase = Boolean(detailPurchaseId);
  const detailSourceList = detailIsPurchase ? purchases : orders;
  const detailListLoading = detailIsPurchase ? purchasesLoading : ordersLoading;

  // Por numero publico (con o sin espacios) o, para enlaces antiguos, por id: siempre contra la
  // lista del propio usuario, asi que un id ajeno simplemente no aparece.
  const detailFromList = activeDetailId
    ? (detailSourceList || []).find((candidate) => orderMatchesRef(candidate, activeDetailId))
    : null;

  /**
   * El pedido que NO esta en la lista cacheada se pide por su numero.
   *
   * Pasa con cualquier venta que llegue DURANTE la sesion: la campana navega al detalle, pero
   * el listado quedo cacheado con `staleTime` de 60s y no se vuelve a pedir, asi que el pedido
   * nuevo no esta ahi. Y `ordersLoading` es `isLoading`, que con la lista ya cargada es false:
   * no se veia ni "Cargando", se iba derecho a "No encontramos ese pedido en tu cuenta" y la
   * venta solo aparecia al recargar con F5.
   *
   * Es el mismo recurso que ya usa el banner del retorno de pago, unas lineas mas arriba.
   */
  const [fetchedDetail, setFetchedDetail] = useState(null);
  const [detailFetching, setDetailFetching] = useState(false);
  // El refresco del listado se dispara UNA vez por pedido: si el backend no lo devolviera en la
  // lista, invalidar en cada respuesta dejaria el par pedir-invalidar girando solo.
  const detailRefreshedRef = useRef(null);
  // Lo mismo para el camino en que NO hay endpoint y hay que repedir el listado entero.
  const listRefetchedRef = useRef(null);
  useEffect(() => {
    // Mientras la lista siga en su primera carga no se pide nada: lo normal es que venga en ella.
    if (!activeDetailId || detailFromList || detailListLoading) {
      setFetchedDetail(null);
      setDetailFetching(false);
      return undefined;
    }
    const asBuyerView = detailIsPurchase || !isSeller;
    const ownerId = asBuyerView ? effectiveUserId : effectiveSellerId;
    if (!ownerId) return undefined;

    /**
     * La tienda solo tiene el endpoint por NUMERO publico (O72), y las notificaciones enlazan con
     * el id crudo: `PedidoNotificacionSupport` arma TODOS sus `targetParams` con
     * `pedido.getId()`, asi que la campana manda `?pedido=4` y la URL queda en
     * `/perfil/pedidos/4`. Ahi no hay nada que pedir por numero, y la unica via es repedir el
     * listado -- que es exactamente el F5 que el vendedor terminaba apretando--.
     *
     * `refetchQueries` y no `invalidateQueries`: invalidar solo marca la copia como vieja y el
     * refetch queda a merced de que algo la vuelva a observar, asi que la pantalla podia quedarse
     * con el mismo listado sin el pedido.
     */
    if (!asBuyerView && !normalizeOrderNumber(activeDetailId)) {
      if (listRefetchedRef.current === String(activeDetailId)) return undefined;
      listRefetchedRef.current = String(activeDetailId);
      let vigente = true;
      setDetailFetching(true);
      queryClient.refetchQueries({ queryKey: qk.sellerOrders(effectiveSellerId) })
        .finally(() => { if (vigente) setDetailFetching(false); });
      return () => { vigente = false; };
    }

    let active = true;
    setDetailFetching(true);
    const request = asBuyerView
      ? getBuyerOrderByRefApi(ownerId, activeDetailId)
      : getSellerOrderByNumberApi(ownerId, activeDetailId);
    request
      .then((order) => {
        if (!active) return;
        setFetchedDetail(order || null);
        // El listado tampoco lo tiene: se refresca para que al volver atras aparezca.
        if (order && detailRefreshedRef.current !== String(activeDetailId)) {
          detailRefreshedRef.current = String(activeDetailId);
          queryClient.invalidateQueries({
            queryKey: asBuyerView ? qk.buyerOrders(effectiveUserId) : qk.sellerOrders(effectiveSellerId),
          });
        }
      })
      // Un 404 aca es lo mismo que no encontrarlo en la lista: se muestra el mensaje de siempre.
      .catch(() => { if (active) setFetchedDetail(null); })
      .finally(() => { if (active) setDetailFetching(false); });
    return () => { active = false; };
  }, [activeDetailId, detailFromList, detailListLoading, detailIsPurchase, isSeller,
    effectiveUserId, effectiveSellerId, queryClient]);

  // La lista manda cuando lo tiene: es la copia que los handlers refrescan al invalidar.
  const detailBase = detailFromList
    || (activeDetailId && orderMatchesRef(fetchedDetail, activeDetailId) ? fetchedDetail : null);

  // `selectedOrder` es el buffer donde los handlers escriben la respuesta del backend apenas
  // llega (confirmar por tienda, cancelar, calificar). `invalidateQueries` refresca el listado,
  // pero es asincrono: sin mezclarlo, la accion se veia con retraso -- o no se veia -- porque
  // la pagina seguia leyendo la version vieja de la lista.
  const detailOrder = !activeDetailId
    ? null
    : (selectedOrder && orderMatchesRef(selectedOrder, activeDetailId)
      ? { ...detailBase, ...selectedOrder }
      : detailBase);

  // O72: un enlace antiguo con el id (`/perfil/pedidos/25`) que si es de este usuario se
  // reescribe a su numero publico; si no es suyo, abajo se muestra "No encontramos ese pedido"
  // sin distinguirlo de uno inexistente.
  useEffect(() => {
    if (!activeDetailId || !detailBase) return;
    if (normalizeOrderNumber(activeDetailId)) return;
    const ref = orderNumberRef(detailBase);
    if (!ref || ref === String(activeDetailId)) return;
    navigate(detailIsPurchase ? profilePurchasePath(ref) : profileOrderPath(ref), { replace: true });
  }, [activeDetailId, detailBase, detailIsPurchase, navigate]);

  useEffect(() => {
    if (!activeDetailId) return;
    if (selectedOrder && orderMatchesRef(selectedOrder, activeDetailId)) return;
    if (detailBase) setSelectedOrder(detailBase);
    // `selectedOrder` no va en las dependencias a proposito: cada actualizacion del buffer
    // volveria a disparar el efecto y lo pisaria con la version vieja de la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDetailId, detailBase]);

  const handleOrderRated = (updatedOrder) => {
    if (!updatedOrder?.id) return;
    queryClient.invalidateQueries({ queryKey: qk.buyerOrders(effectiveUserId) });
    setSelectedOrder((prev) => (prev && String(prev.id) === String(updatedOrder.id)
      ? { ...prev, ...updatedOrder }
      : prev));
  };

  /**
   * El comprador cancela su compra a UNA tienda
   * (`POST /pedidos/{id}/proveedores/{id}/cancelacion-comprador`).
   *
   * No se toca `estado` a mano en la copia local: con dos tiendas el pedido sigue vivo
   * mientras quede una en pie, y quien decide eso es el backend. Se mezcla lo que
   * respondió y listo.
   */
  const handleCancelBuyerSubOrder = async (order, proveedorId, { reasonDetail } = {}) => {
    const orderId = order?.id;
    if (!orderId || !proveedorId) return;
    const updated = await cancelBuyerSubOrderApi(orderId, proveedorId, { reasonDetail });
    queryClient.invalidateQueries({ queryKey: qk.buyerOrders(effectiveUserId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated }
      : prev);
    return updated;
  };

  /**
   * Cancelación formal del vendedor con motivo (`POST /proveedores/{id}/pedidos/{id}/cancelacion`).
   */
  const handleCancelSellerOrder = async (order, { reasonCode, reasonDetail } = {}) => {
    const orderId = order?.id;
    if (!effectiveSellerId || !orderId) return;
    const updated = await cancelSellerOrderApi(effectiveSellerId, orderId, { reasonCode, reasonDetail });
    queryClient.invalidateQueries({ queryKey: qk.sellerOrders(effectiveSellerId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated, estado: 'CANCELADO', status: 'CANCELADO', motivoCancelacion: reasonCode, detalleCancelacion: reasonDetail }
      : prev
    );
    return updated;
  };

  /**
   * Registro de despacho por courier con número de seguimiento y comprobante opcional (`POST /pedidos/{id}/envio`).
   */
  const handleRegisterOrderDispatch = async (order, dispatchData) => {
    const orderId = order?.id;
    if (!orderId) return;
    const updated = await registerOrderDispatchApi(orderId, dispatchData);
    queryClient.invalidateQueries({ queryKey: qk.sellerOrders(effectiveSellerId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated, estado: 'ENVIADO', status: 'ENVIADO', courier: dispatchData.courier, trackingNumber: dispatchData.trackingNumber }
      : prev
    );
    return updated;
  };

  /**
   * El vendedor sube la boleta / factura de su venta (`POST /pedidos/{id}/boleta-venta`).
   * Es obligatoria para confirmar el pedido: el modal de confirmación la exige y, tras
   * subirla, dispara la transición a EN_PREPARACION con `handleUpdateOrderStatus`.
   */
  const handleRegisterSaleReceipt = async (order, file) => {
    const orderId = order?.id;
    if (!orderId || !file) return;
    const updated = await registerSaleReceiptApi(orderId, file);
    queryClient.invalidateQueries({ queryKey: qk.sellerOrders(effectiveSellerId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated }
      : prev
    );
    return updated;
  };

  /**
   * El vendedor reporta que un courier externo (Uber Flash, Didi, un fletero propio) ya
   * entrego el pedido (`POST /pedidos/{id}/entrega-declarada`). Arranca la ventana de veto de
   * 48 horas: el pedido NO cambia de estado -sigue "Enviado"-, asi que a diferencia del resto
   * de los handlers de esta pantalla no hay un `estado`/`status` que forzar en el merge; con
   * lo que devuelve el backend (`entregaDeclaradaAt`) alcanza para que el banner aparezca.
   */
  const handleDeclareOrderDelivery = async (order) => {
    const orderId = order?.id;
    if (!orderId) return;
    const updated = await declareOrderDeliveryApi(orderId);
    queryClient.invalidateQueries({ queryKey: qk.sellerOrders(effectiveSellerId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated }
      : prev
    );
    return updated;
  };

  /**
   * El comprador vetea una entrega que el vendedor declaro: abre un reclamo con motivo fijo
   * `not_received`, el mismo que ya reconoce `MediacionBackofficeService` para clasificar el
   * caso. Un solo tap y sin pedirle que retipee nada -el comprador ya dijo con el boton mismo
   * que no la recibio-, a diferencia del reclamo libre de "Reportes/Disputa".
   */
  const handleDisputeDeclaredDelivery = async (order, proveedorId) => {
    const orderId = order?.id;
    if (!orderId) return;
    // O71b (pruebas de lanzamiento, 27-sep): el veto es de la tienda que declaro la entrega.
    const updated = await createOrderClaimApi(effectiveUserId, orderId, {
      motivo: 'not_received',
      descripcion: 'El vendedor reportó que el pedido fue entregado, pero no lo recibí.',
      ...(proveedorId != null ? { proveedorId } : {}),
    });
    queryClient.invalidateQueries({ queryKey: qk.buyerOrders(effectiveUserId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated }
      : prev
    );
    return updated;
  };

  /**
   * El comprador abre un reclamo libre desde el detalle del pedido ("¿Tienes un reclamo?").
   * Mismo endpoint que el veto de entrega declarada (`POST /usuarios/{id}/pedidos/{id}/reclamo`),
   * pero con el motivo y la descripcion que eligio en el modal. El pedido queda "En disputa"
   * (chat directo con la tienda); solo pasa a "En mediación" si luego se pide un mediador.
   */
  const handleCreateOrderClaim = async (order, { motivo, descripcion, proveedorId }) => {
    const orderId = order?.id;
    if (!orderId) return;
    // O71b (pruebas de lanzamiento, 27-sep): el reclamo es contra UNA tienda; con varias, el
    // comprador la eligio en el detalle.
    const updated = await createOrderClaimApi(effectiveUserId, orderId, {
      motivo, descripcion, ...(proveedorId != null ? { proveedorId } : {}),
    });
    queryClient.invalidateQueries({ queryKey: qk.buyerOrders(effectiveUserId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated }
      : prev
    );
    return updated;
  };

  return (
    <>
      {/* `/perfil/pedidos/:orderId` y `/perfil/compras/:orderId`: el detalle ocupa el
          lugar del listado, dentro del panel. Una compra del vendedor se ve SIEMPRE en
          modo comprador. */}
      {activeTab === 'pedidos' && isSeller && sellerComplianceMode && (
        <ComplianceDeadlinesNotice
          deadlines={sellerComplianceDeadlines}
          orderId={detailOrderId || null}
        />
      )}
      {(activeTab === 'pedidos' || activeTab === 'compras') && activeDetailId ? (
        detailOrder ? (
          (() => {
            const asBuyerView = detailIsPurchase || !isSeller;
            return (
              <OrderDetailView
                layout="page"
                order={detailOrder}
                mode={asBuyerView ? 'buyer' : 'seller'}
                sellerId={effectiveSellerId}
                userId={effectiveUserId}
                onClose={() => navigate(detailIsPurchase ? `${ROUTES.profile}/compras` : `${ROUTES.profile}/pedidos`)}
                onUpdateStatus={detailIsPurchase ? handlePurchaseUpdateStatus : handleUpdateOrderStatus}
                onRetryPayment={asBuyerView && !isBuyerBlocked ? handleRetryPayment : undefined}
                onCancelOrder={asBuyerView ? handleCancelOrder : undefined}
                // Comprador suspendido: sigue su pedido y conversa con la tienda, pero no cancela su
                // compra a la tienda, no reclama ni vetea la entrega (pruebas en dev, 2026-10-09).
                onCancelBuyerSubOrder={asBuyerView && !isBuyerBlocked ? handleCancelBuyerSubOrder : undefined}
                autoOpenRating={asBuyerView && !isBuyerBlocked && ratingPromptOrderId != null && String(detailOrder.id) === String(ratingPromptOrderId)}
                onRatingPromptShown={() => setRatingPromptOrderId(null)}
                onOrderRated={handleOrderRated}
                ratingDisabled={asBuyerView && isBuyerBlocked}
                onCancelSellerOrder={!asBuyerView && !sellerActionsLocked ? handleCancelSellerOrder : undefined}
                onRegisterDispatch={!asBuyerView && !sellerActionsLocked ? handleRegisterOrderDispatch : undefined}
                onRegisterSaleReceipt={!asBuyerView && !sellerActionsLocked ? handleRegisterSaleReceipt : undefined}
                onDeclareDelivery={!asBuyerView && !sellerActionsLocked ? handleDeclareOrderDelivery : undefined}
                onDisputeDeclaredDelivery={asBuyerView && !isBuyerBlocked ? handleDisputeDeclaredDelivery : undefined}
                onCreateClaim={asBuyerView && !isBuyerBlocked ? handleCreateOrderClaim : undefined}
                onOpenDispute={(proveedorId, draftMessage) => {
                  const params = new URLSearchParams({ caso: String(detailOrder.id) });
                  if (proveedorId != null && proveedorId !== '') params.set('tienda', String(proveedorId));
                  // El vendedor abre el chat en SU bandeja ("Chats con compradores"). Con
                  // `chats_vendedor` caia en la de sus compras, en modo comprador.
                  const inbox = asBuyerView ? 'chats_vendedor' : 'chats_compradores';
                  // `from`: el "volver" del chat regresa a este detalle, no a la bandeja.
                  navigate(`${ROUTES.profile}/${inbox}?${params.toString()}`, {
                    state: { from: currentPathForBack(), ...(draftMessage ? { draftMessage } : {}) },
                  });
                }}
                readOnly={!asBuyerView && sellerActionsLocked}
              />
            );
          })()
        ) : (
          <div className="profile-panel">
            {(detailListLoading || detailFetching)
              ? <EmptyState label={detailIsPurchase ? 'Cargando la compra…' : 'Cargando el pedido…'} />
              : <EmptyState label="No encontramos ese pedido en tu cuenta." />}
          </div>
        )
      ) : activeTab === 'pedidos' && (
        isSeller ? (
          <SellerOrdersPanel
            key={sellerOrdersPreset?.nonce ?? 'seller-orders'}
            initialStatuses={sellerOrdersPreset?.filter}
            orders={orders || []}
            sellerId={user?.sellerId}
            onSelectOrder={openOrderDetail}
            onUpdateStatus={handleUpdateOrderStatus}
            onRegisterSaleReceipt={sellerActionsLocked ? undefined : handleRegisterSaleReceipt}
            readOnly={sellerActionsLocked}
          />
        ) : (
          <div className="profile-panel">
            {paymentStatus && paymentStatus !== 'success' && (
              <div
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20,
                  padding: '14px 16px', borderRadius: 12,
                  background: paymentStatus === 'pending' ? '#fffbeb' : '#fef2f2',
                  border: `1px solid ${paymentStatus === 'pending' ? '#fcd34d' : '#fca5a5'}`,
                }}
              >
                <AlertTriangle size={18} color={paymentStatus === 'pending' ? '#b45309' : '#b91c1c'} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <strong>{paymentStatus === 'pending' ? 'Estamos confirmando tu pago' : 'Tu pago no pudo procesarse'}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#4b5563' }}>
                    {paymentStatus === 'pending'
                      ? 'En unos minutos verás el estado actualizado en este pedido.'
                      : 'Revisa el detalle del pedido para reintentar el pago.'}
                  </p>
                </div>
                {paymentBannerOrder && (
                  <button
                    type="button"
                    className="btn-view-details"
                    onClick={() => setSelectedOrder(paymentBannerOrder)}
                  >
                    Ver pedido
                  </button>
                )}
              </div>
            )}
            <h2 className="profile-panel-title">Mis Pedidos</h2>
            <BuyerOrdersBrowser
              orders={orders || []}
              loading={ordersLoading}
              emptyLabel="Aún no has realizado pedidos."
              onSelectOrder={openOrderDetail}
              onUpdateStatus={handleUpdateOrderStatus}
              onRetryPayment={isBuyerBlocked ? undefined : handleRetryPayment}
              onCancelOrder={handleCancelOrder}
            />
          </div>
        )
      )}

      {/* "Mis compras" del vendedor: los pedidos donde ES el comprador, con la MISMA
          vista que un comprador (tarjetas + detalle en modo buyer). */}
      {activeTab === 'compras' && isSeller && !activeDetailId && (
        <div className="profile-panel">
          <h2 className="profile-panel-title"><ShoppingCart size={20} /> Mis compras</h2>
          <p style={{ margin: '4px 0 16px', color: '#64748b', fontSize: '13.5px' }}>
            Los repuestos que has comprado a otras tiendas. Se gestionan igual que cualquier compra.
          </p>
          <BuyerOrdersBrowser
            orders={purchases || []}
            loading={purchasesLoading}
            emptyLabel="Aún no has comprado repuestos a otras tiendas."
            onSelectOrder={openPurchaseDetail}
            onUpdateStatus={handlePurchaseUpdateStatus}
            onRetryPayment={handleRetryPayment}
            onCancelOrder={handleCancelOrder}
          />
        </div>
      )}
    </>
  );
}

const DEADLINE_LABELS = {
  DESPACHO: 'Despachar (o dejar listo para retiro) antes del',
  RETIRO: 'El comprador puede retirar hasta el',
};

function formatDeadline(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * H59 fase 3: plazos de la tienda suspendida en modo cumplimiento, calculados por el backend
 * (2 dias habiles desde el pago, tope de 72 h en la definitiva, 7/5 dias para retirar). En el
 * detalle de un pedido muestra solo el suyo.
 */
function ComplianceDeadlinesNotice({ deadlines, orderId }) {
  const visible = orderId != null
    ? deadlines.filter((d) => String(d.orderId) === String(orderId))
    : deadlines;
  if (orderId != null && visible.length === 0) return null;
  return (
    <div
      role="status"
      style={{
        marginBottom: 16, padding: '14px 16px', borderRadius: 12,
        background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 13.5, lineHeight: 1.45,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 4 }}>Completa tus ventas ya pagadas</strong>
      {visible.length === 0 ? (
        <span>No tienes ventas pendientes de despacho o retiro.</span>
      ) : (
        <>
          <span>Si no se cumple el plazo, la venta se cancela y se le devuelve el pago al comprador.</span>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {visible.map((d) => (
              <li key={`${d.orderId}-${d.type}`}>
                {orderId == null && <strong>{d.orderNumber}: </strong>}
                {DEADLINE_LABELS[d.type] || 'Plazo:'} {formatDeadline(d.deadline)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
