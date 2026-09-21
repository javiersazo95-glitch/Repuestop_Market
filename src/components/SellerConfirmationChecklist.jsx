import React, { useMemo, useState } from 'react';
import { AlertTriangle, Car, CheckCircle2, Copy, Loader2, MessageSquare, Package } from 'lucide-react';

/**
 * Pasos 1 y 2 de "Confirmar pedido" (stock/entrega y compatibilidad). Se embebe dentro de
 * `SaleReceiptModal`, que agrega el paso 3 (boleta) y el envío final: los tres pasos viven en
 * un solo modal con un solo botón de avance, no como tarjeta suelta en la página con botones
 * propios compitiendo con el de "Confirmar pedido".
 *
 * Solo lo ve el vendedor — el backend lo emite detrás de un guard por `proveedorId`. El estado
 * de cada paso lo calcula el backend y llega en `order.checklistVendedor`: los clientes no
 * vuelven a espejar las reglas.
 *
 * Ver docs/planes/plan_validacion_compatibilidad_pedido.md en el monorepo.
 */

const ETIQUETA_RESULTADO = {
  UNIVERSAL: { texto: 'Sirve para cualquier vehículo', tono: 'ok' },
  COMPATIBLE: { texto: 'Compatible', tono: 'ok' },
  NO_COINCIDE: { texto: 'No coincide', tono: 'alerta' },
  SIN_DATOS: { texto: 'Sin información', tono: 'neutro' },
};

function descripcionVehiculo(order) {
  const partes = [order?.vehiculoMarca, order?.vehiculoModelo, order?.vehiculoAnio].filter(Boolean);
  if (partes.length === 0 && order?.vehiculoPatente) return `patente ${order.vehiculoPatente}`;
  if (partes.length === 0) return 'el vehículo del comprador';
  return partes.join(' ');
}

function Paso({ numero, titulo, listo, bloqueado, children }) {
  return (
    <div className={`seller-checklist-step ${listo ? 'is-done' : ''} ${bloqueado ? 'is-locked' : ''}`}>
      <div className="seller-checklist-step-head">
        <span className="seller-checklist-step-num">
          {listo ? <CheckCircle2 size={16} /> : numero}
        </span>
        <strong>{titulo}</strong>
      </div>
      {!listo && !bloqueado && <div className="seller-checklist-step-body">{children}</div>}
    </div>
  );
}

