import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Building2, Car, CheckCircle2, ChevronRight, CreditCard, FileText, Loader2, Lock, MapPin, Package, ReceiptText, Sparkles, Store, Truck, User,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import {
  checkoutCartApi, checkoutConversationQuoteApi, confirmOrderPaymentApi, getAddressesApi,
  getBuyerConversationsApi, getConversationQuoteApi, getPublicProductApi, resolveMediaUrl,
  searchVehicleByPatenteApi,
} from '../services/api';
import { formatVehicleLabel, isValidPlate, lookupVehicleByPlate, normalizePlate } from '../utils/vehicleLookup';
import { adaptProduct, formatRut, isValidRut } from '../services/adapters';
import { isQuoteExpired, quantityFromLabel, quoteShippingCost } from '../utils/quoteFlow';
import { normalizeOrderStatus } from '../data/orderStatusFlow';
import { checkoutFallbackShippingMethod, resolveShippingService } from '../data/shippingMethods';
import { buyerProfilePath, profilePath, ROUTES } from '../routes/paths';
import { useSellerBlocked } from '../hooks/useSellerBlocked';
import { useBuyerBlocked } from '../hooks/useBuyerBlocked';
import BuyerAddressBook from '../components/BuyerAddressBook';
import CheckoutSummaryPanel from '../components/CheckoutSummaryPanel';
import CheckoutItemDelivery from '../components/CheckoutItemDelivery';
import CheckoutVehicleDialog from '../components/CheckoutVehicleDialog';
import {
  deliveryKind, isDispatch, methodsForItem, pendingDeliveryReason, shippingFees, vehicleLabel,
} from '../utils/cartDelivery';

const STEPS = [
  { id: 'entrega', label: 'Entrega' },
  { id: 'pago', label: 'Pago' },
];

const LAST_SUCCESSFUL_ORDER_KEY = 'repuestop_last_successful_order';


/**
 * ¿Se ofrece el método de pago "Simulación" en este ambiente?
 *
 * Es un método de PRUEBAS: no cobra nada, solo pide al backend que confirme el pedido.
 * En los ambientes de desarrollo el backend levanta con la pasarela en modo mock y esa
 * confirmación aprueba el pago, que es justo lo que se quiere para probar el flujo
 * completo sin tarjeta. En producción el modo mock está apagado a propósito
 * (`FlowPasarelaPago`, que aborta el arranque si faltan las llaves de Flow), así que
 * elegirlo deja el pedido sin pagar. Por eso la opción solo existe fuera de `main`.
 *
 * `__DEPLOY_BRANCH__` lo inyecta vite.config.js con la rama del deploy; Vite lo sustituye
 * por una constante al construir, de modo que en el bundle de producción esta rama
 * desaparece entera y la tarjeta de pruebas ni siquiera viaja al cliente.
 */
