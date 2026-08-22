import { useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isOwnAd, OWN_AD_BLOCK_MESSAGES } from '../../data/automotiveAdsData';

/**
 * Identifica los anuncios publicados por la propia sesion para impedir que su
 * dueño se llame, se escriba o se agende a si mismo. Es la contraparte web de
 * `mobile/hooks/use-ad-ownership.ts`.
 *
 * Se compara por proveedor, usuario y correo porque un anuncio puede haberse
 * creado antes de que la sesion tuviera todos esos datos.
 */
export function useAdOwnership() {
  const { user } = useAuth();

  const identity = useMemo(() => ({
    userId: user?.userId ?? user?.id ?? user?.buyerId ?? null,
    sellerId: user?.sellerId ?? null,
    email: user?.email ?? null
  }), [user?.userId, user?.id, user?.buyerId, user?.sellerId, user?.email]);

  const isOwn = useCallback((ad) => isOwnAd(ad, identity), [identity]);

  /** Devuelve el mensaje a mostrar cuando la accion debe bloquearse, o null si puede seguir. */
  const blockIfOwnAd = useCallback(
    (ad, action) => (isOwn(ad) ? OWN_AD_BLOCK_MESSAGES[action] : null),
    [isOwn]
  );

  return { identity, isOwn, blockIfOwnAd, storeName: user?.storeName ?? null };
}
