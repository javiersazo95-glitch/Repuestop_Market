import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Car, Check, CheckCircle2, Copy, EyeOff, Loader2, Lock, MessageSquare, Package, ReceiptText, ShieldCheck,
} from 'lucide-react';

/**
 * Checklist de "Confirmar pedido": 1) stock y entrega, 2) compatibilidad y 3) boleta. Se embebe
 * dentro de `SaleReceiptModal`, que entrega el contenido del paso 3 (datos de la venta y el PDF)
 * por `boleta` y pone el botón final: los tres pasos viven en un solo modal con un solo botón de
 * avance, no como tarjeta suelta en la página con botones propios compitiendo con el de
 * "Confirmar pedido".
 *
 * Solo lo ve el vendedor — el backend lo emite detrás de un guard por `proveedorId`. El estado
 * de los pasos 1 y 2 lo calcula el backend y llega en `order.checklistVendedor`: los clientes no
 * vuelven a espejar las reglas. El paso 3 queda listo cuando hay un PDF adjunto (o ya cargado).
 *
 * Ver docs/planes/plan_validacion_compatibilidad_pedido.md en el monorepo.
 */

const ETIQUETA_RESULTADO = {
  UNIVERSAL: { texto: 'Sirve para cualquier vehículo', tono: 'ok' },
  COMPATIBLE: { texto: 'Compatible', tono: 'ok' },
  NO_COINCIDE: { texto: 'No coincide', tono: 'alerta' },
  SIN_DATOS: { texto: 'Sin información', tono: 'neutro' },
};

// Marca, modelo, año y versión, y la patente una sola vez. Antes la patente salía dos veces
// ("patente ABCD12 · ABCD12") y, sin modelo, el vendedor no tenía contra qué revisar
// (pruebas de lanzamiento H26: el backend ahora completa el vehículo con la patente guardada).
function descripcionVehiculo(order) {
  const partes = [order?.vehiculoMarca, order?.vehiculoModelo, order?.vehiculoAnio].filter(Boolean);
  const version = order?.vehiculoVersion ? ` ${order.vehiculoVersion}` : '';
  const patente = order?.vehiculoPatente ? `patente ${order.vehiculoPatente}` : '';
  if (partes.length === 0 && patente) return `${patente} (marca y modelo no identificados)`;
  if (partes.length === 0) return 'el vehículo del comprador';
  return `${partes.join(' ')}${version}${patente ? ` · ${patente}` : ''}`;
}

