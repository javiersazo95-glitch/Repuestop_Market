import { useCallback, useEffect, useMemo, useState } from 'react';

const FAVORITES_EVENT = 'repuestop:marketplace-favorites-updated';

function storageKey(userId) {
  return `repuestop_marketplace_favorites_${userId || 'guest'}`;
}

function readSaved(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) || '{}');
    return {
      ads: Array.isArray(parsed.ads) ? parsed.ads : [],
      stores: Array.isArray(parsed.stores) ? parsed.stores : [],
    };
  } catch {
    return { ads: [], stores: [] };
  }
}

function writeSaved(userId, value) {
  localStorage.setItem(storageKey(userId), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: { userId: String(userId || 'guest') } }));
}

/**
 * Favoritos que todavía no tienen tabla propia en el backend (anuncios y tiendas).
 * Se separan por usuario y se emite un evento para que mural, directorio, detalle y
 * perfil se actualicen de inmediato aunque monten instancias distintas del hook.
 */
export function useSavedMarketplaceItems(userId) {
  const [saved, setSaved] = useState(() => readSaved(userId));

  useEffect(() => {
    const sync = (event) => {
      if (event?.type === FAVORITES_EVENT && event.detail?.userId !== String(userId || 'guest')) return;
      setSaved(readSaved(userId));
    };
    setSaved(readSaved(userId));
    window.addEventListener('storage', sync);
    window.addEventListener(FAVORITES_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(FAVORITES_EVENT, sync);
    };
  }, [userId]);

  const toggle = useCallback((type, item) => {
    const collection = type === 'stores' ? 'stores' : 'ads';
    const id = String(item?.id ?? item?.proveedorId ?? '');
    if (!id) return;
    const current = readSaved(userId);
    const exists = current[collection].some((entry) => String(entry.id) === id);
    const next = {
      ...current,
      [collection]: exists
        ? current[collection].filter((entry) => String(entry.id) !== id)
        : [{ ...item, id, savedAt: new Date().toISOString() }, ...current[collection]],
    };
    writeSaved(userId, next);
  }, [userId]);

  const adIds = useMemo(() => new Set(saved.ads.map((item) => String(item.id))), [saved.ads]);
  const storeIds = useMemo(() => new Set(saved.stores.map((item) => String(item.id))), [saved.stores]);

  return {
    savedAds: saved.ads,
    savedStores: saved.stores,
    isAdSaved: useCallback((id) => adIds.has(String(id)), [adIds]),
    isStoreSaved: useCallback((id) => storeIds.has(String(id)), [storeIds]),
    toggleAd: useCallback((ad) => toggle('ads', ad), [toggle]),
    toggleStore: useCallback((store) => toggle('stores', store), [toggle]),
  };
}

export default useSavedMarketplaceItems;
