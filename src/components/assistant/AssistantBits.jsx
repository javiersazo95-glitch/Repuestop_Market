import React from 'react';
import {
  Banknote, Bike, Building2, Car, CheckCircle2, Clock, Images, Package, Ribbon, Store, Tags, User, Wrench, Zap,
} from 'lucide-react';
import { resolveMediaUrl } from '../../services/api';
import { storeInitials } from '../../utils/partAssistant';

export const REPUESTIN_IMAGE = '/repuestin.webp';

/** Repuestín en círculo (la imagen ya trae su anillo azul): `components/assistant/RepuestinAvatar.tsx`. */
export function RepuestinAvatar({ size = 36, className = '' }) {
  return (
    <img
      className={`ra-repuestin ${className}`.trim()}
      src={REPUESTIN_IMAGE}
      width={size}
      height={size}
      alt="Repuestín, el asistente de RepuesTop"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

/** Foto de la otra parte (tienda o comprador) o sus iniciales. */
export function PartyAvatar({ photo, name, size = 44, store = true }) {
  const src = photo ? resolveMediaUrl(photo) : null;
  return (
    <span className={`ra-party ${store ? 'is-store' : 'is-person'}`} style={{ width: size, height: size }} aria-hidden="true">
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : name ? storeInitials(name) : store ? <Store size={size * 0.45} /> : <User size={size * 0.45} />}
    </span>
  );
}

/** Íconos de los datos de una tienda y del resumen del encargo (claves de la lógica pura). */
const ICONS = {
  wrench: Wrench, car: Car, zap: Zap, bike: Bike, package: Package, ribbon: Ribbon, tags: Tags, clock: Clock,
  images: Images, store: Store, building: Building2, cash: Banknote, check: CheckCircle2,
};

export function FactIcon({ name, size = 14 }) {
  const Icon = ICONS[name] || CheckCircle2;
  return <Icon size={size} aria-hidden="true" />;
}

/** "Escribiendo…" de Repuestín. */
export function TypingDots() {
  return (
    <span className="ra-dots" aria-label="Repuestín está escribiendo">
      <i /><i /><i />
    </span>
  );
}
