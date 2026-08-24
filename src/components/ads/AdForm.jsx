import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CalendarClock, Camera, Check, Clock, Film, Loader2, Plus, Trash2, X
} from 'lucide-react';
import {
  AD_TIERS, AD_TIER_ORDER, AD_FEATURE_TAGS, SERVICE_CATEGORIES
} from '../../data/automotiveAdsData';
import {
  createDefaultSchedule, parseOpeningHours, formatOpeningHours, scheduleToAgendaConfig
} from '../../data/openingHours';
import { getRegionesApi, getComunasApi, getSellerStoreApi } from '../../services/api';
import { resolverUbicacionPorNombre } from '../../services/geoLookup';
import { useAuth } from '../../context/AuthContext';
import AddressAutocompleteInput from '../AddressAutocompleteInput';
import OpeningHoursPicker from './OpeningHoursPicker';
import {
  createDefaultAgendaConfig, normalizeAgendaConfig, toAgendaConfigPayload,
  getAgendaSummaryText, validateAgendaConfig
} from '../../data/agendaConfig';
import { UPGRADE_TOKEN_COSTS, uploadAdImages, adErrorMessage } from '../../services/adsStorage';
import AgendaScheduleEditor from './AgendaScheduleEditor';
import RepuestopCoin from './RepuestopCoin';

/**
 * Contador de caracteres. Existe porque el campo dejaba de aceptar texto sin
 * decir por que: los `maxLength` estaban puestos pero eran invisibles.
 *
 * Con `always={false}` aparece recien al 80% del tope, para los campos donde el
 * limite es holgado —la direccion— y un "0/300" permanente seria solo ruido.
 */
function CharCount({ value, max, always = true }) {
  const usados = String(value || '').length;
  if (!always && usados < max * 0.8) return null;
  return (
    <small className={`char-count ${usados >= max ? 'is-full' : ''}`}>{usados}/{max}</small>
  );
}

/**
 * Topes del formulario. El backend acepta mas (descripcion 5000, texto de precio
 * 120, direccion 300), pero un cliente mas estricto es seguro: lo que se guarda
 * sigue cabiendo. Se bajan porque el tope del DTO no es una medida editorial.
 *
 * La descripcion se muestra recortada a 2 lineas en la tarjeta del mural, y
 * COMPLETA en el visor de historias y en el detalle del movil: 5000 caracteres
 * son unas 70 lineas de telefono encima de una foto.
 *
 * El precio son dos campos distintos segun la modalidad: en "precio de
 * referencia" se cuentan DIGITOS y en "a cotizar", caracteres de texto libre.
 * Nueve digitos son $999.999.999 y ademas evitan el desborde: el backend recibe
 * un Long y `Number()` de JS pierde precision pasando los 16 digitos.
 */
const MAX_DESCRIPTION = 500;
const MAX_PRICE_DIGITS = 9;
const MAX_PRICE_TEXT = 80;
const MAX_ADDRESS = 300;

/**
 * Telefono chileno: el prefijo +56 es fijo y solo se escriben los 9 digitos.
 * Es lo mismo que hace el CreateAdModal del movil (`stripChileCountryCode` al
 * abrir, `+56 ...` al enviar). El campo aceptaba letras y simbolos y viajaban
 * tal cual al backend, que guarda 40 caracteres sin validar nada.
 */
const PHONE_DIGITS = 9;
const soloDigitos = (valor) => String(valor || '').replace(/\D/g, '').slice(0, PHONE_DIGITS);
const quitarPrefijo = (valor) => {
  const digitos = String(valor || '').replace(/\D/g, '');
  return (digitos.startsWith('56') ? digitos.slice(2) : digitos).slice(-PHONE_DIGITS);
};

/**
 * El movil identifica la agenda de un aviso por `agendaConfigId` y recien despues
 * mira el `agendaConfig` que trae el anuncio (`mobile/components/ads/AdAppointmentModal.tsx`,
 * en el efecto que resuelve la configuracion). Un aviso publicado desde la web con
 * la agenda completa pero sin ese id se ve SIN dias disponibles en la app, aunque
 * el backend lo haya aceptado: no valida ese campo. Por eso siempre se emite uno.
 */
