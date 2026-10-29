import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlarmClock, AlertCircle, Home, CalendarClock, Camera, Car, Check, ChevronLeft, ChevronRight, Clock3,
  Film, Loader2, MessageCircle, Plus, PlusCircle, Trash2, X
} from 'lucide-react';
import { SERVICE_CATEGORIES } from '../../data/automotiveAdsData';
import {
  createDefaultSchedule, parseOpeningHours, formatOpeningHours
} from '../../data/openingHours';
import { getRegionesApi, getComunasApi, getSellerStoreApi, getVehicleBrandsApi } from '../../services/api';
import {
  getAgendaConfigs, getCachedAgendaConfigs, subscribeToAgendaConfigsUpdates,
} from '../../services/agendaConfigsStorage';
import AgendaConfigModal from './AgendaConfigModal';
import { resolverUbicacionPorNombre } from '../../services/geoLookup';
import { useAuth } from '../../context/AuthContext';
import { getWorkshopServices } from '../../services/workshopApi';
import { getFaultCategories } from '../../services/faultApi';
import AddressAutocompleteInput from '../AddressAutocompleteInput';
import OpeningHoursPicker from './OpeningHoursPicker';
import {
  toAgendaConfigPayload, getAgendaSummaryText, getAgendaWeeklySlotsCount, validateAgendaConfig,
  pickDefaultAgendaConfig, PRINCIPAL_AGENDA_ID,
} from '../../data/agendaConfig';
import { agendaToOpeningSchedule } from '../../data/workshopHours';
import { uploadAdImages, adErrorMessage } from '../../services/adsStorage';
import { validateUpload, FILE_LIMITS } from '../../utils/fileValidation';

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
const STANDARD_AD_LIMITS = {
  maxImages: 6,
  maxTags: 8,
  maxStories: 4,
  hasWhatsapp: true,
  hasBooking: true,
};

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

