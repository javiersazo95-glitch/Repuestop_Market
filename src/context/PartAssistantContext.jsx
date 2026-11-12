import React, { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useMarketplace } from './MarketplaceContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { deleteNotificationApi, getAddressesApi, getNotificationsApi, searchVehicleByPatenteApi } from '../services/api';
import { adaptVehicle } from '../services/adapters';
import { onAuctionCreated } from '../services/assistantApi';
import { notificationTargetPath } from '../data/notificationTargets';
import { auctionDetailPath, buyerProfilePath, catalogPath, profilePath, storePath } from '../routes/paths';
import {
  ASSISTANT_NEWS_TYPES, EMPTY_ASSISTANT_CONTEXT, orderPrefill, stripAssistantParams, toAssistantContext, toAssistantNewsItem,
} from '../utils/partAssistant';
import AssistantBubble, { MAX_BADGE } from '../components/assistant/AssistantBubble';
import '../styles/assistant.css';

// El chat y las novedades se descargan recién al abrirse la primera vez: no pesan en la carga del Market.
const PartAssistantSheet = lazy(() => import('../components/assistant/PartAssistantSheet'));
const AssistantNewsSheet = lazy(() => import('../components/assistant/AssistantNewsSheet'));
const CreateAuctionModal = lazy(() => import('../components/CreateAuctionModal'));

const STORAGE_KEY = 'repuestopPartAssistant';
/** Una búsqueda sin resolver deja de insistir después de un día. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
/** Cada cuánto suma un aviso mientras la burbuja está cerrada. */
const BUBBLE_NUDGE_MS = 45_000;
/** Navegar a otra vista también suma un aviso, si pasó este rato desde el último. */
const NAVIGATION_NUDGE_MIN_GAP_MS = 20_000;
/** Cada cuánto se revisan las novedades mientras la página está a la vista. */
const NEWS_POLL_MS = 15_000;
/** Pantallas donde la burbuja estorba: registro de tienda o taller. */
const HIDDEN_PATHS = ['/vender', '/taller/registro'];

const noop = { open: () => undefined, markResolved: () => undefined, hasPending: false, canAsk: false };
const PartAssistantContext = createContext(noop);

/** Fuera del proveedor no hace nada, en vez de fallar. */
export function usePartAssistant() {
  return useContext(PartAssistantContext);
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const position = data?.position && Number.isFinite(data.position.x) ? data.position : null;
    const pending = data?.pending && Date.now() - Number(data.pending.savedAt) <= PENDING_TTL_MS
      ? { context: toAssistantContext(data.pending.context), savedAt: Number(data.pending.savedAt) }
      : null;
    return { pending, position, count: Number(data?.count) || 0, userKey: data?.userKey ?? '' };
  } catch {
    return null;
  }
}

/**
 * Dueño del chat de Repuestín y de su burbuja (`mobile/context/part-assistant-context.tsx`). Vive sobre las rutas para
 * que la burbuja siga a la persona por todo el Market, perfil incluido: queda al cerrar el chat y solo desaparece cuando
 * deja un mensaje a las casas de repuestos o crea un encargo. Mientras tanto suma avisos, como una campana. Además cuenta
 * las novedades de las preguntas de disponibilidad a compradores, tiendas y talleres.
 */
