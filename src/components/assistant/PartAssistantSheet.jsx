import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, Bike, CheckCircle2, Circle, List, Megaphone, Search, Send, Store, X } from 'lucide-react';
import { getAddressesApi, searchVehicleByPatenteApi } from '../../services/api';
import { createAuction, uploadAuctionPhoto } from '../../services/auctionApi';
import { getAssistantAvailability, loadAssistantSubcategories, sendPartBroadcast } from '../../services/assistantApi';
import { isValidPlate, lookupVehicleByPlate, normalizePlate } from '../../utils/vehicleLookup';
import {
  EMPTY_ASSISTANT_CONTEXT, MAX_ORDER_ITEMS, MAX_ORDER_PHOTOS, NUDGE_AFTER_MS, URGENCY_OPTIONS, addressLabel, auctionTrackingCode,
  buildAuctionPayload, buildBroadcastText, detectOrderIntent, emptyOrderDraft, findSubcategory, formatCLP, nextQuestion,
  normalizeText, nudgeFor, orderMissing, orderSummary, otherStoresCount, parseBudget, pickOutcome, suggestSubcategories,
  toAssistantContext, vehicleLabel,
} from '../../utils/partAssistant';
import { RepuestinAvatar, TypingDots } from './AssistantBits';
import RecommendedStoreCard from './RecommendedStoreCard';
import { SubcategoryPicker, VehicleCatalogPicker } from './AssistantPickers';
import { AddressChooser, OrderReviewCard, PhotoTray, QuantityChooser, QuickReplies, SendRound, TextAnswer, UrgencyChooser } from './OrderParts';

const BOT_NAME = 'Repuestín';
/** Pausa de "escribiendo…" antes de cada respuesta: hace que Repuestín se sienta como alguien, no un formulario. */
const TYPING_MS = 650;
/** Respuesta casi inmediata cuando el usuario ya pidió algo concreto (p. ej. publicar un encargo). */
const QUICK_REPLY_MS = 120;
const NUDGE_STEPS = ['part', 'vehicle', 'products', 'stores', 'order', 'sent'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const wait = (ms) => new Promise((done) => { setTimeout(done, ms); });

/** Un backend anterior no manda la ficha: se arma lo mínimo con lo que sí llega. */
function fallbackFicha(store) {
  return {
    especialidades: [], marcas: store.marcasEspecialistas || [], consiguePorEncargo: false, entregas: [],
    rating: store.rating ?? null, cantidadOpiniones: 0, repuestosPublicados: store.productCount ?? 0, tiendaNueva: false, fundadora: false,
  };
}

/** La dirección fija del taller: la principal de su libreta (nace con la dirección del registro). */
async function workshopAddress(userId) {
  const list = await getAddressesApi(userId);
  const book = Array.isArray(list) ? list : [];
  const principal = book.find((address) => address.esPrincipal) || book[0];
  if (!principal?.comunaNombre) throw new Error('Tu perfil no tiene una dirección con comuna registrada.');
  return principal;
}

/**
 * "Hay N casas de repuestos": también se elige. Al marcarla el usuario sabe que se generará un encargo
 * y que TODAS las casas de repuestos del sistema lo verán y podrán ofertarle.
 */
function OrderCard({ total, shown, selected, onToggle }) {
  return (
    <div
      className={`ra-all-stores${selected ? ' is-on' : ''}`}
      role="checkbox"
      tabIndex={0}
      aria-checked={selected}
      aria-label={`Generar un encargo que verán las ${total} casas de repuestos de RepuesTop`}
      onClick={onToggle}
      onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); onToggle(); } }}
    >
      <Megaphone size={26} className="ra-primary" aria-hidden="true" />
      <div className="ra-all-stores-copy">
        <strong>Hay {total} casas de repuestos en RepuesTop</strong>
        {selected ? (
          <>
            <small className="ra-all-stores-feedback">Se generará un encargo y las {total} casas de repuestos del sistema lo verán y podrán ofertarte.</small>
            <small>Ya dejé el formulario casi listo con lo que me contaste.</small>
          </>
        ) : (
          <small>{total > shown ? `Te muestro las ${shown} con más probabilidad. Toca aquí para generar un encargo que verán las ${total}.` : 'Toca aquí para generar un encargo que verán todas.'}</small>
        )}
      </div>
      {selected ? <CheckCircle2 size={26} className="ra-check is-on" aria-hidden="true" /> : <Circle size={26} className="ra-check" aria-hidden="true" />}
    </div>
  );
}

/**
 * Repuestín, el asistente de RepuesTop que aparece cuando no se encuentra un repuesto
 * (`components/assistant/PartAssistantSheet.tsx`). Por reglas y botones (sin IA): pregunta qué busca y para qué
 * vehículo, revisa EN VIVO qué hay en el sistema y lleva al usuario a (1) ver lo que ya existe, (2) dejar un mensaje
 * a las casas de repuestos con más probabilidad de tenerlo o (3) encargar el repuesto. Es proactivo.
 *
 * Celular: hoja desde abajo al 92% de alto, igual que la app. Escritorio: ventana de chat anclada abajo a la derecha,
 * sin tapar la página.
 */
