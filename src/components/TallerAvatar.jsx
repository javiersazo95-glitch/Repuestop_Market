import React from 'react';
import AuctionAvatar from './AuctionAvatar';

/**
 * Imagen de perfil de un taller en sus diagnósticos. Siempre es su foto: si el diagnóstico no la trae o no carga, usa la del
 * perfil del taller (`tallerId`); solo si tampoco existe muestra la inicial de su nombre, nunca un icono genérico.
 */
export default function TallerAvatar({ src, name = '', className = '', tallerId = null }) {
  return <AuctionAvatar src={src} name={name} tallerId={tallerId} className={`taller-avatar ${className}`.trim()} />;
}
