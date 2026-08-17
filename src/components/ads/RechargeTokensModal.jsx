import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Coins, CheckCircle2, CreditCard, Landmark, ShieldCheck,
  Zap, Sparkles, ArrowRight
} from 'lucide-react';
import { TOKEN_PACKS, rechargeTokensWithPack } from '../../services/adsStorage';

export default function RechargeTokensModal({
  isOpen,
  onClose,
  onRechargeSuccess
}) {
  const [selectedPack, setSelectedPack] = useState(TOKEN_PACKS[1]); // Default al más popular (Medio)
  const [paymentMethod, setPaymentMethod] = useState('webpay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [creditedAmount, setCreditedAmount] = useState(0);

  if (!isOpen) return null;

  const handlePay = (e) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(() => {
      const methodName = paymentMethod === 'webpay' ? 'Webpay Plus' : paymentMethod === 'transfer' ? 'Transferencia Bancaria' : 'Tarjeta de Crédito';
      const updatedBalance = rechargeTokensWithPack(selectedPack, methodName);
      setCreditedAmount(selectedPack.totalTokens);
      setIsProcessing(false);
      setIsSuccess(true);
      onRechargeSuccess?.(updatedBalance);
    }, 1000);
  };

  const handleClose = () => {
    setIsSuccess(false);
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
                  <Coins className="text-amber-500" size={24} />
                  Recargar Fichas RepuesTop
                </h3>
                <p>
                  Elige un pack de fichas para mejorar la visibilidad y rango de tus anuncios en el Mural Automotriz.
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
                      className={`token-pack-card ${isSelected ? 'selected' : ''} ${pack.highlight ? 'is-popular' : ''}`}
                      onClick={() => setSelectedPack(pack)}
                    >
                      {pack.tag && (
                        <div className={`pack-tag-pill ${pack.highlight ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                          {pack.tag}
                        </div>
                      )}
                      <h4 className="pack-title">{pack.name}</h4>
                      <div className="pack-tokens-display">
                        <strong>{pack.totalTokens.toLocaleString('es-CL')}</strong>
                        <span>Fichas</span>
                      </div>
                      {pack.bonus > 0 && (
                        <span className="pack-bonus-badge">
                          +{pack.bonus} Fichas de Regalo
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
                  <strong className="text-slate-900">{selectedPack.name} ({selectedPack.totalTokens} Fichas)</strong>
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
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={36} />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
              ¡Recarga Exitosa!
            </h3>

            <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
              Se han acreditado <strong className="text-emerald-700 font-bold">{creditedAmount.toLocaleString('es-CL')} Fichas RepuesTop</strong> a tu monedero de manera inmediata.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-md mx-auto mb-6 space-y-2 text-xs text-slate-700">
              <div><strong>Transacción:</strong> <span className="font-mono text-slate-900">#RT-PAY-{Math.floor(100000 + Math.random() * 900000)}</span></div>
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
      </div>
    </div>,
    document.body
  );
}