export default function PartAssistantSheet({
  open, onClose, initial, returning = false, isLoggedIn, user, comuna, isMobile,
  onContextChange, onResolved, onShowProducts, onRequireLogin, onOpenOrderForm, onNavigate, storeLink, buyerMessagesLink, orderLink,
}) {
  const scrollRef = useRef(null);
  const lineSeq = useRef(0);
  const session = useRef(0);
  const botQueue = useRef(Promise.resolve());
  const nudged = useRef({});

  const [ctx, setCtx] = useState(EMPTY_ASSISTANT_CONTEXT);
  const [lines, setLines] = useState([]);
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [selected, setSelected] = useState([]);
  const [orderSelected, setOrderSelected] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [subOptions, setSubOptions] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState('');
  const [selectedSub, setSelectedSub] = useState(null);
  const [partText, setPartText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const userId = user?.userId ?? user?.id ?? null;
  // Un taller encarga siempre a la dirección del taller: no escribe una nueva ni elige entre sus direcciones.
  const isWorkshop = String(user?.role || '').toUpperCase() === 'WORKSHOP';
  const [draft, setDraft] = useState(() => emptyOrderDraft(EMPTY_ASSISTANT_CONTEXT));
  const orderItem = useRef(0);
  const orderMode = useRef(false);
  const photoThanked = useRef(false);
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState(null);

  const [marcaInput, setMarcaInput] = useState('');
  const [modeloInput, setModeloInput] = useState('');
  const [anioInput, setAnioInput] = useState('');
  const [chasisInput, setChasisInput] = useState('');
  const [vehicleMode, setVehicleMode] = useState('plate');
  const [plateInput, setPlateInput] = useState('');
  const [lookingPlate, setLookingPlate] = useState(false);

  const partValue = partText.trim();
  const suggestions = useMemo(
    () => (selectedSub && normalizeText(selectedSub.nombre) === normalizeText(partText) ? [] : suggestSubcategories(subOptions, partText)),
    [subOptions, partText, selectedSub],
  );

  const push = useCallback((from, text, images) => {
    lineSeq.current += 1;
    const id = lineSeq.current;
    setLines((current) => [...current, { id, from, text, images }]);
  }, []);

  /** Repuestín "escribe" y luego responde; las respuestas salen en orden aunque se pidan seguidas. */
  const botSay = useCallback((text, delay = TYPING_MS) => {
    const mySession = session.current;
    botQueue.current = botQueue.current.then(async () => {
      if (session.current !== mySession) return;
      setTyping(true);
      const [resolved] = await Promise.all([Promise.resolve(text), wait(delay)]);
      if (session.current !== mySession) return;
      if (resolved) push('bot', resolved);
      setTyping(false);
    });
    return botQueue.current;
  }, [push]);

  /** Muestra el siguiente paso recién cuando Repuestín terminó de hablar. */
  const goTo = useCallback((next, after) => {
    const mySession = session.current;
    setStep(null);
    void after.then(() => { if (session.current === mySession) setStep(next); });
  }, []);

  const loadSubcategories = useCallback(async () => {
    const mySession = session.current;
    setSubLoading(true);
    setSubError('');
    try {
      const options = await loadAssistantSubcategories();
      if (session.current !== mySession) return;
      setSubOptions(options);
      setSelectedSub((current) => findSubcategory(options, { id: current ? String(current.id) : undefined, name: current?.nombre }) ?? current);
    } catch {
      if (session.current === mySession) setSubError('No pudimos cargar la lista. Puedes escribir lo que buscas.');
    } finally {
      if (session.current === mySession) setSubLoading(false);
    }
  }, []);

  const otherStores = availability ? otherStoresCount(availability) : 0;

  const offerStores = useCallback((next, result, intro) => {
    setSelected([]);
    setOrderSelected(false);
    setMessageText(buildBroadcastText(next));
    void botSay(intro);
    const rest = otherStoresCount(result);
    goTo('stores', botSay(
      rest > 0
        ? `Marca las que quieras y les dejo tu mensaje. Y si prefieres que las ${rest} casas restantes también lo vean, toca la tarjeta de encargo 😉`
        : 'Marca las que quieras y les dejo tu mensaje. Suelen responder rápido 😉',
      500,
    ));
  }, [botSay, goTo]);

  const check = useCallback(async (next) => {
    setStep('checking');
    const thinking = botSay('¡Manos a la obra! Déjame revisar el taller… 🔍');
    let result;
    try {
      [result] = await Promise.all([getAssistantAvailability(next, { comuna }), thinking]);
    } catch {
      result = { productCount: 0, stores: [], totalStores: 0 };
    }
    setAvailability(result);
    const outcome = pickOutcome(result);
    if (outcome === 'products') {
      goTo('products', botSay(`¡Buenas noticias! 🎉 Encontré ${result.productCount === 1 ? '1 repuesto publicado' : `${result.productCount} repuestos publicados`} que podrían servirte.`));
    } else if (outcome === 'stores') {
      const marca = next.marca.trim();
      offerStores(next, result, `Revisé las ${result.totalStores} casas de repuestos de RepuesTop y estas ${result.stores.length === 1 ? 'es la' : `${result.stores.length} son las`} con más probabilidad de tener ${next.repuesto.trim()}${marca ? ` para ${marca}` : ''}. Las ordené de la más a la menos probable: miro especialidad, lo que ya publican de ese rubro y su valoración.`);
    } else {
      void botSay('Hoy no encontré casas de repuestos que coincidan… ¡pero tengo un plan B! 💪');
      goTo('order', botSay('Publícalo como encargo y todas las casas de repuestos podrán ofertarte. Lo armamos aquí mismo en un minuto 😉'));
    }
  }, [botSay, goTo, offerStores, comuna]);

  const beginOrderRef = useRef(null);
  const advance = useCallback((next) => {
    setCtx(next);
    const question = nextQuestion(next);
    if (question === 'vehicle') {
      goTo('vehicle', botSay(`Anotado: ${next.repuesto.trim()} ✍️ ¿Para qué vehículo es? Escríbeme la patente y detecto la marca, el modelo, el año y el chasis. Si prefieres, dime marca y modelo.`));
    } else if (orderMode.current) {
      beginOrderRef.current(next);
    } else {
      void check(next);
    }
  }, [botSay, check, goTo]);

  // Una apertura nueva empieza de cero. Reabrir desde la burbuja (`returning`) retoma el chat donde quedó.
  const started = useRef(false);
  useEffect(() => {
    if (!open) return;
    if (returning && started.current) {
      nudged.current = {};
      return;
    }
    started.current = true;
    session.current += 1;
    botQueue.current = Promise.resolve();
    nudged.current = {};
    const start = toAssistantContext(initial);
    lineSeq.current = 0;
    setCtx(start);
    setLines([]);
    setTyping(false);
    setStep(null);
    setAvailability(null);
    setSelected([]);
    setOrderSelected(false);
    setMessageText('');
    setError('');
    setSending(false);
    setPickerOpen(false);
    setMarcaInput(start.marca);
    setModeloInput(start.modelo);
    setAnioInput(start.anio);
    setChasisInput(start.chasis);
    setVehicleMode('plate');
    setPlateInput(start.patente);
    setLookingPlate(false);
    setDraft(emptyOrderDraft(start));
    orderItem.current = 0;
    orderMode.current = false;
    photoThanked.current = false;
    setAddresses([]);
    setAddressesLoading(false);
    setUploadingPhoto(false);
    setPublishing(false);
    setCreatedOrderId(null);

    const name = start.repuesto.trim();
    setPartText(name);
    setSelectedSub(start.subcategoriaId && name ? { id: Number(start.subcategoriaId), nombre: name, categoriaId: Number(start.categoriaId) || 0, categoriaNombre: '' } : null);
    void loadSubcategories();

    // Llegó por patente (o con marca y modelo): Repuestín confirma el vehículo y solo pregunta el repuesto.
    const mySession = session.current;
    const plate = start.patente ? normalizePlate(start.patente) : '';
    const vehicleLookup = plate && isValidPlate(plate)
      ? lookupVehicleByPlate(plate, { searchVehicleByPatenteApi }).catch(() => null)
      : Promise.resolve(null);
    const vehicleLine = vehicleLookup.then((found) => {
      let known = start;
      if (found) {
        known = {
          ...start,
          patente: found.patente || start.patente,
          marca: start.marca || found.marca,
          modelo: start.modelo || found.modelo,
          anio: start.anio || (found.anio > 0 ? String(found.anio) : ''),
          version: start.version || found.version,
          chasis: start.chasis || found.chasis || '',
          catalogoId: start.catalogoId || (found.catalogoId ? String(found.catalogoId) : ''),
        };
        if (session.current === mySession) {
          setCtx(known);
          setChasisInput(known.chasis);
        }
      }
      if (!known.marca.trim() || !known.modelo.trim()) return '';
      return `¡Ya tengo tu vehículo! 🚗 ${vehicleLabel(known)}${known.chasis ? ` · chasis ${known.chasis}` : ''}.`;
    });
    const knownVehicle = Boolean(start.marca.trim() && start.modelo.trim()) || Boolean(plate);
    const complete = returning && Boolean(name) && Boolean(start.marca.trim() && start.modelo.trim());
    void botSay(returning ? '¡Volviste! 🙌 Tu búsqueda sigue sin resolverse y no quiero que te quedes sin tu repuesto.' : '¡Hola! Soy Repuestín 👋🔧', 450);
    if (complete) {
      setStep(null);
      void check(start);
      return;
    }
    void botSay(vehicleLine, 500);
    const ask = start.subcategoriaId && name
      ? botSay(`Vi que estabas mirando «${name}» y no hay resultados… ¡pero no te vayas todavía! Lo dejé escrito: si es eso, toca enviar; si buscas otra cosa, escríbelo y te sugiero cómo se llama. Yo te ayudo a conseguirlo.`)
      : name
        ? botSay(`Vi que buscabas «${name}» y no apareció nada… ¡pero no te vayas todavía! Escríbeme qué repuesto necesitas y te sugiero cómo se llama para que lo busquemos bien.`)
        : botSay(knownVehicle
          ? '¿Qué repuesto necesitas para tu vehículo? Escríbelo y te voy sugiriendo cómo se llama.'
          : '¿Andas buscando algún repuesto en particular? Escríbelo y te voy sugiriendo cómo se llama.');
    goTo('part', ask);
    // Solo al abrir: `initial` cambia mientras el usuario escribe en la pantalla de atrás.
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // La burbuja guarda lo que se sabe de la búsqueda para retomarla.
  useEffect(() => {
    if (open && (ctx.repuesto || ctx.marca)) onContextChange?.(ctx);
  }, [open, ctx, onContextChange]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const node = scrollRef.current;
      if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(timer);
  }, [lines, step, typing, selected.length, orderSelected]);

  // Proactividad: si el usuario se queda quieto en un paso, Repuestín propone el siguiente movimiento (una vez por paso).
  useEffect(() => {
    if (!open || typing || !step || pickerOpen || sending || !NUDGE_STEPS.includes(step) || nudged.current[step]) return undefined;
    const mySession = session.current;
    const mark = step;
    const timer = setTimeout(() => {
      if (session.current !== mySession) return;
      nudged.current[mark] = true;
      void botSay(nudgeFor(mark, ctx, otherStores), 500);
    }, NUDGE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [open, typing, step, pickerOpen, sending, ctx, otherStores, botSay,
    selectedSub, partText, marcaInput, modeloInput, anioInput, plateInput, chasisInput, selected, orderSelected, messageText]);

  // Escape cierra la lista primero y después el chat.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (pickerOpen) setPickerOpen(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pickerOpen, onClose]);

  // En el celular la hoja tapa la página: no se desplaza lo de atrás.
  useEffect(() => {
    if (!open || !isMobile) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open, isMobile]);

  const chooseSub = (option) => {
    setSelectedSub(option);
    setPartText(option.nombre);
    setPickerOpen(false);
  };

  const chooseFreeText = (text) => {
    setSelectedSub(null);
    setPartText(text);
    setPickerOpen(false);
  };

  const changePartText = (value) => {
    setPartText(value);
    setSelectedSub((current) => (current && normalizeText(current.nombre) === normalizeText(value) ? current : null));
  };

  // ── Encargo conversado ─────────────────────────────────────────────────────────────

  const beginOrder = (next) => {
    orderMode.current = true;
    setCtx(next);
    setDraft((current) => {
      const base = emptyOrderDraft(next);
      return current.items.length > 0 && current.items[0].nombre === base.items[0]?.nombre ? current : base;
    });
    orderItem.current = 0;
    void botSay('¡Excelente! 🙌 Armemos tu encargo juntos: te hago unas preguntas cortitas y lo publico por ti. Todas las casas de repuestos lo verán y te ofertarán.');
    goTo('orderQty', botSay(`¿Cuántas unidades de «${next.repuesto.trim()}» necesitas?`, 500));
  };
  beginOrderRef.current = beginOrder;

  const startOrder = () => {
    setSelected([]);
    setOrderSelected(false);
    setError('');
    if (!isLoggedIn) {
      goTo('orderLogin', botSay('¡Me encanta la idea! 🙌 Para publicar tu encargo necesito que inicies sesión: así las tiendas te pueden ofertar y yo te aviso cuando lleguen ofertas.'));
      return;
    }
    orderMode.current = true;
    if (!ctx.repuesto.trim()) {
      setStep('part');
      if (subOptions.length === 0 && !subLoading) void loadSubcategories();
      void botSay('¡Claro que sí! 🙌 Te ayudo a publicar tu encargo y todas las casas de repuestos lo verán. ¿Qué repuesto necesitas? Escríbelo y te sugiero cómo se llama.', QUICK_REPLY_MS);
      return;
    }
    if (!ctx.marca.trim() || !ctx.modelo.trim()) {
      setStep('vehicle');
      void botSay(`¡Dale! 🙌 Armemos tu encargo de ${ctx.repuesto.trim()}. ¿Para qué vehículo es? Con la patente detecto todo al tiro.`, QUICK_REPLY_MS);
      return;
    }
    beginOrder(ctx);
  };

  const askForOrder = () => { push('me', 'Quiero publicar un encargo'); startOrder(); };

  const submitPart = () => {
    if (!partValue) return;
    if (detectOrderIntent(partValue)) {
      push('me', partValue);
      setPartText('');
      setSelectedSub(null);
      startOrder();
      return;
    }
    const sub = selectedSub ?? findSubcategory(subOptions, { name: partValue });
    push('me', partValue);
    advance({ ...ctx, repuesto: sub ? sub.nombre : partValue, subcategoriaId: sub ? String(sub.id) : '', categoriaId: sub ? String(sub.categoriaId) : '' });
  };

  const submitPlate = async () => {
    const plate = normalizePlate(plateInput);
    if (!isValidPlate(plate) || lookingPlate) {
      setError('Revisa la patente: debe ser como ABCD12 o AB1234.');
      return;
    }
    setError('');
    setLookingPlate(true);
    push('me', plate);
    const mySession = session.current;
    let vehicle = null;
    let lookupError = '';
    try {
      [vehicle] = await Promise.all([
        lookupVehicleByPlate(plate, { searchVehicleByPatenteApi }).catch((err) => { lookupError = err?.message || ''; return null; }),
        botSay('Déjame revisar esa patente… 🔎'),
      ]);
    } finally {
      setLookingPlate(false);
    }
    if (session.current !== mySession) return;
    if (!vehicle) {
      setPlateInput('');
      goTo('vehicle', botSay(lookupError
        ? `${lookupError} Si prefieres, cuéntame la marca y el modelo 🚗`
        : 'Mmm, no logré identificar esa patente 🤔 Revísala o, si prefieres, cuéntame la marca y el modelo.'));
      return;
    }
    const next = {
      ...ctx,
      patente: vehicle.patente,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      anio: vehicle.anio > 0 ? String(vehicle.anio) : '',
      version: vehicle.version,
      chasis: vehicle.chasis || ctx.chasis,
      catalogoId: vehicle.catalogoId ? String(vehicle.catalogoId) : '',
    };
    void botSay(`¡Lo tengo! 🚗 ${vehicleLabel(next)}${vehicle.chasis ? ` · chasis ${vehicle.chasis}` : ''}. Se lo paso a las tiendas para que den con la pieza exacta.`);
    advance(next);
  };

  const submitVehicle = () => {
    const marca = marcaInput.trim();
    const modelo = modeloInput.trim();
    if (!marca || !modelo) {
      setError('Indica al menos la marca y el modelo.');
      return;
    }
    setError('');
    const next = { ...ctx, patente: '', catalogoId: '', version: '', marca, modelo, anio: anioInput.trim(), chasis: chasisInput.trim().toUpperCase() };
    push('me', [vehicleLabel(next), next.chasis ? `chasis ${next.chasis}` : ''].filter(Boolean).join(' · '));
    advance(next);
  };

  const updateItem = (index, patch) => {
    setDraft((current) => ({ ...current, items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  };

  const submitQuantity = (quantity) => {
    updateItem(orderItem.current, { cantidad: quantity });
    push('me', quantity === 1 ? '1 unidad' : `${quantity} unidades`);
    goTo('orderDetail', botSay('¡Anotado! ✍️ ¿Hay algún detalle que ayude a las tiendas? Por ejemplo el lado (izquierdo o derecho), la medida, la marca que prefieres o el código de la pieza. Si no, toca «Omitir» 😊'));
  };

  const askPhotos = () => {
    goTo('orderPhotos', botSay(`¿Tienes una foto del repuesto o de la pieza dañada? 📸 Con una imagen las tiendas aciertan mucho más rápido. Puedes subir hasta ${MAX_ORDER_PHOTOS}, y si no tienes, no pasa nada.`));
  };

  const askMore = () => {
    if (draft.items.length >= MAX_ORDER_ITEMS) {
      askPhotos();
      return;
    }
    goTo('orderMore', botSay('¿Necesitas otro repuesto para el mismo vehículo? Los pongo todos en un solo encargo 🧰'));
  };

  const submitDetail = (text) => {
    if (text) {
      updateItem(orderItem.current, { descripcion: text });
      push('me', text);
    } else {
      push('me', 'Sin detalles');
    }
    askMore();
  };

  const chooseMore = (wantsMore) => {
    push('me', wantsMore ? 'Sí, agregar otro' : 'No, es todo');
    if (wantsMore) goTo('orderMorePart', botSay('¡Perfecto! ¿Qué otro repuesto necesitas?'));
    else askPhotos();
  };

  const submitExtraPart = (name) => {
    push('me', name);
    setDraft((current) => {
      orderItem.current = current.items.length;
      return { ...current, items: [...current.items, { nombre: name, cantidad: 1, descripcion: '' }] };
    });
    goTo('orderQty', botSay(`¡Sumado! ¿Cuántas unidades de «${name}» necesitas?`));
  };

  const addPhotos = async (files) => {
    const room = MAX_ORDER_PHOTOS - draft.fotos.length;
    if (room <= 0 || uploadingPhoto) return;
    setUploadingPhoto(true);
    try {
      for (const file of files.slice(0, room)) {
        if (!String(file.type || '').startsWith('image/')) continue;
        if (file.size > MAX_PHOTO_BYTES) {
          void botSay('Esa foto pesa más de 5 MB 😕 Prueba con otra más liviana.');
          continue;
        }
        try {
          const res = await uploadAuctionPhoto(file);
          if (!res?.url) throw new Error('sin url');
          const local = URL.createObjectURL(file);
          setDraft((current) => ({ ...current, fotos: [...current.fotos, { local, url: res.url }] }));
          push('me', '', [local]);
          if (!photoThanked.current) {
            photoThanked.current = true;
            void botSay('¡Buena foto! 👌 Si tienes otra (por ejemplo del código o desde otro ángulo), súbela; si no, toca «Listo, seguir».', 400);
          }
        } catch {
          void botSay('Uy, no pude subir esa foto 😕 Revisa tu conexión e inténtalo de nuevo, o sigue sin ella.');
        }
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (index) => setDraft((current) => ({ ...current, fotos: current.fotos.filter((_, i) => i !== index) }));

  const donePhotos = () => {
    push('me', draft.fotos.length > 0 ? `Listo, ${draft.fotos.length === 1 ? 'una foto' : `${draft.fotos.length} fotos`}` : 'Sin fotos');
    goTo('orderDelivery', botSay('¿Cómo prefieres recibirlo? 🚚'));
  };

  const chooseAddress = (address, automatic = false) => {
    setDraft((current) => ({ ...current, address }));
    if (automatic) void botSay(`Uso tu comuna, ${address.comunaNombre}, para ubicar tu encargo 📍`, 300);
    else push('me', addressLabel(address));
    goTo('orderUrgency', botSay('¿Para cuándo lo necesitas? ⏱️'));
  };

  const chooseDelivery = async (tipo) => {
    push('me', tipo);
    setDraft((current) => ({ ...current, tipoEnvio: tipo }));
    if (isWorkshop && userId) {
      const intro = botSay(tipo === 'Retiro en tienda'
        ? '¡Perfecto! Retiras en la tienda 🏪 Ubico tu encargo con la dirección de tu taller.'
        : '¡Genial! Te lo enviamos a la dirección de tu taller 🏠', 300);
      try {
        const [address] = await Promise.all([workshopAddress(userId), intro]);
        setDraft((current) => ({ ...current, address, addressLocked: true }));
        void botSay(`Tu taller: ${addressLabel(address)} 📍 Es fija, así que no tienes que escribirla.`, 300);
        goTo('orderUrgency', botSay('¿Para cuándo lo necesitas? ⏱️', 400));
      } catch (err) {
        await intro;
        goTo('orderDelivery', botSay(`Uy, no pude leer la dirección de tu taller 😕 ${err?.message || ''} Revísala en tu perfil e inténtalo de nuevo.`.replace(/\s+/g, ' ').trim()));
      }
      return;
    }
    setAddressesLoading(true);
    const thinking = botSay(tipo === 'Retiro en tienda'
      ? '¡Perfecto! Retiras en la tienda 🏪 Solo necesito tu comuna para mostrarle tu encargo a las tiendas cercanas.'
      : '¡Genial! ¿A qué dirección te lo envían? 📍');
    let list = [];
    try {
      const data = await getAddressesApi(userId);
      list = Array.isArray(data) ? data : [];
    } catch {
      list = [];
    }
    const sorted = [...list].sort((a, b) => Number(Boolean(b.esPrincipal)) - Number(Boolean(a.esPrincipal)));
    setAddresses(sorted);
    setAddressesLoading(false);
    const principal = sorted.find((address) => address.esPrincipal && address.comunaNombre) || null;
    if (tipo === 'Retiro en tienda' && principal) {
      await thinking;
      chooseAddress(principal, true);
      return;
    }
    goTo('orderAddress', thinking.then(() => (sorted.length === 0
      ? botSay('Aún no tienes direcciones guardadas: escríbela aquí abajo y la guardo para la próxima 😉', 300)
      : Promise.resolve())));
  };

  const chooseUrgency = (key) => {
    const option = URGENCY_OPTIONS.find((item) => item.key === key) ?? URGENCY_OPTIONS[1];
    setDraft((current) => ({ ...current, urgency: key }));
    push('me', option.label);
    goTo('orderBudget', botSay('Última pregunta, lo prometo 🙌 ¿Tienes un presupuesto máximo? Es opcional: ayuda a que te lleguen ofertas a tu medida.'));
  };

  const submitBudget = (text) => {
    const value = text ? parseBudget(text) : null;
    setDraft((current) => ({ ...current, presupuesto: value }));
    push('me', value ? `Hasta ${formatCLP(value)}` : 'Sin presupuesto');
    goTo('orderReview', botSay('¡Listo! 🎉 Revisa tu encargo antes de publicarlo. Si algo no calza, puedes ajustarlo en el formulario.'));
  };

  const publishOrder = async () => {
    const missing = orderMissing(ctx, draft);
    if (missing) {
      void botSay(`Me falta ${missing} para publicarlo 🤔`);
      return;
    }
    setPublishing(true);
    setError('');
    try {
      const created = await createAuction(buildAuctionPayload(ctx, draft));
      onResolved?.();
      setCreatedOrderId(created?.id ?? null);
      push('me', 'Publicar encargo');
      const total = availability?.totalStores ?? 0;
      void botSay(`¡Publicado! 🚀 Tu encargo ${auctionTrackingCode(created?.id ?? '')} ya está visible para ${total > 0 ? `las ${total} casas de repuestos` : 'todas las casas de repuestos'} de RepuesTop.`);
      goTo('orderDone', botSay('Te aviso apenas llegue una oferta 🔔 Mientras tanto, ¿te ayudo con algo más?', 500));
    } catch (err) {
      void botSay(`Uy, algo falló al publicarlo 😕 ${err?.message || ''} ¿Lo intento de nuevo?`.replace(/\s+/g, ' ').trim());
    } finally {
      setPublishing(false);
    }
  };

  const goLogin = () => { onClose(); onRequireLogin?.(); };

  /** Ajustar en el formulario completo, con todo lo que ya contó. */
  const goOrderForm = () => {
    onClose();
    if (!isLoggedIn) { onRequireLogin?.(); return; }
    onOpenOrderForm?.(ctx, orderMode.current ? draft : null);
  };

  const showProducts = () => {
    onResolved?.();
    onClose();
    onShowProducts?.(ctx);
  };

  const notWhatINeed = () => {
    push('me', 'No es lo que busco');
    if (availability && availability.stores.length > 0) {
      offerStores(ctx, availability, `¡Sin problema! Probemos con las casas de repuestos que más probablemente lo tienen: son ${availability.stores.length} de las ${availability.totalStores} de RepuesTop.`);
    } else {
      goTo('order', botSay('¡Sin problema! Publícalo como encargo y las casas de repuestos te ofertarán. Lo armamos aquí mismo en un minuto 😉'));
    }
  };

  /** Otro repuesto para el mismo vehículo: se conservan patente, marca, modelo, año y chasis. */
  const searchAnother = () => {
    push('me', 'Quiero buscar otro repuesto');
    const next = { ...ctx, repuesto: '', subcategoriaId: '', categoriaId: '', descripcion: '' };
    setCtx(next);
    setSelectedSub(null);
    setPartText('');
    setAvailability(null);
    setSelected([]);
    setOrderSelected(false);
    nudged.current = {};
    const vehicle = vehicleLabel(next);
    goTo('part', botSay(vehicle ? `¡Dale! 🙌 ¿Qué otro repuesto necesitas para tu ${vehicle}?` : '¡Dale! 🙌 ¿Qué otro repuesto necesitas?'));
  };

  const toggleStore = (id) => {
    setOrderSelected(false);
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const toggleOrder = () => {
    setSelected([]);
    setOrderSelected((current) => !current);
  };

  const send = async () => {
    if (!isLoggedIn) { goLogin(); return; }
    if (selected.length === 0) {
      setError('Elige al menos una casa de repuestos.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const result = await sendPartBroadcast(ctx, selected, messageText);
      onResolved?.();
      push('me', messageText.trim());
      const count = result.tiendasContactadas === 1 ? '1 casa de repuestos' : `${result.tiendasContactadas} casas de repuestos`;
      void botSay(`¡Listo! 🚀 Le escribí a ${count}${ctx.chasis || ctx.patente ? ' con los datos de tu vehículo y el chasis' : ''}. Te aviso apenas respondan.`);
      const rest = availability ? otherStoresCount(availability) : 0;
      goTo('sent', botSay(
        rest > 0
          ? `Y si quieres que las ${rest} casas restantes también te ofrezcan, genera un encargo: todas lo verán 🙌`
          : 'Mientras tanto, si quieres que más casas de repuestos te ofrezcan, también puedes encargarlo 🙌',
        500,
      ));
    } catch (err) {
      setError(err?.message || 'No pudimos enviar tu mensaje. Inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };

  const go = (path) => { onClose(); onNavigate?.(path); };

  return (
    <div className={`ra-sheet-root${open ? ' is-open' : ''}${isMobile ? ' is-mobile' : ' is-desktop'}`} hidden={!open}>
      {isMobile && <button type="button" className="ra-backdrop" aria-label="Cerrar asistente" onClick={onClose} />}
      <section className="ra-sheet" role="dialog" aria-modal={isMobile ? 'true' : 'false'} aria-label="Repuestín, el asistente de repuestos">
        {/* Cabecera con la mascota: Repuestín "en línea", como un chat con una persona. */}
        <header className="ra-sheet-header">
          {isMobile && <span className="ra-grabber" aria-hidden="true" />}
          <div className="ra-sheet-header-row">
            <RepuestinAvatar size={48} />
            <div className="ra-sheet-title">
              <strong>{BOT_NAME}</strong>
              <span><i className="ra-online" aria-hidden="true" />{typing ? 'escribiendo…' : 'Tu mecánico de repuestos · en línea'}</span>
            </div>
            <button type="button" className="ra-close" onClick={onClose} aria-label="Cerrar asistente"><X size={20} /></button>
          </div>
        </header>

        <div className="ra-sheet-body">
          <div className="ra-chat" ref={scrollRef} aria-live="polite">
            {lines.map((line) => (line.from === 'bot' ? (
              <div key={line.id} className="ra-row is-bot">
                <RepuestinAvatar size={28} />
                <div className="ra-bubble is-bot">{line.text}</div>
              </div>
            ) : (
              <div key={line.id} className="ra-row is-me">
                <div className={`ra-bubble is-me${line.images?.length ? ' has-photo' : ''}`}>
                  {line.images?.map((uri) => <img key={uri} className="ra-chat-photo" src={uri} alt="Foto adjunta al encargo" />)}
                  {line.text ? <span>{line.text}</span> : null}
                </div>
              </div>
            )))}

            {typing && (
              <div className="ra-row is-bot">
                <RepuestinAvatar size={28} />
                <div className="ra-bubble is-bot is-typing"><TypingDots /></div>
              </div>
            )}

            {(step === 'orderReview' || (publishing && draft.items.length > 0)) && (
              <div className="ra-block"><OrderReviewCard rows={orderSummary(ctx, draft)} photos={draft.fotos} /></div>
            )}

            {step === 'stores' && availability && (
              <div className="ra-block">
                {availability.stores.map((store, index) => (
                  <RecommendedStoreCard
                    key={store.proveedorId}
                    rank={index + 1}
                    name={store.nombre}
                    logoUrl={store.logoUrl}
                    comuna={store.comuna}
                    affinity={store.affinity}
                    reasons={store.reasons?.length ? store.reasons : store.summary ? [store.summary] : []}
                    ficha={store.ficha ?? fallbackFicha(store)}
                    selected={selected.includes(store.proveedorId)}
                    onToggle={() => toggleStore(store.proveedorId)}
                    onOpenProfile={() => go(storeLink({ id: store.proveedorId, nombre: store.nombre }))}
                  />
                ))}
                {availability.totalStores > 0 && (
                  <OrderCard total={availability.totalStores} shown={availability.stores.length} selected={orderSelected} onToggle={toggleOrder} />
                )}
                {selected.length > 0 && (
                  <div className="ra-message-card">
                    <label className="ra-label" htmlFor="ra-message">Tu mensaje para las tiendas</label>
                    <textarea id="ra-message" className="ra-textarea" value={messageText} maxLength={500} rows={3} onChange={(event) => setMessageText(event.target.value)} />
                    <small className="ra-caption">Sin teléfonos ni enlaces: todo se conversa dentro de RepuesTop.</small>
                    {(ctx.chasis || ctx.patente) && (
                      <div className="ra-chassis-note">
                        <Barcode size={16} className="ra-primary" />
                        <small>{ctx.chasis ? `Les entrego el chasis ${ctx.chasis}` : 'Les entrego el chasis de tu patente'} para que den con la pieza exacta.</small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {pickerOpen && (
            <SubcategoryPicker
              options={subOptions}
              loading={subLoading}
              error={subError}
              selectedId={selectedSub ? String(selectedSub.id) : undefined}
              onSelect={chooseSub}
              onUseText={chooseFreeText}
              onClose={() => setPickerOpen(false)}
              onRetry={() => void loadSubcategories()}
            />
          )}
        </div>

        {error && <p className="ra-error-text ra-sheet-error" role="alert">{error}</p>}

        <footer className="ra-sheet-footer">
          {step === 'part' && (
            <>
              {suggestions.length > 0 && (
                <div className="ra-suggestions" aria-label="Sugerencias de repuestos">
                  <span className="ra-overline">¿ES ALGUNO DE ESTOS?</span>
                  {suggestions.map((option) => (
                    <button key={option.id} type="button" className="ra-suggestion" onClick={() => chooseSub(option)} aria-label={`Elegir ${option.nombre}, ${option.categoriaNombre}`}>
                      <Search size={16} />
                      <span><strong>{option.nombre}</strong><small>{option.categoriaNombre}</small></span>
                    </button>
                  ))}
                </div>
              )}
              {selectedSub ? (
                <div className="ra-matched"><CheckCircle2 size={15} /> <span>{selectedSub.categoriaNombre ? `${selectedSub.categoriaNombre} › ${selectedSub.nombre}` : selectedSub.nombre}</span></div>
              ) : partValue.length >= 3 && suggestions.length === 0 && !subLoading ? (
                <small className="ra-caption">No encontré una categoría igual: lo busco tal como lo escribiste 👍</small>
              ) : null}
              {!orderMode.current && isLoggedIn && (
                <QuickReplies options={[{ key: 'order', label: 'Prefiero publicar un encargo', icon: 'megaphone' }]} onPick={askForOrder} />
              )}
              <form className="ra-composer" onSubmit={(event) => { event.preventDefault(); submitPart(); }}>
                <input
                  className="ra-input"
                  placeholder="¿Qué repuesto necesitas? Ej: aceite de caja"
                  value={partText}
                  maxLength={120}
                  onChange={(event) => changePartText(event.target.value)}
                  aria-label="Repuesto que necesitas"
                  autoFocus={!isMobile}
                />
                <button type="button" className="ra-browse" onClick={() => setPickerOpen(true)} aria-label="Ver todas las categorías de repuestos"><List size={20} /></button>
                <SendRound onClick={submitPart} disabled={!partValue} />
              </form>
            </>
          )}

          {step === 'vehicle' && (
            <div className="ra-mode-tabs" role="tablist">
              {['plate', 'manual'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={vehicleMode === mode}
                  className={`ra-mode-tab${vehicleMode === mode ? ' is-on' : ''}`}
                  onClick={() => { setVehicleMode(mode); setError(''); }}
                >
                  {mode === 'plate' ? 'Por patente' : 'Marca y modelo'}
                </button>
              ))}
            </div>
          )}

          {step === 'vehicle' && vehicleMode === 'plate' && (
            <form className="ra-composer" onSubmit={(event) => { event.preventDefault(); void submitPlate(); }}>
              <input
                className="ra-input is-plate"
                placeholder="Patente (ej: ABCD12)"
                value={plateInput}
                maxLength={6}
                autoCapitalize="characters"
                onChange={(event) => setPlateInput(event.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                aria-label="Patente del vehículo"
                autoFocus={!isMobile}
              />
              <button type="submit" className="ra-send" disabled={!isValidPlate(plateInput) || lookingPlate} aria-label="Enviar"><Send size={18} /></button>
            </form>
          )}

          {step === 'vehicle' && vehicleMode === 'manual' && (
            <>
              <VehicleCatalogPicker
                initial={{ marca: marcaInput, modelo: modeloInput, anio: anioInput }}
                onChange={({ marca, modelo, anio }) => { setMarcaInput(marca); setModeloInput(modelo); setAnioInput(anio); setError(''); }}
              />
              <input
                className="ra-input"
                placeholder="N° de chasis / VIN (opcional)"
                value={chasisInput}
                maxLength={20}
                onChange={(event) => setChasisInput(event.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                aria-label="Chasis del vehículo"
              />
              <button type="button" className="ra-btn ra-btn-primary ra-btn-block" onClick={submitVehicle} disabled={!marcaInput.trim() || !modeloInput.trim()}>
                Listo, usar este vehículo
              </button>
            </>
          )}

          {step === 'products' && (
            <>
              <button type="button" className="ra-btn ra-btn-primary ra-btn-block" onClick={showProducts}>Ver los repuestos</button>
              <button type="button" className="ra-btn ra-btn-outline ra-btn-block" onClick={notWhatINeed}>No es lo que busco</button>
            </>
          )}

          {step === 'stores' && (
            selected.length > 0 ? (
              <button type="button" className="ra-btn ra-btn-primary ra-btn-block" onClick={send} disabled={sending}>
                {sending ? 'Enviando…' : selected.length > 1 ? `Dejarles un mensaje (${selected.length})` : 'Dejarle un mensaje'}
              </button>
            ) : orderSelected ? (
              <button type="button" className="ra-btn ra-btn-primary ra-btn-block" onClick={askForOrder}>
                {availability && availability.totalStores > 0 ? `Generar encargo para las ${availability.totalStores} casas` : 'Generar encargo'}
              </button>
            ) : (
              <p className="ra-caption ra-center ra-pick-hint">Elige una o más casas de repuestos, o la tarjeta de encargo para que todas lo vean.</p>
            )
          )}

          {step === 'order' && (
            <>
              <button type="button" className="ra-btn ra-btn-primary ra-btn-block" onClick={askForOrder}>Publicar encargo aquí</button>
              <button type="button" className="ra-btn ra-btn-ghost ra-btn-block" onClick={searchAnother}>Buscar otro repuesto</button>
            </>
          )}

          {step === 'orderLogin' && (
            <>
              <button type="button" className="ra-btn ra-btn-primary ra-btn-block" onClick={goLogin}>Iniciar sesión</button>
              <button type="button" className="ra-btn ra-btn-ghost ra-btn-block" onClick={searchAnother}>Seguir buscando</button>
            </>
          )}

          {step === 'orderQty' && <QuantityChooser onSubmit={submitQuantity} />}

          {step === 'orderDetail' && (
            <TextAnswer
              key={`detail-${orderItem.current}`}
              placeholder="Ej: lado derecho, original, código 04465-0D120"
              onSubmit={submitDetail}
              onSkip={() => submitDetail(null)}
              maxLength={300}
              ariaLabel="Detalle del repuesto"
            />
          )}

          {step === 'orderMore' && (
            <div className="ra-two-cols">
              <button type="button" className="ra-btn ra-btn-outline" onClick={() => chooseMore(true)}>Sí, agregar otro</button>
              <button type="button" className="ra-btn ra-btn-primary" onClick={() => chooseMore(false)}>No, es todo</button>
            </div>
          )}

          {step === 'orderMorePart' && (
            <TextAnswer placeholder="¿Qué otro repuesto? Ej: filtro de aire" onSubmit={submitExtraPart} onSkip={() => chooseMore(false)} skipLabel="Mejor no, seguir" maxLength={120} ariaLabel="Otro repuesto" />
          )}

          {step === 'orderPhotos' && (
            <PhotoTray photos={draft.fotos} uploading={uploadingPhoto} onFiles={(files) => void addPhotos(files)} onRemove={removePhoto} onDone={donePhotos} />
          )}

          {step === 'orderDelivery' && (
            <div className="ra-two-cols">
              <button type="button" className="ra-btn ra-btn-outline" onClick={() => void chooseDelivery('Despacho a domicilio')}><Bike size={18} /> Despacho a domicilio</button>
              <button type="button" className="ra-btn ra-btn-outline" onClick={() => void chooseDelivery('Retiro en tienda')}><Store size={18} /> Retiro en tienda</button>
            </div>
          )}

          {step === 'orderAddress' && <AddressChooser userId={userId} addresses={addresses} loading={addressesLoading} onSelect={(address) => chooseAddress(address)} />}

          {step === 'orderUrgency' && <UrgencyChooser onPick={chooseUrgency} />}

          {step === 'orderBudget' && (
            <TextAnswer
              placeholder="Monto máximo en pesos (ej: 50000)"
              onSubmit={(text) => submitBudget(text)}
              onSkip={() => submitBudget(null)}
              skipLabel="Sin presupuesto"
              numeric
              maxLength={12}
              ariaLabel="Presupuesto máximo"
              format={(text) => {
                const digits = text.replace(/\D/g, '');
                return digits ? `$${Number(digits).toLocaleString('es-CL')}` : '';
              }}
            />
          )}

          {step === 'orderReview' && (
            <>
              <button type="button" className="ra-btn ra-btn-primary ra-btn-block" onClick={() => void publishOrder()} disabled={publishing}>{publishing ? 'Publicando…' : 'Publicar encargo'}</button>
              {/* El formulario deja elegir otra dirección: un taller no la cambia, así que no se ofrece. */}
              {!isWorkshop && <button type="button" className="ra-btn ra-btn-ghost ra-btn-block" onClick={goOrderForm} disabled={publishing}>Ajustar en el formulario</button>}
            </>
          )}

          {step === 'orderDone' && (
            <>
              <button type="button" className="ra-btn ra-btn-primary ra-btn-block" onClick={() => createdOrderId && go(orderLink(createdOrderId))}>Ver mi encargo</button>
              <button type="button" className="ra-btn ra-btn-ghost ra-btn-block" onClick={() => { orderMode.current = false; searchAnother(); }}>Buscar otro repuesto</button>
            </>
          )}

          {step === 'sent' && (
            <>
              <button type="button" className="ra-btn ra-btn-primary ra-btn-block" onClick={() => go(buyerMessagesLink)}>Ver mis mensajes</button>
              <div className="ra-two-cols">
                <button type="button" className="ra-btn ra-btn-outline" onClick={searchAnother}>Buscar otro</button>
                <button type="button" className="ra-btn ra-btn-outline" onClick={askForOrder}>Encargarlo</button>
              </div>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
