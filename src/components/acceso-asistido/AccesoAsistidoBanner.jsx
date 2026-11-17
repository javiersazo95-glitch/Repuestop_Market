import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Headset } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { profilePath } from '../../routes/paths';
import { useAccesoAsistido, useRestante } from './useAccesoAsistido';
import './AccesoAsistido.css';

/**
 * Franja bajo el header para el vendedor: avisa cuando soporte pide entrar a su panel o ya esta dentro, con el
 * contador de cuanto falta. Solo se muestra mientras hay una solicitud pendiente de el, o un acceso activo.
 */
export default function AccesoAsistidoBanner() {
  const { user, role, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const sellerId = user?.sellerId;
  const esVendedor = isLoggedIn && String(user?.role || role || '').toUpperCase() === 'SELLER' && Boolean(sellerId);
  const { actual, offsetMs } = useAccesoAsistido(sellerId, esVendedor);
  const mostrar = esVendedor && actual && (actual.estado === 'PENDIENTE_VENDEDOR' || actual.estado === 'ACTIVO');
  const activo = actual?.estado === 'ACTIVO';
  const restante = useRestante(mostrar ? (activo ? actual.expiraEn : actual.solicitudExpiraEn) : null, offsetMs);

  if (!mostrar) return null;

  return (
    <div className={`acceso-asistido-banner ${activo ? 'activo' : 'pide'}`} role="status">
      <Headset size={16} aria-hidden="true" />
      <span>
        {activo
          ? <>Soporte tiene acceso a tu panel · vence en <strong className={`tono-${restante.tono}`}>{restante.texto}</strong></>
          : <>Soporte pide acceso a tu panel para cargar repuestos · responde antes de <strong className={`tono-${restante.tono}`}>{restante.texto}</strong></>}
      </span>
      <button type="button" onClick={() => navigate(profilePath('ayuda_carga'))}>{activo ? 'Ver o cortar' : 'Revisar'}</button>
    </div>
  );
}