export function PartAssistantProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user, isLoggedIn } = useAuth();
  const { openAuthModal, activeVehicle, setActiveVehicle } = useMarketplace();
  const userId = user?.userId ?? user?.id ?? null;
  const isSeller = String(user?.role || '').toUpperCase() === 'SELLER';
  // La cuenta vendedora solo vende (como en el inicio del Market): recibe las novedades de Repuestín, pero no busca ni encarga.
  const canAsk = !isSeller;
  // La burbuja es de una sesión: al cerrar sesión (o entrar otra cuenta) desaparece.
  const userKey = isLoggedIn ? String(userId ?? 'user') : '';

  const stored = useRef(undefined);
  if (stored.current === undefined) {
    const value = readStored();
    stored.current = value && (!value.userKey || value.userKey === userKey) ? value : null;
  }

  const [sheetOpen, setSheetOpen] = useState(false);
  // Una vez abierto, el chat queda montado: cerrarlo con la X y volver desde la burbuja retoma la conversación.
  const [sheetMounted, setSheetMounted] = useState(false);
  useEffect(() => { if (sheetOpen) setSheetMounted(true); }, [sheetOpen]);
  const [initial, setInitial] = useState({});
  const [returning, setReturning] = useState(false);
  const [pending, setPending] = useState(() => stored.current?.pending ?? null);
  const [count, setCount] = useState(() => stored.current?.count ?? 0);
  const [position, setPosition] = useState(() => stored.current?.position ?? null);
  const [news, setNews] = useState([]);
  const [newsOpen, setNewsOpen] = useState(false);
  const [orderForm, setOrderForm] = useState(null);
  const [comuna, setComuna] = useState('');
  const lastBump = useRef(Date.now());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ pending, position, count, userKey })); } catch { /* sin almacenamiento */ }
  }, [pending, position, count, userKey]);

  // Cerrar sesión (o cambiar de cuenta) borra la burbuja y el chat.
  const previousUserKey = useRef(userKey);
  useEffect(() => {
    const previous = previousUserKey.current;
    previousUserKey.current = userKey;
    if (previous && previous !== userKey) {
      setSheetOpen(false);
      setReturning(false);
      setPending(null);
      setCount(0);
      setPosition(null);
      setOrderForm(null);
    }
  }, [userKey]);

  // La comuna de la dirección principal: Repuestín suma a las tiendas cercanas y a las que despachan hasta ahí.
  useEffect(() => {
    if (!userId) { setComuna(''); return undefined; }
    let active = true;
    getAddressesApi(userId)
      .then((list) => {
        if (!active) return;
        const book = Array.isArray(list) ? list : [];
        setComuna((book.find((address) => address.esPrincipal) || book[0])?.comunaNombre || '');
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [userId]);

  // Novedades del flujo: al entrar, cada rato con la página a la vista y al volver a ella.
  useEffect(() => {
    if (!userKey || !userId) {
      setNews([]);
      setNewsOpen(false);
      return undefined;
    }
    let active = true;
    const refresh = () => {
      getNotificationsApi(userId, { soloNoLeidas: true })
        .then((items) => {
          if (!active) return;
          const list = Array.isArray(items) ? items : [];
          setNews(list.filter((item) => !item.leida && ASSISTANT_NEWS_TYPES.has(String(item.tipo).toUpperCase())));
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, NEWS_POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userKey, userId]);

  const open = useCallback((next) => {
    if (!canAsk) return;
    const context = toAssistantContext({ ...EMPTY_ASSISTANT_CONTEXT, ...next });
    setInitial(context);
    setReturning(false);
    // Una búsqueda nueva reemplaza a la anterior sin resolver.
    setPending({ context, savedAt: Date.now() });
    setCount(0);
    setNewsOpen(false);
    setSheetOpen(true);
  }, [canAsk]);

  // Una búsqueda hecha antes de iniciar sesión no se hereda a una cuenta que no busca (la tienda).
  useEffect(() => { if (!canAsk) setPending(null); }, [canAsk]);

  const markResolved = useCallback(() => {
    setPending(null);
    setCount(0);
  }, []);

  // Un encargo creado por cualquier vía (aunque no se haya abierto la burbuja) resuelve la búsqueda.
  useEffect(() => onAuctionCreated(markResolved), [markResolved]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // La burbuja salta siempre, salvo por los avisos del chat que la persona tiene abierto en este momento.
  const openChatId = location.pathname.startsWith('/perfil') ? new URLSearchParams(location.search).get('cotizacion') : null;
  const visibleNews = useMemo(
    () => (openChatId ? news.filter((item) => String(item.targetParams?.quoteId ?? '') !== String(openChatId)) : news),
    [news, openChatId],
  );

  const reopenFromBubble = useCallback(() => {
    if (visibleNews.length > 0) {
      setNewsOpen(true);
      return;
    }
    if (!pending) return;
    setInitial(pending.context);
    setReturning(true);
    setCount(0);
    setSheetOpen(true);
  }, [pending, visibleNews.length]);

  const onContextChange = useCallback((context) => {
    setPending((current) => (current ? { context, savedAt: current.savedAt } : current));
  }, []);

  const hiddenHere = HIDDEN_PATHS.some((path) => location.pathname.startsWith(path));
  const hasNews = visibleNews.length > 0;
  const bubbleVisible = (Boolean(pending) || hasNews) && !sheetOpen && !newsOpen && !orderForm && !hiddenHere;

  const bump = useCallback(() => {
    lastBump.current = Date.now();
    setCount((current) => Math.min(current + 1, MAX_BADGE + 1));
  }, []);

  useEffect(() => {
    if (!bubbleVisible) return undefined;
    lastBump.current = Date.now();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') bump(); }, BUBBLE_NUDGE_MS);
    return () => window.clearInterval(timer);
  }, [bubbleVisible, bump]);

  // Navegar por otras vistas sin haber resuelto nada también suma un aviso.
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    if (bubbleVisible && Date.now() - lastBump.current > NAVIGATION_NUDGE_MIN_GAP_MS) bump();
  }, [location.pathname, bubbleVisible, bump]);

  /** "Ver los repuestos": el catálogo con lo que se buscó y el mismo vehículo. */
  const showProducts = useCallback(async (context) => {
    setPending(null);
    setCount(0);
    const filter = context.subcategoriaId
      ? { categoryId: context.categoriaId || undefined, subcategoryId: context.subcategoriaId, subcategory: context.repuesto }
      : null;
    const extra = context.subcategoriaId ? {} : { q: context.repuesto };
    if (context.patente) {
      // La patente manda en el catálogo por el vehículo activo (mismo cruce de compatibilidad).
      if (activeVehicle?.patente !== context.patente) {
        try {
          const vehicle = adaptVehicle(await searchVehicleByPatenteApi(context.patente));
          if (vehicle?.marca) setActiveVehicle(vehicle);
        } catch { /* sin vehículo, el catálogo filtra por marca y modelo */ }
      }
      navigate(catalogPath(filter, extra));
      return;
    }
    navigate(catalogPath(filter, {
      ...extra,
      vehicleBrandName: context.marca || undefined,
      vehicleModel: context.modelo || undefined,
      vehicleYear: context.anio || undefined,
    }));
  }, [navigate, activeVehicle?.patente, setActiveVehicle]);

  const forgetNews = useCallback((items) => {
    if (items.length === 0) return;
    setNews((current) => current.filter((entry) => !items.some((other) => other.id === entry.id)));
    if (userId) items.forEach((entry) => { deleteNotificationApi(userId, entry.id).catch(() => undefined); });
  }, [userId]);

  const openOrderForm = useCallback((context, draft) => {
    if (!isLoggedIn) { openAuthModal(); return; }
    setOrderForm(orderPrefill(toAssistantContext(context), draft));
  }, [isLoggedIn, openAuthModal]);

  /** Acción de una novedad: ir al chat, encargar el repuesto o ir a Ventas. Los avisos de ese chat se dan por vistos. */
  const handleNewsAction = useCallback((id, action) => {
    const item = news.find((entry) => entry.id === id);
    if (!item) return;
    setNewsOpen(false);
    const quoteId = item.targetParams?.quoteId;
    forgetNews(quoteId ? news.filter((entry) => entry.targetParams?.quoteId === quoteId) : [item]);
    if (action === 'order') {
      openOrderForm(pending ? pending.context : EMPTY_ASSISTANT_CONTEXT, null);
      return;
    }
    if (action === 'sales') {
      navigate(profilePath('pedidos'));
      return;
    }
    const path = notificationTargetPath({ ...item, targetParams: stripAssistantParams(item.targetParams) }, { isSeller });
    if (path) navigate(path);
  }, [forgetNews, news, pending, navigate, isSeller, openOrderForm]);

  // Soltar la burbuja sobre la "X": se da por cerrada la búsqueda y por vistos sus avisos.
  const dismissBubble = useCallback(() => {
    markResolved();
    forgetNews(visibleNews);
    setPosition(null);
  }, [markResolved, forgetNews, visibleNews]);

  const dismissAllNews = useCallback(() => {
    setNewsOpen(false);
    forgetNews(visibleNews);
  }, [forgetNews, visibleNews]);

  const continueSearchFromNews = useCallback(() => {
    setNewsOpen(false);
    if (!pending) return;
    setInitial(pending.context);
    setReturning(true);
    setSheetOpen(true);
  }, [pending]);

  const newsItems = useMemo(() => visibleNews.map(toAssistantNewsItem), [visibleNews]);
  const value = useMemo(() => ({ open, markResolved, hasPending: Boolean(pending), canAsk }), [open, markResolved, pending, canAsk]);

  return (
    <PartAssistantContext.Provider value={value}>
      {children}
      {(sheetMounted || sheetOpen) && (
      <Suspense fallback={null}>
      <PartAssistantSheet
        open={sheetOpen}
        onClose={closeSheet}
        initial={initial}
        returning={returning}
        isLoggedIn={isLoggedIn}
        user={user}
        comuna={comuna}
        isMobile={isMobile}
        onContextChange={onContextChange}
        onResolved={markResolved}
        onShowProducts={showProducts}
        onRequireLogin={() => openAuthModal()}
        onOpenOrderForm={openOrderForm}
        onNavigate={navigate}
        storeLink={storePath}
        buyerMessagesLink={buyerProfilePath(user, 'quotes')}
        orderLink={auctionDetailPath}
      />
      </Suspense>
      )}
      {bubbleVisible && (
        <AssistantBubble
          count={hasNews ? visibleNews.length : count}
          hasNews={hasNews}
          position={position}
          isMobile={isMobile}
          onPress={reopenFromBubble}
          onMove={setPosition}
          onDismiss={dismissBubble}
        />
      )}
      {newsOpen && hasNews && (
      <Suspense fallback={null}>
      <AssistantNewsSheet
        open
        items={newsItems}
        isMobile={isMobile}
        onClose={() => setNewsOpen(false)}
        onAction={handleNewsAction}
        onDismissAll={dismissAllNews}
        onContinueSearch={pending ? continueSearchFromNews : undefined}
      />
      </Suspense>
      )}
      {orderForm && (
        <Suspense fallback={null}>
          <CreateAuctionModal
            isOpen
            prefill={orderForm}
            onClose={() => setOrderForm(null)}
            onSuccess={(created) => {
              setOrderForm(null);
              markResolved();
              if (created?.id) navigate(auctionDetailPath(created.id));
            }}
          />
        </Suspense>
      )}
    </PartAssistantContext.Provider>
  );
}
