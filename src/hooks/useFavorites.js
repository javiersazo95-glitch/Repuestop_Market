import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { addFavoriteApi, removeFavoriteApi, getFavoritesApi } from '../services/api';
import { qk } from '../services/queryKeys';

/**
 * Favoritos del comprador, compartidos por todas las vistas que pintan tarjetas.
 *
 * `MarketplaceProductCard` ya recibia `isFavorite` y `onToggleFavorite`, pero ninguna
 * vista se los pasaba: el corazon se dibujaba y no hacia nada. En vez de repetir el
 * estado en cada pantalla, se carga UNA vez por sesion de la vista y se expone el par
 * consultar/alternar.
 *
 * El backend responde con `proveedorProductoId` y un `id` propio del favorito. Para
 * borrar hace falta el id DEL FAVORITO, no el del producto, asi que se guarda el mapa
 * de uno a otro.
 */
export function useFavorites(userId) {
  const queryClient = useQueryClient();
  // producto -> id del favorito
  const [byProduct, setByProduct] = useState(() => new Map());
  const [busyIds, setBusyIds] = useState(() => new Set());

  useEffect(() => {
    if (!userId) {
      setByProduct(new Map());
      return undefined;
    }
    const controller = new AbortController();
    getFavoritesApi(userId, { signal: controller.signal })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.content || []);
        setByProduct(new Map(list
          .filter((item) => item?.proveedorProductoId != null)
          .map((item) => [String(item.proveedorProductoId), item.id])));
      })
      .catch(() => null);
    return () => controller.abort();
  }, [userId]);

  const isFavorite = useCallback(
    (productId) => byProduct.has(String(productId)),
    [byProduct],
  );

  const toggleFavorite = useCallback(async (product) => {
    const productId = String(product?.id ?? product?.proveedorProductoId ?? '');
    if (!userId || !productId || busyIds.has(productId)) return;

    setBusyIds((previous) => new Set(previous).add(productId));
    const favoriteId = byProduct.get(productId);
    try {
      if (favoriteId != null) {
        await removeFavoriteApi(userId, favoriteId);
        setByProduct((previous) => {
          const next = new Map(previous);
          next.delete(productId);
          return next;
        });
      } else {
        const created = await addFavoriteApi(userId, productId);
        setByProduct((previous) => new Map(previous).set(productId, created?.id ?? true));
      }
      // El panel de perfil lee la lista por React Query. Sin esto seguia mostrando el
      // favorito borrado hasta recargar la pagina.
      queryClient.invalidateQueries({ queryKey: qk.favorites(userId) });
    } catch {
      // Si falla, el corazon se queda como estaba: no se pinta un favorito que el
      // servidor no guardo.
    } finally {
      setBusyIds((previous) => {
        const next = new Set(previous);
        next.delete(productId);
        return next;
      });
    }
  }, [userId, byProduct, busyIds, queryClient]);

  return { isFavorite, toggleFavorite };
}

export default useFavorites;
