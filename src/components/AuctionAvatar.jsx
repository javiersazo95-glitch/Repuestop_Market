import React, { useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { resolveMediaUrl } from '../services/api';
import '../styles/auction-avatar.css';

/** Foto de perfil de un comprador o de una tienda; si no hay foto (o no carga), inicial o ícono de tienda. */
export default function AuctionAvatar({ src, name = '', isStore = false, className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);

  const url = src && !failed ? resolveMediaUrl(src) : null;
  return (
    <span className={`as-avatar-box ${isStore ? 'is-store' : ''} ${className}`} aria-hidden="true">
      {url ? (
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : isStore ? (
        <Store size={16} />
      ) : (
        (name.trim().charAt(0) || '?').toUpperCase()
      )}
    </span>
  );
}