const SIMULATED_PAYMENT_ENABLED = __DEPLOY_BRANCH__ !== 'main';

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { isBlocked: isSellerBlockedAccount } = useSellerBlocked();
  const { isBlocked: isBuyerBlockedAccount } = useBuyerBlocked();
  const isBlockedAccount = isSellerBlockedAccount || isBuyerBlockedAccount;
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isSeller = user?.role === 'SELLER';
  const buyerQuotesPath = buyerProfilePath(user, 'quotes');
  const { activeVehicle, cartItems, cartCount, cartTotals, clearCart } = useMarketplace();
  const userId = user?.userId ?? user?.id;

  const location = useLocation();

  // Modo cotización: `/checkout?cotizacion=ID`. El pago de una cotización cerrada vivía
  // dentro del chat con su propia copia de dirección, documento y totales; ahora usa
  // este mismo checkout y esa copia se eliminó.
  const conversacionId = searchParams.get('cotizacion');
  const isQuoteMode = Boolean(conversacionId);
  // El chat pasa los datos de display por `state` para pintar la vista al instante; si
  // se entra por URL directa se recuperan del listado de conversaciones.
  const [quoteContext, setQuoteContext] = useState(location.state?.quoteContext || null);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(isQuoteMode);
  const [quoteError, setQuoteError] = useState('');

  const requestedStep = searchParams.get('paso');
  // Compatibilidad hacia atrás: si la URL o el historial apuntan a 'documento', se normaliza a 'pago'
  const normalizedStep = requestedStep === 'documento' ? 'pago' : requestedStep;
  const step = STEPS.some((entry) => entry.id === normalizedStep) ? normalizedStep : 'entrega';
  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addressBookOpen, setAddressBookOpen] = useState(false);

  const [documentType, setDocumentType] = useState(user?.facturaRut ? 'FACTURA' : 'BOLETA');
  const [invoice, setInvoice] = useState({
    rut: user?.facturaRut || '',
    razonSocial: user?.facturaRazonSocial || '',
    giro: user?.facturaGiro || '',
  });

  const [error, setError] = useState('');
  // `placing` sobrevive al vaciado del carrito: sin él, el clearCart posterior al pedido
  // dispararía la guarda de "carrito vacío" y devolvería al usuario a /carrito en vez de
  // dejarlo llegar a la confirmación.
  const [placing, setPlacing] = useState(false);
  // Flow es el método por defecto en TODOS los ambientes: es el único que cobra de
  // verdad. En desarrollo tampoco hace falta elegir "Simulación" para probar, porque el
  // backend en modo mock devuelve un `urlPago` con token `mock_flow_token_` y más abajo
  // `isMockToken` ya dispara la confirmación simulada igual.
  const [paymentMethod, setPaymentMethod] = useState('FLOW');
  const [paymentProcessingStatus, setPaymentProcessingStatus] = useState('');
  const submittingRef = useRef(false);

  // Espejo de `quoteContext` para leerlo dentro del efecto sin ponerlo en sus
  // dependencias: el propio efecto lo escribe, y tenerlo ahí lo hacía dispararse de
  // nuevo y pedir la cotización dos veces.
  const quoteContextRef = useRef(quoteContext);
  useEffect(() => { quoteContextRef.current = quoteContext; }, [quoteContext]);

  useEffect(() => {
    if (!isQuoteMode || !userId) return undefined;
    const contextoActual = quoteContextRef.current;

    let active = true;
    setQuoteLoading(true);
    setQuoteError('');

    Promise.all([
      getConversationQuoteApi(conversacionId),
      contextoActual ? Promise.resolve(null) : getBuyerConversationsApi(userId),
    ])
      .then(([savedQuote, conversations]) => {
        if (!active) return;
        if (!savedQuote) {
          setQuoteError('Esta conversación todavía no tiene una cotización para pagar.');
          return;
        }
        if (isQuoteExpired(savedQuote)) {
          setQuoteError('La cotización venció. Pídele al vendedor que la actualice.');
          return;
        }
        setQuote(savedQuote);
        if (!contextoActual && Array.isArray(conversations)) {
          const found = conversations.find((item) => String(item.id) === String(conversacionId));
          if (found) {
            setQuoteContext({
              conversacionId: found.id,
              productoId: found.productoId,
              productoNombre: found.productoNombre,
              productoImagenUrl: resolveMediaUrl(found.productoImagenUrl),
              proveedorId: found.proveedorId,
              tiendaNombre: found.participante || found.proveedorNombre,
            });
          }
        }
      })
      .catch((loadError) => {
        if (active) setQuoteError(loadError.message || 'No pudimos cargar la cotización.');
      })
      .finally(() => { if (active) setQuoteLoading(false); });

    return () => { active = false; };
  }, [isQuoteMode, conversacionId, userId]);

  /**
   * En modo cotización el checkout trabaja con una sola línea armada desde la propuesta
   * del vendedor: precio acordado, cantidad acordada y las condiciones de entrega que él
   * definió (que reemplazan al selector de envío del carrito).
   */
  const quoteLine = useMemo(() => {
    if (!quote) return null;
    const cantidad = quantityFromLabel(quote.cantidad) || 1;
    const total = Number(quote.precioFinal ?? quote.precio ?? 0);
    const unitario = Number(quote.precioUnitario ?? (cantidad ? total / cantidad : total));
    return {
      id: quoteContext?.productoId || conversacionId,
      titulo: quoteContext?.productoNombre || 'Producto cotizado',
      imagen: quoteContext?.productoImagenUrl || '',
      vendedor: quoteContext?.tiendaNombre || 'Tienda RepuesTop',
      proveedorId: quoteContext?.proveedorId,
      precio: unitario,
      quantity: cantidad,
      total,
      shippingMethod: quote.condicionesEntrega || '',
      // El mismo despacho que cobrara el backend (`costoDespacho` de la cotizacion).
      shippingFee: quoteShippingCost(quote),
    };
  }, [quote, quoteContext, conversacionId]);

  // Si el producto cotizado es universal. La cotizacion no lo trae, asi que se pregunta a
  // su ficha; mientras no se sepa (o si falla) se asume que no lo es y se pide el vehiculo.
  const [quoteProductUniversal, setQuoteProductUniversal] = useState(false);
  const quoteProductId = quoteContext?.productoId;
  useEffect(() => {
    if (!isQuoteMode || !quoteProductId) return undefined;
    const controller = new AbortController();
    getPublicProductApi(quoteProductId, { signal: controller.signal })
      .then((dto) => setQuoteProductUniversal(Boolean(adaptProduct(dto).esUniversal)))
      .catch(() => setQuoteProductUniversal(false));
    return () => controller.abort();
  }, [isQuoteMode, quoteProductId]);

  const lineItems = useMemo(
    () => (isQuoteMode ? (quoteLine ? [quoteLine] : []) : cartItems),
    [isQuoteMode, quoteLine, cartItems]
  );
  const itemCount = isQuoteMode ? (quoteLine?.quantity || 0) : cartCount;
  // El backend fija el costo local desde los métodos de la tienda y lo devuelve dentro
  // de `condicionesEntrega`; aquí se desglosa para que el resumen coincida con el pedido.
  // O84: `rawTotals` cuenta el envío de TODAS las tiendas; el resumen usa `totals` (más abajo),
  // que descuenta el de las entregas que quedaron por revisar.
  const rawTotals = isQuoteMode
    ? { subtotal: quoteLine?.total || 0, costoEnvio: quoteLine?.shippingFee || 0, total: (quoteLine?.total || 0) + (quoteLine?.shippingFee || 0) }
    : cartTotals;

  // Retiro en tienda no necesita dirección de despacho. Un ítem sin método todavía
  // elegido no cuenta para ningún lado: recién se sabe si hace falta dirección cuando
  // el comprador termina de elegir cómo recibe cada tienda.
  const needsAddress = useMemo(() => lineItems.some((item) => (
    item.shippingMethod && resolveShippingService(item.shippingMethod).name !== 'Retiro en tienda'
  )), [lineItems]);

  const groups = useMemo(() => {
    const byStore = new Map();
    lineItems.forEach((item) => {
      const key = String(item.proveedorId || item.vendedor || item.id);
      if (!byStore.has(key)) {
        byStore.set(key, { key, vendedor: item.vendedor, shippingMethod: item.shippingMethod || '', items: [] });
      }
      byStore.get(key).items.push(item);
    });
    return [...byStore.values()];
  }, [lineItems]);

  // La cotización trae su entrega acordada; el carrito la elige por producto (más abajo).
  const allShippingChosen = isQuoteMode || groups.every((group) => Boolean(group.shippingMethod));
  const totals = rawTotals;

  const shippingLabel = useMemo(() => {
    const services = lineItems
      .map((item) => item.shippingMethod)
      .filter(Boolean)
      .map((method) => resolveShippingService(method).name);
    if (services.length === 0) return 'Por definir';
    if (services.every((name) => name === 'Retiro en tienda')) return 'Retiro en tienda';
    if (services.some((name) => name === 'Envío fuera de la comuna')) return 'Por pagar';
    // El despacho dentro de la comuna tiene costo: decir "Sin costo" junto a un total que lo
    // incluye contradecia el propio resumen.
    if (Number(totals.costoEnvio) > 0) return formatCLP(totals.costoEnvio);
    return 'Sin costo';
  }, [lineItems, totals.costoEnvio]);

  // `silent` es para cuando la libreta embebida avisa un cambio: sin el estado de carga
  // la libreta no se desmonta a mitad de camino (se oculta mientras carga) y la
  // dirección recién creada aparece seleccionada en la lista.
  const loadAddresses = useCallback(({ silent = false } = {}) => {
    if (!userId) return;
    if (!silent) setAddressesLoading(true);
    getAddressesApi(userId)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAddresses(list);
        const principal = list.find((address) => address.esPrincipal);
        // La selección actual se conserva solo si sigue existiendo: pudo borrarse desde la libreta.
        setSelectedAddressId((current) => (
          list.some((address) => String(address.id) === String(current))
            ? current
            : String(principal?.id || list[0]?.id || '')
        ));
      })
      .catch(() => setAddresses([]))
      .finally(() => setAddressesLoading(false));
  }, [userId]);

  // Se cargan desde el inicio, no recien cuando hace falta direccion: la comuna de la direccion
  // elegida decide que metodos de despacho se ofrecen (dentro/fuera de la comuna).
  useEffect(() => {
    if (userId) loadAddresses();
  }, [userId, loadAddresses]);

  // Checkout por producto (2026-10-02, igual que la app): los vehículos de la compra (el propio,
  // el de un familiar) y la entrega de cada producto: método, dirección y vehículo.
  const [cartVehicles, setCartVehicles] = useState(() => (
    activeVehicle?.marca || activeVehicle?.patente
      ? [{
        key: 'v-activo',
        patente: normalizePlate(activeVehicle.patente || ''),
        marca: activeVehicle.marca || '',
        modelo: activeVehicle.modelo || '',
        anio: activeVehicle.anio ? String(activeVehicle.anio) : '',
        catalogoId: activeVehicle.catalogoId || null,
      }]
      : []
  ));
  const [identifiedPlates, setIdentifiedPlates] = useState(() => new Set(
    activeVehicle?.patente && activeVehicle?.marca ? [normalizePlate(activeVehicle.patente)] : [],
  ));
  const [deliveries, setDeliveries] = useState({});
  const [vehicleDialog, setVehicleDialog] = useState(null);
  const deliveryPlateCache = useRef(new Map());

  // Cada producto parte con el método que eligió al agregarlo, la dirección principal y el primer
  // vehículo de la compra; después el comprador cambia lo que necesite en cada uno.
  useEffect(() => {
    if (isQuoteMode) return;
    setDeliveries((current) => {
      const principalId = String(addresses.find((address) => address.esPrincipal)?.id || addresses[0]?.id || '') || null;
      const next = {};
      let changed = Object.keys(current).length !== cartItems.length;
      cartItems.forEach((item) => {
        const previous = current[item.id];
        const addressId = previous?.addressId && addresses.some((address) => String(address.id) === String(previous.addressId))
          ? previous.addressId : principalId;
        const address = addresses.find((entry) => String(entry.id) === String(addressId)) || null;
        const allowed = methodsForItem(item, address);
        const wanted = previous?.method ?? (item.shippingMethod || null);
        const method = wanted && allowed.includes(wanted) ? wanted : allowed.length === 1 ? allowed[0] : null;
        const vehicleKey = item.esUniversal
          ? null
          : previous?.vehicleKey && cartVehicles.some((vehicle) => vehicle.key === previous.vehicleKey)
            ? previous.vehicleKey
            : cartVehicles[0]?.key ?? null;
        next[item.id] = { method, addressId, vehicleKey };
        if (!previous || previous.method !== method || previous.addressId !== addressId || previous.vehicleKey !== vehicleKey) changed = true;
      });
      return changed ? next : current;
    });
  }, [isQuoteMode, cartItems, addresses, cartVehicles]);

  // Si la nueva dirección deja fuera el método elegido ("dentro de la comuna" hacia otra comuna),
  // se pasa al equivalente que sí sirve.
  const updateDelivery = (item, patch) => {
    setDeliveries((current) => {
      const merged = { method: null, addressId: null, vehicleKey: null, ...current[item.id], ...patch };
      const address = addresses.find((entry) => String(entry.id) === String(merged.addressId)) || null;
      const allowed = methodsForItem(item, address);
      if (merged.method && !allowed.includes(merged.method)) {
        const kind = deliveryKind(merged.method);
        const equivalente = kind === 'local' || kind === 'courier'
          ? allowed.find((method) => deliveryKind(method) === (kind === 'local' ? 'courier' : 'local'))
          : undefined;
        merged.method = equivalente ?? null;
      }
      return { ...current, [item.id]: merged };
    });
  };

  const saveCartVehicle = (vehicle, plateIdentified) => {
    setCartVehicles((current) => (current.some((entry) => entry.key === vehicle.key)
      ? current.map((entry) => (entry.key === vehicle.key ? vehicle : entry))
      : [...current, vehicle]));
    setIdentifiedPlates((current) => {
      const next = new Set(current);
      if (plateIdentified && vehicle.patente) next.add(vehicle.patente);
      else next.delete(vehicle.patente);
      return next;
    });
    const itemId = vehicleDialog?.itemId;
    if (itemId != null) {
      setDeliveries((current) => ({ ...current, [itemId]: { method: null, addressId: null, ...current[itemId], vehicleKey: vehicle.key } }));
    }
    setVehicleDialog(null);
  };

  const cartShipping = useMemo(() => shippingFees(cartItems, deliveries), [cartItems, deliveries]);
  const entregaPendiente = isQuoteMode ? '' : pendingDeliveryReason(cartItems, deliveries, cartVehicles, identifiedPlates);
  // En el carrito el envío se cobra por destino de cada tienda (la regla del backend).
  const checkoutTotals = isQuoteMode
    ? totals
    : { subtotal: rawTotals.subtotal, costoEnvio: cartShipping.total, total: rawTotals.subtotal + cartShipping.total };
  const checkoutShippingLabel = (() => {
    if (isQuoteMode) return shippingLabel;
    const methods = cartItems.map((item) => deliveries[item.id]?.method).filter(Boolean);
    if (methods.length < cartItems.length) return 'Por definir';
    if (methods.every((method) => deliveryKind(method) === 'pickup')) return 'Retiro en tienda';
    if (cartShipping.total > 0) {
      return cartShipping.shipments > 1 ? `${formatCLP(cartShipping.total)} (${cartShipping.shipments} despachos)` : formatCLP(cartShipping.total);
    }
    if (methods.some((method) => deliveryKind(method) === 'courier')) return 'Por pagar';
    return 'Sin costo';
  })();
  const addressBookRef = useRef(null);
  const openAddressBook = () => {
    setAddressBookOpen(true);
    window.setTimeout(() => addressBookRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  // Se parte de los params actuales en vez de escribir un objeto nuevo: pasarle
  // `{ paso: id }` a setSearchParams reemplaza TODA la query, y eso borraba el
  // `?cotizacion=` al avanzar de paso — el checkout perdía el modo cotización a mitad
  // de camino y la guarda de carrito vacío mandaba al usuario a /carrito.
  const goStep = (id) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (id === 'entrega') next.delete('paso');
      else next.set('paso', id);
      return next;
    }, { replace: false });
    setError('');
  };

  // Vehiculo del comprador. Si llego al checkout desde una busqueda por patente, el
  // vehiculo ya esta en el contexto y solo se confirma; si no, lo declara a mano. Es lo
  // que el vendedor usa para confirmar la compatibilidad antes de preparar el pedido
  // (docs/planes/plan_validacion_compatibilidad_pedido.md), asi que es obligatorio en
  // cuanto hay un repuesto que no es universal. El backend aplica la misma regla.
  const [useActiveVehicle, setUseActiveVehicle] = useState(true);
  const [vehicleForm, setVehicleForm] = useState({ patente: '', marca: '', modelo: '', anio: '' });
  const hasActiveVehicle = Boolean(activeVehicle?.marca || activeVehicle?.patente);
  const vehicleRequired = isQuoteMode
    ? Boolean(quoteLine) && !quoteProductUniversal
    : cartItems.some((item) => !item.esUniversal);
  // El formulario va siempre abierto, aunque sea opcional: plegado tras un "+ Agregar", el
  // comprador lo pasaba de largo y el pedido le llegaba al vendedor sin vehiculo contra el
  // cual revisar la compatibilidad (su checklist de confirmacion).
  const showVehicleForm = !hasActiveVehicle || !useActiveVehicle;

  // H26 (pruebas de lanzamiento, 25-sep, decisión del usuario): la patente escrita en el
  // checkout se identifica como en el home, para que el pedido lleve marca, modelo y año y el
  // vendedor pueda revisar la compatibilidad. Una sola consulta por patente (caché local) y solo
  // con la patente completa: con 6 caracteres al escribir, con 5 (motos) al salir del campo, para
  // no consultar por el camino "AB123" mientras se escribe "AB1234" (cada patente nueva tiene
  // costo). Si no se identifica, se piden marca, modelo y año.
  const [plateLookup, setPlateLookup] = useState({ patente: '', status: 'idle', vehicle: null });
  const plateLookupCache = useRef(new Map());
  const identifyPlate = useCallback(async (raw) => {
    const patente = normalizePlate(raw);
    if (!isValidPlate(patente)) return;
    if (plateLookupCache.current.has(patente)) {
      const cached = plateLookupCache.current.get(patente);
      setPlateLookup({ patente, status: cached ? 'found' : 'notfound', vehicle: cached });
      return;
    }
    setPlateLookup({ patente, status: 'loading', vehicle: null });
    let vehicle = null;
    let status = 'notfound';
    try {
      vehicle = await lookupVehicleByPlate(patente, { searchVehicleByPatenteApi });
      status = vehicle ? 'found' : 'notfound';
      plateLookupCache.current.set(patente, vehicle);
    } catch {
      // 429 (tope de patentes nuevas) o red: no se cachea, se piden los datos a mano.
      status = 'error';
    }
    // Si mientras tanto se escribió otra patente, esta respuesta ya no aplica.
    setPlateLookup((current) => (current.patente === patente ? { patente, status, vehicle } : current));
    // La patente manda: se pisan marca, modelo y año aunque ya hubiera datos (de otra
    // patente escrita antes, por ejemplo).
    if (vehicle) {
      setVehicleForm((current) => (normalizePlate(current.patente) !== patente ? current : {
        ...current,
        marca: vehicle.marca || current.marca,
        modelo: vehicle.modelo || current.modelo,
        anio: vehicle.anio > 0 ? String(vehicle.anio) : current.anio,
      }));
    }
  }, []);
  useEffect(() => {
    const patente = normalizePlate(vehicleForm.patente);
    if (patente.length !== 6 || !isValidPlate(patente) || plateLookup.patente === patente) return undefined;
    const timer = setTimeout(() => { identifyPlate(patente); }, 500);
    return () => clearTimeout(timer);
  }, [vehicleForm.patente, plateLookup.patente, identifyPlate]);
  const lookupForCurrentPlate = plateLookup.patente && plateLookup.patente === normalizePlate(vehicleForm.patente)
    ? plateLookup
    : null;

  const checkoutVehicle = useMemo(() => {
    if (hasActiveVehicle && useActiveVehicle) {
      return {
        patente: activeVehicle.patente || null,
        vehiculoCatalogoId: activeVehicle.catalogoId || null,
        marca: activeVehicle.marca || null,
        modelo: activeVehicle.modelo || null,
        anio: activeVehicle.anio || null,
      };
    }
    const patente = vehicleForm.patente.trim();
    const marca = vehicleForm.marca.trim();
    const modelo = vehicleForm.modelo.trim();
    const anio = Number(vehicleForm.anio) || null;
    // Sin ningun dato no se manda nada: el backend lo registra como NO_INFORMADO.
    if (!patente && !marca && !modelo && !anio) return null;
    const identificado = lookupForCurrentPlate?.status === 'found' ? lookupForCurrentPlate.vehicle : null;
    return {
      patente: patente || null,
      vehiculoCatalogoId: identificado?.catalogoId || null,
      marca: marca || null,
      modelo: modelo || null,
      anio,
    };
  }, [activeVehicle, hasActiveVehicle, useActiveVehicle, vehicleForm, lookupForCurrentPlate]);
  // Basta una patente identificada, o marca, modelo y año. Una patente que no se pudo
  // identificar (o que se está consultando) no alcanza: el vendedor no tendría contra qué
  // revisar la compatibilidad (H26).
  const vehicleComplete = Boolean(checkoutVehicle) && (
    Boolean(checkoutVehicle.marca && checkoutVehicle.modelo && checkoutVehicle.anio)
    || (hasActiveVehicle && useActiveVehicle
      && String(checkoutVehicle.patente || '').replace(/[^A-Za-z0-9]/g, '').length >= 5)
    || lookupForCurrentPlate?.status === 'found'
  );

  // Cada vez que se llega al paso de pago la pagina baja sola hasta el vehiculo y lo hace
  // parpadear: es opcional, pero el comprador lo pasaba de largo. El ref de callback se
  // dispara al montar el bloque, que solo existe en el paso de pago, asi que corre una vez
  // por llegada (tambien al volver desde "Entrega").
  const vehicleSectionNode = useRef(null);
  const plateInputRef = useRef(null);
  const [vehicleAttention, setVehicleAttention] = useState(0);
  const focusVehicleSection = useCallback(() => {
    const node = vehicleSectionNode.current;
    if (!node) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    setVehicleAttention((current) => current + 1);
    // Con mouse se deja el cursor en la patente; en celular no, para no abrir el teclado
    // encima del resumen.
    const input = plateInputRef.current;
    if (input && !input.value && window.matchMedia?.('(pointer: fine)').matches) {
      input.focus({ preventScroll: true });
    }
  }, []);
  const vehicleSectionRef = useCallback((node) => {
    vehicleSectionNode.current = node;
    if (node) window.setTimeout(focusVehicleSection, 350);
  }, [focusVehicleSection]);
  // Pagar sin vehiculo (cuando es opcional) pide un segundo clic: el primero lleva al bloque.
  const [vehicleSkipWarned, setVehicleSkipWarned] = useState(false);
  const vehicleSkipPending = isQuoteMode && step === 'pago' && !vehicleRequired && !checkoutVehicle;

  const rutValid = isValidRut(invoice.rut);
  // Un vendedor sin ninguna direccion propia guardada no queda trabado aca: el backend
  // ya sabe usar la direccion de su tienda como respaldo al armar el pedido
  // (PedidoCheckoutCarritoSupport/CotizacionSupport), asi que no hace falta forzarlo a
  // agregar una direccion solo para destrabar el boton.
  const sellerWithoutSavedAddress = isSeller && !addressesLoading && addresses.length === 0;
  const stepComplete = {
    entrega: isQuoteMode
      ? allShippingChosen && (!needsAddress || Boolean(selectedAddressId) || sellerWithoutSavedAddress)
      : !entregaPendiente,
    // En el carrito el vehículo ya va en cada producto (paso Entrega).
    pago: Boolean(paymentMethod) && (documentType !== 'FACTURA' || rutValid)
      && (!isQuoteMode || !vehicleRequired || vehicleComplete),
  };

  // Lo que falta para avanzar, dicho antes de que la persona haga clic: el botón se
  // deshabilita, pero un botón apagado sin explicación es igual de frustrante.
  const missingForStep = {
    entrega: !isQuoteMode
      ? entregaPendiente
      : !allShippingChosen
        ? 'Elige cómo recibir los productos de cada tienda para continuar.'
        : 'Selecciona una dirección de entrega para continuar.',
    pago: documentType === 'FACTURA' && !rutValid
      ? 'Ingresa un RUT válido para emitir la factura.'
      : isQuoteMode && vehicleRequired && !vehicleComplete
        ? (lookupForCurrentPlate?.status === 'loading'
          ? 'Estamos identificando tu patente…'
          : (lookupForCurrentPlate?.status === 'notfound' || lookupForCurrentPlate?.status === 'error')
            ? 'No pudimos identificar la patente: completa la marca, el modelo y el año.'
            : 'Indica la patente o la marca, modelo y año de tu vehículo para continuar.')
        : '',
  }[step];

  const pay = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPlacing(true);
    setError('');
    setPaymentProcessingStatus('Generando el pedido…');
    try {
      const order = isQuoteMode
        ? await checkoutConversationQuoteApi(userId, {
          productoId: quoteContext?.productoId,
          precioUnitario: quoteLine.precio,
          cantidad: quoteLine.quantity,
          metodoEnvio: quoteLine.shippingMethod,
          conversacionId,
          tipoDocumentoTributario: documentType,
          facturaRut: documentType === 'FACTURA' ? invoice.rut.trim() : null,
          facturaRazonSocial: documentType === 'FACTURA' ? invoice.razonSocial.trim() : null,
          facturaGiro: documentType === 'FACTURA' ? invoice.giro.trim() : null,
          direccionId: needsAddress && selectedAddressId ? Number(selectedAddressId) : null,
          vehiculo: checkoutVehicle,
        })
        : await (() => {
          // Entrega de cada producto: su método, su dirección (si se despacha) y su vehículo.
          const toVehiculo = (vehicle) => (vehicle ? {
            patente: vehicle.patente || null,
            vehiculoCatalogoId: vehicle.catalogoId || null,
            marca: vehicle.marca || null,
            modelo: vehicle.modelo || null,
            anio: Number(vehicle.anio) || null,
          } : null);
          const entregas = cartItems.map((item) => {
            const delivery = deliveries[item.id] || {};
            const vehicle = item.esUniversal ? null : cartVehicles.find((entry) => entry.key === delivery.vehicleKey);
            return {
              productoId: Number(item.id),
              metodoEnvio: delivery.method || item.shippingMethod || null,
              direccionId: isDispatch(delivery.method) && delivery.addressId ? Number(delivery.addressId) : null,
              vehiculo: toVehiculo(vehicle),
            };
          });
          const principalDireccion = entregas.find((entrega) => entrega.direccionId)?.direccionId;
          return checkoutCartApi(userId, {
            direccionId: principalDireccion ? String(principalDireccion) : '',
            metodoEnvio: checkoutFallbackShippingMethod(cartItems),
            tipoDocumentoTributario: documentType,
            facturaRut: documentType === 'FACTURA' ? invoice.rut.trim() : '',
            facturaRazonSocial: documentType === 'FACTURA' ? invoice.razonSocial.trim() : '',
            facturaGiro: documentType === 'FACTURA' ? invoice.giro.trim() : '',
            vehiculo: entregas.find((entrega) => entrega.vehiculo)?.vehiculo ?? null,
            entregas,
          });
        })();
      // Una cotización no toca el carrito: vaciarlo acá borraría productos que la
      // persona dejó guardados para después.
      if (!isQuoteMode) clearCart();

      // ¿Debe simularse el pago?
      // Se simula si el usuario eligió SIMULACION o si el urlPago contiene token mock de prueba
      const isMockToken = Boolean(order?.urlPago && /mock_flow_token_/i.test(order.urlPago));
      const shouldSimulate = paymentMethod === 'SIMULACION' || isMockToken;

      if (shouldSimulate && order?.id) {
        setPaymentProcessingStatus('Simulando confirmación de pago…');
        let finalOrder = order;
        try {
          const confirmed = await confirmOrderPaymentApi(userId, order.id);
          if (confirmed) finalOrder = confirmed;
        } catch (confirmErr) {
          // El pedido ya existe; que la confirmación falle no lo invalida. La pantalla de
          // confirmación vuelve a pedirla sola cuando el pedido sigue PENDIENTE.
          console.warn('No se pudo confirmar el pago simulado:', confirmErr);
        }

        // Quién decide si está pagado es el backend contra la pasarela, nunca el cliente.
        // Antes se escribía `estado: 'PAGADO'` a mano cuando la confirmación no llegaba, y
        // el comprador terminaba con un comprobante "Pagado" sobre un pedido que nunca se
        // cobró y que el job de expiración iba a cancelar.
        const pagoConfirmado = normalizeOrderStatus(finalOrder) !== 'PENDIENTE';
        if (pagoConfirmado) finalOrder = { ...finalOrder, isSimulatedPayment: true };

        try {
          sessionStorage.setItem(LAST_SUCCESSFUL_ORDER_KEY, JSON.stringify(finalOrder));
        } catch {
          // El state de navegación mantiene la confirmación disponible en esta sesión.
        }

        setPaymentProcessingStatus(pagoConfirmado ? '¡Pago aprobado con éxito!' : 'El pedido quedó pendiente de pago');
        navigate(ROUTES.purchaseSuccess, { state: { order: finalOrder, isSimulated: pagoConfirmado } });
        return;
      }

      // Si no es simulación y trae urlPago de Flow real, redirige a la pasarela
      try {
        sessionStorage.setItem(LAST_SUCCESSFUL_ORDER_KEY, JSON.stringify(order));
      } catch {
        // El state de navegación mantiene la confirmación disponible en esta sesión.
      }
      if (order?.urlPago) {
        window.location.href = order.urlPago;
        return;
      }
      navigate(ROUTES.purchaseSuccess, { state: { order } });
    } catch (submitError) {
      setError(submitError.message || 'No se pudo generar el pedido. Intenta nuevamente.');
      submittingRef.current = false;
      setPlacing(false);
      setPaymentProcessingStatus('');
    }
  };

  const advance = () => {
    if (!stepComplete[step]) {
      setError(missingForStep);
      return;
    }
    if (step === 'pago') {
      if (vehicleSkipPending && !vehicleSkipWarned) {
        setVehicleSkipWarned(true);
        focusVehicleSection();
        return;
      }
      pay();
      return;
    }
    goStep(STEPS[stepIndex + 1].id);
  };

  // Cuenta bloqueada: el backend responde 403 a todo el lado comprador. Se corta antes
  // de que el usuario llene la direccion y el pago falle al final.
  if (isBlockedAccount) {
    return (
      <main className="checkout-page">
        <div className="cart-page-shell">
          <div className="checkout-block">
            <p className="checkout-error">
              <Lock size={15} /> Tu cuenta está bloqueada: no puedes completar compras mientras se revisa tu caso.
            </p>
            <button type="button" className="checkout-summary-back" onClick={() => navigate(profilePath('resumen'))}>
              <ArrowLeft size={15} /> Ir a mi perfil
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!isQuoteMode && cartItems.length === 0 && !placing) return <Navigate to={ROUTES.cart} replace />;

  if (isQuoteMode && (quoteLoading || quoteError || !quoteLine)) {
    return (
      <main className="checkout-page">
        <div className="cart-page-shell">
          {quoteLoading ? (
            <p className="checkout-block-loading"><Loader2 size={16} className="spin-icon" /> Cargando la cotización…</p>
          ) : (
            <div className="checkout-block">
              <p className="checkout-error"><AlertTriangle size={15} /> {quoteError || 'No encontramos esta cotización.'}</p>
              <button type="button" className="checkout-summary-back" onClick={() => navigate(buyerQuotesPath)}>
                <ArrowLeft size={15} /> Volver a mis cotizaciones
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <div className="cart-page-shell">
        <header className="cart-page-head checkout-shopify-header">
          <div className="checkout-shopify-header-top">
            {isQuoteMode
              ? <Link className="cart-page-back" to={buyerQuotesPath}><ArrowLeft size={16} /> Volver a mis cotizaciones</Link>
              : <Link className="cart-page-back" to={ROUTES.cart}><ArrowLeft size={16} /> Volver al carrito</Link>}
            <h1>{isQuoteMode ? 'Pagar cotización' : 'Finalizar compra'}</h1>
          </div>

          <nav className="shopify-breadcrumb-nav" aria-label="Progreso de la compra">
            <Link
              to={isQuoteMode ? buyerQuotesPath : ROUTES.cart}
              className="shopify-breadcrumb-link"
            >
              {isQuoteMode ? 'Cotización' : 'Carrito'}
            </Link>
            <ChevronRight size={13} className="shopify-breadcrumb-sep" />

            <button
              type="button"
              className={`shopify-breadcrumb-step ${step === 'entrega' ? 'is-active' : 'is-completed'}`}
              onClick={() => goStep('entrega')}
            >
              Entrega
            </button>
            <ChevronRight size={13} className="shopify-breadcrumb-sep" />

            <button
              type="button"
              className={`shopify-breadcrumb-step ${step === 'pago' ? 'is-active' : ''}`}
              onClick={() => stepComplete.entrega && goStep('pago')}
              disabled={!stepComplete.entrega}
            >
              Pago y facturación
            </button>
          </nav>
        </header>

        <div className="cart-page-layout">
          <div className="checkout-main">
            {step === 'entrega' && (
              <div className="checkout-main-flow">
                <section className="checkout-block checkout-contact-card" aria-label="Información de contacto">
                  <div className="checkout-contact-header">
                    <span className="checkout-contact-title">
                      <User size={15} /> Información de contacto
                    </span>
                    <span className="checkout-contact-user">
                      {user?.email || user?.nombreCompleto || 'Usuario RepuesTop'}
                    </span>
                  </div>
                  <p className="checkout-contact-note">
                    Recibirás la confirmación del pedido y comprobante de compra en esta cuenta.
                  </p>
                </section>

                {!isQuoteMode && (
                  <section className="checkout-block" aria-labelledby="checkout-shipping-title">
                    <h2 id="checkout-shipping-title"><Truck size={16} /> Entrega de cada producto</h2>
                    <p className="checkout-block-note">
                      Elige cómo recibir cada repuesto, a qué dirección va y para qué vehículo es: puede ser tu auto o el de un familiar.
                    </p>
                    <div className="checkout-delivery-groups">
                      {groups.map((group) => (
                        <div key={group.key} className="cart-store-group">
                          <div className="cart-store-head">
                            <div className="cart-store-id">
                              <span className="cart-store-avatar"><Store size={15} /></span>
                              <strong>{group.items[0]?.storeName || group.vendedor || 'Tienda RepuesTop'}</strong>
                              {group.items[0]?.storeComuna && <small className="checkout-store-commune">{group.items[0].storeComuna}</small>}
                            </div>
                          </div>
                          <div className="cart-store-lines">
                            {group.items.map((item) => {
                              const delivery = deliveries[item.id] || { method: null, addressId: null, vehicleKey: null };
                              const sharesShipment = cartShipping.perItem[item.id] === 0 && deliveryKind(delivery.method) === 'local'
                                && group.items.some((other) => other.id !== item.id
                                  && String(deliveries[other.id]?.addressId) === String(delivery.addressId)
                                  && (cartShipping.perItem[other.id] || 0) > 0);
                              return (
                                <div key={item.id} className="checkout-delivery-line">
                                  <div className="cart-line">
                                    <div className="cart-line-media">
                                      {item.imagen ? <img src={item.imagen} alt="" loading="lazy" /> : <Package size={20} />}
                                    </div>
                                    <div className="cart-line-info">
                                      <h3>{item.titulo}</h3>
                                      <p className="cart-line-meta">
                                        <span>{item.quantity} {item.quantity === 1 ? 'unidad' : 'unidades'}</span>
                                        {item.marca && <span>{item.marca}</span>}
                                        <span>{formatCLP(item.precio * item.quantity)}</span>
                                      </p>
                                    </div>
                                  </div>
                                  <CheckoutItemDelivery
                                    item={item}
                                    delivery={delivery}
                                    addresses={addresses}
                                    vehicles={cartVehicles}
                                    sharesShipment={sharesShipment}
                                    onChange={(patch) => updateDelivery(item, patch)}
                                    onAddVehicle={() => setVehicleDialog({ vehicle: null, itemId: item.id })}
                                    onEditVehicle={(vehicle) => setVehicleDialog({ vehicle, itemId: item.id })}
                                    onManageAddresses={openAddressBook}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {!isQuoteMode && (
                  <section className="checkout-block" aria-labelledby="checkout-direcciones-title" ref={addressBookRef}>
                    <h2 id="checkout-direcciones-title"><MapPin size={16} /> Tus direcciones</h2>
                    <p className="checkout-block-note">
                      Cada producto que se despacha elige una de estas direcciones. Agrega la de tu familiar si le envías un repuesto.
                    </p>
                    <button type="button" className="checkout-inline-link" onClick={() => setAddressBookOpen((open) => !open)}>
                      {addressBookOpen ? 'Ocultar direcciones' : 'Agregar o editar direcciones'}
                    </button>
                    {(addressBookOpen || (!addressesLoading && addresses.length === 0)) && (
                      <div className="checkout-address-book"><BuyerAddressBook usuarioId={userId} onChange={() => loadAddresses({ silent: true })} /></div>
                    )}
                  </section>
                )}

                {isQuoteMode && (
                <section className="checkout-block" aria-labelledby="checkout-entrega-title">
                  <h2 id="checkout-entrega-title"><MapPin size={16} /> ¿Dónde recibes tu pedido?</h2>

                  {!allShippingChosen ? (
                    <p className="checkout-block-note">
                      Elige primero, arriba, cómo recibes los productos de cada tienda.
                    </p>
                  ) : needsAddress ? (
                    <>
                      {addressesLoading ? (
                        <p className="checkout-block-loading"><Loader2 size={15} className="spin-icon" /> Cargando tus direcciones…</p>
                      ) : addresses.length > 0 ? (
                        <div className="checkout-address-list" role="radiogroup" aria-label="Direcciones guardadas">
                          {addresses.map((address) => (
                            <label key={address.id} className={String(address.id) === String(selectedAddressId) ? 'is-selected' : ''}>
                              <input
                                type="radio"
                                name="checkout-address"
                                value={address.id}
                                checked={String(address.id) === String(selectedAddressId)}
                                onChange={(event) => setSelectedAddressId(event.target.value)}
                              />
                              <span className="checkout-address-body">
                                <strong>{address.calleYNumero}</strong>
                                <small>{address.comunaNombre}{address.regionNombre ? `, ${address.regionNombre}` : ''}</small>
                              </span>
                              {address.esPrincipal && (
                                <em
                                  className="checkout-address-tag"
                                  style={isSeller ? { background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' } : undefined}
                                >
                                  {isSeller ? 'Dirección de tu tienda' : 'Principal'}
                                </em>
                              )}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="checkout-block-empty"><AlertTriangle size={15} /> Todavía no tienes direcciones guardadas.</p>
                      )}

                      <button
                        type="button"
                        className="checkout-inline-link"
                        onClick={() => setAddressBookOpen((open) => !open)}
                      >
                        {addressBookOpen
                          ? 'Ocultar opciones de dirección'
                          : (isSeller ? '+ Enviar a otra dirección' : 'Agregar o editar direcciones')}
                      </button>

                      {(addressBookOpen || (!addressesLoading && addresses.length === 0)) && (
                        <div className="checkout-address-book"><BuyerAddressBook usuarioId={userId} onChange={() => loadAddresses({ silent: true })} /></div>
                      )}
                    </>
                  ) : (
                    <p className="checkout-block-note">
                      Todos los productos son retiro en tienda, así que no necesitamos una dirección de despacho.
                      Coordina el retiro con cada vendedor desde el detalle del pedido.
                    </p>
                  )}

                  {isQuoteMode && (
                    <p className="checkout-block-note checkout-quote-terms">
                      <FileText size={14} /> La entrega ya está acordada en la cotización:
                      {' '}<strong>{quoteLine.shippingMethod || 'a coordinar con la tienda'}</strong>.
                    </p>
                  )}
                </section>
                )}
              </div>
            )}

            {step === 'pago' && (
              <div className="checkout-main-flow">
                {/* Resumen de solo lectura: la navegacion real ya la da el breadcrumb de
                    arriba (Carrito > Entrega > Pago y facturacion). Botones "Cambiar" que
                    repetian esa misma vuelta atras, uno por fila, no aportaban nada aparte
                    de confundir. "Enviar a" y "Metodo" tambien se fusionaron en una sola
                    fila: para retiro en tienda mostraban el mismo dato dos veces. */}
                <div className="shopify-recap-box" aria-label="Resumen de datos de entrega">
                  <div className="shopify-recap-row">
                    <span className="shopify-recap-label">Contacto</span>
                    <span className="shopify-recap-value">{user?.email || user?.nombreCompleto || 'Usuario RepuesTop'}</span>
                  </div>

                  <div className="shopify-recap-divider" />

                  <div className="shopify-recap-row">
                    <span className="shopify-recap-label">Entrega</span>
                    <span className="shopify-recap-value">
                      {!isQuoteMode
                        ? 'Por producto (detalle abajo)'
                        : needsAddress
                        ? (() => {
                          const address = addresses.find((item) => String(item.id) === String(selectedAddressId));
                          const direccion = address ? `${address.calleYNumero}, ${address.comunaNombre}${address.regionNombre ? `, ${address.regionNombre}` : ''}` : 'Dirección seleccionada';
                          return `${direccion} · ${shippingLabel}`;
                        })()
                        : 'Retiro en tienda'}
                    </span>
                  </div>
                </div>

                {isQuoteMode && (
                <section
                  ref={vehicleSectionRef}
                  className="checkout-block checkout-vehicle-block"
                  aria-labelledby="checkout-vehiculo-title"
                >
                  {vehicleAttention > 0 && <span key={vehicleAttention} className="checkout-vehicle-pulse" aria-hidden="true" />}
                  <div className="shopify-section-header">
                    <h2 id="checkout-vehiculo-title">
                      <span className="checkout-vehicle-icon"><Car size={16} /></span>
                      ¿Para qué vehículo es?
                      <span className={`checkout-vehicle-badge ${vehicleRequired ? 'is-required' : ''}`}>
                        {vehicleRequired ? 'Obligatorio' : 'Importante'}
                      </span>
                    </h2>
                    <p className="shopify-section-subtitle">
                      {vehicleRequired
                        ? 'El vendedor revisa que el repuesto calce con tu vehículo antes de enviarlo. Escribe tu patente y completamos el resto por ti.'
                        : 'Escribe tu patente y completamos los datos por ti: el vendedor confirma que la pieza calza con tu auto antes de enviarla y evitas devoluciones.'}
                    </p>
                    <small className="checkout-vehicle-privacy" style={{ display: 'block', color: '#64748b', marginTop: 4 }}>Compartimos con la tienda solo el chasis y el modelo de tu vehículo (la patente, parcial) para validar la compatibilidad.</small>
                  </div>

                  {hasActiveVehicle && (
                    <label className="checkout-vehicle-active">
                      <input
                        type="checkbox"
                        checked={useActiveVehicle}
                        onChange={(event) => setUseActiveVehicle(event.target.checked)}
                      />
                      <span>
                        <strong>
                          {[activeVehicle.marca, activeVehicle.modelo, activeVehicle.anio].filter(Boolean).join(' ')}
                        </strong>
                        {activeVehicle.patente && <small>Patente {activeVehicle.patente}</small>}
                      </span>
                    </label>
                  )}

                  {showVehicleForm && (
                    <div className="cart-invoice-fields">
                      <label>
                        <span>Patente</span>
                        <input
                          ref={plateInputRef}
                          className="checkout-plate-input"
                          autoComplete="off"
                          value={vehicleForm.patente}
                          onChange={(event) => setVehicleForm((current) => ({ ...current, patente: event.target.value.toUpperCase() }))}
                          onBlur={(event) => identifyPlate(event.target.value)}
                          placeholder="ABCD12"
                          maxLength={12}
                        />
                        {lookupForCurrentPlate?.status === 'loading' && (
                          <small className="checkout-plate-status"><Loader2 size={12} className="spin-icon" /> Identificando patente…</small>
                        )}
                        {lookupForCurrentPlate?.status === 'found' && (
                          <small className="checkout-plate-status is-found"><CheckCircle2 size={12} /> Identificado: <strong>{formatVehicleLabel(lookupForCurrentPlate.vehicle)}</strong></small>
                        )}
                        {(lookupForCurrentPlate?.status === 'notfound' || lookupForCurrentPlate?.status === 'error') && (
                          <small className="checkout-plate-status is-missing">No pudimos identificarla: completa marca, modelo y año.</small>
                        )}
                      </label>
                      <label>
                        <span>Marca</span>
                        <input
                          value={vehicleForm.marca}
                          onChange={(event) => setVehicleForm((current) => ({ ...current, marca: event.target.value }))}
                          placeholder="Toyota"
                          maxLength={80}
                        />
                      </label>
                      <label>
                        <span>Modelo</span>
                        <input
                          value={vehicleForm.modelo}
                          onChange={(event) => setVehicleForm((current) => ({ ...current, modelo: event.target.value }))}
                          placeholder="Yaris"
                          maxLength={120}
                        />
                      </label>
                      <label>
                        <span>Año</span>
                        <input
                          value={vehicleForm.anio}
                          onChange={(event) => setVehicleForm((current) => ({ ...current, anio: event.target.value.replace(/\D/g, '').slice(0, 4) }))}
                          placeholder="2018"
                          inputMode="numeric"
                          maxLength={4}
                        />
                      </label>
                    </div>
                  )}

                  {vehicleSkipPending && vehicleSkipWarned && (
                    <p className="checkout-vehicle-skip-note" role="status">
                      <AlertTriangle size={14} />
                      <span>
                        Sin tu vehículo el vendedor no puede confirmar que el repuesto calce antes de enviarlo.
                        Si no tienes la patente a mano, vuelve a pulsar <strong>Pagar</strong> para continuar sin ella.
                      </span>
                    </p>
                  )}
                </section>
                )}

                {/* Métodos de Pago con selector de Simulación */}
                <section className="checkout-block" aria-labelledby="checkout-pago-title">
                  <div className="shopify-section-header">
                    <h2 id="checkout-pago-title"><CreditCard size={16} /> Método de pago</h2>
                    <p className="shopify-section-subtitle">
                      <Lock size={13} /> Todas las transacciones son seguras y están encriptadas.
                    </p>
                  </div>

                  <div className="checkout-payment-options-grid" role="radiogroup" aria-label="Métodos de pago">
                    {SIMULATED_PAYMENT_ENABLED && (
                      <label className={`checkout-payment-card-option ${paymentMethod === 'SIMULACION' ? 'is-selected' : ''}`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="SIMULACION"
                          checked={paymentMethod === 'SIMULACION'}
                          onChange={() => setPaymentMethod('SIMULACION')}
                        />
                        <div className="checkout-payment-card-body">
                          <div className="checkout-payment-card-header">
                            <strong>Simulación de Pago</strong>
                            <span className="checkout-badge-test"><Sparkles size={12} /> Modo Pruebas</span>
                          </div>
                          <p>Simula la confirmación y aprobación instantánea del pago sin cobro real, ideal para pruebas completas.</p>
                        </div>
                      </label>
                    )}

                    <label className={`checkout-payment-card-option ${paymentMethod === 'FLOW' ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="FLOW"
                        checked={paymentMethod === 'FLOW'}
                        onChange={() => setPaymentMethod('FLOW')}
                      />
                      <div className="checkout-payment-card-body">
                        <div className="checkout-payment-card-header">
                          <strong>Pasarela Flow</strong>
                          <span className="checkout-badge-flow">Webpay / Tarjetas</span>
                        </div>
                        <p>Redirige a Flow para pago con tarjetas bancarias (crédito, débito o sandbox).</p>
                      </div>
                    </label>
                  </div>

                  {SIMULATED_PAYMENT_ENABLED && paymentMethod === 'SIMULACION' && (
                    <div className="checkout-simulation-alert">
                      <Sparkles size={16} />
                      <span>
                        <strong>Modo simulación activo:</strong> Al pagar, el pedido se confirmará y pasará al estado <strong>PAGADO</strong> automáticamente para verificar el flujo de compra y preparación.
                      </span>
                    </div>
                  )}
                </section>

                {/* Datos de Facturación (Boleta o Factura) */}
                <section className="checkout-block" aria-labelledby="checkout-billing-title">
                  <div className="shopify-section-header">
                    <h2 id="checkout-billing-title"><ReceiptText size={16} /> Datos de facturación</h2>
                    <p className="shopify-section-subtitle">
                      Selecciona el documento tributario que emitirá el vendedor para tu compra.
                    </p>
                  </div>

                  <div className="cart-document-options">
                    <label className={documentType === 'BOLETA' ? 'selected' : ''}>
                      <input
                        type="radio"
                        name="checkout-document"
                        value="BOLETA"
                        checked={documentType === 'BOLETA'}
                        onChange={(event) => setDocumentType(event.target.value)}
                      />
                      <ReceiptText size={20} />
                      <span>
                        <strong>Boleta electrónica</strong>
                        <small>Compra personal / Consumidor final</small>
                      </span>
                    </label>
                    <label className={documentType === 'FACTURA' ? 'selected' : ''}>
                      <input
                        type="radio"
                        name="checkout-document"
                        value="FACTURA"
                        checked={documentType === 'FACTURA'}
                        onChange={(event) => setDocumentType(event.target.value)}
                      />
                      <Building2 size={20} />
                      <span>
                        <strong>Factura electrónica</strong>
                        <small>Requiere datos tributarios de empresa</small>
                      </span>
                    </label>
                  </div>

                  {documentType === 'FACTURA' && (
                    <div className="cart-invoice-fields">
                      <label>
                        <span>RUT empresa *</span>
                        <input
                          value={invoice.rut}
                          onChange={(event) => setInvoice((current) => ({ ...current, rut: formatRut(event.target.value) }))}
                          placeholder="76.123.456-7"
                          inputMode="text"
                          maxLength={12}
                        />
                        {invoice.rut && !rutValid && <small className="checkout-field-error">El RUT no es válido.</small>}
                      </label>
                      <label>
                        <span>Razón social</span>
                        <input
                          value={invoice.razonSocial}
                          onChange={(event) => setInvoice((current) => ({ ...current, razonSocial: event.target.value }))}
                          placeholder="Nombre de la empresa"
                          maxLength={180}
                        />
                      </label>
                      <label>
                        <span>Giro</span>
                        <input
                          value={invoice.giro}
                          onChange={(event) => setInvoice((current) => ({ ...current, giro: event.target.value }))}
                          placeholder="Actividad comercial"
                          maxLength={150}
                        />
                      </label>
                    </div>
                  )}
                </section>

                {/* Revisión de Productos por Tienda */}
                <section className="checkout-block" aria-labelledby="checkout-review-title">
                  <h2 id="checkout-review-title" className="checkout-subheading-sm">
                    Revisión de productos
                  </h2>

                  <div className="checkout-recap-lines">
                    {groups.map((group) => (
                      <div key={group.key} className="checkout-recap-store">
                        <h3><Store size={14} /> {group.items[0]?.storeName || group.vendedor || 'Tienda RepuesTop'}</h3>
                        {group.items.map((item) => {
                          const delivery = deliveries[item.id];
                          const address = addresses.find((entry) => String(entry.id) === String(delivery?.addressId));
                          const vehicle = cartVehicles.find((entry) => entry.key === delivery?.vehicleKey);
                          return (
                            <div key={item.id} className="checkout-recap-item">
                              <p>
                                <span>{item.quantity} × {item.titulo}</span>
                                <strong>{formatCLP(item.precio * item.quantity)}</strong>
                              </p>
                              {!isQuoteMode && delivery && (
                                <ul className="checkout-recap-delivery">
                                  <li>
                                    <Truck size={12} />
                                    {(delivery.method || '').replace(/\s*\(.*\)\s*$/, '')}
                                    {isDispatch(delivery.method) && address ? ` · ${address.calleYNumero}, ${address.comunaNombre}` : ''}
                                  </li>
                                  {!item.esUniversal && vehicle && <li><Car size={12} /> {vehicleLabel(vehicle)}</li>}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  <p className="checkout-terms-note">
                    Al pagar aceptas los <Link to={ROUTES.terms} target="_blank" rel="noreferrer">Términos y Condiciones</Link> y
                    la <Link to={ROUTES.privacy} target="_blank" rel="noreferrer">Política de Privacidad</Link> de RepuesTop.
                  </p>
                </section>
              </div>
            )}

            {error && <p className="checkout-error"><AlertTriangle size={15} /> {error}</p>}
          </div>

          <CheckoutSummaryPanel
            itemCount={itemCount}
            subtotal={checkoutTotals.subtotal}
            costoEnvio={checkoutTotals.costoEnvio}
            total={checkoutTotals.total}
            shippingLabel={checkoutShippingLabel}
            ctaLabel={
              step === 'pago'
                ? (paymentProcessingStatus || (paymentMethod === 'SIMULACION' ? `Simular y pagar ${formatCLP(checkoutTotals.total)}` : `Pagar ${formatCLP(checkoutTotals.total)}`))
                : 'Continuar con el pago'
            }
            onCta={advance}
            ctaDisabled={!stepComplete[step] || placing}
            ctaLoading={placing}
            warning={stepComplete[step]
              ? (vehicleSkipPending && vehicleSkipWarned ? 'No indicaste tu vehículo. Si igual quieres pagar sin él, vuelve a pulsar Pagar.' : '')
              : missingForStep}
          >
            {step === 'pago' && (
              <button
                type="button"
                className="checkout-summary-back"
                onClick={() => goStep('entrega')}
              >
                <ArrowLeft size={15} /> Volver a entrega
              </button>
            )}
          </CheckoutSummaryPanel>
        </div>
      </div>

      {vehicleDialog && (
        <CheckoutVehicleDialog
          vehicle={vehicleDialog.vehicle}
          plateCache={deliveryPlateCache.current}
          onClose={() => setVehicleDialog(null)}
          onSave={saveCartVehicle}
        />
      )}

    </main>
  );
}
