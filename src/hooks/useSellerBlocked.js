import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getSellerAccountStatusApi } from '../services/api';
import { qk } from '../services/queryKeys';
import { claimReasonLabel } from '../data/claimReason';

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

  return {
    isSeller,
    isBlocked,
    // El backend guarda ahi el CODIGO del reclamo del comprador, no una frase.
    blockReason: rawReason ? claimReasonLabel(rawReason) : '',
    blockReasonIsClaim: Boolean(rawReason),
  };
}

export default useSellerBlocked;
