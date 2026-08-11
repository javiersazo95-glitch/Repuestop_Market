import React, { useEffect, useState } from 'react';
import {
  AlertCircle, BadgeCheck, BadgeDollarSign, Box, CheckCircle2, ChevronRight,
  CircleHelp, ClipboardList, FileText, LockKeyhole, Package, Send, Shield, Store, X,
} from 'lucide-react';
import {
  createConversationApi, resolveMediaUrl, sendConversationMessageApi,
} from '../services/api';
import {
  buildQuoteRequestMessage, QUOTE_DELIVERY_OPTIONS,
} from '../utils/quoteFlow';

const initialForm = (activeVehicle) => ({
  quantity: 1,
  shippingMethod: '',
  chassis: activeVehicle?.vin || activeVehicle?.patente || '',
  notes: '',
});

export default function QuotationRequestModal({
  product, activeVehicle, isOpen, onClose, user, isLoggedIn, onRequireLogin,
}) {
  const [formData, setFormData] = useState(() => initialForm(activeVehicle));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setFormData(initialForm(activeVehicle));
    setConversation(null);
    setSubmitError('');
  }, [isOpen, product?.id, activeVehicle]);

  if (!isOpen || !product) return null;

  const sellerName = typeof product.vendedor === 'object'
    ? (product.vendedor.nombre || 'Tienda verificada')
    : (product.vendedor || product.storeName || 'Tienda verificada');
  const productName = product.titulo || product.nombre || product.name || 'Repuesto';
  const productImage = resolveMediaUrl(
    product.imagen || product.imagenUrl || product.image || product.imagenes?.[0] || product.fotos?.[0],
  );
  const providerId = product.proveedorId ?? product.sellerId ?? product.vendedor?.id;
  const requiresChassis = Boolean(product.requiereChasis || product.requiresChassis);

  const updateField = (field, value) => setFormData((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isLoggedIn || !user) {
      onRequireLogin?.();
      return;
    }
    if (!formData.shippingMethod) {
      setSubmitError('Selecciona el método de envío que necesitas.');
      return;
    }
    if (!providerId || !product.id) {
      setSubmitError('No fue posible identificar el producto o la tienda.');
      return;
    }
    if (requiresChassis && !formData.chassis.trim()) {
      setSubmitError('Este repuesto requiere patente o chasis para validar compatibilidad.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const createdConversation = await createConversationApi(providerId, product.id);
      const message = buildQuoteRequestMessage(formData);
      const sentMessage = await sendConversationMessageApi(createdConversation.id, message);
      setConversation({ ...createdConversation, ultimoMensaje: sentMessage?.texto || message });
    } catch (error) {
      setSubmitError(error.message || 'No se pudo enviar la solicitud de cotización.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop quote-request-backdrop" onClick={onClose}>
      <section className="quote-request-modal" role="dialog" aria-modal="true" aria-labelledby="quote-request-title" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close-btn quote-request-close" type="button" onClick={onClose} aria-label="Cerrar"><X size={28} /></button>

        <header className="quote-request-header">
          <div className="quote-request-header-icon"><FileText className="quote-request-header-file" size={38} /><BadgeDollarSign className="quote-request-header-money" size={20} /></div>
          <div className="quote-request-header-copy">
            <span>COTIZACIÓN CON LA TIENDA</span>
            <h2 id="quote-request-title">{conversation ? 'Solicitud enviada' : 'Solicita tu cotización'}</h2>
            <p>{conversation ? 'La tienda ya recibió los datos y puede responderte en la conversación.' : 'Completa los datos necesarios para solicitar la cotización del repuesto.'}</p>
          </div>
        </header>

        <div className="quote-request-content">
          <article className="quote-request-product">
            <div className="quote-request-product-media">
              {productImage ? <img src={productImage} alt={productName} /> : <span><Package size={34} /></span>}
            </div>
            <dl className="quote-request-product-data">
              <div><dt><Shield size={19} /> Marca</dt><dd>{product.marca || 'No informada'}</dd></div>
              <div><dt><Box size={19} /> Producto</dt><dd>{productName}</dd></div>
              <div><dt><Store size={19} /> Tienda</dt><dd>{sellerName}</dd></div>
            </dl>
            <div className="quote-request-trust">
              <BadgeCheck size={35} />
              <strong>Cotizas con una tienda verificada</strong>
              <span>Tu solicitud será enviada de forma segura.</span>
            </div>
          </article>

          {conversation ? (
            <div className="quote-request-success">
              <CheckCircle2 size={54} />
              <h3>¡Cotización solicitada correctamente!</h3>
              <p>Quedó creada la conversación #{conversation.id}. Podrás revisar la propuesta, su vigencia y responder desde <strong>Mis cotizaciones</strong>.</p>
              <a className="btn-submit-ticket" href="/perfil/cotizaciones">Ir a mis cotizaciones <ChevronRight size={17} /></a>
              <button className="btn-auth-secondary" type="button" onClick={onClose}>Seguir viendo productos</button>
            </div>
          ) : (
            <form className="quote-request-form" onSubmit={handleSubmit}>
              <div className="quote-request-section-title"><ClipboardList size={25} /><div><strong>Detalle de tu solicitud</strong><small>Estos datos quedarán visibles para el vendedor.</small></div></div>

              <div className="quote-request-grid">
                <label><span>Cantidad</span><input type="number" min="1" max={Math.max(1, Number(product.stock || 99))} value={formData.quantity} onChange={(event) => updateField('quantity', event.target.value)} required /></label>
                <label><span>Método de envío *</span><select value={formData.shippingMethod} onChange={(event) => updateField('shippingMethod', event.target.value)} required><option value="">Selecciona una opción</option>{QUOTE_DELIVERY_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
              </div>

              <label><span className="quote-request-label-with-help">Patente o chasis {requiresChassis ? '*' : '(opcional)'} <CircleHelp size={16} /></span><input value={formData.chassis} onChange={(event) => updateField('chassis', event.target.value.toUpperCase())} required={requiresChassis} placeholder="Ej. BBCL12 o VIN" /></label>
              <label><span>Nota para el vendedor (opcional)</span><textarea rows="3" value={formData.notes} onChange={(event) => updateField('notes', event.target.value)} maxLength="500" placeholder="Marca preferida, urgencia u otra información útil..." /><small className="quote-request-counter">{formData.notes.length}/500</small></label>

              {submitError && <div className="modal-form-error"><AlertCircle size={16} /><span>{submitError}</span></div>}

              <button type="submit" disabled={isSubmitting} className="btn-submit-ticket"><Send size={24} /><span>{isSubmitting ? 'Enviando solicitud...' : 'Enviar solicitud de cotización'}</span></button>
              {!isLoggedIn && <p className="quote-request-login-hint"><LockKeyhole size={15} /> Necesitas iniciar sesión para enviar tu solicitud y guardar la conversación.</p>}
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
