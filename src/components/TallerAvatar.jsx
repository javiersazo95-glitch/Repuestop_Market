import React from 'react';
import AuctionAvatar from './AuctionAvatar';

/**
 * Imagen de perfil de un taller en sus diagnósticos. Siempre es su foto: si todavía no tiene o no carga, muestra la inicial de su
 * nombre, nunca un icono genérico de taller.
 */
export default function TallerAvatar({ src, name = '', className = '' }) {
  return <AuctionAvatar src={src} name={name} className={`taller-avatar ${className}`.trim()} />;
}
