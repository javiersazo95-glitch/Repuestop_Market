import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Edit3, CheckCircle2, Image as ImageIcon, Phone, MapPin, Tag, Clock, MessageCircle
} from 'lucide-react';
import { SERVICE_CATEGORIES, CHILE_COMMUNES, AD_TIERS } from '../../data/automotiveAdsData';
import { updateAdInStorage } from '../../services/adsStorage';

export default function EditAdModal({
  ad,
  isOpen,
  onClose,
  onAdUpdated
}) {
  const [title, setTitle] = useState(ad?.title || '');
  const [company, setCompany] = useState(ad?.company || '');
  const [category, setCategory] = useState(ad?.category || 'mecanica');
  const [description, setDescription] = useState(ad?.description || '');
  const [priceText, setPriceText] = useState(ad?.priceText || '');
  const [commune, setCommune] = useState(ad?.commune || 'Providencia');
  const [address, setAddress] = useState(ad?.address || '');
  const [phone, setPhone] = useState(ad?.phone || '');
  const [whatsapp, setWhatsapp] = useState(ad?.whatsapp || '');
  const [openingHours, setOpeningHours] = useState(ad?.openingHours || 'Lun a Sáb 09:00 - 19:00');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !ad) return null;

  const currentTierConfig = AD_TIERS[ad.tier] || AD_TIERS.basica;

  const handleSubmit = (e) => {
    e.preventDefault();

    const categoryObj = SERVICE_CATEGORIES.find((c) => c.id === category);

    const updatedFields = {
      title: title.trim(),
      company: company.trim(),
      category,
      categoryLabel: categoryObj?.label || 'Mecánica',
      description: description.trim(),
      priceText: priceText.trim(),
      commune,
      address: address.trim(),
      phone: phone.trim(),
      whatsapp: (ad.tier === 'premium' || ad.tier === 'empresarial')
        ? whatsapp.trim().replace(/\D/g, '')
        : null,
      openingHours: openingHours.trim(),
      updatedAt: new Date().toISOString()
    };

    updateAdInStorage(ad.id, updatedFields);
    onAdUpdated?.(ad.id, updatedFields);
    setIsSuccess(true);
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
      <div className="create-ad-modal-card">
        {!isSuccess ? (
          <>
            <div className="booking-modal-header">
              <div>
                <h3>
                  <Edit3 className="text-blue-600" size={22} />
                  Editar Anuncio Clasificado
                </h3>
                <p>
                  Modifica los datos, contactos o descripción de tu aviso (Rango actual: <strong className="uppercase">{currentTierConfig.name}</strong>).
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

            <form onSubmit={handleSubmit}>
              <div className="booking-form-grid">
                
                <div className="booking-field col-span-2">
                  <label>Título del Anuncio *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>Nombre de la Empresa / Taller *</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>Categoría de Servicio *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    {SERVICE_CATEGORIES.filter((c) => c.id !== 'TODAS').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji ? `${c.emoji} ` : ''}{c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="booking-field col-span-2">
                  <label>Descripción del servicio *</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>Comuna *</label>
                  <select
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    required
                  >
                    {CHILE_COMMUNES.filter((c) => c !== 'Todas las comunas').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="booking-field">
                  <label>Dirección física *</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>Teléfono de contacto *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>WhatsApp {ad.tier === 'premium' || ad.tier === 'empresarial' ? '(Activo en tu plan)' : '(Bloqueado en este rango)'}</label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    disabled={ad.tier === 'basica' || ad.tier === 'destacada'}
                  />
                </div>

                <div className="booking-field">
                  <label>Precio / Cotización *</label>
                  <input
                    type="text"
                    value={priceText}
                    onChange={(e) => setPriceText(e.target.value)}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>Horario de atención</label>
                  <input
                    type="text"
                    value={openingHours}
                    onChange={(e) => setOpeningHours(e.target.value)}
                  />
                </div>

              </div>

              <div className="booking-actions-row">
                <button
                  type="button"
                  className="btn-ad-phone"
                  onClick={handleClose}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-post-ad"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={36} />
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
              ¡Anuncio Actualizado!
            </h3>

            <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
              Los cambios en tu aviso han sido guardados y se encuentran reflejados en el Mural de Anuncios.
            </p>

            <button
              type="button"
              className="btn-post-ad mx-auto"
              onClick={handleClose}
            >
              Listo
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
