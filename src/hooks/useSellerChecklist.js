import { useState } from 'react';
import { confirmOrderCompatibilityApi, confirmOrderStockDeliveryApi } from '../services/api';

/**
 * Pasos 1 (stock y entrega) y 2 (compatibilidad) de "Confirmar pedido", compartidos por el
 * detalle del pedido y la tarjeta del listado: los dos abren el mismo `SaleReceiptModal`.
 *
 * El backend exige ambos pasos antes de pasar a EN_PREPARACION cuando
 * `REPUESTOP_PEDIDO_CHECKLIST_EXIGIR` está encendido. Sin el popup, el vendedor solo veía el
 * error ("Confirma el stock y la entrega...") y no tenía dónde hacerlo.
 *
 * Cada confirmación devuelve el pedido completo: se guarda el checklist devuelto en vez de
 * pedirle un refresh al padre, porque el resto del pedido no cambia con estas acciones. Se
 * guarda junto al id del pedido para no arrastrarlo a otro pedido si el componente se reutiliza.
 */
export default function useSellerChecklist(order) {
  const [local, setLocal] = useState(null);
  const localDelPedido = local && local.pedidoId === order?.id ? local.checklist : null;
  const checklist = localDelPedido ?? order?.checklistVendedor ?? null;
  const orderWithChecklist = localDelPedido ? { ...order, checklistVendedor: localDelPedido } : order;
  // Pedidos sin checklist (anteriores al feature o el comprador) no tienen pasos previos.
  const stepsReady = !checklist
    || Boolean(checklist.stockEntregaConfirmadaAt && checklist.compatibilidadConfirmadaAt);

  const guardar = (actualizado) => {
    setLocal({ pedidoId: order?.id, checklist: actualizado?.checklistVendedor ?? null });
  };

  const confirmStock = async () => {
    guardar(await confirmOrderStockDeliveryApi(order.id));
  };

  const confirmCompatibility = async (pedidoItemIds) => {
    guardar(await confirmOrderCompatibilityApi(order.id, pedidoItemIds));
  };

  return { checklist, orderWithChecklist, stepsReady, confirmStock, confirmCompatibility };
}