export default function SellerConfirmationChecklist({
  order,
  isStorePickup,
  onConfirmStock,
  onConfirmCompatibility,
  onOpenBuyerChat,
}) {
  const checklist = order?.checklistVendedor;
  const [busyStep, setBusyStep] = useState(null);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  const items = useMemo(() => checklist?.items ?? [], [checklist]);
  // Los universales no se validan: el paso 2 solo existe por los demás.
  const itemsAValidar = useMemo(() => items.filter((item) => item.resultado !== 'UNIVERSAL'), [items]);
  const hayIncompatibles = itemsAValidar.some((item) => item.resultado === 'NO_COINCIDE');

  const mensajeParaComprador = useMemo(() => (
    `Hola, revisé tu pedido y la pieza que compraste no calza con ${descripcionVehiculo(order)}. `
    + 'Puedo ofrecerte la correcta o, si prefieres, cancelamos y te devolvemos el dinero. '
    + '¿Cómo prefieres seguir?'
  ), [order]);

  if (!checklist) return null;

  const stockListo = Boolean(checklist.stockEntregaConfirmadaAt);
  const compatibilidadLista = Boolean(checklist.compatibilidadConfirmadaAt);

  const ejecutar = async (paso, accion) => {
    setBusyStep(paso);
    setError('');
    try {
      await accion();
    } catch (err) {
      setError(err?.message || 'No se pudo completar este paso. Intenta de nuevo.');
    } finally {
      setBusyStep(null);
    }
  };

  const copiarMensaje = async () => {
    try {
      await navigator.clipboard.writeText(mensajeParaComprador);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setError('No se pudo copiar. Selecciona el texto y cópialo a mano.');
    }
  };

  return (
    <div className="seller-checklist" aria-label="Pasos previos a la boleta">
      <Paso numero="1" titulo="Stock y entrega" listo={stockListo}>
        <p className="seller-checklist-hint">
          {isStorePickup
            ? 'El comprador retira en tu tienda.'
            : 'Revisa que puedas despachar a la dirección del pedido.'}
        </p>
        <button
          type="button"
          className="btn-auth-primary seller-checklist-action"
          disabled={busyStep === 'stock'}
          onClick={() => ejecutar('stock', onConfirmStock)}
        >
          {busyStep === 'stock' ? <Loader2 size={15} className="spin-icon" /> : <Package size={15} />}
          <span>Confirmo que tengo el stock y puedo cumplir la entrega</span>
        </button>
      </Paso>

      <Paso numero="2" titulo="Compatibilidad" listo={compatibilidadLista} bloqueado={!stockListo}>
        <div className="seller-checklist-vehicle">
          <Car size={15} />
          <span>
            {order?.vehiculoOrigen && order.vehiculoOrigen !== 'NO_INFORMADO'
              ? <>Vehículo del comprador: <strong>{descripcionVehiculo(order)}</strong>
                {order?.vehiculoPatente ? ` · ${order.vehiculoPatente}` : ''}</>
              : 'Sin información del vehículo. Confirma según tu criterio.'}
          </span>
        </div>

        {itemsAValidar.length === 0 ? (
          <p className="seller-checklist-hint">
            Todos los repuestos de este pedido sirven para cualquier vehículo.
          </p>
        ) : (
          <ul className="seller-checklist-items">
            {itemsAValidar.map((item) => {
              const etiqueta = ETIQUETA_RESULTADO[item.resultado] ?? ETIQUETA_RESULTADO.SIN_DATOS;
              return (
                <li key={item.pedidoItemId} className={`seller-checklist-item tone-${etiqueta.tono}`}>
                  <span className="seller-checklist-item-name">{item.nombre}</span>
                  <span className={`seller-checklist-badge tone-${etiqueta.tono}`}>
                    {etiqueta.tono === 'alerta' ? <AlertTriangle size={13} /> : null}
                    {etiqueta.texto}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {hayIncompatibles && (
          <div className="seller-checklist-warning">
            <p>
              <strong>Hay un repuesto que no calza con el vehículo del comprador.</strong> Antes de
              seguir, conviene avisarle: puedes ofrecerle la pieza correcta o cancelar y devolverle
              el dinero.
            </p>
            <blockquote className="seller-checklist-message">{mensajeParaComprador}</blockquote>
            <div className="seller-checklist-warning-actions">
              <button type="button" className="btn-auth-secondary" onClick={copiarMensaje}>
                <Copy size={14} />
                <span>{copiado ? 'Mensaje copiado' : 'Copiar mensaje'}</span>
              </button>
              {onOpenBuyerChat && (
                <button
                  type="button"
                  className="btn-auth-secondary"
                  onClick={() => onOpenBuyerChat(mensajeParaComprador)}
                >
                  <MessageSquare size={14} />
                  <span>Abrir chat con el comprador</span>
                </button>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn-auth-primary seller-checklist-action"
          disabled={busyStep === 'compatibilidad'}
          onClick={() => ejecutar('compatibilidad', () => onConfirmCompatibility())}
        >
          {busyStep === 'compatibilidad' ? <Loader2 size={15} className="spin-icon" /> : <CheckCircle2 size={15} />}
          <span>
            {hayIncompatibles
              ? 'Confirmar de todas formas y seguir'
              : 'Confirmo la compatibilidad de estos repuestos'}
          </span>
        </button>
      </Paso>

      {error && <p className="confirm-dialog-error">{error}</p>}
    </div>
  );
}
