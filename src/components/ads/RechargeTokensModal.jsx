import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, CheckCircle2, CreditCard, Landmark, ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { fetchTokenPacks, rechargeTokensWithPack, adErrorMessage } from '../../services/adsStorage';
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
  onRechargeSuccess,
  origin = 'ANUNCIOS'
}) {
  // El catalogo lo sirve el backend: antes estaba fijo aca y en la app, con el precio en dos
  // archivos que nadie garantizaba sincronizados.
  const [packs, setPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [packsError, setPacksError] = useState('');
  const [selectedPack, setSelectedPack] = useState(null);
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

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setPacksLoading(true);
    setPacksError('');
    fetchTokenPacks()
      .then((lista) => {
        if (cancelled) return;
        setPacks(lista);
        // Se preselecciona el pack destacado; si ninguno lo esta, el primero.
        setSelectedPack(lista.find((pack) => pack.highlight) || lista[0] || null);
      })
      .catch((error) => {
        if (!cancelled) setPacksError(adErrorMessage(error, 'No pudimos cargar los packs. Intenta nuevamente.'));
      })
      .finally(() => { if (!cancelled) setPacksLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

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
    if (!selectedPack) return;
    setIsProcessing(true);
    setErrorMsg('');
    const methodName = paymentMethod === 'webpay'
      ? 'Webpay Plus'
      : paymentMethod === 'transfer' ? 'Transferencia Bancaria' : 'Tarjeta de Crédito';
    try {
      const updatedBalance = await rechargeTokensWithPack(selectedPack, methodName, origin);
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
      className="booking-modal-overlay recharge-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="recharge-modal-card">
        {!isSuccess ? (
          <>
            <div className="recharge-modal-header">
              <div className="recharge-modal-title-row">
                <span className="recharge-modal-coin"><RepuestopCoin size={42} face="front" /></span>
                <div>
                  <span className="recharge-modal-eyebrow">MONEDERO REPUESTOP</span>
                  <h3>Recargar Monedas RepuesTop</h3>
                  <p>Para anuncios y productos Top <i /> <strong>1 moneda = $50 CLP</strong></p>
                </div>
              </div>
              <button
                type="button"
                className="recharge-modal-close"
                onClick={handleClose}
                aria-label="Cerrar recarga"
              >
                <X size={18} />
              </button>
            </div>

            <form className="recharge-modal-form" onSubmit={handlePay}>
              {/* Selector de Packs */}
              <div className="recharge-section-heading">
                <span>1</span>
                <div><strong>Selecciona un pack</strong><small>El valor siempre es $50 CLP por moneda</small></div>
              </div>
              {packsLoading && <p className="recharge-packs-state">Cargando packs…</p>}
              {packsError && <p className="recharge-packs-state is-error">{packsError}</p>}
              <div className="token-packs-grid">
                {packs.map((pack) => {
                  const isSelected = selectedPack?.id === pack.id;
                  return (
                    <button
                      type="button"
                      key={pack.id}
                      className={`token-pack-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedPack(pack)}
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Pack ${pack.name}, ${pack.totalTokens} monedas, ${pack.priceFormatted}`}
                    >
                      <div className="pack-top-row">
                        <span className={`pack-tag-pill ${pack.highlight ? 'is-featured' : ''}`}>{pack.tag}</span>
                        {isSelected
                          ? <CheckCircle2 size={20} className="token-pack-check" />
                          : <span className="token-pack-radio" aria-hidden="true" />}
                      </div>
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
                    </button>
                  );
                })}
              </div>

              {/* Selector de Método de Pago */}
              <div className="payment-method-section">
                <div className="recharge-section-heading">
                  <span>2</span>
                  <div><strong>Método de pago seguro</strong><small>Selecciona cómo quieres pagar</small></div>
                </div>
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
                <div className="recharge-summary-main">
                  <div>
                    <span>Pack seleccionado</span>
                    <strong>{selectedPack?.name} · {selectedPack?.totalTokens} Monedas</strong>
                  </div>
                  <div className="recharge-summary-total">
                    <span>Total a pagar</span>
                    <strong>{selectedPack?.priceFormatted}</strong>
                  </div>
                </div>
                <div className="recharge-secure-note">
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

              <div className="recharge-actions-row">
                <button
                  type="button"
                  className="recharge-cancel-btn"
                  onClick={handleClose}
                  disabled={isProcessing}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-recharge-submit"
                  disabled={isProcessing || !selectedPack}
                >
                  {isProcessing ? 'Procesando recarga…' : `Pagar ${selectedPack?.priceFormatted ?? ''}`}
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Confirmación Exitosa */
          <div className="recharge-success-view">
            <div className="recharge-success-coin">
              <RepuestopCoin size={92} face="front" />
            </div>

            <h3>
              ¡Gracias por confiar en RepuesTop!
            </h3>

            <p>
              Se acreditaron <strong>{creditedAmount.toLocaleString('es-CL')} Monedas RepuesTop</strong> en tu monedero. Ya están disponibles para usar en {origin === 'INVENTARIO' ? 'tus productos Top' : 'tus avisos'}.
            </p>

            <div className="recharge-voucher">
              <div><strong>Transacción:</strong> <span className="font-mono text-slate-900">#{receiptId}</span></div>
              <div><strong>Pack Adquirido:</strong> {selectedPack?.name}</div>
              <div><strong>Monto Pagado:</strong> {selectedPack?.priceFormatted}</div>
              <div><strong>Fecha y Hora:</strong> {new Date().toLocaleString('es-CL')}</div>
            </div>

            <button
              type="button"
              className="btn-recharge-submit"
              onClick={handleClose}
            >
              {origin === 'INVENTARIO' ? 'Volver a Producto Top' : 'Volver al Panel de Anuncios'}
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
