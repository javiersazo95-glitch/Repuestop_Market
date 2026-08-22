import React, { useMemo, useState } from 'react';
import {
  AlertCircle, Camera, Check, Clock, Coins, Film, Loader2, Plus, Trash2, X
} from 'lucide-react';
import {
  AD_TIERS, AD_TIER_ORDER, AD_FEATURE_TAGS, SERVICE_CATEGORIES, CHILE_COMMUNES
} from '../../data/automotiveAdsData';
import { UPGRADE_TOKEN_COSTS, uploadAdImages, adErrorMessage } from '../../services/adsStorage';

/**
 * Formulario unico de publicacion y edicion de anuncios.
 *
 * Publicar y editar mandan el MISMO `AnuncioRequestDTO` y, sobre todo,
 * `AnuncioService.aplicar()` reescribe todos los campos en cada PUT: dos
 * formularios distintos significaban que editar borraba lo que el de creacion si
 * mandaba (las historias y la agenda, por ejemplo). Por eso el formulario emite
 * el anuncio COMPLETO, mezclado sobre `initialAd`, y no solo lo que se toco.
 *
 * Los topes por plan (`maxImages`, `maxTags`, `maxStories`) son los de
 * `AD_TIERS`, que replican las validaciones del backend: pasarse es un 400.
 */
