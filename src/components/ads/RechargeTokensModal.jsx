import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, CheckCircle2, CreditCard, Landmark, ShieldCheck,
  Zap, Sparkles, ArrowRight, AlertCircle
} from 'lucide-react';
import { TOKEN_PACKS, rechargeTokensWithPack, adErrorMessage } from '../../services/adsStorage';
import RepuestopCoin from './RepuestopCoin';
import CoinDropAnimation from './CoinDropAnimation';

/** Quien pidio menos movimiento en su sistema se salta la lluvia. */
function prefiereMenosMovimiento() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function RechargeTokensModal({
  isOpen,
  onClose,
  onRechargeSuccess
}) {
  const [selectedPack, setSelectedPack] = useState(TOKEN_PACKS[1]); // Default al más popular (Medio)
  const [paymentMethod, setPaymentMethod] = useState('webpay');
  const [isProcessing, setIsProcessing] = useState(false);
  /**
   * El pago confirmado no salta directo al comprobante: primero la lluvia de
   * monedas toma el modal entero y recien despues aparece el resumen. Es el
   * momento en que el usuario ve que su plata se convirtio en algo, y pasarlo
   * por alto hace que la recarga se sienta como un formulario mas.
   * 'lluvia' -> 'resumen' lo dispara el onFinish de la animacion.
   */
  const [fase, setFase] = useState('compra');
  const [creditedAmount, setCreditedAmount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  /**
   * Numero del comprobante. Se fija UNA vez, al confirmarse la recarga: estaba
   * calculado con Math.random() dentro del render, asi que cambiaba en cada
   * repintado y el usuario podia ver dos numeros distintos para la misma compra.
   */
  const [receiptId, setReceiptId] = useState('');
  const isSuccess = fase === 'resumen';

  if (!isOpen) return null;

  /**
   * Registra la compra en el backend, que es quien acredita las Monedas.
   *
   * Antes esto sumaba el saldo en `localStorage` y no avisaba a nadie: la web
   * NUNCA llamaba a `POST /fichas/compras`, asi que una recarga hecha desde el
   * navegador no acreditaba nada real y ademas quedaba fuera de Administracion
   * Contable. Si el registro falla no se muestra exito: esas Monedas no existen.
   */
  const handlePay = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMsg('');
    const methodName = paymentMethod === 'webpay'
      ? 'Webpay Plus'
      : paymentMethod === 'transfer' ? 'Transferencia Bancaria' : 'Tarjeta de Crédito';
    try {
      const updatedBalance = await rechargeTokensWithPack(selectedPack, methodName);
      setCreditedAmount(selectedPack.totalTokens);
      setReceiptId(`RT-PAY-${Math.floor(100000 + Math.random() * 900000)}`);
      setFase(prefiereMenosMovimiento() ? 'resumen' : 'lluvia');
      onRechargeSuccess?.(updatedBalance);
    } catch (error) {
      setErrorMsg(adErrorMessage(error, 'No se pudo registrar la recarga. Intenta nuevamente.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFase('compra');
    setErrorMsg('');
    onClose?.();
  };

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="recharge-modal-card">
        {!isSuccess ? (
          <>
            <div className="booking-modal-header">
              <div>
                <h3>
                  <RepuestopCoin size={30} face="front" />
                  Recargar Monedas RepuesTop
                </h3>
                <p>
                  Elige un pack de monedas para mejorar la visibilidad y rango de tus anuncios en el Mural Automotriz.
                </p>
              </div>
              <button
                type="button"
                className="story-close-btn"
                style={{ background: '#f1f5f9', color: '#0f172a' }}
                onClick={handleClose}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePay}>
              {/* Selector de Packs */}
              <div className="token-packs-grid">
                {TOKEN_PACKS.map((pack) => {
                  const isSelected = selectedPack.id === pack.id;
                  return (
                    <div
                      key={pack.id}
                      className={`token-pack-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedPack(pack)}
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Pack ${pack.name}, ${pack.totalTokens} monedas, ${pack.priceFormatted}`}
                    >
                      {pack.tag && (
                        <div className={`pack-tag-pill ${pack.highlight ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                          {pack.tag}
                        </div>
                      )}
                      {isSelected && <CheckCircle2 size={18} className="token-pack-check" />}
                      <h4 className="pack-title">{pack.name}</h4>
                      <div className="pack-tokens-display">
                        <RepuestopCoin size={34} face="front" />
                        <strong>{pack.totalTokens.toLocaleString('es-CL')}</strong>
                        <span>Monedas</span>
                      </div>
                      {pack.bonus > 0 && (
                        <span className="pack-bonus-badge">
                          +{pack.bonus} Monedas de Regalo
                        </span>
                      )}
                      <div className="pack-price">{pack.priceFormatted}</div>
                      <p className="pack-desc">{pack.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Selector de Método de Pago */}
              <div className="payment-method-section">
                <label className="text-xs font-bold text-slate-700 block mb-2 uppercase">
                  Método de Pago Seguro
                </label>
                <div className="payment-methods-row">
                  <label className={`payment-radio-card ${paymentMethod === 'webpay' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="webpay"
                      checked={paymentMethod === 'webpay'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <CreditCard size={18} className="text-red-500" />
                    <div>
                      <strong>Webpay Plus / Débito</strong>
                      <small>Redcompra y bancos nacionales</small>
                    </div>
                  </label>

                  <label className={`payment-radio-card ${paymentMethod === 'credit' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="credit"
                      checked={paymentMethod === 'credit'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <CreditCard size={18} className="text-blue-500" />
                    <div>
                      <strong>Tarjeta de Crédito</strong>
                      <small>Hasta 3 cuotas sin interés</small>
                    </div>
                  </label>

                  <label className={`payment-radio-card ${paymentMethod === 'transfer' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="transfer"
                      checked={paymentMethod === 'transfer'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <Landmark size={18} className="text-emerald-600" />
                    <div>
                      <strong>Transferencia Bancaria</strong>
                      <small>Acreditación instantánea</small>
                    </div>
                  </label>
                </div>
              </div>

              {/* Resumen del Pedido */}
              <div className="recharge-order-summary">
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-slate-600">Pack seleccionado:</span>
                  <strong className="text-slate-900">{selectedPack.name} ({selectedPack.totalTokens} Monedas)</strong>
                </div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-slate-600">Total a pagar:</span>
                  <strong className="text-emerald-700 text-lg font-extrabold">{selectedPack.priceFormatted}</strong>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-200">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Pago protegido con encriptación SSL 256 bits y acreditación inmediata.</span>
                </div>
              </div>

              {errorMsg && (
                <div className="ad-form-error">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="booking-actions-row">
                <button
                  type="button"
                  className="btn-ad-phone"
                  onClick={handleClose}
                  disabled={isProcessing}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-recharge-submit"
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Procesando recarga...' : `Pagar ${selectedPack.priceFormatted} y Recargar`}
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Confirmación Exitosa */
          <div className="text-center py-6">
            <div className="recharge-success-coin">
              <RepuestopCoin size={92} face="front" />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
              ¡Gracias por confiar en RepuesTop!
            </h3>

            <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
              Se acreditaron <strong className="text-emerald-700 font-bold">{creditedAmount.toLocaleString('es-CL')} Monedas RepuesTop</strong> en tu monedero. Ya están disponibles para usar en tus avisos.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-md mx-auto mb-6 space-y-2 text-xs text-slate-700">
              <div><strong>Transacción:</strong> <span className="font-mono text-slate-900">#{receiptId}</span></div>
              <div><strong>Pack Adquirido:</strong> {selectedPack.name}</div>
              <div><strong>Monto Pagado:</strong> {selectedPack.priceFormatted}</div>
              <div><strong>Fecha y Hora:</strong> {new Date().toLocaleString('es-CL')}</div>
            </div>

            <button
              type="button"
              className="btn-post-ad mx-auto"
              onClick={handleClose}
            >
              Volver al Panel de Anuncios
            </button>
          </div>
        )}

        {/* La lluvia toma el modal entero, por encima del formulario: es un
            momento propio, no un adorno del comprobante. Al terminar cede el
            paso al resumen. */}
        {fase === 'lluvia' && (
          <div className="coin-rain-layer">
            <CoinDropAnimation active onFinish={() => setFase('resumen')} />
            <h3>¡Listo!</h3>
            <p>Estamos acreditando tus monedas…</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
