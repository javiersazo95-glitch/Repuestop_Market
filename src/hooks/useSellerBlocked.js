import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getSellerAccountStatusApi } from '../services/api';
import { qk } from '../services/queryKeys';
import { CLAIM_REASON_LABELS, claimReasonLabel } from '../data/claimReason';
import { legacySuspension, normalizeSuspension } from '../utils/accountSuspension';

const SELLER_ROLES = ['SELLER', 'PROVIDER', 'PROVEEDOR'];

/**
 * Estado de bloqueo de la tienda, para cualquier vista.
 *
 * El bloqueo NO es solo del rol vendedor: `JwtAuthenticationFilter` responde 403 a todo
 * lo que no este en su whitelist, y el lado comprador -carrito, checkout, pedidos del
 * usuario, favoritos- esta entero afuera. O sea que una cuenta bloqueada tampoco puede
 * comprar. Por eso los accesos de compra se esconden en vez de dejar que el usuario
 * choque contra un 403 mudo a mitad del checkout.
 *
 * La consulta comparte `queryKey` con la del panel de perfil, asi que React Query la
 * deduplica: montar el hook en el header no agrega una peticion por pantalla.
 */
export function useSellerBlocked() {
  const { user, role } = useAuth();
  const isSeller = SELLER_ROLES.includes(role);
  const sellerId = isSeller ? (user?.sellerId || user?.proveedorId || null) : null;

  const { data } = useQuery({
    queryKey: qk.sellerAccountStatus(sellerId),
    queryFn: ({ signal }) => getSellerAccountStatusApi(sellerId, { signal }),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    // Con la tienda bloqueada este endpoint tambien puede responder 403 si el backend
    // no tiene el fix del filtro: el respaldo es el `sellerBlocked` que trajo el login.
    retry: false,
  });

  const isBlocked = isSeller && Boolean(data?.sellerBlocked ?? user?.sellerBlocked);
  const rawReason = data?.blockReason || user?.sellerBlockReason;
  // H59 fase 3 (pruebas de lanzamiento, 1-oct): la tienda suspendida SIN fraude queda en "modo
  // cumplimiento": no vende ni toca su inventario, pero completa lo que ya le pagaron (despacho,
  // boleta, PIN, cancelacion) dentro de su plazo. Si no, el backend lo cancela y reembolsa solo.
  const complianceMode = isBlocked && Boolean(data?.complianceMode ?? user?.sellerComplianceMode);

  // Plazo, contador y revision (pruebas en dev, 2026-10-09); sin el payload nuevo, los campos del login.
  const suspension = !isBlocked ? null
    : (normalizeSuspension(data?.suspension) ?? normalizeSuspension(user?.suspension) ?? legacySuspension({
      blocked: true,
      reason: rawReason ? claimReasonLabel(rawReason) : null,
      endsAt: user?.suspendedUntil,
      canAppeal: user?.sellerCanAppeal,
      complianceMode,
    }));

  return {
    isSeller,
    isBlocked,
    suspension,
    // El backend guarda ahi el CODIGO del reclamo del comprador, no una frase.
    blockReason: rawReason ? claimReasonLabel(rawReason) : '',
    // H62 (pruebas de lanzamiento, 30-sep): solo es "el reclamo que origino la mediacion" si
    // viene un codigo de reclamo. Una suspension directa trae el motivo que escribio el
    // operador y se mostraba como si fuera el reclamo de un comprador.
    blockReasonIsClaim: Boolean(rawReason) && Object.prototype.hasOwnProperty.call(CLAIM_REASON_LABELS, String(rawReason).trim()),
    complianceMode,
    // [{ orderId, orderNumber, type: 'DESPACHO' | 'RETIRO', deadline }], el mas proximo primero.
    complianceDeadlines: complianceMode && Array.isArray(data?.complianceDeadlines) ? data.complianceDeadlines : [],
  };
}

export default useSellerBlocked;
