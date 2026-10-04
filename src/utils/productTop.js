export const TOP_BADGE_DURATION_DAYS = 30;

/**
 * Normaliza los nombres de la API publica, el inventario del vendedor y el modelo
 * de la app movil. `destacado` por si solo no basta: una insignia vencida puede
 * seguir llegando marcada hasta que el backend haga su siguiente actualizacion.
 */
export function getProductTopStatus(product, now = new Date()) {
  const isTop = Boolean(product?.isTop ?? product?.destacado);
  const rawExpiry = product?.topExpiresAt ?? product?.topHasta;

  if (!isTop && !rawExpiry) return { state: 'none', daysLeft: 0, expiresAt: null };

  if (!rawExpiry) {
    return isTop
      ? { state: 'active', daysLeft: 0, expiresAt: null }
      : { state: 'none', daysLeft: 0, expiresAt: null };
  }

  const expiresAt = new Date(rawExpiry);
  if (Number.isNaN(expiresAt.getTime())) {
    return isTop
      ? { state: 'active', daysLeft: 0, expiresAt: null }
      : { state: 'none', daysLeft: 0, expiresAt: null };
  }

  if (!isTop || expiresAt.getTime() <= now.getTime()) {
    return { state: 'expired', daysLeft: 0, expiresAt };
  }

  return {
    state: 'active',
    daysLeft: Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000),
    expiresAt,
  };
}

export function isProductTopActive(product, now) {
  return getProductTopStatus(product, now).state === 'active';
}

/**
 * Grupo de un repuesto en el listado por patente (regla del 4-oct, igual que el backend):
 * 0 compatible con el auto y con Top vigente, 1 compatible, 2 universal con Top, 3 universal.
 * `compatibleRegistrado` lo arma adaptCompatibleOffer; sin el, se usa `esUniversal`.
 */
export function rangoListadoPorPatente(product, now) {
  const compatible = product?.compatibleRegistrado ?? !product?.esUniversal;
  const top = isProductTopActive(product, now);
  if (compatible) return top ? 0 : 1;
  return top ? 2 : 3;
}

export function topExpiryDateLabel(status) {
  if (!status?.expiresAt) return '';
  return status.expiresAt.toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

