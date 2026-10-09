/**
 * Redes sociales de la tienda (Instagram, Facebook y TikTok). Misma regla que
 * `RedesSocialesTienda` del backend y `utils/social-links.ts` de la app: solo https al dominio de
 * cada red y con un perfil en la ruta. Se muestran como enlaces en el perfil público, así que
 * nunca se acepta un `javascript:` ni un sitio cualquiera disfrazado de Instagram.
 */
export const SOCIAL_NETWORKS = [
  {
    key: 'instagramUrl',
    label: 'Instagram',
    placeholder: 'instagram.com/tu_tienda',
    domains: ['instagram.com', 'instagr.am'],
  },
  {
    key: 'facebookUrl',
    label: 'Facebook',
    placeholder: 'facebook.com/tu_tienda',
    domains: ['facebook.com', 'fb.com', 'fb.me'],
  },
  {
    key: 'tiktokUrl',
    label: 'TikTok',
    placeholder: 'tiktok.com/@tu_tienda',
    domains: ['tiktok.com'],
  },
];

export const EMPTY_SOCIAL_LINKS = { enabled: false, instagramUrl: '', facebookUrl: '', tiktokUrl: '' };

/** Enlace con https, o null si no es un perfil válido de esa red. */
export function normalizeSocialUrl(value, network) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  const match = /^(https?):\/\/([^/?#@\s]+)(\/[^\s#]*)?$/i.exec(withScheme);
  if (!match) return null;
  const host = match[2].toLowerCase();
  const path = match[3] ?? '';
  const ownDomain = network.domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!ownDomain || path === '' || path === '/' || path.startsWith('/?')) return null;
  return `https://${host}${path}`;
}

/** Estado del formulario a partir de la verificación guardada (precarga en una corrección). */
export function socialLinksFromVerification(verification) {
  const links = {
    instagramUrl: verification?.instagramUrl || '',
    facebookUrl: verification?.facebookUrl || '',
    tiktokUrl: verification?.tiktokUrl || '',
  };
  return { ...links, enabled: Object.values(links).some(Boolean) };
}

/** Errores por red; objeto vacío si todo está bien o si el interruptor está apagado. */
export function validateSocialLinks(state) {
  if (!state?.enabled) return {};
  return SOCIAL_NETWORKS.reduce((errors, network) => {
    const value = state[network.key];
    if (String(value ?? '').trim() && !normalizeSocialUrl(value, network)) {
      errors[network.key] = `Pega el enlace de tu perfil de ${network.label}.`;
    }
    return errors;
  }, {});
}

/**
 * Campos que van al endpoint de verificación. Siempre se mandan las tres: vacías (o con el
 * interruptor apagado) el servidor las quita del perfil.
 */
export function socialLinksPayload(state) {
  return SOCIAL_NETWORKS.reduce((payload, network) => {
    payload[network.key] = state?.enabled ? (normalizeSocialUrl(state[network.key], network) ?? '') : '';
    return payload;
  }, {});
}

/** Solo las redes con un enlace válido, para el perfil público. */
export function storeSocialLinks(store) {
  if (!store) return [];
  return SOCIAL_NETWORKS.flatMap((network) => {
    const url = normalizeSocialUrl(store[network.key], network);
    return url ? [{ ...network, url }] : [];
  });
}