export default function AdForm({
  initialAd,
  mode = 'create',
  tokensBalance = 0,
  isSubmitting = false,
  submitError = '',
  submitLabel,
  onSubmit,
  onCancel
}) {
  const [tier, setTier] = useState(initialAd?.tier || 'basica');
  const [title, setTitle] = useState(initialAd?.title || '');
  const [company, setCompany] = useState(initialAd?.company || '');
  const [category, setCategory] = useState(initialAd?.category || 'mecanica');
  const [description, setDescription] = useState(initialAd?.description || '');
  const [priceType, setPriceType] = useState(initialAd?.priceType === 'fixed' ? 'fixed' : 'quote');
  const [priceText, setPriceText] = useState(initialAd?.priceText || '');
  const [priceValue, setPriceValue] = useState(
    initialAd?.priceValue ? String(initialAd.priceValue) : ''
  );
  const [region, setRegion] = useState(initialAd?.region || 'Región Metropolitana');
  const [commune, setCommune] = useState(initialAd?.commune || 'Providencia');
  const [address, setAddress] = useState(initialAd?.address || '');
  const [phone, setPhone] = useState(initialAd?.phone || '');
  const [whatsapp, setWhatsapp] = useState(initialAd?.whatsapp || '');
  const [openingHours, setOpeningHours] = useState(initialAd?.openingHours || '');
  const [is24Hours, setIs24Hours] = useState(initialAd?.is24Hours === true);
  const [features, setFeatures] = useState(initialAd?.features || []);
  const [servicesOffered, setServicesOffered] = useState(initialAd?.servicesOffered || []);
  const [serviceDraft, setServiceDraft] = useState('');
  const [images, setImages] = useState(initialAd?.images || []);
  const [storyImages, setStoryImages] = useState(initialAd?.storyImages || []);
  const [uploadTarget, setUploadTarget] = useState('');
  const [uploadError, setUploadError] = useState('');

  const limits = AD_TIERS[tier] || AD_TIERS.basica;
  const tierCost = UPGRADE_TOKEN_COSTS[tier] || 0;
  const canAffordTier = mode !== 'create' || tokensBalance >= tierCost;

  const categoryLabel = useMemo(
    () => SERVICE_CATEGORIES.find((c) => c.id === category)?.label || '',
    [category]
  );

  // Al bajar de plan (solo posible en el formulario de creacion) los topes se
  // achican: se recortan aca para que la vista previa muestre lo que realmente
  // se va a guardar, y no fotos que el backend va a rechazar.
  const visibleImages = images.slice(0, limits.maxImages);
  const visibleStories = storyImages.slice(0, limits.maxStories);
  const visibleFeatures = features.slice(0, limits.maxTags);
  const visibleServices = servicesOffered.slice(0, limits.maxTags);

  const toggleFeature = (tag) => {
    setFeatures((current) => {
      if (current.includes(tag)) return current.filter((item) => item !== tag);
      if (current.length >= limits.maxTags) return current;
      return [...current, tag];
    });
  };

  const addService = () => {
    const value = serviceDraft.trim();
    if (!value || servicesOffered.includes(value) || servicesOffered.length >= limits.maxTags) return;
    setServicesOffered([...servicesOffered, value]);
    setServiceDraft('');
  };

  const handleUpload = async (event, target) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const isStories = target === 'stories';
    const currentList = isStories ? storyImages : images;
    const max = isStories ? limits.maxStories : limits.maxImages;
    const room = max - currentList.length;
    if (room <= 0) return;

    setUploadTarget(target);
    setUploadError('');
    try {
      const urls = await uploadAdImages(files.slice(0, room));
      if (isStories) setStoryImages([...currentList, ...urls].slice(0, max));
      else setImages([...currentList, ...urls].slice(0, max));
    } catch (error) {
      setUploadError(adErrorMessage(error, 'No se pudieron subir las fotos.'));
    } finally {
      setUploadTarget('');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit?.({
      ...initialAd,
      tier,
      title: title.trim(),
      company: company.trim(),
      category,
      categoryLabel,
      description: description.trim(),
      priceType,
      priceText: priceText.trim(),
      priceValue: priceType === 'fixed' ? Number(priceValue.replace(/\D/g, '')) || 0 : null,
      region: region.trim(),
      commune,
      address: address.trim(),
      phone: phone.trim(),
      whatsapp: limits.hasWhatsapp ? whatsapp.trim() : '',
      openingHours: openingHours.trim(),
      is24Hours,
      features: visibleFeatures,
      servicesOffered: visibleServices,
      images: visibleImages,
      storyImages: visibleStories
    });
  };

  const renderGallery = (target, list, max, hint) => (
    <div className="ad-upload-block">
      <div className="ad-upload-grid">
        {list.map((url) => (
          <div key={url} className="ad-upload-thumb">
            <img src={url} alt="" />
            <button
              type="button"
              aria-label="Quitar foto"
              onClick={() => (target === 'stories'
                ? setStoryImages(storyImages.filter((item) => item !== url))
                : setImages(images.filter((item) => item !== url)))}
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {list.length < max && (
          <label className={`ad-upload-drop ${uploadTarget === target ? 'is-busy' : ''}`}>
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={Boolean(uploadTarget)}
              onChange={(event) => handleUpload(event, target)}
            />
            {uploadTarget === target
              ? <Loader2 size={18} className="spin-icon" />
              : (target === 'stories' ? <Film size={18} /> : <Camera size={18} />)}
            <span>{uploadTarget === target ? 'Subiendo…' : 'Agregar'}</span>
          </label>
        )}
      </div>
      <small className="ad-upload-hint">{hint}</small>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {mode === 'create' && (
        <div className="mb-4">
          <label className="ad-form-step-label">1. Plan de tu anuncio</label>
          <div className="tier-selector-grid">
            {AD_TIER_ORDER.map((tierId) => {
              const config = AD_TIERS[tierId];
              const cost = UPGRADE_TOKEN_COSTS[tierId] || 0;
              const affordable = tokensBalance >= cost;
              return (
                <button
                  type="button"
                  key={tierId}
                  className={`tier-card-option ${tier === tierId ? `selected-${tierId}` : ''} ${affordable ? '' : 'is-locked'}`}
                  onClick={() => setTier(tierId)}
                >
                  <span className="tier-option-badge" style={{ background: `${config.badgeColor}1a`, color: config.badgeColor }}>
                    {cost > 0 ? `${cost} Fichas` : 'Gratis'}
                  </span>
                  <h4>{config.name}</h4>
                  <div className="tier-features-list">
                    • {config.maxImages} fotos · {config.maxTags} etiquetas<br />
                    • {config.hasWhatsapp ? 'WhatsApp directo' : 'Solo teléfono'}<br />
                    • {config.maxStories > 0 ? `${config.maxStories} historias` : 'Sin historias'}
                    {config.hasBooking ? <><br />• Agenda en línea</> : null}
                  </div>
                  {!affordable && <small className="tier-locked-note">Saldo insuficiente</small>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="ad-form-step-label">
        {mode === 'create' ? '2. Información del servicio' : 'Información del servicio'}
      </label>

      <div className="booking-form-grid">
        <div className="booking-field col-span-2">
          <label>Título del anuncio *</label>
          <input
            type="text"
            maxLength={160}
            placeholder="Ej: Taller especializado en frenos y embragues multimarca"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="booking-field">
          <label>Nombre de la empresa o taller *</label>
          <input
            type="text"
            maxLength={180}
            placeholder="Ej: Frenos & Mecánica Central SpA"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
          />
        </div>

        <div className="booking-field">
          <label>Categoría de servicio *</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            {SERVICE_CATEGORIES.filter((c) => c.id !== 'TODAS').map((c) => (
              <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.label}</option>
            ))}
          </select>
        </div>

        <div className="booking-field col-span-2">
          <label>Descripción del servicio *</label>
          <textarea
            rows={3}
            maxLength={5000}
            placeholder="Describe los trabajos que realizas, con qué equipos cuentas y qué garantías ofreces."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        {/* El tipo de precio es un campo real del anuncio (`priceType`), no se
            deduce de que el texto diga "cotización": la tarjeta del mural lo usa
            para rotular el bloque como Tarifa o Presupuesto. */}
        <div className="booking-field">
          <label>Modalidad de cobro *</label>
          <div className="ad-radio-row">
            <label className={`ad-radio-chip ${priceType === 'quote' ? 'active' : ''}`}>
              <input
                type="radio"
                name="priceType"
                value="quote"
                checked={priceType === 'quote'}
                onChange={() => setPriceType('quote')}
              />
              A cotizar
            </label>
            <label className={`ad-radio-chip ${priceType === 'fixed' ? 'active' : ''}`}>
              <input
                type="radio"
                name="priceType"
                value="fixed"
                checked={priceType === 'fixed'}
                onChange={() => setPriceType('fixed')}
              />
              Precio de referencia
            </label>
          </div>
        </div>

        <div className="booking-field">
          <label>{priceType === 'fixed' ? 'Precio de referencia (CLP) *' : 'Texto del precio *'}</label>
          {priceType === 'fixed' ? (
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 25000"
              value={priceValue}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setPriceValue(digits);
                setPriceText(digits ? `Desde $${Number(digits).toLocaleString('es-CL')}` : '');
              }}
              required
            />
          ) : (
            <input
              type="text"
              maxLength={120}
              placeholder="Ej: Según presupuesto"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              required
            />
          )}
        </div>

        <div className="booking-field">
          <label>Región</label>
          <input
            type="text"
            maxLength={120}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
        </div>

        <div className="booking-field">
          <label>Comuna *</label>
          <select value={commune} onChange={(e) => setCommune(e.target.value)} required>
            {CHILE_COMMUNES.filter((c) => c !== 'Todas las comunas').map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="booking-field col-span-2">
          <label>Dirección física *</label>
          <input
            type="text"
            maxLength={300}
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
            maxLength={40}
            placeholder="+56 9 8765 4321"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div className="booking-field">
          <label>
            WhatsApp {limits.hasWhatsapp
              ? `(incluido en el plan ${limits.name})`
              : `(no disponible en el plan ${limits.name})`}
          </label>
          <input
            type="tel"
            maxLength={40}
            placeholder="+56 9 8765 4321"
            value={limits.hasWhatsapp ? whatsapp : ''}
            onChange={(e) => setWhatsapp(e.target.value)}
            disabled={!limits.hasWhatsapp}
          />
        </div>

        <div className="booking-field col-span-2">
          <label>Horario de atención</label>
          <input
            type="text"
            maxLength={300}
            placeholder="Ej: Lun a Sáb 09:00 - 19:00"
            value={openingHours}
            onChange={(e) => setOpeningHours(e.target.value)}
            disabled={is24Hours}
          />
          {/* `is24Hours` es un campo propio y el mural filtra por él. Antes se
              adivinaba buscando "24" dentro del horario escrito a mano. */}
          <label className="ad-check-row">
            <input
              type="checkbox"
              checked={is24Hours}
              onChange={(e) => {
                setIs24Hours(e.target.checked);
                if (e.target.checked) setOpeningHours('Atención 24 horas');
              }}
            />
            <Clock size={13} /> Atiendo las 24 horas
          </label>
        </div>

        <div className="booking-field col-span-2">
          <label>Etiquetas del anuncio ({visibleFeatures.length}/{limits.maxTags} del plan {limits.name})</label>
          <div className="ad-tag-picker">
            {AD_FEATURE_TAGS.map((tag) => {
              const selected = visibleFeatures.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  className={`ad-tag-chip ${selected ? 'active' : ''}`}
                  disabled={!selected && visibleFeatures.length >= limits.maxTags}
                  onClick={() => toggleFeature(tag)}
                >
                  {selected && <Check size={11} />} {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div className="booking-field col-span-2">
          <label>Servicios que ofreces ({visibleServices.length}/{limits.maxTags})</label>
          <div className="ad-chip-input">
            <input
              type="text"
              maxLength={120}
              placeholder="Ej: Cambio de pastillas de freno"
              value={serviceDraft}
              onChange={(e) => setServiceDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addService(); }
              }}
              disabled={servicesOffered.length >= limits.maxTags}
            />
            <button
              type="button"
              className="btn-ad-phone"
              onClick={addService}
              disabled={servicesOffered.length >= limits.maxTags}
            >
              <Plus size={14} /> Agregar
            </button>
          </div>
          {visibleServices.length > 0 && (
            <div className="ad-tag-picker">
              {visibleServices.map((service) => (
                <span key={service} className="ad-tag-chip active">
                  {service}
                  <button
                    type="button"
                    aria-label={`Quitar ${service}`}
                    onClick={() => setServicesOffered(servicesOffered.filter((item) => item !== service))}
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="booking-field col-span-2">
          <label>Fotos del anuncio ({visibleImages.length}/{limits.maxImages} del plan {limits.name})</label>
          {renderGallery('images', visibleImages, limits.maxImages, 'JPG o PNG, hasta 5MB por foto. La primera es la portada en el mural.')}
        </div>

        {limits.maxStories > 0 && (
          <div className="booking-field col-span-2">
            <label>Historias ({visibleStories.length}/{limits.maxStories} del plan {limits.name})</label>
            {renderGallery('stories', visibleStories, limits.maxStories, 'Aparecen en el carrusel de historias, arriba del mural.')}
          </div>
        )}
      </div>

      {(uploadError || submitError) && (
        <div className="ad-form-error">
          <AlertCircle size={16} />
          <span>{uploadError || submitError}</span>
        </div>
      )}

      <div className="booking-actions-row">
        <button type="button" className="btn-ad-phone" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-post-ad"
          disabled={isSubmitting || Boolean(uploadTarget) || !canAffordTier}
        >
          {isSubmitting ? <Loader2 size={16} className="spin-icon" /> : <Plus size={16} />}
          {isSubmitting
            ? 'Enviando…'
            : submitLabel || (mode === 'create'
              ? (tierCost > 0 ? `Publicar por ${tierCost} Fichas` : 'Publicar anuncio')
              : 'Guardar cambios')}
        </button>
      </div>

      {mode === 'create' && !canAffordTier && (
        <p className="ad-form-balance-note">
          <Coins size={13} /> El plan {limits.name} cuesta {tierCost} Fichas y tu saldo es de {tokensBalance}. Recarga o elige otro plan.
        </p>
      )}
    </form>
  );
}
