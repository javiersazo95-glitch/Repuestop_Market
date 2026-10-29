/**
 * Indice de los respaldos locales del Mantenedor comun.
 *
 * Cada constante vive junto a su consumidor (asi el respaldo se lee al lado del codigo que lo usa)
 * y aca solo se re-exporta, para ver de un vistazo que usa el Market cuando el bootstrap no esta y
 * para armar o validar fixtures (`fixtures/bootstrap.market.json`).
 *
 * Contrato: `RespuesTop-mono-repo/docs/arquitectura/contrato-mantenedor-bootstrap.md`.
 */

// Catalogos (`categorias`, `marcasVehiculo`)
export {
  CATEGORY_VISUALS_FALLBACK,
  HEADER_CATEGORIES_FALLBACK,
  SIDEBAR_CATEGORIES_FALLBACK,
} from '../data/categoriesFallback';
export { VEHICLE_BRAND_LOGO_SLUGS_FALLBACK } from '../data/vehicleBrands';

// Listas (`listas.<CODIGO>`)
export { PART_CONDITIONS_FALLBACK } from '../data/productConditions'; // CONDICION_PRODUCTO
export { PRODUCT_WARRANTY_PRESETS_FALLBACK } from '../utils/productWarranty'; // GARANTIA_PRODUCTO
export { SHIPPING_METHOD_DEFS_FALLBACK } from '../data/shippingMethods'; // METODO_ENVIO
export { CARRIERS_FALLBACK } from '../data/carrierTracking'; // COURIER
export { BANKS_FALLBACK } from '../data/banks'; // BANCO
export {
  CANCELLATION_REASON_HINTS_FALLBACK,
  CANCELLATION_REASON_LABELS_FALLBACK,
} from '../data/cancellationReason'; // MOTIVO_CANCELACION_PEDIDO
export { CLAIM_REASON_LABELS_FALLBACK } from '../data/claimReason'; // MOTIVO_RECLAMO
export { COMBUSTIBLES_FALLBACK } from '../data/vehicleOptions'; // COMBUSTIBLE

// Parametros (`parametros.<clave>`)
export {
  COMMISSION_IVA, // comision.iva
  COMMISSION_IVA_INCLUDED, // comision.iva.incluido
  FLOW_IVA, // pasarela.iva
  FLOW_RATE_BASE, // pasarela.porcentaje
  FOUNDER_APP_RATE, // comision.fundador.porcentaje
  STANDARD_APP_RATE, // comision.tasa.alta
} from '../utils/pricing';
export {
  AUTO_FINALIZATION_DAYS_FALLBACK, // pedido.autofinalizacion.dias
  AUTO_RECEPTION_DAYS_FALLBACK, // pedido.autorecepcion.dias
  AUTO_RECEPTION_LOCAL_DAYS_FALLBACK, // pedido.autorecepcion.local.dias
  DELIVERY_VETO_WINDOW_HOURS_FALLBACK, // pedido.entregadeclarada.veto.horas
  FUNDS_RELEASE_DAYS_FALLBACK, // retiro.retencion.retracto.dias
  PAYMENT_WINDOW_MINUTES_FALLBACK, // pedido.expiracion.minutos
} from '../data/orderDeadlines';

/**
 * Flags que consume el Market (contrato, seccion 5). Todos valen `true` sin bootstrap salvo
 * `market.checkout.pago-simulado`, cuyo respaldo es `__DEPLOY_BRANCH__ !== 'main'`.
 */
export const MARKET_FLAGS = Object.freeze([
  'market.home.hero-patente',
  'market.home.ultimos-agregados',
  'market.home.tiendas-nuevas',
  'market.home.testimonios',
  'market.global.aviso-app-movil',
  'market.global.cookie-banner',
  'market.global.modal-reaceptacion-terminos',
  'market.global.modal-adhesion-vendedor',
  'market.global.prompt-declaracion-iva',
  'market.checkout.pago-simulado',
  'market.header.megamenu-categorias',
  'market.footer.enlaces-categorias',
  'market.nav.mural-anuncios',
  'market.perfil.vendedor.ventas',
  'market.perfil.vendedor.mis-compras',
  'market.perfil.vendedor.mi-tienda',
  'market.perfil.vendedor.soporte',
  'market.perfil.comprador.mis-compras',
  'market.perfil.comprador.mi-cuenta',
  'market.perfil.comprador.soporte',
]);
