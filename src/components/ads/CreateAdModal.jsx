import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Plus, Sparkles, CheckCircle2, ShieldCheck, Zap, Crown, Star,
  Image as ImageIcon, Phone, MapPin, Tag, Clock, MessageCircle
} from 'lucide-react';
import { AD_TIERS, SERVICE_CATEGORIES, CHILE_COMMUNES } from '../../data/automotiveAdsData';

const SAMPLE_PHOTO_PRESETS = [
  'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&auto=format&fit=crop&q=80'
];

export default function CreateAdModal({
  isOpen,
  onClose,
  onAdCreated
}) {
  const [selectedTier, setSelectedTier] = useState('empresarial');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState('mecanica');
  const [description, setDescription] = useState('');
  const [priceText, setPriceText] = useState('');
  const [commune, setCommune] = useState('Providencia');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [openingHours, setOpeningHours] = useState('Lun a Vie 09:00 - 18:30');
  const [selectedImages, setSelectedImages] = useState([SAMPLE_PHOTO_PRESETS[0]]);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const currentTierConfig = AD_TIERS[selectedTier] || AD_TIERS.basica;
  const maxImagesAllowed = currentTierConfig.maxImages || 2;

  const handleToggleImagePreset = (url) => {
    if (selectedImages.includes(url)) {
      if (selectedImages.length > 1) {
        setSelectedImages(selectedImages.filter((img) => img !== url));
      }
    } else {
      if (selectedImages.length < maxImagesAllowed) {
        setSelectedImages([...selectedImages, url]);
      } else {
        // Reemplazar la última
        setSelectedImages([...selectedImages.slice(1), url]);
      }
    }
  };

  const handleAddCustomImage = () => {
    if (!customImageUrl.trim()) return;
    if (selectedImages.length < maxImagesAllowed) {
      setSelectedImages([...selectedImages, customImageUrl.trim()]);
      setCustomImageUrl('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const categoryObj = SERVICE_CATEGORIES.find((c) => c.id === category);

    const newAd = {
      id: `ad-user-${Date.now()}`,
      tier: selectedTier,
      title: title.trim(),
      company: company.trim(),
      category,
      categoryLabel: categoryObj?.label || 'Mecánica',
      description: description.trim(),
      priceType: priceText.toLowerCase().includes('cotiz') ? 'quote' : 'fixed',
      priceText: priceText.trim(),
      priceValue: parseInt(priceText.replace(/\D/g, ''), 10) || 0,
      region: 'Región Metropolitana',
      commune,
      address: address.trim(),
      phone: phone.trim(),
      whatsapp: (selectedTier === 'premium' || selectedTier === 'empresarial')
        ? (whatsapp.trim().replace(/\D/g, '') || null)
        : null,
      openingHours: openingHours.trim(),
      rating: 5.0,
      reviewsCount: 1,
      images: selectedImages.length > 0 ? selectedImages : [SAMPLE_PHOTO_PRESETS[0]],
      features: ['Atención directa', 'Servicio garantizado'],
      servicesOffered: [title.trim(), 'Diagnóstico general'],
      is24Hours: openingHours.toLowerCase().includes('24'),
      hasOnlineBooking: selectedTier === 'empresarial',
      publishedAt: new Date().toISOString().split('T')[0]
    };

    onAdCreated?.(newAd);
    setIsSuccess(true);
  };

  const handleCloseAfterSuccess = () => {
    setIsSuccess(false);
    onClose?.();
  };

  return createPortal(
    <div
      className="booking-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
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
                  <Plus className="text-amber-500" size={22} />
                  Publicar Anuncio en el Mural Automotriz
                </h3>
                <p>
                  Ofrece tus servicios mecánicos, taller, detailing o asistencia a miles de conductores.
                </p>
              </div>
              <button
                type="button"
                className="story-close-btn"
                style={{ background: '#f1f5f9', color: '#0f172a' }}
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Selector de Nivel de Plan */}
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-700 block mb-2 uppercase">
                  1. Selecciona el Plan de tu Anuncio
                </label>
                <div className="tier-selector-grid">
                  {/* Básica */}
                  <div
                    className={`tier-card-option ${selectedTier === 'basica' ? 'selected-basica' : ''}`}
                    onClick={() => setSelectedTier('basica')}
                  >
                    <span className="tier-option-badge bg-slate-200 text-slate-700">Gratis</span>
                    <h4>Básica</h4>
                    <div className="tier-features-list">
                      • Hasta 2 imágenes<br />
                      • Contacto telefónico<br />
                      • WhatsApp & Agendamiento bloqueados
                    </div>
                  </div>

                  {/* Destacada */}
                  <div
                    className={`tier-card-option ${selectedTier === 'destacada' ? 'selected-destacada' : ''}`}
                    onClick={() => setSelectedTier('destacada')}
                  >
                    <span className="tier-option-badge bg-amber-200 text-amber-800">⭐ Destacado</span>
                    <h4>Destacada</h4>
                    <div className="tier-features-list">
                      • Card amarillo suave<br />
                      • Etiqueta de Destacado<br />
                      • Mayor visibilidad
                    </div>
                  </div>

                  {/* Premium */}
                  <div
                    className={`tier-card-option ${selectedTier === 'premium' ? 'selected-premium' : ''}`}
                    onClick={() => setSelectedTier('premium')}
                  >
                    <span className="tier-option-badge bg-purple-200 text-purple-800">⚡ Premium</span>
                    <h4>Premium</h4>
                    <div className="tier-features-list">
                      • Card en tono morado<br />
                      • WhatsApp directo rápido<br />
                      • Hasta 4 imágenes
                    </div>
                  </div>

                  {/* Empresarial */}
                  <div
                    className={`tier-card-option ${selectedTier === 'empresarial' ? 'selected-empresarial' : ''}`}
                    onClick={() => setSelectedTier('empresarial')}
                  >
                    <span className="tier-option-badge bg-emerald-200 text-emerald-800">👑 Empresarial</span>
                    <h4>Empresarial</h4>
                    <div className="tier-features-list">
                      • Agendamiento en línea<br />
                      • WhatsApp directo<br />
                      • Galería completa
                    </div>
                  </div>
                </div>
              </div>

              {/* Formulario de Datos */}
              <label className="text-xs font-bold text-slate-700 block mb-2 uppercase">
                2. Información del Servicio
              </label>
              <div className="booking-form-grid">
                
                <div className="booking-field col-span-2">
                  <label>Título del Anuncio *</label>
                  <input
                    type="text"
                    placeholder="Ej: Taller Especializado en Frenos y Embragues Multimarca"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>Nombre de la Empresa o Taller *</label>
                  <input
                    type="text"
                    placeholder="Ej: Frenos & Mecánica Central SpA"
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
                  <label>Descripción detallada del servicio *</label>
                  <textarea
                    rows={3}
                    placeholder="Describe los trabajos que realizas, equipos con los que cuentas, garantías otorgadas, etc."
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
                    placeholder="Ej: Av. Providencia 1240, Local 5"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>Teléfono de contacto *</label>
                  <input
                    type="tel"
                    placeholder="+56 9 8765 4321"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>WhatsApp {selectedTier === 'premium' || selectedTier === 'empresarial' ? '(Habilitado en tu plan)' : '(Bloqueado en este plan)'}</label>
                  <input
                    type="tel"
                    placeholder="+56 9 8765 4321"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    disabled={selectedTier === 'basica' || selectedTier === 'destacada'}
                  />
                </div>

                <div className="booking-field">
                  <label>Precio / Cotización *</label>
                  <input
                    type="text"
                    placeholder="Ej: Desde $25.000 / Cotización previa"
                    value={priceText}
                    onChange={(e) => setPriceText(e.target.value)}
                    required
                  />
                </div>

                <div className="booking-field">
                  <label>Horario de atención</label>
                  <input
                    type="text"
                    placeholder="Ej: Lun a Sáb 09:00 - 19:00"
                    value={openingHours}
                    onChange={(e) => setOpeningHours(e.target.value)}
                  />
                </div>

                {/* Selección de Fotos */}
                <div className="booking-field col-span-2">
                  <label>Fotos del anuncio (Máximo {maxImagesAllowed} imágenes en plan {currentTierConfig.name})</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {SAMPLE_PHOTO_PRESETS.map((presetUrl, idx) => {
                      const isSelected = selectedImages.includes(presetUrl);
                      return (
                        <div
                          key={idx}
                          className={`relative cursor-pointer rounded-lg overflow-hidden border-2 w-16 h-12 ${isSelected ? 'border-blue-600 ring-2 ring-blue-400' : 'border-slate-200 opacity-60'}`}
                          onClick={() => handleToggleImagePreset(presetUrl)}
                        >
                          <img src={presetUrl} alt="" className="w-full h-full object-cover" />
                          {isSelected && (
                            <span className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-0.5">
                              <CheckCircle2 size={10} />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="O ingresa una URL de imagen externa..."
                      value={customImageUrl}
                      onChange={(e) => setCustomImageUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-ad-phone"
                      onClick={handleAddCustomImage}
                    >
                      Añadir Foto
                    </button>
                  </div>
                </div>

              </div>

              <div className="booking-actions-row">
                <button
                  type="button"
                  className="btn-ad-phone"
                  onClick={onClose}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-post-ad"
                >
                  <Plus size={16} />
                  Publicar Anuncio Ahora
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
              ¡Anuncio Publicado Exitosamente!
            </h3>

            <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
              Tu anuncio clasificado bajo el plan <strong>{currentTierConfig.name}</strong> ya se encuentra visible para todos los usuarios en el Mural de Anuncios.
            </p>

            <button
              type="button"
              className="btn-post-ad mx-auto"
              onClick={handleCloseAfterSuccess}
            >
              Ver en el Mural de Anuncios
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
