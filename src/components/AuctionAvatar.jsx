import React, { useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { getStoreProfileApi, resolveMediaUrl } from '../services/api';
import { getWorkshopProfile } from '../services/workshopApi';
import '../styles/auction-avatar.css';

// Foto del perfil público de cada tienda o taller, pedida una sola vez por sesión: cuando un comentario, una oferta o un
// diagnóstico no trae la foto, se usa la del perfil (así siempre se ve, como en la app).
const profilePhotoCache = new Map();

function loadProfilePhoto(kind, id) {
  const key = `${kind}:${id}`;
  if (!profilePhotoCache.has(key)) {
    const request = kind === 'taller' ? getWorkshopProfile(id) : getStoreProfileApi(id);
    profilePhotoCache.set(key, Promise.resolve(request)
      .then((profile) => profile?.logoUrl || profile?.userProfileUrl || profile?.fotoPerfilUrl || null)
      .catch(() => { profilePhotoCache.delete(key); return null; }));
  }
  return profilePhotoCache.get(key);
}

/**
 * Foto de perfil de un comprador, una tienda o un taller. Sin foto (o si no carga) intenta la del perfil público (`storeId` /
 * `tallerId`); solo si tampoco hay, muestra la inicial o el ícono de tienda.
 */
export default function AuctionAvatar({ src, name = '', isStore = false, className = '', storeId = null, tallerId = null }) {
  const [failed, setFailed] = useState(false);
  const [profileSrc, setProfileSrc] = useState(null);
  const [profileFailed, setProfileFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  useEffect(() => { setProfileFailed(false); }, [profileSrc]);

  const needsProfile = (!src || failed) && (storeId || tallerId);
  useEffect(() => {
    if (!needsProfile) return undefined;
    let active = true;
    loadProfilePhoto(tallerId ? 'taller' : 'store', tallerId || storeId).then((photo) => { if (active) setProfileSrc(photo); });
    return () => { active = false; };
  }, [needsProfile, storeId, tallerId]);

  const shown = src && !failed ? src : (profileSrc && !profileFailed ? profileSrc : null);
  const url = shown ? resolveMediaUrl(shown) : null;
  return (
    <span className={`as-avatar-box ${isStore ? 'is-store' : ''} ${className}`} aria-hidden="true">
      {url ? (
        <img src={url} alt="" loading="lazy" onError={() => (src && !failed ? setFailed(true) : setProfileFailed(true))} />
      ) : isStore ? (
        <Store size={16} />
      ) : (
        (name.trim().charAt(0) || '?').toUpperCase()
      )}
    </span>
  );
}
