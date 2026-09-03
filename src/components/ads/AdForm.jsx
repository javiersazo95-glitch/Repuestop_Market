import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, CalendarClock, Camera, Check, ChevronLeft, ChevronRight, Clock3, Eye,
  Film, Heart, Loader2, LockKeyhole, MessageCircle, Plus, Sparkles, Trash2, TrendingUp, UserPlus, X
} from 'lucide-react';
import {
  AD_TIERS, AD_TIER_ORDER, AD_FEATURE_TAGS, SERVICE_CATEGORIES, getNewlyUnlockedFeatures
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
import { AD_TIER_PRICES_CLP, UPGRADE_TOKEN_COSTS, uploadAdImages, adErrorMessage } from '../../services/adsStorage';
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

/** Marca la funcion que se acaba de desbloquear, para que salte a la vista. */
function EtiquetaNueva() {
  return <span className="ad-nuevo-tag">NUEVO</span>;
}

const AD_FORM_STEPS = ['Plan', 'Aviso', 'Contacto'];
const WHY_PUBLISH_REASONS = [
  { Icon: Eye, title: 'Más visibilidad', text: 'Aparece frente a miles de conductores.' },
  { Icon: UserPlus, title: 'Nuevos clientes', text: 'Recibe consultas de personas interesadas.' },
  { Icon: Heart, title: 'Más confianza', text: 'Construye reputación para tu negocio.' },
  { Icon: TrendingUp, title: 'Crecimiento', text: 'Haz crecer tu taller o servicio.' },
];

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
  accreditationProfile = null,
  hasUsedBasicFreePeriod = false,
  isSubmitting = false,
  submitError = '',
  submitLabel,
  upgradedFromTier = null,
  upgradedToTier = null,
  onSubmit,
  onCancel,
  onOpenRecharge
}) {
  // Al publicar, los datos del negocio ya validados en la acreditación
  // (`/automotive-services/me`) mandan sobre los de la tienda: son los que
  // RepuesTop revisó para este servicio. Solo siembran campos vacíos y todo
  // sigue siendo editable (el taller del aviso puede ser otro local).
  const prefill = mode === 'create' ? accreditationProfile : null;
  const [tier, setTier] = useState(initialAd?.tier || 'basica');
  const [title, setTitle] = useState(initialAd?.title || '');
  const [company, setCompany] = useState(initialAd?.company || prefill?.businessName || '');
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
  const [address, setAddress] = useState(initialAd?.address || prefill?.address || '');
  const [phone, setPhone] = useState(() => quitarPrefijo(initialAd?.phone || prefill?.phone));
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
  const [step, setStep] = useState(mode === 'create' ? 0 : 1);
  const [stepError, setStepError] = useState('');
  const scrollRef = useRef(null);

  // La agenda solo existe en el plan Empresarial. Se conserva en el estado
  // aunque se baje de plan para no perderla si el socio vuelve a subir antes de
  // guardar; lo que decide si viaja al backend es `bookingEnabled` + el plan.
  const [bookingEnabled, setBookingEnabled] = useState(initialAd?.hasOnlineBooking === true);
  const [agendaConfig, setAgendaConfig] = useState(
    () => normalizeAgendaConfig(initialAd?.agendaConfig) || createDefaultAgendaConfig()
  );
  const [agendaConfigName, setAgendaConfigName] = useState(initialAd?.agendaConfigName || '');
  const [agendaConfigId] = useState(initialAd?.agendaConfigId || newAgendaConfigId());

  /**
   * Funciones que se desbloquearon con la ULTIMA mejora de plan, no todas las
   * del plan nuevo: quien sube de Destacada a Premium ya tenia WhatsApp, y
   * listarselo como novedad lo manda a buscar algo que ya estaba encendido.
   *
   * Llega desde `UpgradeAdRankModal`, que congela el plan anterior al montarse.
   * Sin ese dato el formulario se abre como una edicion cualquiera.
   */
  const unlockedFeatures = useMemo(
    () => (upgradedToTier ? getNewlyUnlockedFeatures(upgradedFromTier || 'basica', upgradedToTier) : []),
    [upgradedFromTier, upgradedToTier]
  );
  const esFuncionNueva = (nombre) => unlockedFeatures.includes(nombre);
  /**
   * Primera funcion recien desbloqueada dentro del formulario. Al entrar desde
   * "Activar mejoras" el formulario se abre arriba del todo y los controles de
   * esas funciones quedan mas abajo: sin llevar la vista hasta alla, el socio no
   * tiene como saber que le falta un paso.
   */
  const primeraNuevaRef = useRef(null);

  useEffect(() => {
    if (unlockedFeatures.length === 0) return undefined;
    // Un frame de gracia: el modal recien monto y las secciones todavia se estan
    // acomodando, asi que la posicion del primer intento no sirve.
    const id = setTimeout(() => {
      primeraNuevaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => clearTimeout(id);
  }, [unlockedFeatures.length]);

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

  // Al publicar sin comuna previa, se ubica la del expediente acreditado.
  useEffect(() => {
    if (initialAd?.commune || !prefill?.commune) return;
    seleccionarPorNombre(prefill.region, prefill.commune);
  }, [initialAd?.commune, prefill?.region, prefill?.commune, seleccionarPorNombre]);

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
        // La comuna del expediente acreditado ya tiene prioridad; la tienda solo
        // completa si la acreditación no la trae.
        if (!prefill?.commune && tienda.comuna) seleccionarPorNombre(tienda.region, tienda.comuna);
      })
      .catch(() => {});

    return () => { vigente = false; controller.abort(); };
  }, [mode, user?.sellerId, prefill?.commune, seleccionarPorNombre]);

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
  const tierCost = mode === 'create' && tier === 'basica' && !hasUsedBasicFreePeriod
    ? 0
    : UPGRADE_TOKEN_COSTS[tier] || 0;
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
  // Lo obligatorio de la etapa 1: Aviso (contenido del servicio)
  const contentMissing = [
    !category && 'la categoría',
    !title.trim() && 'el título',
    !description.trim() && 'la descripción',
    !(priceType === 'fixed' ? priceValue.trim() : priceText.trim()) && 'el precio o detalle de cotización',
    visibleImages.length === 0 && 'al menos una foto',
  ].filter(Boolean);

  // Lo obligatorio de la etapa 2: Detalles (contacto y ubicación)
  const detailsMissing = [
    !company.trim() && 'el nombre del taller o empresa',
    !regionId && 'la región',
    !comunaId && 'la comuna',
    !address.trim() && 'la dirección',
    phone.replace(/\D/g, '').length !== PHONE_DIGITS && 'un teléfono de 9 dígitos',
  ].filter(Boolean);

  const stepMissing = step === 1 ? contentMissing : step === 2 ? detailsMissing : [];

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

  const goToNextStep = () => {
    setStepError('');
    if (step === 0) {
      if (!canAffordTier) {
        setStepError(`Te faltan ${(tierCost - tokensBalance).toLocaleString('es-CL')} monedas para elegir el plan ${limits.name}.`);
        return;
      }
      setStep(1);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (step === 1) {
      if (contentMissing.length > 0) {
        setStepError(`Falta completar en el aviso: ${contentMissing.join(', ')}.`);
        return;
      }
      setStep(2);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPrevStep = () => {
    setStepError('');
    if (step === 2) {
      setStep(1);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (step === 1 && mode !== 'edit') {
      setStep(0);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepClick = (index) => {
    if (mode === 'edit' && index === 0) return;
    if (index === step) return;
    if (index < step) {
      setStepError('');
      setStep(index);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (step === 0) {
      if (!canAffordTier) {
        setStepError(`Te faltan ${(tierCost - tokensBalance).toLocaleString('es-CL')} monedas para elegir el plan ${limits.name}.`);
        return;
      }
      if (index === 2 && contentMissing.length > 0) {
        setStep(1);
        setStepError(`Completa los datos del aviso antes de pasar a detalles: falta ${contentMissing.join(', ')}.`);
        return;
      }
      setStep(index);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (step === 1) {
      if (contentMissing.length > 0) {
        setStepError(`Falta completar en el aviso: ${contentMissing.join(', ')}.`);
        return;
      }
      setStep(2);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (contentMissing.length > 0) {
      setStep(1);
      setStepError(`Completa el contenido del aviso: falta ${contentMissing.join(', ')}.`);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (detailsMissing.length > 0) {
      setStep(2);
      setStepError(`Completa los detalles de contacto y ubicación: falta ${detailsMissing.join(', ')}.`);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (hasAgendaErrors) {
      setStep(2);
      setStepError('Revisa la configuración de la agenda antes de publicar.');
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

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
      region: regionNombre,
      commune: comunaNombre,
      address: address.trim(),
      phone: phone ? `+56 ${phone}` : '',
      whatsapp: limits.hasWhatsapp && whatsapp ? `+56 ${whatsapp}` : '',
      openingHours: is24Hours ? 'Atención 24 horas' : formatOpeningHours(schedule),
      is24Hours,
      features: visibleFeatures,
      servicesOffered: visibleServices,
      images: visibleImages,
      storyImages: visibleStories,
      hasOnlineBooking: bookingOn,
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
    <form className={`ad-publish-form ${mode === 'create' ? 'is-create' : 'is-edit'}`} data-step={step} onSubmit={handleSubmit} noValidate>
      <nav className="ad-form-stepper" aria-label="Etapas de publicación">
        {AD_FORM_STEPS.map((label, index) => {
          const isDone = index < step;
          const isCurrent = index === step;
          const isDisabled = mode === 'edit' && index === 0;
          return (
            <React.Fragment key={label}>
              {index > 0 && <span className={`ad-form-step-line ${index <= step ? 'is-done' : ''}`} />}
              <button
                type="button"
                className={`ad-form-step ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''} ${isDisabled ? 'is-disabled' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                disabled={isDisabled}
                onClick={() => handleStepClick(index)}
              >
                <i>{isDone ? <Check size={13} /> : index + 1}</i>
                <span>{label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="ad-form-scroll-area" ref={scrollRef}>
        <div className="ad-form-step-intro">
          <span>ETAPA {step + 1} DE 3 · {AD_FORM_STEPS[step].toUpperCase()}</span>
          <h4>
            {step === 0
              ? 'Elige el plan de tu anuncio'
              : step === 1
                ? 'Contenido del aviso'
                : 'Detalles del aviso'}
          </h4>
          <p>
            {step === 0
              ? 'Define la visibilidad y las herramientas que tendrá tu publicación durante 30 días.'
              : step === 1
                ? 'Solo lo necesario para publicar: qué ofreces, a qué precio y con qué fotos.'
                : 'Ubicación, datos de contacto, horario y funciones adicionales de tu plan.'}
          </p>
        </div>

        {unlockedFeatures.length > 0 && (
          <div className="ad-unlocked-banner">
            <Sparkles size={17} />
            <div>
              <strong>
                {unlockedFeatures.length === 1
                  ? `Desbloqueaste ${unlockedFeatures[0]}.`
                  : `Desbloqueaste ${unlockedFeatures.length} funciones nuevas.`}
              </strong>
              <p>
                Enciéndelas aquí abajo y guarda los cambios para que queden activas.
              </p>
            </div>
          </div>
        )}

        {/* ETAPA 0: PLAN */}
        {step === 0 && mode === 'create' && (
          <div className="ad-step-panel ad-step-plan">
            <div className="ad-plan-heading">
              <label className="ad-form-step-label">Plan de tu anuncio</label>
              <button type="button" className="ad-form-balance-pill" onClick={onOpenRecharge}>
                <RepuestopCoin size={20} />
                <span><b>{Number(tokensBalance).toLocaleString('es-CL')}</b> monedas</span>
                <Plus size={14} />
              </button>
            </div>
            <div className="tier-selector-grid">
              {AD_TIER_ORDER.map((tierId) => {
                const config = AD_TIERS[tierId];
                const cost = tierId === 'basica' && !hasUsedBasicFreePeriod ? 0 : UPGRADE_TOKEN_COSTS[tierId] || 0;
                const affordable = tokensBalance >= cost;
                return (
                  <button
                    type="button"
                    key={tierId}
                    className={`tier-card-option ${tier === tierId ? `selected-${tierId}` : ''} ${affordable ? '' : 'is-locked'}`}
                    onClick={() => setTier(tierId)}
                  >
                    <span className="tier-option-topline">
                      <span className="tier-option-badge" style={{ background: `${config.badgeColor}1a`, color: config.badgeColor }}>
                        {tierId === 'basica' && cost === 0 ? '1.er mes gratis' : config.name}
                      </span>
                      {tier === tierId && <span className="tier-selected-check"><Check size={12} /></span>}
                    </span>
                    <h4>{config.name}</h4>
                    <strong className="tier-option-price">{cost === 0 ? 'Gratis por 30 días' : `$${Number(AD_TIER_PRICES_CLP[tierId] || cost * 50).toLocaleString('es-CL')} CLP`}</strong>
                    {cost > 0 && <span className="tier-option-coins"><RepuestopCoin size={15} /> {cost} monedas</span>}
                    <div className="tier-features-list">
                      • {config.maxImages} fotos · {config.maxTags} etiquetas<br />
                      • {config.hasWhatsapp ? 'WhatsApp directo' : 'Solo teléfono'}<br />
                      • {config.maxStories > 0 ? `${config.maxStories} historias` : 'Sin historias'}
                      {config.hasBooking ? <><br />• Agenda en línea</> : null}
                    </div>
                    {!affordable && <small className="tier-locked-note"><LockKeyhole size={11} /> Te faltan {cost - tokensBalance} monedas</small>}
                  </button>
                );
              })}
            </div>
            {tier === 'basica' && !hasUsedBasicFreePeriod && (
              <p className="ad-basic-free-note">
                <RepuestopCoin size={15} />
                <span>
                  Tu primer anuncio Básico es <strong>gratis por 30 días</strong>. Después,
                  cada período nuevo cuesta 100 Monedas ($5.000 CLP).
                </span>
              </p>
            )}

            <section className="ad-why-publish">
              <h4>¿Por qué publicar tu servicio en el Mural?</h4>
              <div>
                {WHY_PUBLISH_REASONS.map(({ Icon, title: reasonTitle, text }) => (
                  <article key={reasonTitle}>
                    <span><Icon size={18} /></span>
                    <strong>{reasonTitle}</strong>
                    <p>{text}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ETAPA 1: AVISO */}
        {step === 1 && (
          <div className="ad-step-panel ad-step-content">
            {mode === 'edit' && (
              <div className="ad-section-header">
                <h5>1. Contenido del servicio</h5>
                <p>Modifica el título, categoría, modalidad de cobro y fotos de tu aviso.</p>
              </div>
            )}
            <div className="ad-form-grid booking-form-grid">
              <div className="ad-field booking-field col-span-2">
                <div className="ad-field-header">
                  <label htmlFor="ad-title">Título del anuncio *</label>
                  <CharCount value={title} max={160} />
                </div>
                <input
                  id="ad-title"
                  type="text"
                  maxLength={160}
                  placeholder="Ej: Taller especializado en frenos y embragues multimarca"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="ad-field booking-field col-span-2">
                <div className="ad-field-header">
                  <label htmlFor="ad-category">Categoría de servicio *</label>
                </div>
                <select id="ad-category" value={category} onChange={(e) => setCategory(e.target.value)} required>
                  {SERVICE_CATEGORIES.filter((c) => c.id !== 'TODAS').map((c) => (
                    <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="ad-field booking-field col-span-2">
                <div className="ad-field-header">
                  <label htmlFor="ad-description">Descripción del servicio *</label>
                  <CharCount value={description} max={MAX_DESCRIPTION} />
                </div>
                <textarea
                  id="ad-description"
                  rows={4}
                  maxLength={MAX_DESCRIPTION}
                  placeholder="Describe los trabajos que realizas, con qué equipos cuentas y qué garantías ofreces."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="ad-field booking-field">
                <div className="ad-field-header">
                  <label>Modalidad de cobro *</label>
                </div>
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

              <div className="ad-field booking-field">
                <div className="ad-field-header">
                  <label htmlFor="ad-price">{priceType === 'fixed' ? 'Precio de referencia (CLP) *' : 'Texto del precio *'}</label>
                  {priceType === 'fixed'
                    ? <CharCount value={priceValue} max={MAX_PRICE_DIGITS} />
                    : <CharCount value={priceText} max={MAX_PRICE_TEXT} />}
                </div>
                {priceType === 'fixed' ? (
                  <input
                    id="ad-price"
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
                    id="ad-price"
                    type="text"
                    maxLength={MAX_PRICE_TEXT}
                    placeholder="Ej: Según presupuesto"
                    value={priceText}
                    onChange={(e) => setPriceText(e.target.value)}
                    required
                  />
                )}
              </div>

              <div className="ad-field booking-field col-span-2">
                <div className="ad-field-header">
                  <label>Fotos del anuncio ({visibleImages.length}/{limits.maxImages} del plan {limits.name}) *</label>
                </div>
                {renderGallery('images', visibleImages, limits.maxImages, 'Formatos: JPG, PNG o WEBP, hasta 5MB por foto. Sube al menos una foto para publicar tu anuncio.')}
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 2: DETALLES */}
        {step === 2 && (
          <div className="ad-step-panel ad-step-details">
            {mode === 'edit' && (
              <div className="ad-section-header">
                <h5>2. Ubicación, contacto y herramientas del plan</h5>
                <p>Datos de tu local, teléfonos, horarios y beneficios activos.</p>
              </div>
            )}
            <div className="ad-form-grid booking-form-grid">
              <div className="ad-field booking-field">
                <div className="ad-field-header">
                  <label htmlFor="ad-company">Nombre del taller o empresa *</label>
                  <CharCount value={company} max={180} always={false} />
                </div>
                <input
                  id="ad-company"
                  type="text"
                  maxLength={180}
                  placeholder="Ej: Frenos & Mecánica Central SpA"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                />
              </div>

              <div className="ad-field booking-field">
                <div className="ad-field-header">
                  <label htmlFor="ad-phone">Teléfono de contacto *</label>
                  <CharCount value={phone} max={PHONE_DIGITS} />
                </div>
                <div className="phone-field">
                  <span className="phone-prefix">+56</span>
                  <input
                    id="ad-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="9 8765 4321"
                    value={phone}
                    onChange={(e) => setPhone(soloDigitos(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="ad-field booking-field">
                <div className="ad-field-header">
                  <label htmlFor="ad-region">Región *</label>
                </div>
                <select
                  id="ad-region"
                  value={regionId}
                  onChange={(e) => { setRegionId(e.target.value); setComunaId(''); }}
                  required
                >
                  <option value="">Selecciona una región</option>
                  {regiones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>

              <div className="ad-field booking-field">
                <div className="ad-field-header">
                  <label htmlFor="ad-comuna">Comuna *</label>
                </div>
                <select
                  id="ad-comuna"
                  value={comunaId}
                  onChange={(e) => setComunaId(e.target.value)}
                  disabled={!regionId || comunas.length === 0}
                  required
                >
                  <option value="">{regionId ? 'Selecciona una comuna' : 'Elige primero la región'}</option>
                  {comunas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              <div className="ad-field booking-field col-span-2">
                <div className="ad-field-header">
                  <label>Dirección física *</label>
                  <CharCount value={address} max={MAX_ADDRESS} always={false} />
                </div>
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
              </div>

              <div
                className={`ad-field booking-field col-span-2 ${esFuncionNueva('WhatsApp directo') ? 'is-unlocked' : ''}`}
                ref={unlockedFeatures[0] === 'WhatsApp directo' ? primeraNuevaRef : null}
              >
                <div className="ad-field-header">
                  <label htmlFor="ad-whatsapp">
                    <MessageCircle size={14} /> WhatsApp directo
                    {limits.hasWhatsapp
                      ? ` (plan ${limits.name})`
                      : ` (disponible en Destacada, Premium o Empresarial)`}
                    {esFuncionNueva('WhatsApp directo') && <EtiquetaNueva />}
                  </label>
                  {limits.hasWhatsapp && <CharCount value={whatsapp} max={PHONE_DIGITS} />}
                </div>
                {limits.hasWhatsapp ? (
                  <div className="ad-field-with-actions">
                    <div className="phone-field">
                      <span className="phone-prefix">+56</span>
                      <input
                        id="ad-whatsapp"
                        type="tel"
                        inputMode="numeric"
                        placeholder="9 8765 4321"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(soloDigitos(e.target.value))}
                      />
                    </div>
                    {phone && whatsapp !== phone && (
                      <button
                        type="button"
                        className="btn-copy-phone"
                        onClick={() => setWhatsapp(phone)}
                      >
                        Usar el mismo teléfono
                      </button>
                    )}
                  </div>
                ) : (
                  <small className="ad-upload-hint">
                    Permite a los conductores iniciar chat directo por WhatsApp contigo desde el aviso en el mural.
                  </small>
                )}
              </div>

              <div className="ad-field booking-field col-span-2">
                <div className="ad-field-header">
                  <label><Clock3 size={14} /> Horario de atención</label>
                </div>
                <label className="ad-check-row">
                  <input
                    type="checkbox"
                    checked={is24Hours}
                    onChange={(e) => setIs24Hours(e.target.checked)}
                  />
                  <span>Atención 24 horas continuas</span>
                </label>
                {is24Hours ? (
                  <small className="ad-upload-hint">El aviso se publicará con el distintivo de “Atención 24 horas”.</small>
                ) : (
                  <OpeningHoursPicker schedule={schedule} onChange={setSchedule} />
                )}
              </div>

              <div className="ad-field booking-field col-span-2">
                <div className="ad-field-header">
                  <label>Etiquetas del anuncio ({visibleFeatures.length}/{limits.maxTags} del plan {limits.name})</label>
                </div>
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

              <div className="ad-field booking-field col-span-2">
                <div className="ad-field-header">
                  <label>Servicios que ofreces ({visibleServices.length}/{limits.maxTags})</label>
                </div>
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
                  <div className="ad-tag-picker" style={{ marginTop: '8px' }}>
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

              {limits.maxStories > 0 && (
                <div
                  className={`ad-field booking-field col-span-2 ${esFuncionNueva('Carrusel de Historias') ? 'is-unlocked' : ''}`}
                  ref={unlockedFeatures[0] === 'Carrusel de Historias' ? primeraNuevaRef : null}
                >
                  <div className="ad-field-header">
                    <label>
                      Historias ({visibleStories.length}/{limits.maxStories} del plan {limits.name})
                      {esFuncionNueva('Carrusel de Historias') && <EtiquetaNueva />}
                    </label>
                  </div>
                  {renderGallery('stories', visibleStories, limits.maxStories, 'Aparecen en el carrusel de historias en la parte superior del mural.')}
                </div>
              )}

              {limits.hasBooking && (
                <div
                  className={`ad-field booking-field col-span-2 ${esFuncionNueva('Agenda de citas en línea') ? 'is-unlocked' : ''}`}
                  ref={unlockedFeatures[0] === 'Agenda de citas en línea' ? primeraNuevaRef : null}
                >
                  <div className="ad-field-header">
                    <label>
                      <CalendarClock size={14} /> Agenda de citas en línea (plan {limits.name})
                      {esFuncionNueva('Agenda de citas en línea') && <EtiquetaNueva />}
                    </label>
                  </div>

                  <label className="ad-check-row">
                    <input
                      type="checkbox"
                      checked={bookingEnabled}
                      onChange={(e) => handleBookingToggle(e.target.checked)}
                    />
                    <span>Habilitar reservas de hora desde el mural</span>
                  </label>

                  {bookingEnabled ? (
                    <>
                      <div className="ad-field" style={{ marginTop: 10 }}>
                        <div className="ad-field-header">
                          <label htmlFor="ad-agenda-name">Nombre de la agenda (opcional)</label>
                          <CharCount value={agendaConfigName} max={160} always={false} />
                        </div>
                        <input
                          id="ad-agenda-name"
                          type="text"
                          maxLength={160}
                          placeholder="Ej: Horario de taller principal"
                          value={agendaConfigName}
                          onChange={(e) => setAgendaConfigName(e.target.value)}
                        />
                        <small className="ad-upload-hint">
                          Identifica este horario en tu panel de administración.
                        </small>
                      </div>

                      <AgendaScheduleEditor config={agendaConfig} onChange={setAgendaConfig} />
                    </>
                  ) : (
                    <small className="ad-upload-hint">
                      Con las reservas apagadas, el aviso solo muestra contacto por teléfono y WhatsApp.
                    </small>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {(uploadError || submitError) && (
          <div className="ad-form-error">
            <AlertCircle size={16} />
            <span>{uploadError || submitError}</span>
          </div>
        )}

        {stepError && (
          <div className="ad-form-error ad-step-error">
            <AlertCircle size={16} />
            <span>{stepError}</span>
          </div>
        )}

        {mode === 'create' && !canAffordTier && (
          <div className="ad-form-balance-note">
            <RepuestopCoin size={19} />
            <span>El plan {limits.name} cuesta {tierCost} Monedas y tu saldo es de {tokensBalance}.</span>
            <button type="button" onClick={onOpenRecharge}>Recargar monedas</button>
          </div>
        )}
      </div>

      <div className="ad-form-footer">
        <div className="ad-form-footer-copy">
          {stepMissing.length > 0 && (step === 1 || step === 2) ? (
            <span className="ad-step-missing-tag">
              <AlertCircle size={14} /> Falta: {stepMissing.join(', ')}
            </span>
          ) : (
            <>
              <span>Etapa {step + 1} de 3</span>
              <strong>{AD_FORM_STEPS[step]}</strong>
            </>
          )}
        </div>
        <div className="booking-actions-row">
          {step > 0 && !(mode === 'edit' && step === 1) ? (
            <button type="button" className="ad-form-back" onClick={goToPrevStep} disabled={isSubmitting}>
              <ChevronLeft size={16} /> Atrás
            </button>
          ) : (
            <button type="button" className="ad-form-back" onClick={onCancel} disabled={isSubmitting}>Cancelar</button>
          )}
          {step < 2 ? (
            <button
              type="button"
              className="btn-post-ad"
              onClick={goToNextStep}
              disabled={isSubmitting || Boolean(uploadTarget)}
            >
              Siguiente <ChevronRight size={16} />
            </button>
          ) : (
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
          )}
        </div>
      </div>
    </form>
  );
}