function horaConfirmacion(fecha) {
  const d = fecha ? new Date(fecha) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Paso({ numero, icono: Icono, titulo, descripcion, estado, resumen, children }) {
  const hecho = estado === 'hecho';
  const bloqueado = estado === 'bloqueado';
  const etiquetaEstado = { hecho: 'Completado', activo: 'En curso', bloqueado: 'Pendiente' }[estado];
  return (
    <li className={`seller-checklist-step is-${estado}`} aria-current={estado === 'activo' ? 'step' : undefined}>
      <div className="seller-checklist-rail" aria-hidden="true">
        <span className="seller-checklist-step-num">
          {hecho ? <Check size={15} strokeWidth={3} /> : bloqueado ? <Lock size={12} /> : numero}
        </span>
      </div>
      <div className="seller-checklist-card">
        <div className="seller-checklist-step-head">
          <span className="seller-checklist-step-icon"><Icono size={16} /></span>
          <div className="seller-checklist-step-title">
            <small>Paso {numero}</small>
            <strong>{titulo}</strong>
          </div>
          <span className={`seller-checklist-status is-${estado}`}>{etiquetaEstado}</span>
        </div>
        {hecho && resumen && <p className="seller-checklist-summary"><CheckCircle2 size={13} />{resumen}</p>}
        {bloqueado && <p className="seller-checklist-hint">{descripcion}</p>}
        {!hecho && !bloqueado && <div className="seller-checklist-step-body">{children}</div>}
      </div>
    </li>
  );
}

/** Casilla de declaración: el vendedor "marca" el paso y eso lo registra en el backend. */
function Declaracion({ ocupado, alerta, onClick, children }) {
  return (
    <button
      type="button"
      className={`seller-checklist-check ${alerta ? 'is-alerta' : ''}`}
      disabled={ocupado}
      onClick={onClick}
    >
      <span className="seller-checklist-checkbox" aria-hidden="true">
        {ocupado ? <Loader2 size={13} className="spin-icon" /> : <Check size={13} strokeWidth={3} />}
      </span>
      <span className="seller-checklist-check-text">{children}</span>
    </button>
  );
}

export default function SellerConfirmationChecklist({
  order,
  isStorePickup,
  onConfirmStock,
  onConfirmCompatibility,
  onOpenBuyerChat,
  boleta,
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
  const boletaLista = Boolean(boleta?.lista);
  const completados = [stockListo, compatibilidadLista, boletaLista].filter(Boolean).length;

  const estadoStock = stockListo ? 'hecho' : 'activo';
  const estadoCompatibilidad = compatibilidadLista ? 'hecho' : stockListo ? 'activo' : 'bloqueado';
  // El paso 3 sigue abierto con el PDF adjunto: ahí se ve el archivo y el botón final confirma.
  const estadoBoleta = !(stockListo && compatibilidadLista) ? 'bloqueado' : 'activo';

  const pasoActual = !stockListo ? 1 : !compatibilidadLista ? 2 : 3;
  const tituloActual = ['Stock y entrega', 'Compatibilidad', 'Boleta o factura'][pasoActual - 1];

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

  const confirmadoStock = horaConfirmacion(checklist.stockEntregaConfirmadaAt);
  const confirmadoCompat = horaConfirmacion(checklist.compatibilidadConfirmadaAt);

  return (
    <div className="seller-checklist" aria-label="Pasos para confirmar el pedido">
      <div className="seller-checklist-progress">
        <div className="seller-checklist-progress-head">
          <span>
            {completados === 3
              ? <>Todo listo para confirmar</>
              : <>Paso {pasoActual} de 3 · <strong>{tituloActual}</strong></>}
          </span>
          <span className="seller-checklist-progress-count">{completados}/3 completados</span>
        </div>
        <div className="seller-checklist-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={completados}>
          {[stockListo, compatibilidadLista, boletaLista].map((listo, i) => (
            <span key={i} className={listo ? 'is-done' : i + 1 === pasoActual ? 'is-active' : ''} />
          ))}
        </div>
        <p className="seller-checklist-private">
          <EyeOff size={12} />
          Solo tú ves estos pasos. Revisar la compatibilidad antes de emitir la boleta evita
          devoluciones y notas de crédito.
        </p>
      </div>

      <ol className="seller-checklist-steps">
        <Paso
          numero={1}
          icono={Package}
          titulo="Stock y entrega"
          estado={estadoStock}
          resumen={`Stock y entrega confirmados${confirmadoStock ? ` · ${confirmadoStock}` : ''}`}
        >
          <p className="seller-checklist-hint">
            {isStorePickup
              ? 'El comprador retira en tu tienda. Verifica que tengas las piezas disponibles.'
              : 'Verifica que tengas las piezas y que puedas despachar a la dirección del pedido.'}
          </p>
          <Declaracion ocupado={busyStep === 'stock'} onClick={() => ejecutar('stock', onConfirmStock)}>
            <strong>Tengo el stock y puedo cumplir la entrega</strong>
            <small>Marca para confirmar este paso</small>
          </Declaracion>
        </Paso>

        <Paso
          numero={2}
          icono={ShieldCheck}
          titulo="Compatibilidad"
          descripcion="Se habilita al confirmar el stock y la entrega."
          estado={estadoCompatibilidad}
          resumen={`Compatibilidad revisada${confirmadoCompat ? ` · ${confirmadoCompat}` : ''}`}
        >
          <div className="seller-checklist-vehicle">
            <Car size={15} />
            <span>
              {order?.vehiculoOrigen && order.vehiculoOrigen !== 'NO_INFORMADO'
                ? <>Vehículo del comprador: <strong>{descripcionVehiculo(order)}</strong></>
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
                      {etiqueta.tono === 'alerta' ? <AlertTriangle size={12} /> : etiqueta.tono === 'ok' ? <Check size={12} strokeWidth={3} /> : null}
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
                <AlertTriangle size={15} />
                <span>
                  <strong>Hay un repuesto que no calza con el vehículo del comprador.</strong> Antes
                  de seguir, conviene avisarle: puedes ofrecerle la pieza correcta o cancelar y
                  devolverle el dinero.
                </span>
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

          <Declaracion
            ocupado={busyStep === 'compatibilidad'}
            alerta={hayIncompatibles}
            onClick={() => ejecutar('compatibilidad', () => onConfirmCompatibility())}
          >
            <strong>
              {hayIncompatibles
                ? 'Entiendo la advertencia y confirmo de todas formas'
                : 'Revisé que estos repuestos son compatibles'}
            </strong>
            <small>Marca para confirmar este paso</small>
          </Declaracion>
        </Paso>

        <Paso
          numero={3}
          icono={ReceiptText}
          titulo="Boleta o factura"
          descripcion="Se habilita al completar los pasos 1 y 2. Así no emites el documento antes de revisar el pedido."
          estado={estadoBoleta}
        >
          {boleta?.contenido}
        </Paso>
      </ol>

      {error && <p className="confirm-dialog-error">{error}</p>}
    </div>
  );
}