const newAgendaConfigId = () => `web-agc-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

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
  // Region y comuna salen del catalogo real (`/geografia/...`), igual que en
  // `BuyerAddressBook` y que en el CreateAdModal del movil. Antes la region era un
  // `<input>` de texto libre y la comuna una lista fija de 18 nombres que mezclaba
  // Providencia y Ñuñoa con Viña, Concepcion, Antofagasta y Temuco, sin relacion
  // con la region escrita. El anuncio guarda NOMBRES, no ids, asi que el catalogo
  // se usa para elegir bien y se envia el nombre resuelto.
  const [regiones, setRegiones] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [comunaId, setComunaId] = useState('');
  const [address, setAddress] = useState(initialAd?.address || '');
  const [phone, setPhone] = useState(() => quitarPrefijo(initialAd?.phone));
  const [whatsapp, setWhatsapp] = useState(() => quitarPrefijo(initialAd?.whatsapp));
  // El horario se elige, no se escribe. Si el anuncio traia una cadena que no
  // calza con el formato del selector se cae al horario por defecto, en vez de
  // mostrar controles que digan algo distinto de lo que hay guardado.
  const [schedule, setSchedule] = useState(
    () => parseOpeningHours(initialAd?.openingHours) || createDefaultSchedule()
  );
  const [is24Hours, setIs24Hours] = useState(initialAd?.is24Hours === true);
  const [features, setFeatures] = useState(initialAd?.features || []);
  const [servicesOffered, setServicesOffered] = useState(initialAd?.servicesOffered || []);
  const [serviceDraft, setServiceDraft] = useState('');
  const [images, setImages] = useState(initialAd?.images || []);
  const [storyImages, setStoryImages] = useState(initialAd?.storyImages || []);
  const [uploadTarget, setUploadTarget] = useState('');
  const [uploadError, setUploadError] = useState('');

  // La agenda solo existe en el plan Empresarial. Se conserva en el estado
  // aunque se baje de plan para no perderla si el socio vuelve a subir antes de
  // guardar; lo que decide si viaja al backend es `bookingEnabled` + el plan.
  const [bookingEnabled, setBookingEnabled] = useState(initialAd?.hasOnlineBooking === true);
  const [agendaConfig, setAgendaConfig] = useState(
    () => normalizeAgendaConfig(initialAd?.agendaConfig) || createDefaultAgendaConfig()
  );
  const [agendaConfigName, setAgendaConfigName] = useState(initialAd?.agendaConfigName || '');
  const [agendaConfigId] = useState(initialAd?.agendaConfigId || newAgendaConfigId());

  const { user } = useAuth();
  const regionNombre = regiones.find((r) => String(r.id) === String(regionId))?.nombre || '';
  const comunaNombre = comunas.find((c) => String(c.id) === String(comunaId))?.nombre || '';

  // Catalogo de regiones, una vez.
  useEffect(() => {
    const controller = new AbortController();
    getRegionesApi(1, { signal: controller.signal })
      .then((lista) => setRegiones(Array.isArray(lista) ? lista : []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Comunas de la region elegida. Al cambiar de region la comuna se limpia:
  // dejarla puesta es lo que producia pares imposibles como Metropolitana/Temuco.
  useEffect(() => {
    if (!regionId) { setComunas([]); return undefined; }
    const controller = new AbortController();
    getComunasApi(regionId, { signal: controller.signal })
      .then((lista) => setComunas(Array.isArray(lista) ? lista : []))
      .catch(() => {});
    return () => controller.abort();
  }, [regionId]);

  /** Deja seleccionados la region y la comuna que correspondan a esos nombres. */
  const seleccionarPorNombre = useCallback(async (nombreRegion, nombreComuna) => {
    const resuelto = await resolverUbicacionPorNombre({ region: nombreRegion, comuna: nombreComuna });
    if (resuelto?.regiones?.length) setRegiones(resuelto.regiones);
    if (resuelto?.comunas?.length) setComunas(resuelto.comunas);
    if (resuelto?.regionId) setRegionId(String(resuelto.regionId));
    if (resuelto?.comunaId) setComunaId(String(resuelto.comunaId));
    return resuelto;
  }, []);

  // Al editar, el anuncio guarda los NOMBRES: hay que volver a ubicarlos en el
  // catalogo para que los dos selectores queden en la opcion correcta.
  useEffect(() => {
    if (!initialAd?.commune) return;
    seleccionarPorNombre(initialAd.region, initialAd.commune);
  }, [initialAd?.region, initialAd?.commune, seleccionarPorNombre]);

  /**
   * Prellenado con los datos de la tienda, SOLO al publicar y solo sobre campos
   * vacios: al editar, lo que el socio ya guardo manda. El taller del aviso puede
   * ser otro local, asi que todo esto es editable.
   *
   * `GET /proveedores/{id}/tienda` trae nombre, telefono, direccion, region,
   * comuna y el horario que se capturo en el registro de la app (`Proveedor.hours`).
   */
  useEffect(() => {
    const sellerId = user?.sellerId;
    if (mode !== 'create' || !sellerId) return undefined;
    const controller = new AbortController();
    let vigente = true;

    getSellerStoreApi(sellerId, { signal: controller.signal })
      .then((tienda) => {
        if (!vigente || !tienda) return;
        setCompany((actual) => actual || tienda.storeName || '');
        setPhone((actual) => actual || quitarPrefijo(tienda.phone));
        setAddress((actual) => actual || tienda.address || '');
        const horario = parseOpeningHours(tienda.hours);
        if (horario) setSchedule(horario);
        if (tienda.comuna) seleccionarPorNombre(tienda.region, tienda.comuna);
      })
      .catch(() => {});

    return () => { vigente = false; controller.abort(); };
  }, [mode, user?.sellerId, seleccionarPorNombre]);

  /**
   * Al encender las reservas, la agenda parte del horario de atencion ya
   * declarado en vez de un Lun-Vie generico. Es el mismo dato dicho dos veces:
   * sin esto se podia publicar "Lun a Sab 09:00 a 20:00" con una agenda que solo
   * ofrecia Mar a Vie hasta las 18:00. Solo siembra al activarla; despues el
   * socio ajusta bloques y colacion sin que nada se los pise.
   */
  const handleBookingToggle = (activar) => {
    setBookingEnabled(activar);
    if (!activar || initialAd?.agendaConfig) return;
    const sembrada = scheduleToAgendaConfig(schedule, agendaConfig);
    if (sembrada) setAgendaConfig(sembrada);
  };

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

  // `AnuncioService.validar()` responde 400 si `hasOnlineBooking` viene encendido
  // sin una agenda que pase `validarAgenda()`. Se bloquea el envio en vez de
  // dejar que el backend lo rechace despues de subir las fotos.
  const agendaErrors = limits.hasBooking && bookingEnabled ? validateAgendaConfig(agendaConfig) : [];
  const hasAgendaErrors = agendaErrors.length > 0;

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
    if (hasAgendaErrors) return;

    const bookingOn = limits.hasBooking && bookingEnabled;
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
      // Se guardan los NOMBRES del catalogo, que es lo que el anuncio persiste.
      region: regionNombre,
      commune: comunaNombre,
      address: address.trim(),
      // El prefijo lo pone el formulario; el campo solo tiene los 9 digitos.
      phone: phone ? `+56 ${phone}` : '',
      whatsapp: limits.hasWhatsapp && whatsapp ? `+56 ${whatsapp}` : '',
      openingHours: is24Hours ? 'Atención 24 horas' : formatOpeningHours(schedule),
      is24Hours,
      features: visibleFeatures,
      servicesOffered: visibleServices,
      images: visibleImages,
      storyImages: visibleStories,
      hasOnlineBooking: bookingOn,
      // Se manda null al apagar las reservas para que el PUT limpie la agenda
      // vieja: `aplicar()` reescribe el campo con lo que venga, no lo conserva.
      agendaConfig: bookingOn ? toAgendaConfigPayload(agendaConfig) : null,
      agendaConfigId: bookingOn ? agendaConfigId : null,
      agendaConfigName: bookingOn
        ? (agendaConfigName.trim() || `Agenda de ${company.trim() || title.trim() || 'mi taller'}`)
        : null,
      agendaHours: bookingOn ? getAgendaSummaryText(agendaConfig) : ''
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
                    {cost > 0 ? `${cost} Monedas` : 'Gratis'}
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
          <CharCount value={title} max={160} />
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
          <CharCount value={company} max={180} />
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
            maxLength={MAX_DESCRIPTION}
            placeholder="Describe los trabajos que realizas, con qué equipos cuentas y qué garantías ofreces."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <CharCount value={description} max={MAX_DESCRIPTION} />
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
              maxLength={MAX_PRICE_DIGITS}
              placeholder="Ej: 25000"
              value={priceValue}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, MAX_PRICE_DIGITS);
                setPriceValue(digits);
                setPriceText(digits ? `Desde $${Number(digits).toLocaleString('es-CL')}` : '');
              }}
              required
            />
          ) : (
            <input
              type="text"
              maxLength={MAX_PRICE_TEXT}
              placeholder="Ej: Según presupuesto"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              required
            />
          )}
          {priceType === 'fixed'
            ? <CharCount value={priceValue} max={MAX_PRICE_DIGITS} />
            : <CharCount value={priceText} max={MAX_PRICE_TEXT} />}
        </div>

        <div className="booking-field">
          <label>Región *</label>
          <select
            value={regionId}
            onChange={(e) => { setRegionId(e.target.value); setComunaId(''); }}
            required
          >
            <option value="">Selecciona una región</option>
            {regiones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>

        <div className="booking-field">
          <label>Comuna *</label>
          <select
            value={comunaId}
            onChange={(e) => setComunaId(e.target.value)}
            disabled={!regionId || comunas.length === 0}
            required
          >
            <option value="">{regionId ? 'Selecciona una comuna' : 'Elige primero la región'}</option>
            {comunas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {/* Sugerencias reales contra Photon/OSM, el mismo campo del alta de
            direcciones y de la app. Al elegir una sugerencia se completan tambien
            region y comuna, que es lo que evita el par imposible. */}
        <div className="booking-field col-span-2">
          <label>Dirección física *</label>
          <AddressAutocompleteInput
            value={address}
            onChange={setAddress}
            onSelectLocation={({ comuna, region }) => seleccionarPorNombre(region, comuna)}
            comuna={comunaNombre}
            region={regionNombre}
            placeholder="Ej: Av. Providencia 1240, Local 5"
            required
            maxLength={MAX_ADDRESS}
          />
          <CharCount value={address} max={MAX_ADDRESS} always={false} />
        </div>

        <div className="booking-field">
          <label>Teléfono de contacto *</label>
          <div className="phone-field">
            <span className="phone-prefix">+56</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="9 8765 4321"
              value={phone}
              onChange={(e) => setPhone(soloDigitos(e.target.value))}
              required
            />
          </div>
          <CharCount value={phone} max={PHONE_DIGITS} />
        </div>

        <div className="booking-field">
          <label>
            WhatsApp {limits.hasWhatsapp
              ? `(incluido en el plan ${limits.name})`
              : `(no disponible en el plan ${limits.name})`}
          </label>
          <div className={`phone-field ${limits.hasWhatsapp ? '' : 'is-disabled'}`}>
            <span className="phone-prefix">+56</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="9 8765 4321"
              value={limits.hasWhatsapp ? whatsapp : ''}
              onChange={(e) => setWhatsapp(soloDigitos(e.target.value))}
              disabled={!limits.hasWhatsapp}
            />
          </div>
        </div>

        <div className="booking-field col-span-2">
          <label><Clock size={13} /> Horario de atención</label>

          {/* `is24Hours` es un campo propio y el mural filtra por él. Antes se
              adivinaba buscando "24" dentro del horario escrito a mano. */}
          <label className="ad-check-row">
            <input
              type="checkbox"
              checked={is24Hours}
              onChange={(e) => setIs24Hours(e.target.checked)}
            />
            Atiendo las 24 horas
          </label>

          {is24Hours
            ? <small className="ad-upload-hint">El anuncio se publica como “Atención 24 horas”.</small>
            : <OpeningHoursPicker schedule={schedule} onChange={setSchedule} />}
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
            <CharCount value={serviceDraft} max={120} always={false} />
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

        {/* Agenda en linea: es lo que el plan Empresarial cobra aparte. Sin este
            bloque el anuncio no puede encenderla, porque el backend exige la
            configuracion horaria completa junto con `hasOnlineBooking`. */}
        {limits.hasBooking && (
          <div className="booking-field col-span-2">
            <label><CalendarClock size={13} /> Agenda de citas en línea (plan {limits.name})</label>

            <label className="ad-check-row">
              <input
                type="checkbox"
                checked={bookingEnabled}
                onChange={(e) => handleBookingToggle(e.target.checked)}
              />
              Recibir reservas de hora desde el mural
            </label>

            {bookingEnabled ? (
              <>
                <div className="booking-field" style={{ marginTop: 10 }}>
                  <label>Nombre de la agenda (opcional)</label>
                  <input
                    type="text"
                    maxLength={160}
                    placeholder="Ej: Horario de taller"
                    value={agendaConfigName}
                    onChange={(e) => setAgendaConfigName(e.target.value)}
                  />
                  <CharCount value={agendaConfigName} max={160} always={false} />
                  <small className="ad-upload-hint">
                    Solo lo ves tú, para reconocer este horario en tu gestión.
                  </small>
                </div>

                <AgendaScheduleEditor config={agendaConfig} onChange={setAgendaConfig} />
              </>
            ) : (
              <small className="ad-upload-hint">
                Con las reservas apagadas la tarjeta solo muestra teléfono y WhatsApp: nadie
                puede pedir hora desde el mural.
              </small>
            )}
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
          disabled={isSubmitting || Boolean(uploadTarget) || !canAffordTier || hasAgendaErrors}
        >
          {isSubmitting ? <Loader2 size={16} className="spin-icon" /> : <Plus size={16} />}
          {isSubmitting
            ? 'Enviando…'
            : submitLabel || (mode === 'create'
              ? (tierCost > 0 ? `Publicar por ${tierCost} Monedas` : 'Publicar anuncio')
              : 'Guardar cambios')}
        </button>
      </div>

      {mode === 'create' && !canAffordTier && (
        <p className="ad-form-balance-note">
          <RepuestopCoin size={16} /> El plan {limits.name} cuesta {tierCost} Monedas y tu saldo es de {tokensBalance}. Recarga o elige otro plan.
        </p>
      )}
    </form>
  );
}
