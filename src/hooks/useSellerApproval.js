import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getSellerStoreApi } from '../services/api';
import { qk } from '../services/queryKeys';

const SELLER_ROLES = ['SELLER', 'PROVIDER', 'PROVEEDOR'];

/** `EstadoTienda` del backend. Solo APPROVED habilita el panel de vendedor. */
export const STORE_APPROVED = 'APPROVED';

/**
 * Aprobacion de la tienda. La otorga EXCLUSIVAMENTE el backoffice: al aprobar la
 * validacion, `ValidacionBackofficeService` escribe tres señales a la vez
 * (`VerificacionProveedor.reviewStatus`, `Proveedor.status = "verified"` y
 * `Tienda.status = APPROVED`). Se usa `Tienda.status` porque es el estado de la tienda,
 * ya viaja en `GET /proveedores/{id}/tienda` y es el que pinta el chip del panel.
 *
 * Comparte `queryKey` con la consulta del panel, asi que React Query la deduplica.
 *
 * OJO: esto es una puerta de la UI, no un permiso. El backend NO exige aprobacion para
 * publicar, vender ni pedir retiros -ni `RetiroProveedorService` ni los servicios de
 * inventario consultan `VerificacionProveedor`-, asi que un POST directo sigue pasando.
 * Cuando se cierre esa parte, va en el backend y esta puerta queda como el aviso.
 */
export function useSellerApproval() {
  const { user, role } = useAuth();
  const isSeller = SELLER_ROLES.includes(role);
  const sellerId = isSeller ? (user?.sellerId || user?.proveedorId || null) : null;

  const { data, isLoading, isError } = useQuery({
    queryKey: qk.sellerStore(sellerId),
    queryFn: ({ signal }) => getSellerStoreApi(sellerId, { signal }),
    enabled: Boolean(sellerId),
    staleTime: 60 * 1000,
    retry: false,
  });

  const storeStatus = data?.status || null;

  return {
    isSeller,
    storeStatus,
    isApproved: String(storeStatus || '').toUpperCase() === STORE_APPROVED,
    // Mientras no se sepa el estado no se decide nada: redirigir con la consulta en
    // vuelo sacaba del panel a una tienda aprobada por un parpadeo. Un error tampoco
    // decide -no es lo mismo "no aprobada" que "no pudimos preguntarlo"-.
    isUnknown: isLoading || isError || !storeStatus,
  };
}

export default useSellerApproval;
