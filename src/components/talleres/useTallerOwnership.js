import { useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isOwnTaller, OWN_TALLER_BLOCK_MESSAGES } from '../../data/talleresData';

/**
 * Identifica el taller de la propia sesion para impedir que su dueño se llame, se escriba o se
 * agende a si mismo. Es la contraparte web de `mobile/hooks/use-taller-ownership.ts`.
 */
export function useTallerOwnership() {
  const { user } = useAuth();

  const identity = useMemo(() => ({
    userId: user?.userId ?? user?.id ?? user?.buyerId ?? null,
    email: user?.email ?? null
  }), [user?.userId, user?.id, user?.buyerId, user?.email]);

  const isOwn = useCallback((taller) => isOwnTaller(taller, identity), [identity]);

  /** Devuelve el mensaje a mostrar cuando la accion debe bloquearse, o null si puede seguir. */
  const blockIfOwnTaller = useCallback(
    (taller, action) => (isOwn(taller) ? OWN_TALLER_BLOCK_MESSAGES[action] : null),
    [isOwn]
  );

  return { identity, isOwn, blockIfOwnTaller };
}
