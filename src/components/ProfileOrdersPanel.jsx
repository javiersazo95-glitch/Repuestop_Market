import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShoppingCart } from 'lucide-react';
import {
  getBuyerOrderByIdApi, retryOrderPaymentApi, confirmOrderPaymentApi, updateOrderStatusApi,
  cancelSellerOrderApi, cancelBuyerSubOrderApi, registerOrderDispatchApi, registerSaleReceiptApi,
  declareOrderDeliveryApi, createOrderClaimApi,
} from '../services/api';
import { qk } from '../services/queryKeys';
import OrderCard from './OrderCard';
import OrderDetailView from './OrderDetailView';
import SellerOrdersPanel from './SellerOrdersPanel';
import { EmptyState } from './ProfileDashboard';
import { profileOrderPath, profilePurchasePath, ROUTES } from '../routes/paths';

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
  isSeller,
  isSellerBlocked,
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
    navigate(profileOrderPath(deepLinkOrderId), { replace: true });
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
    const found = orders.find((o) => String(o.id) === String(paymentOrderId));
    if (found) {
      setPaymentBannerOrder(found);
      return undefined;
    }
    if (!effectiveUserId) return undefined;
    let active = true;
    getBuyerOrderByIdApi(effectiveUserId, paymentOrderId)
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
  const openOrderDetail = (order) => {
    if (!order?.id) return;
    navigate(profileOrderPath(order.id));
  };

  // El vendedor abre una de SUS compras: mismo patron, otra ruta y otra lista de origen.
  const openPurchaseDetail = (order) => {
    if (!order?.id) return;
    navigate(profilePurchasePath(order.id));
  };

  // El detalle abierto: puede ser un pedido recibido (`detailOrderId`) o una compra
  // (`detailPurchaseId`). Solo uno llega a la vez.
  const activeDetailId = detailOrderId || detailPurchaseId;
  const detailIsPurchase = Boolean(detailPurchaseId);
  const detailSourceList = detailIsPurchase ? purchases : orders;

  const detailFromList = activeDetailId
    ? (detailSourceList || []).find((candidate) => String(candidate.id) === String(activeDetailId))
    : null;
  // `selectedOrder` es el buffer donde los handlers escriben la respuesta del backend apenas
  // llega (confirmar por tienda, cancelar, calificar). `invalidateQueries` refresca el listado,
  // pero es asincrono: sin mezclarlo, la accion se veia con retraso -- o no se veia -- porque
  // la pagina seguia leyendo la version vieja de la lista.
  const detailOrder = !activeDetailId
    ? null
    : (selectedOrder && String(selectedOrder.id) === String(activeDetailId)
      ? { ...detailFromList, ...selectedOrder }
      : detailFromList);

  useEffect(() => {
    if (!activeDetailId) return;
    if (selectedOrder && String(selectedOrder.id) === String(activeDetailId)) return;
    if (detailFromList) setSelectedOrder(detailFromList);
    // `selectedOrder` no va en las dependencias a proposito: cada actualizacion del buffer
    // volveria a disparar el efecto y lo pisaria con la version vieja de la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDetailId, detailFromList]);

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
  const handleDisputeDeclaredDelivery = async (order) => {
    const orderId = order?.id;
    if (!orderId) return;
    const updated = await createOrderClaimApi(effectiveUserId, orderId, {
      motivo: 'not_received',
      descripcion: 'El vendedor reportó que el pedido fue entregado, pero no lo recibí.',
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
  const handleCreateOrderClaim = async (order, { motivo, descripcion }) => {
    const orderId = order?.id;
    if (!orderId) return;
    const updated = await createOrderClaimApi(effectiveUserId, orderId, { motivo, descripcion });
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
                onRetryPayment={asBuyerView ? handleRetryPayment : undefined}
                onCancelOrder={asBuyerView ? handleCancelOrder : undefined}
                onCancelBuyerSubOrder={asBuyerView ? handleCancelBuyerSubOrder : undefined}
                autoOpenRating={asBuyerView && ratingPromptOrderId != null && String(detailOrder.id) === String(ratingPromptOrderId)}
                onRatingPromptShown={() => setRatingPromptOrderId(null)}
                onOrderRated={handleOrderRated}
                onCancelSellerOrder={!asBuyerView && !isSellerBlocked ? handleCancelSellerOrder : undefined}
                onRegisterDispatch={!asBuyerView && !isSellerBlocked ? handleRegisterOrderDispatch : undefined}
                onRegisterSaleReceipt={!asBuyerView && !isSellerBlocked ? handleRegisterSaleReceipt : undefined}
                onDeclareDelivery={!asBuyerView && !isSellerBlocked ? handleDeclareOrderDelivery : undefined}
                onDisputeDeclaredDelivery={asBuyerView ? handleDisputeDeclaredDelivery : undefined}
                onCreateClaim={asBuyerView ? handleCreateOrderClaim : undefined}
                onOpenDispute={(proveedorId) => {
                  const params = new URLSearchParams({ caso: String(detailOrder.id) });
                  if (proveedorId != null && proveedorId !== '') params.set('tienda', String(proveedorId));
                  navigate(`${ROUTES.profile}/chats_vendedor?${params.toString()}`);
                }}
                readOnly={!asBuyerView && isSellerBlocked}
              />
            );
          })()
        ) : (
          <div className="profile-panel">
            {(detailIsPurchase ? purchasesLoading : ordersLoading)
              ? <EmptyState label={detailIsPurchase ? 'Cargando la compra…' : 'Cargando el pedido…'} />
              : <EmptyState label="No encontramos ese pedido en tu cuenta." />}
          </div>
        )
      ) : activeTab === 'pedidos' && (
        isSeller ? (
          <SellerOrdersPanel
            orders={orders || []}
            sellerId={user?.sellerId}
            onSelectOrder={openOrderDetail}
            onUpdateStatus={handleUpdateOrderStatus}
            onRegisterSaleReceipt={isSellerBlocked ? undefined : handleRegisterSaleReceipt}
            readOnly={isSellerBlocked}
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
            {(orders || []).length === 0 ? <EmptyState label="Aún no has realizado pedidos." /> : <div className="profile-orders-cards-grid">{orders.map((order) => <OrderCard key={order.id} order={order} mode="buyer" onSelectOrder={openOrderDetail} onUpdateStatus={handleUpdateOrderStatus} onRetryPayment={handleRetryPayment} onCancelOrder={handleCancelOrder} />)}</div>}
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
          {purchasesLoading
            ? <EmptyState label="Cargando tus compras…" />
            : (purchases || []).length === 0
              ? <EmptyState label="Aún no has comprado repuestos a otras tiendas." />
              : (
                <div className="profile-orders-cards-grid">
                  {purchases.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      mode="buyer"
                      onSelectOrder={openPurchaseDetail}
                      onUpdateStatus={handlePurchaseUpdateStatus}
                      onRetryPayment={handleRetryPayment}
                      onCancelOrder={handleCancelOrder}
                    />
                  ))}
                </div>
              )}
        </div>
      )}
    </>
  );
}