const AD_FORM_STEPS = [
  { index: 1, label: 'Aviso' },
  { index: 2, label: 'Contacto y agenda' },
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
 * El backend conserva `tier` como campo técnico para compatibilidad con datos
 * anteriores, pero todos los anuncios usan la misma capacidad y experiencia.
 */
export default function AdForm({
  initialAd,
  mode = 'create',
  accreditationProfile = null,
  isSubmitting = false,
  submitError = '',
  submitLabel,
  onSubmit,
  onCancel,
}) {
  // Al publicar, los datos del negocio ya validados en la acreditación
  // (`/automotive-services/me`) mandan sobre los de la tienda: son los que
  // RepuesTop revisó para este servicio. Solo siembran campos vacíos y todo
  // sigue siendo editable (el taller del aviso puede ser otro local).
  const prefill = mode === 'create' ? accreditationProfile : null;
  const tier = 'empresarial';
  const [title, setTitle] = useState(initialAd?.title || '');
  const [company, setCompany] = useState(initialAd?.company || prefill?.businessName || '');
  const [category, setCategory] = useState(initialAd?.category || 'mecanica');
  // Subcategoría opcional: el servicio concreto de la categoría (misma lista de fallas y servicios del taller).
  const [subcategory, setSubcategory] = useState(initialAd?.subcategory || '');
  const [categoryCatalog, setCategoryCatalog] = useState([]);
  useEffect(() => {
    let active = true;
    getFaultCategories().then((items) => { if (active) setCategoryCatalog(Array.isArray(items) ? items : []); }).catch(() => {});
    return () => { active = false; };
  }, []);
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
  // 24/7 / urgencias lo declara el taller al acreditarse. Solo entonces se pregunta
  // por anuncio; un taller "solo 24/7" publica todo como 24/7 (el backend lo fuerza
  // igual). Un aviso que ya era 24/7 sigue mostrando la pregunta para poder apagarlo.
  const workshop24Hours = accreditationProfile?.atiende24Horas === true;
  const workshopOnly24Hours = workshop24Hours && accreditationProfile?.tieneHorarioNormal === false;
  const show24HoursQuestion = workshop24Hours || initialAd?.is24Hours === true;
  const [is24Hours, setIs24Hours] = useState(initialAd?.is24Hours === true || workshopOnly24Hours);
  // Servicio a domicilio dentro de la comuna: habilita la opción "a domicilio" al agendar.
  const [homeService, setHomeService] = useState(initialAd?.homeService === true);
  // Las etiquetas existentes se conservan al editar; en creación ya no se
  // seleccionan en la etapa 3 para no duplicar los servicios manuales del paso 2.
  const [features] = useState(initialAd?.features || []);
  const [servicesOffered, setServicesOffered] = useState(initialAd?.servicesOffered || []);
  // Marcas que atiende el taller. Vacío = atiende todas.
  const [specialistBrands, setSpecialistBrands] = useState(() => (
    Array.isArray(initialAd?.specialistBrands)
      ? initialAd.specialistBrands
        .map((brand) => typeof brand === 'string' ? brand.trim() : String(brand?.nombre || brand?.name || '').trim())
        .filter(Boolean)
      : []
  ));
  const [brandCatalog, setBrandCatalog] = useState([]);
  const [brandDraft, setBrandDraft] = useState('');
  const [serviceDraft, setServiceDraft] = useState('');
  // Cuenta de taller: los servicios no se escriben, se eligen del catalogo que registro en "Mis servicios".
  const { role: accountRole } = useAuth();
  const isWorkshopAccount = accountRole === 'WORKSHOP';
  const [catalogServices, setCatalogServices] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(isWorkshopAccount);
  const [serviceIds, setServiceIds] = useState(() => (Array.isArray(initialAd?.serviceIds) ? initialAd.serviceIds : []));
  useEffect(() => {
    if (!isWorkshopAccount) return undefined;
    let active = true;
    getWorkshopServices()
      .then((list) => { if (active) setCatalogServices(Array.isArray(list) ? list : []); })
      .catch(() => { if (active) setCatalogServices([]); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [isWorkshopAccount]);
  const [images, setImages] = useState(initialAd?.images || []);
  const [storyImages, setStoryImages] = useState(initialAd?.storyImages || []);
  const [uploadTarget, setUploadTarget] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState('');
  const scrollRef = useRef(null);

  // La agenda se elige de las configuraciones guardadas y compartidas con la app.
  const [bookingEnabled, setBookingEnabled] = useState(initialAd?.hasOnlineBooking === true);
  const [agendaConfigs, setAgendaConfigs] = useState(() => getCachedAgendaConfigs());
  const [agendaConfigId, setAgendaConfigId] = useState(initialAd?.agendaConfigId || '');
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);

  const selectedAgendaConfig = useMemo(
    () => agendaConfigs.find((c) => c.id === agendaConfigId) || null,
    [agendaConfigs, agendaConfigId]
  );

  useEffect(() => {
    let active = true;
    getAgendaConfigs().then((list) => { if (active) setAgendaConfigs(list); }).catch(() => {});
    const unsubscribe = subscribeToAgendaConfigsUpdates((list) => { if (active) setAgendaConfigs(list); });
    return () => { active = false; unsubscribe(); };
  }, []);

  // Si hay una sola agenda y no se eligió ninguna, se preselecciona.
  // Se preselecciona el "Horario principal" del taller (o la única guardada).
  useEffect(() => {
    if (!bookingEnabled || agendaConfigId) return;
    const preferred = pickDefaultAgendaConfig(agendaConfigs);
    if (preferred) setAgendaConfigId(preferred.id);
  }, [bookingEnabled, agendaConfigId, agendaConfigs]);

  // Anuncio nuevo: el horario de atención arranca con el horario normal registrado.
  const prefilledScheduleRef = useRef(false);
  useEffect(() => {
    if (mode !== 'create' || prefilledScheduleRef.current) return;
    const principal = agendaConfigs.find((config) => config.id === PRINCIPAL_AGENDA_ID);
    if (!principal) return;
    prefilledScheduleRef.current = true;
    setSchedule(agendaToOpeningSchedule(principal));
  }, [mode, agendaConfigs]);

  useEffect(() => {
    if (workshopOnly24Hours) setIs24Hours(true);
  }, [workshopOnly24Hours]);

  useEffect(() => {
    let active = true;
    getVehicleBrandsApi()
      .then((list) => {
        if (!active) return;
        const names = (Array.isArray(list) ? list : [])
          .map((b) => (typeof b === 'string' ? b : b?.nombre || b?.name || ''))
          .filter(Boolean);
        setBrandCatalog([...new Set(names)].sort((a, b) => a.localeCompare(b, 'es')));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

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

  const handleBookingToggle = (activar) => setBookingEnabled(activar);

  const limits = STANDARD_AD_LIMITS;

  const categoryLabel = useMemo(
    () => SERVICE_CATEGORIES.find((c) => c.id === category)?.label || '',
    [category]
  );

  // Se recortan para que la vista previa muestre lo que realmente se guardará.
  const visibleImages = images.slice(0, limits.maxImages);
  const visibleStories = storyImages.slice(0, limits.maxStories);
  const visibleFeatures = features.slice(0, limits.maxTags);
  const visibleServices = servicesOffered.slice(0, limits.maxTags);

  // `AnuncioService.validar()` responde 400 si `hasOnlineBooking` viene encendido
  // sin una agenda válida. Con el selector, "válida" = hay una agenda elegida y
  // su horario pasa `validateAgendaConfig`.
  const agendaErrors = limits.hasBooking && bookingEnabled && !is24Hours
    ? (selectedAgendaConfig
      ? validateAgendaConfig(selectedAgendaConfig)
      : ['Elige una agenda para recibir citas (o créala con "Nueva agenda").'])
    : [];
  const hasAgendaErrors = agendaErrors.length > 0;
  // Etapa 2 ("Aviso") junta TODO lo obligatorio: contenido + contacto + ubicación.
  // La segunda etapa no tiene campos obligatorios salvo la agenda cuando se activa.
  const contentMissing = [
    !category && 'la categoría',
    !title.trim() && 'el título',
    !description.trim() && 'la descripción',
    !(priceType === 'fixed' ? priceValue.trim() : priceText.trim()) && 'el precio o detalle de cotización',
    visibleImages.length === 0 && 'al menos una foto',
    !company.trim() && 'el nombre del taller o empresa',
    !regionId && 'la región',
    !comunaId && 'la comuna',
    !address.trim() && 'la dirección',
    phone.replace(/\D/g, '').length !== PHONE_DIGITS && 'un teléfono de 9 dígitos',
    isWorkshopAccount && serviceIds.length === 0 && 'al menos un servicio de tu catálogo',
  ].filter(Boolean);

  const stepMissing = step === 1 ? contentMissing : [];

  const toggleCatalogService = (id) => setServiceIds((current) => (
    current.includes(id) ? current.filter((value) => value !== id) : (current.length >= limits.maxTags ? current : [...current, id])));
  const catalogNames = serviceIds.map((id) => catalogServices.find((service) => service.id === id)?.nombre).filter(Boolean);

  const addService = () => {
    const value = serviceDraft.trim();
    if (!value || servicesOffered.includes(value) || servicesOffered.length >= limits.maxTags) return;
    setServicesOffered([...servicesOffered, value]);
    setServiceDraft('');
  };

  const addSpecialistBrand = (rawValue = brandDraft) => {
    const typed = String(rawValue || '').trim();
    if (!typed) return;
    // Si coincide con el catálogo conservamos su escritura oficial (por ejemplo,
    // "Mercedes-Benz"). Las marcas libres siguen permitidas para talleres de nicho.
    const catalogMatch = brandCatalog.find((brand) => brand.localeCompare(typed, 'es', { sensitivity: 'base' }) === 0);
    const value = catalogMatch || typed;
    setSpecialistBrands((current) => {
      const exists = current.some((brand) => brand.localeCompare(value, 'es', { sensitivity: 'base' }) === 0);
      if (exists || current.length >= 20) return current;
      return [...current, value];
    });
    setBrandDraft('');
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

    const aSubir = files.slice(0, room);
    // Antes no se comprobaba nada aqui: una foto de 200 MB se enviaba entera y el fallo
    // aparecia al final de la subida, como un error generico del servidor.
    const invalido = aSubir.map((file) => validateUpload(file, {
      maxBytes: FILE_LIMITS.IMAGE, accept: 'image', label: `"${file.name}"`,
    })).find(Boolean);
    if (invalido) {
      setUploadError(invalido);
      return;
    }

    setUploadTarget(target);
    setUploadError('');
    try {
      const urls = await uploadAdImages(aSubir);
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
    if (step === 1) {
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
    }
  };

  const handleStepClick = (index) => {
    if (index === step) return;
    if (index < step) {
      setStepError('');
      setStep(index);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (step === 1) {
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
    // El navegador puede disparar un submit nativo al presionar Enter en un
    // campo del aviso. No se debe crear ni mandar a revisión hasta que la
    // persona llegue explícitamente a la etapa 3 y pulse su botón final.
    if (step !== 2) {
      setStepError('Completa esta etapa y presiona Siguiente para revisar los beneficios antes de enviar el anuncio.');
      return;
    }
    if (contentMissing.length > 0) {
      setStep(1);
      setStepError(`Completa el aviso: falta ${contentMissing.join(', ')}.`);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (hasAgendaErrors) {
      setStep(2);
      setStepError('Revisa la configuración de la agenda antes de publicar.');
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Un anuncio 24/7 se contacta directo: nunca lleva agenda de citas.
    const bookingOn = limits.hasBooking && bookingEnabled && !is24Hours && Boolean(selectedAgendaConfig);
    onSubmit?.({
      ...initialAd,
      tier,
      title: title.trim(),
      company: company.trim(),
      category,
      categoryLabel,
      subcategory: subcategory || null,
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
      homeService,
      features: isWorkshopAccount ? catalogNames.slice(0, limits.maxTags) : visibleFeatures,
      servicesOffered: isWorkshopAccount ? catalogNames.slice(0, limits.maxTags) : visibleServices,
      serviceIds: isWorkshopAccount ? serviceIds.slice(0, limits.maxTags) : undefined,
      specialistBrands,
      images: visibleImages,
      storyImages: visibleStories,
      hasOnlineBooking: bookingOn,
      agendaConfig: bookingOn ? toAgendaConfigPayload(selectedAgendaConfig) : null,
      agendaConfigId: bookingOn ? selectedAgendaConfig.id : null,
      agendaConfigName: bookingOn ? selectedAgendaConfig.name : null,
      agendaHours: bookingOn ? getAgendaSummaryText(selectedAgendaConfig) : ''
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
        {AD_FORM_STEPS.map(({ index, label }, position) => {
          const isDone = index < step;
          const isCurrent = index === step;
          const isDisabled = false;
          return (
            <React.Fragment key={label}>
              {position > 0 && <span className={`ad-form-step-line ${index <= step ? 'is-done' : ''}`} />}
              <button
                type="button"
                className={`ad-form-step ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''} ${isDisabled ? 'is-disabled' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                disabled={isDisabled}
                onClick={() => handleStepClick(index)}
              >
                <i>{isDone ? <Check size={13} /> : position + 1}</i>
                <span>{label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="ad-form-scroll-area" ref={scrollRef}>
        <div className="ad-form-step-intro">
          <span>ETAPA {step} DE 2 · {AD_FORM_STEPS[step - 1].label.toUpperCase()}</span>
          <h4>
            {step === 1 ? 'Datos del aviso' : 'Contacto y agenda'}
          </h4>
          <p>
            {step === 1
              ? 'Todo lo necesario para publicar: qué ofreces, precio, fotos, contacto, ubicación y horario.'
              : 'Configura WhatsApp, fotos destacadas y la agenda de citas de tu taller.'}
          </p>
        </div>

        {/* ETAPA 1: AVISO */}
        {step === 1 && (
          <div className="ad-step-panel ad-step-content">
            {mode === 'edit' && (
              <div className="ad-section-header">
                <h5>Datos del aviso</h5>
                <p>Título, categoría, precio, fotos, contacto, ubicación y horario.</p>
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
                <select id="ad-category" value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }} required>
                  {SERVICE_CATEGORIES.filter((c) => c.id !== 'TODAS').map((c) => (
                    <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.label}</option>
                  ))}
                </select>
              </div>

              {(categoryCatalog.find((item) => item.id === category)?.subcategorias || []).length > 0 && (
                <div className="ad-field booking-field col-span-2">
                  <div className="ad-field-header">
                    <label htmlFor="ad-subcategory">Servicio específico <small>Opcional</small></label>
                  </div>
                  <select id="ad-subcategory" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                    <option value="">Todos los de la categoría</option>
                    {(categoryCatalog.find((item) => item.id === category)?.subcategorias || []).map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              )}

              {/* ¿Este anuncio es 24/7? Solo si el taller declaró urgencias 24/7 en su
                  acreditación. El aviso entra en el filtro "Urgencias 24 horas" del Mural
                  y se contacta directo, sin agenda (mismo dato `is24Hours`). */}
              {show24HoursQuestion && (
                <label className={`ads-urgent-card col-span-2 ${is24Hours ? 'is-active' : ''}`}>
                  <span className="ads-urgent-icon"><AlarmClock size={16} /></span>
                  <span className="ads-urgent-text">
                    <strong>¿Este anuncio es de atención 24/7?</strong>
                    <small>
                      {workshopOnly24Hours
                        ? 'Tu taller atiende solo 24/7, así que el anuncio se publica como urgencia. Agrega un horario normal en "Horario y urgencias" para publicar anuncios con agenda.'
                        : 'Actívalo si este servicio se atiende a toda hora. Se contacta directo (llamada o WhatsApp), sin agenda de citas, y aparece en el filtro de urgencias del Mural.'}
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={is24Hours}
                    disabled={workshopOnly24Hours}
                    onChange={(e) => setIs24Hours(e.target.checked)}
                    aria-label="Este anuncio es de atención 24/7"
                  />
                </label>
              )}

              {/* Servicio a domicilio dentro de la comuna. Solo con este dato el cliente puede
                  pedir "a domicilio" al agendar, y el aviso entra al filtro "A domicilio" del
                  Mural (mismo dato `homeService` en la app). */}
              <label className={`ads-urgent-card col-span-2 ${homeService ? 'is-active' : ''}`}>
                <span className="ads-urgent-icon is-home"><Home size={16} /></span>
                <span className="ads-urgent-text">
                  <strong>¿Haces servicio a domicilio dentro de la comuna?</strong>
                  <small>
                    {`Actívalo si vas donde está el vehículo del cliente en ${comunaNombre || 'tu comuna'}. El anuncio lleva la etiqueta "A domicilio" y, al agendar, el cliente puede pedir que vayas a su dirección.`}
                  </small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={homeService}
                  onChange={(e) => setHomeService(e.target.checked)}
                  aria-label="Este anuncio ofrece servicio a domicilio dentro de la comuna"
                />
              </label>

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
                  <label>Fotos del anuncio ({visibleImages.length}/{limits.maxImages}) *</label>
                </div>
                {renderGallery('images', visibleImages, limits.maxImages, 'Formatos: JPG, PNG o WEBP, hasta 5MB por foto. Sube al menos una foto para publicar tu anuncio.')}
              </div>

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

              <div className="ad-field booking-field col-span-2">
                <div className="ad-field-header">
                  <label><Clock3 size={14} /> Horario de atención</label>
                </div>
                {is24Hours ? (
                  <small className="ad-upload-hint">Atiendes urgencias 24 horas: el aviso se publicará con el distintivo de “Atención 24 horas” y no necesita horario.</small>
                ) : (
                  <OpeningHoursPicker schedule={schedule} onChange={setSchedule} />
                )}
              </div>

              {isWorkshopAccount ? (
                <div className="ad-field booking-field col-span-2">
                  <div className="ad-field-header">
                    <label>Servicios de tu catálogo ({serviceIds.length}/{limits.maxTags})</label>
                  </div>
                  {catalogLoading ? (
                    <small className="ad-upload-hint">Cargando tus servicios…</small>
                  ) : catalogServices.length === 0 ? (
                    <small className="ad-upload-hint">Aún no registras servicios. Agrégalos en “Mis servicios” del perfil para elegirlos aquí.</small>
                  ) : (
                    <div className="ad-tag-picker" style={{ marginTop: '8px' }}>
                      {catalogServices.map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          className={`ad-tag-chip ${serviceIds.includes(service.id) ? 'active' : ''}`}
                          aria-pressed={serviceIds.includes(service.id)}
                          onClick={() => toggleCatalogService(service.id)}
                        >
                          {service.nombre} · {service.precioTexto}
                        </button>
                      ))}
                    </div>
                  )}
                  <small className="ad-upload-hint">Las marcas especialistas de cada servicio se suman a las de tu aviso.</small>
                </div>
              ) : (
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
              )}

              <div className="ad-field booking-field col-span-2">
                <div className="ad-field-header">
                  <label><Car size={14} /> Marcas que atiendes ({specialistBrands.length}/20, opcional)</label>
                </div>
                <div className="ad-chip-input">
                  <input
                    type="text"
                    list="ad-brand-catalog"
                    placeholder="Ej: Toyota"
                    value={brandDraft}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBrandDraft(value);
                      // Seleccionar una opción del datalist debe registrarla al instante;
                      // antes quedaba escrita en el input pero nunca entraba a la lista.
                      const exact = brandCatalog.find((brand) => brand.localeCompare(value.trim(), 'es', { sensitivity: 'base' }) === 0);
                      if (exact) addSpecialistBrand(exact);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      addSpecialistBrand(e.currentTarget.value);
                    }}
                    onBlur={(e) => addSpecialistBrand(e.currentTarget.value)}
                    disabled={specialistBrands.length >= 20}
                  />
                  <datalist id="ad-brand-catalog">
                    {brandCatalog
                      .filter((b) => !specialistBrands.includes(b))
                      .map((b) => <option key={b} value={b} />)}
                  </datalist>
                  <button
                    type="button"
                    className="btn-ad-phone"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addSpecialistBrand()}
                    disabled={!brandDraft.trim() || specialistBrands.length >= 20}
                  >
                    <Plus size={14} /> Agregar
                  </button>
                </div>
                <small className="ad-upload-hint">
                  Selecciona una sugerencia o escribe una marca y presiona Agregar. Déjalo vacío si atiendes todas las marcas.
                </small>
                {specialistBrands.length > 0 && (
                  <div className="ad-tag-picker" style={{ marginTop: '8px' }}>
                    {specialistBrands.map((brand) => (
                      <span key={brand} className="ad-tag-chip active">
                        <Car size={11} /> {brand}
                        <button
                          type="button"
                          aria-label={`Quitar ${brand}`}
                          onClick={() => setSpecialistBrands(specialistBrands.filter((b) => b !== brand))}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 2: CONTACTO Y AGENDA */}
        {step === 2 && (
          <div className="ad-step-panel ad-step-details">
            <div className="ad-section-header">
              <h5>Contacto y agenda</h5>
              <p>Configura WhatsApp directo, fotos destacadas y reservas de citas.</p>
            </div>
            <div className="ad-form-grid booking-form-grid">
              {limits.hasWhatsapp && (
                <div
                  className="ad-field booking-field col-span-2"
                >
                  <div className="ad-field-header">
                    <label htmlFor="ad-whatsapp">
                      <MessageCircle size={14} /> WhatsApp directo
                    </label>
                    <CharCount value={whatsapp} max={PHONE_DIGITS} />
                  </div>
                  <p className="ad-upload-hint">Los clientes abren un chat contigo desde el aviso. Déjalo vacío para no mostrar el botón.</p>
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
                </div>
              )}

              {limits.maxStories > 0 && (
                <div
                  className="ad-field booking-field col-span-2"
                >
                  <div className="ad-field-header">
                    <label>
                      Carrusel de historias ({visibleStories.length}/{limits.maxStories})
                    </label>
                  </div>
                  {renderGallery('stories', visibleStories, limits.maxStories, 'Fotos destacadas que aparecen en el carrusel de la parte superior del mural.')}
                </div>
              )}

              {limits.hasBooking && (
                <div
                  className="ad-field booking-field col-span-2"
                >
                  <div className="ad-field-header">
                    <label>
                      <CalendarClock size={14} /> Agenda de citas en línea
                    </label>
                  </div>

                  <div className="ad-form-error" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                    <CalendarClock size={15} />
                    <span>
                      El anuncio <strong>necesita una agenda</strong> para recibir citas.
                      Las agendas se comparten con la app.
                    </span>
                  </div>

                  <label className="ad-check-row">
                    <input
                      type="checkbox"
                      checked={bookingEnabled && !is24Hours}
                      disabled={is24Hours}
                      onChange={(e) => handleBookingToggle(e.target.checked)}
                    />
                    <span>Habilitar reservas de hora desde el mural</span>
                  </label>

                  {is24Hours && (
                    <small className="ad-upload-hint">Los anuncios 24/7 se contactan directo: no usan agenda de citas.</small>
                  )}

                  {bookingEnabled && !is24Hours ? (
                    <div className="ad-agenda-picker">
                      {agendaConfigs.length === 0 ? (
                        <button
                          type="button"
                          className="ad-agenda-empty"
                          onClick={() => setIsAgendaModalOpen(true)}
                        >
                          <CalendarClock size={20} />
                          <span>Todavía no tienes una agenda. Créala (días, jornada y duración de los bloques) para poder recibir citas.</span>
                          <span className="ad-agenda-empty-cta"><PlusCircle size={15} /> Crear configuración de agenda</span>
                        </button>
                      ) : (
                        <>
                          <p className="ad-upload-hint">Elige la agenda para este aviso:</p>
                          {agendaConfigs.map((cfg) => (
                            <label
                              key={cfg.id}
                              className={`ad-agenda-option ${agendaConfigId === cfg.id ? 'active' : ''}`}
                            >
                              <input
                                type="radio"
                                name="ad-agenda-config"
                                checked={agendaConfigId === cfg.id}
                                onChange={() => setAgendaConfigId(cfg.id)}
                              />
                              <span className="ad-agenda-option-body">
                                <strong>{cfg.name}</strong>
                                <em>{getAgendaSummaryText(cfg)}</em>
                                <em className="ad-agenda-option-slots">{getAgendaWeeklySlotsCount(cfg)} bloques por semana</em>
                              </span>
                            </label>
                          ))}
                          <button
                            type="button"
                            className="ad-agenda-add-link"
                            onClick={() => setIsAgendaModalOpen(true)}
                          >
                            <PlusCircle size={14} /> Crear otra agenda
                          </button>
                        </>
                      )}
                    </div>
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

      </div>

      <div className="ad-form-footer">
        <div className="ad-form-footer-copy">
          {stepMissing.length > 0 && (step === 1 || step === 2) ? (
            <span className="ad-step-missing-tag">
              <AlertCircle size={14} /> Falta: {stepMissing.join(', ')}
            </span>
          ) : (
            <>
              <span>Etapa {step} de 2</span>
              <strong>{AD_FORM_STEPS[step - 1].label}</strong>
            </>
          )}
        </div>
        <div className="booking-actions-row">
          {step > 1 ? (
            <button type="button" className="ad-form-back" onClick={goToPrevStep} disabled={isSubmitting}>
              <ChevronLeft size={16} /> Atrás
            </button>
          ) : (
            <button type="button" className="ad-form-back" onClick={onCancel} disabled={isSubmitting}>Cancelar</button>
          )}
          {step < 2 ? (
            <button
              key="ad-form-next"
              type="button"
              className="btn-post-ad"
              onClick={goToNextStep}
              disabled={isSubmitting || Boolean(uploadTarget)}
            >
              Siguiente <ChevronRight size={16} />
            </button>
          ) : (
            <button
              key="ad-form-submit"
              type="submit"
              className="btn-post-ad"
              disabled={isSubmitting || Boolean(uploadTarget) || hasAgendaErrors}
            >
              {isSubmitting ? <Loader2 size={16} className="spin-icon" /> : <Plus size={16} />}
              {isSubmitting
                ? 'Enviando…'
                : submitLabel || (mode === 'create' ? 'Enviar a revisión' : 'Guardar cambios')}
            </button>
          )}
        </div>
      </div>

      <AgendaConfigModal
        isOpen={isAgendaModalOpen}
        onClose={() => setIsAgendaModalOpen(false)}
        onSaved={(list) => {
          setAgendaConfigs(list);
          // Selecciona la recién creada (la más nueva por updatedAt).
          if (list[0]) setAgendaConfigId(list[0].id);
        }}
      />
    </form>
  );
}
