import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, ChevronRight, History, Landmark, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSellerWithdrawalAlertApi } from '../services/api';
import { qk } from '../services/queryKeys';
import { profilePath } from '../routes/paths';
import './WithdrawalFailureAlert.css';

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Alerta de retiro fallido en el header del market. Aparece cuando Administración Contable marcó
 * que el depósito de un retiro rebotó en el banco, y se apaga sola cuando el vendedor vuelve a
 * solicitar un retiro: el backend la calcula comparando el rechazo con los retiros posteriores.
 * Equivalente web del chip de alerta del `TopAppBar` de la app móvil.
 *
 * `variant="header"` es la etiqueta junto al monedero (escritorio); `variant="strip"` es la franja
 * bajo la cabecera que la reemplaza en tablet y teléfono, donde el grupo de usuario se oculta.
 */
export default function WithdrawalFailureAlert({ variant = 'header' }) {
  const { user, role, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const sellerId = user?.sellerId;
  const isSeller = isLoggedIn && String(user?.role || role || '').toUpperCase() === 'SELLER' && Boolean(sellerId);

  const { data: alerta } = useQuery({
    queryKey: qk.sellerWithdrawalAlert(sellerId),
    queryFn: () => getSellerWithdrawalAlertApi(sellerId),
    enabled: isSeller,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isSeller || !alerta?.activa) return null;

  const irARetiros = (corregir) => {
    setIsOpen(false);
    navigate(corregir ? `${profilePath('retiros')}?corregir=datos-bancarios` : profilePath('retiros'));
  };

  return (
    <>
      <button
        type="button"
        className={`withdrawal-alert-trigger withdrawal-alert-trigger--${variant}`}
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        title="Tu último retiro no pudo depositarse"
      >
        <AlertTriangle size={17} />
        {variant === 'strip' ? (
          <>
            <span className="withdrawal-alert-strip-text">Tu último retiro no pudo depositarse</span>
            <span className="withdrawal-alert-strip-cta">Ver detalle <ChevronRight size={15} /></span>
          </>
        ) : (
          <span>Retiro fallido</span>
        )}
      </button>

      {isOpen && createPortal(
        <div className="withdrawal-alert-backdrop" onClick={() => setIsOpen(false)}>
          <div
            className="withdrawal-alert-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdrawal-alert-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="withdrawal-alert-close" onClick={() => setIsOpen(false)} aria-label="Cerrar">
              <X size={18} />
            </button>
            <div className="withdrawal-alert-icon"><AlertTriangle size={26} /></div>
            <h2 id="withdrawal-alert-title">Tu retiro no pudo depositarse</h2>
            <p className="withdrawal-alert-lead">
              El banco devolvió la transferencia, así que el dinero no llegó a tu cuenta.
              Tus pedidos volvieron a quedar disponibles para retirar.
            </p>

            <div className="withdrawal-alert-reason">
              <small>Motivo informado</small>
              <strong>{alerta.motivoRechazo || 'Sin detalle del banco'}</strong>
            </div>

            <dl className="withdrawal-alert-facts">
              <div><dt>Solicitud</dt><dd>{alerta.codigoExterno || '—'}</dd></div>
              <div><dt>Monto</dt><dd>{formatCLP(alerta.montoTotal)}</dd></div>
              <div><dt>Rechazado el</dt><dd>{formatDate(alerta.rechazadoAt) || '—'}</dd></div>
            </dl>

            <ol className="withdrawal-alert-steps">
              <li>Revisa y corrige tus datos bancarios.</li>
              <li>Solicita un nuevo retiro. Al hacerlo, esta alerta desaparece.</li>
            </ol>

            <div className="withdrawal-alert-actions">
              <button type="button" className="withdrawal-alert-secondary" onClick={() => irARetiros(false)}>
                <History size={16} /> Ver mis retiros
              </button>
              <button type="button" className="withdrawal-alert-primary" onClick={() => irARetiros(true)}>
                <Landmark size={16} /> Corregir datos bancarios <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
