import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, CheckCircle2, ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { fetchTokenPacks, fetchDatosDocumentoRecarga, iniciarRecargaApi, adErrorMessage } from '../../services/adsStorage';
import { formatRut, isValidRut } from '../../services/adapters';
import RepuestopCoin from './RepuestopCoin';

export default function RechargeTokensModal({
  isOpen,
  onClose,
  origin = 'ANUNCIOS'
}) {
  // El catalogo lo sirve el backend: antes estaba fijo aca y en la app, con el precio en dos
  // archivos que nadie garantizaba sincronizados.
  const [packs, setPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [packsError, setPacksError] = useState('');
  const [selectedPack, setSelectedPack] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  /**
   * Que documento tributario pide el comprador. Arranca en FACTURA cuando tiene tienda con RUT
   * registrado: quien recarga Monedas casi siempre es un vendedor con giro que necesita el
   * credito fiscal del IVA, y dejarlo en boleta por descuido le cuesta plata.
   */
  const [documento, setDocumento] = useState({ tipo: 'BOLETA', rut: '', razonSocial: '', giro: '' });
  const [rutTocado, setRutTocado] = useState(false);

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

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    fetchDatosDocumentoRecarga({ signal: controller.signal })
      .then((datos) => setDocumento({
        tipo: datos.tipoSugerido,
        rut: datos.rut ? formatRut(datos.rut) : '',
        razonSocial: datos.razonSocial,
        giro: datos.giro,
      }))
      // Que no se pueda prellenar no debe impedir recargar: queda en boleta y el usuario elige.
      .catch(() => {});
    return () => controller.abort();
  }, [isOpen]);

  if (!isOpen) return null;

  const pideFactura = documento.tipo === 'FACTURA';
  // Se valida con modulo 11 en el cliente para avisar mientras escribe; el backend lo vuelve a
  // validar antes de cobrar, que es donde de verdad importa.
  const rutValido = !pideFactura || isValidRut(documento.rut);
  const faltaRazonSocial = pideFactura && !documento.razonSocial.trim();

  /**
   * Registra la compra en el backend, que es quien acredita las Monedas.
   *
   * Crea la intencion de pago y manda al usuario a Flow.
   *
   * Ya no acredita ni muestra exito: las Monedas entran cuando el webhook confirma que el
   * dinero llego, no cuando el navegador dice que pago. El usuario sale de esta pagina y
   * vuelve por la pagina puente del backend a `/perfil/anuncios?status=success`, con la
   * lluvia de monedas ya del lado del panel.
   */
  const handlePay = async (e) => {
    e.preventDefault();
    if (!selectedPack) return;
    if (pideFactura && !isValidRut(documento.rut)) {
      setRutTocado(true);
      setErrorMsg('Revisa el RUT: no es válido.');
      return;
    }
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const { url } = await iniciarRecargaApi(selectedPack.id, origin, documento);
      if (!url) throw new Error('La pasarela no devolvio una URL de pago.');
      // Redireccion dura, no window.open: es la misma pestana la que va a Flow y vuelve.
      window.location.href = url;
    } catch (error) {
      setErrorMsg(adErrorMessage(error, 'No pudimos iniciar el pago. Intenta nuevamente.'));
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
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

              {/* El documento se pregunta ANTES de cobrar: una factura mal pedida obliga a
                  anular y re-emitir, y si el RUT no sirve hay que devolver la plata. */}
              <div className="recharge-section-heading">
                <span>2</span>
                <div>
                  <strong>Documento tributario</strong>
                  <small>Con factura puedes usar el IVA como crédito fiscal</small>
                </div>
              </div>
              <div className="recharge-doc-choice" role="radiogroup" aria-label="Tipo de documento">
                {['BOLETA', 'FACTURA'].map((tipo) => (
                  <button
                    type="button"
                    key={tipo}
                    role="radio"
                    aria-checked={documento.tipo === tipo}
                    className={`recharge-doc-option ${documento.tipo === tipo ? 'selected' : ''}`}
                    onClick={() => setDocumento((prev) => ({ ...prev, tipo }))}
                  >
                    <strong>{tipo === 'BOLETA' ? 'Boleta' : 'Factura'}</strong>
                    <small>
                      {tipo === 'BOLETA'
                        ? 'Para consumidor final'
                        : 'Necesita tu RUT de empresa'}
                    </small>
                  </button>
                ))}
              </div>

              {pideFactura && (
                <div className="recharge-doc-fields">
                  <label className="recharge-doc-field">
                    <span>RUT *</span>
                    <input
                      type="text"
                      inputMode="text"
                      value={documento.rut}
                      onChange={(e) => setDocumento((prev) => ({ ...prev, rut: formatRut(e.target.value) }))}
                      onBlur={() => setRutTocado(true)}
                      placeholder="12.345.678-9"
                      maxLength={12}
                      aria-invalid={rutTocado && !rutValido}
                      className={rutTocado && !rutValido ? 'is-invalid' : ''}
                    />
                    {rutTocado && !rutValido && (
                      <small className="recharge-doc-error">
                        {documento.rut.trim()
                          ? 'Ese RUT no es válido: revisa el dígito verificador.'
                          : 'El RUT es obligatorio para emitir una factura.'}
                      </small>
                    )}
                  </label>
                  <label className="recharge-doc-field">
                    <span>Razón social *</span>
                    <input
                      type="text"
                      value={documento.razonSocial}
                      onChange={(e) => setDocumento((prev) => ({ ...prev, razonSocial: e.target.value }))}
                      placeholder="Repuestos SpA"
                      maxLength={180}
                    />
                  </label>
                  <label className="recharge-doc-field">
                    <span>Giro</span>
                    <input
                      type="text"
                      value={documento.giro}
                      onChange={(e) => setDocumento((prev) => ({ ...prev, giro: e.target.value }))}
                      placeholder="Venta de repuestos automotrices"
                      maxLength={150}
                    />
                  </label>
                </div>
              )}

              {/* El medio de pago se elige DENTRO de Flow: ofrecerlo aca era pura
                  decoracion, porque ninguna de las tres opciones cobraba nada. */}
              <div className="recharge-section-heading">
                <span>3</span>
                <div>
                  <strong>Pago seguro con Flow</strong>
                  <small>Te llevamos a Flow para pagar con Webpay, tarjeta o transferencia</small>
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
                  // Con una factura incompleta el backend cortaria igual, pero recien al
                  // apretar: es mejor que el boton diga que falta algo antes de intentarlo.
                  disabled={isProcessing || !selectedPack || !rutValido || faltaRazonSocial}
                >
                  {isProcessing ? 'Procesando recarga…' : `Pagar ${selectedPack?.priceFormatted ?? ''}`}
                </button>
              </div>
            </form>
      </div>
    </div>,
    document.body
  );
}
