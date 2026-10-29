/**
 * Etiquetas de los motivos de reclamo de un pedido.
 *
 * El formulario guarda el CODIGO (`incompatible`, `payout_issue`, ...) en
 * `Pedido.motivoReclamo`, y de ahi el backend lo copia a `Mediacion.motivo`
 * (`MediacionChatService:84`). Ese mismo valor vuelve como `blockReason` en
 * `GET /proveedores/{id}/estado-cuenta`, asi que sin traducirlo el vendedor
 * bloqueado leia "Motivo actual: incompatible" -un codigo de maquina- en vez de
 * la frase que eligio el comprador.
 *
 * Es la UNICA fuente de los textos: `HelpContactForm` arma sus listas desde aqui.
 * Un codigo nuevo que se agregue alla sin agregarlo aca aparece crudo en pantalla,
 * no vacio, asi que el sintoma se ve.
 */
import { remoteConfig } from '../remoteConfig/remoteConfig';

// Mantenedor comun (2026-10-20): la lista vigente es `MOTIVO_RECLAMO` (`valor` = codigo). Estos
// textos son el respaldo y siguen traduciendo los codigos que el dueno oculte, porque un reclamo
// viejo con ese codigo tiene que seguir leyendose.
export const CLAIM_REASON_LABELS_FALLBACK = {
  incompatible: 'Pieza incompatible con mi vehículo/modelo',
  defective: 'Pieza en mal estado / Defectuosa / Dañada',
  not_received: 'El producto no ha llegado / Retraso en la entrega',
  wrong_purchase: 'Me equivoqué de compra / Quiero cancelar el pedido',
  wrong_product: 'Producto incorrecto o incompleto (faltan piezas)',
  buyer_remorse: 'Me arrepentí de la compra / Solicitar devolución',
  delay_preparation: 'El vendedor tarda demasiado en preparar o enviar el producto',
  store_closed: 'Fui a retirar y el local estaba cerrado',
  refused_delivery: 'El vendedor se niega a entregar el producto',
  no_contact: 'No logro contactar al vendedor',
  buyer_no_response: 'El comprador no responde o rechazó la entrega',
  courier_issue: 'Problema con la empresa de transporte (Courier)',
  payout_issue: 'Error en la liquidación o procesamiento del pago',
  disputed_return: 'Devolución de producto dañada o incompleta',
  out_of_stock: 'Problema con el stock / No puedo procesar el pedido',
  buyer_no_show: 'El comprador no se ha presentado a retirar',
  other: 'Otro',
};

/**
 * Traduce el codigo a su frase. Si el motivo no es un codigo conocido se devuelve
 * tal cual: cuando el usuario elige "Otro" el backend guarda el texto que escribio,
 * que ya es legible.
 */
export function claimReasonLabel(code) {
  const key = String(code || '').trim();
  if (!key) return '';
  const remote = remoteClaimReasons()?.find((opcion) => opcion?.valor === key);
  return remote?.etiqueta || CLAIM_REASON_LABELS_FALLBACK[key] || key;
}

/** ¿Es un codigo de motivo conocido (de la lista del mantenedor o del respaldo)? */
export function isClaimReasonCode(code) {
  const key = String(code || '').trim();
  if (!key) return false;
  return Object.prototype.hasOwnProperty.call(CLAIM_REASON_LABELS_FALLBACK, key)
    || Boolean(remoteClaimReasons()?.some((opcion) => opcion?.valor === key));
}

/**
 * Arma los pares [etiqueta, codigo] que consume el selector del formulario. Con la lista del
 * mantenedor se omiten los motivos que el dueno oculto; `other` queda siempre, para que el
 * formulario nunca se quede sin una opcion.
 */
export function claimReasonPairs(...codes) {
  const remote = remoteClaimReasons();
  const visible = remote
    ? codes.filter((code) => code === 'other' || remote.some((opcion) => opcion?.valor === code))
    : codes;
  return visible.map((code) => [claimReasonLabel(code), code]);
}

function remoteClaimReasons() {
  return remoteConfig.lista('MOTIVO_RECLAMO', null);
}
