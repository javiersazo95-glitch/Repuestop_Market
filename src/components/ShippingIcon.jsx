import { resolveShippingService, shippingKindIcon } from '../data/shippingMethods';

/**
 * Ícono del método de envío con la convención de todo RepuesTop: tienda con toldo para el
 * retiro, bicicleta dentro de la comuna y camión fuera (o sin método reconocido). Recibe el
 * texto del método o, si ya se conoce, el tipo de paquete (`pickup` / `local` / `courier`).
 */
export default function ShippingIcon({ method, kind, size = 14, ...props }) {
  const Icon = kind ? shippingKindIcon(kind) : resolveShippingService(method).icon;
  return <Icon size={size} {...props} />;
}
