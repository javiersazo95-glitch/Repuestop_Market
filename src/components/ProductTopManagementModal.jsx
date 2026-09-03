import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CalendarClock, Loader2, Trophy, X } from 'lucide-react';
import { getSellerProductTopSummaryApi, updateSellerProductTopApi } from '../services/api';
import { fetchTokensBalance } from '../services/adsStorage';
import { getProductTopStatus, topExpiryDateLabel } from '../utils/productTop';
import ProductTopBadge from './ProductTopBadge';
import RepuestopCoin from './ads/RepuestopCoin';
import RechargeTokensModal from './ads/RechargeTokensModal';

const DEFAULT_SUMMARY = {
  activos: 0,
  gratuitosDisponibles: 0,
  maximo: 10,
  cuposGratuitos: 2,
  costoMonedas: 200,
  duracionDias: 30,
  saldoMonedas: 0,
};

export default function ProductTopManagementModal({ product, sellerId, onClose, onUpdated }) {
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const status = useMemo(() => getProductTopStatus(product), [product]);
  const active = status.state === 'active';
  const expired = status.state === 'expired';
  const wasTopBefore = status.state !== 'none' || Boolean(product?.topExpiresAt ?? product?.topHasta);
  const isFree = !wasTopBefore && Number(summary.gratuitosDisponibles) > 0;
  const cost = isFree ? 0 : Number(summary.costoMonedas || 200);
  const missingCoins = Math.max(0, cost - Number(summary.saldoMonedas || 0));
  const atLimit = !active && Number(summary.activos || 0) >= Number(summary.maximo || 10);

  const loadSummary = async () => {
    if (!sellerId) return;
    setLoading(true);
    setError('');
    try {
      setSummary({ ...DEFAULT_SUMMARY, ...(await getSellerProductTopSummaryApi(sellerId)) });
    } catch (requestError) {
      setError(requestError?.message || 'No se pudo consultar el estado de productos Top.');
      const balance = await fetchTokensBalance().catch(() => 0);
      setSummary((current) => ({ ...current, saldoMonedas: balance }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSummary(); }, [sellerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activate = async () => {
    if (!sellerId || !product?.id || saving || loading || atLimit || missingCoins > 0) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateSellerProductTopApi(sellerId, product.id, true, active);
      const refreshed = await getSellerProductTopSummaryApi(sellerId).catch(() => null);
      if (refreshed) setSummary({ ...DEFAULT_SUMMARY, ...refreshed });
      await fetchTokensBalance().catch(() => null);
      onUpdated?.(updated, active ? 'Sumamos 30 días a tu insignia Top.' : 'Producto marcado como Top por 30 días.');
      onClose?.();
    } catch (requestError) {
      const message = requestError?.message || 'No se pudo gestionar el producto Top.';
      setError(message);
      if (message.toLocaleLowerCase('es').includes('saldo insuficiente')) setRechargeOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const actionLabel = atLimit
    ? `Máximo de ${summary.maximo} productos Top alcanzado`
    : missingCoins > 0
      ? `Te faltan ${missingCoins.toLocaleString('es-CL')} monedas`
      : active
        ? `Agregar ${summary.duracionDias} días · ${cost.toLocaleString('es-CL')} monedas`
        : `${expired ? 'Renovar' : 'Activar posicionamiento Top'} · ${isFree ? 'gratis' : `${cost.toLocaleString('es-CL')} monedas`}`;

  return createPortal(
    <>
      {!rechargeOpen && (
        <div className="product-top-management-overlay" role="dialog" aria-modal="true" aria-labelledby="product-top-management-title" onClick={() => !saving && onClose?.()}>
          <section className="product-top-management" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="product-top-management-close" onClick={onClose} disabled={saving} aria-label="Cerrar"><X size={19} /></button>
            <header>
              <ProductTopBadge compact />
              <div>
                <span className="product-top-management-eyebrow"><Trophy size={14} /> TOP VENTAS</span>
                <h3 id="product-top-management-title">{active ? 'Tu insignia Top' : expired ? 'Tu insignia Top venció' : 'Posicionar como Top'}</h3>
                <p>{active ? 'Suma 30 días a los que ya te quedan y conserva la prioridad.' : expired ? 'Renueva la insignia y vuelve a las primeras posiciones.' : 'Dale prioridad en búsquedas y una insignia visible durante 30 días.'}</p>
              </div>
            </header>

            {status.state !== 'none' && (
              <div className={`product-top-countdown ${expired ? 'is-expired' : ''}`}>
                {expired ? <AlertCircle size={21} /> : <CalendarClock size={21} />}
                <div>
                  <strong>{active ? (status.daysLeft ? `Quedan ${status.daysLeft} ${status.daysLeft === 1 ? 'día' : 'días'}` : 'Insignia activa') : 'Sin días disponibles'}</strong>
                  <span>{topExpiryDateLabel(status) ? `${active ? 'Vence' : 'Venció'} el ${topExpiryDateLabel(status)}` : 'Vigencia de 30 días'}</span>
                </div>
              </div>
            )}

            <button type="button" className="product-top-primary-action" disabled={saving || loading || atLimit || missingCoins > 0} onClick={activate}>
              {saving || loading ? <Loader2 size={19} className="spin-icon" /> : <Trophy size={19} />}
              <span>{loading ? 'Consultando cupos Top…' : saving ? 'Procesando…' : actionLabel}</span>
            </button>

            {missingCoins > 0 && !loading && (
              <button type="button" className="product-top-insufficient" onClick={() => setRechargeOpen(true)}>
                <RepuestopCoin size={26} face="front" />
                <span><strong>Te faltan {missingCoins.toLocaleString('es-CL')} monedas</strong>Recarga para activar el botón.</span>
              </button>
            )}

            {error && <div className="product-top-error"><AlertCircle size={16} /> {error}</div>}

            <div className="product-top-rules">
              <strong>{loading ? 'Consultando cupos Top…' : `${summary.activos} de ${summary.maximo} productos Top activos`}</strong>
              <p>• Los primeros {summary.cuposGratuitos} productos tienen gratis su primera activación.</p>
              <p>• Toda renovación cuesta {summary.costoMonedas} monedas ($10.000 CLP), igual que activar del producto 3 al 10.</p>
              <p>• La insignia dura {summary.duracionDias} días y al vencer pierde la prioridad automáticamente.</p>
              <p>• Si renuevas antes, los {summary.duracionDias} días se suman a los que te quedan.</p>
              <div className="product-top-balance"><span><RepuestopCoin size={25} face="front" /> Saldo: <b>{Number(summary.saldoMonedas || 0).toLocaleString('es-CL')} monedas</b></span><button type="button" onClick={() => setRechargeOpen(true)}>Recargar</button></div>
            </div>
          </section>
        </div>
      )}

      <RechargeTokensModal
        isOpen={rechargeOpen}
        origin="INVENTARIO"
        onClose={() => setRechargeOpen(false)}
        onRechargeSuccess={(balance) => setSummary((current) => ({ ...current, saldoMonedas: balance }))}
      />
    </>,
    document.body
  );
}

