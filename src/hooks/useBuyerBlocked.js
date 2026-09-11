import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getBuyerAccountStatusApi } from '../services/api';
import { qk } from '../services/queryKeys';

const BUYER_ROLES = ['BUYER', 'CLIENTE', 'CLIENT'];

/**
 * Contraparte de useSellerBlocked para el lado comprador. Antes de este hook, el
 * bloqueo de comprador viajaba en el login (`buyerBlocked`) pero nada de la app lo
 * usaba: el header, el carrito y el checkout seguian funcionando con total
 * normalidad para una cuenta comprador suspendida.
 */
export function useBuyerBlocked() {
  const { user, role } = useAuth();
  const isBuyer = BUYER_ROLES.includes(role);
  const buyerId = isBuyer ? (user?.buyerId || null) : null;

  const { data } = useQuery({
    queryKey: qk.buyerAccountStatus(buyerId),
    queryFn: ({ signal }) => getBuyerAccountStatusApi(buyerId, { signal }),
    enabled: Boolean(buyerId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    // Con la cuenta bloqueada este endpoint tambien puede responder 403 si el backend
    // no tiene el fix del filtro: el respaldo es el `buyerBlocked` que trajo el login.
    retry: false,
  });

  const isBlocked = isBuyer && Boolean(data?.buyerBlocked ?? user?.buyerBlocked);
  const blockReason = data?.blockReason || user?.buyerBlockReason || 'Tu cuenta ha sido suspendida.';

  return {
    isBuyer,
    isBlocked,
    blockReason,
  };
}

export default useBuyerBlocked;
