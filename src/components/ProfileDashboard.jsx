import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, LayoutGrid, Package, Heart, UserCog, Store, ShoppingBag,
  MessageSquare, LogOut, Star, TrendingUp, Truck, Check, Save, X,
  Clock, ShieldCheck, PackageCheck, Loader2, Inbox, Search,
  ArrowUpRight, Sparkles, Camera, Upload, Image as ImageIcon,
  Trash2, AlertTriangle, ReceiptText, Plus, MessageCircleQuestion, Headphones, Wallet, Crown,
  Megaphone, CheckCircle2, ShoppingCart, Scale
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import RepuesTopLogo from './RepuesTopLogo';
import BlockedAccountReviewModal from './BlockedAccountReviewModal';
import AccountClosureModal from './AccountClosureModal';
import ProfileAccountDataPanel from './ProfileAccountDataPanel';
import ProfileSummaryPanel from './ProfileSummaryPanel';
import ProfileFeedbackPanel from './ProfileFeedbackPanel';
import ProfileOrdersPanel from './ProfileOrdersPanel';
import ProfileQuotesPanel from './ProfileQuotesPanel';
import ProfileCatalogPanel from './ProfileCatalogPanel';
import ProfileMyQuestionsPanel from './ProfileMyQuestionsPanel';
import ProfileStoreSummaryPanel from './ProfileStoreSummaryPanel';
import {
  getBuyerOrdersApi, getSellerOrdersApi, getFavoritesApi,
  confirmOrderPaymentApi,
  getSellerInventoryApi, getSellerInventorySummaryApi, getSellerConversationsApi, getBuyerConversationsApi, getSellerStoreApi, getSellerProductQuestionsApi,
  uploadProfileImageApi, resolveMediaUrl,
  getStoreCoverTemplatesApi, selectStoreCoverTemplateApi,
  saveConversationQuoteApi, sendConversationMessageApi,
  pauseSellerProductApi, resumeSellerProductApi,
  getSellerVerificationStatusApi, submitSellerVerificationApi, appealSellerVerificationApi, acceptSellerAdhesionApi
} from '../services/api';
import { qk } from '../services/queryKeys';
import { useSellerBlocked } from '../hooks/useSellerBlocked';
import { useBuyerBlocked } from '../hooks/useBuyerBlocked';
import ProductTopManagementModal from './ProductTopManagementModal';
import QuoteDetailModal from './QuoteDetailModal';
import ProfileSupportPanel from './ProfileSupportPanel';
import SellerChatsView from './SellerChatsView';
import ProfileNotificationsBell from './ProfileNotificationsBell';
import HeaderWalletButton from './HeaderWalletButton';
import NewCatalogProductModal from './NewCatalogProductModal';
import SellerProductQuestionsPanel from './SellerProductQuestionsPanel';
import SellerWithdrawalsPanel from './SellerWithdrawalsPanel';
import AdsManagementSection from './ads/AdsManagementSection';
import ProfileFavoritesPanel from './ProfileFavoritesPanel';
import { useSavedMarketplaceItems } from '../hooks/useSavedMarketplaceItems';
import { useNavigate } from 'react-router-dom';
import { ROUTES, storePath } from '../routes/paths';

export const CATALOG_PAGE_SIZE_OPTIONS = [12, 24, 48];

// `EstadoTienda` del backend. Es el estado de la TIENDA, distinto del de la revision
// documental (`EstadoRevisionVerificacion`), que vive en SellerVerificationCard.
const STORE_STATUS_CHIP = {
  APPROVED: { label: 'Tienda verificada', className: 'chip-approved' },
  PENDING_VERIFICATION: { label: 'Tienda en revisión', className: 'chip-pending' },
  REJECTED: { label: 'Verificación rechazada', className: 'chip-rejected' },
  SUSPENDED: { label: 'Tienda suspendida', className: 'chip-rejected' },
};
const BUYER_PROFILE_COVER_URL = import.meta.env.VITE_BUYER_PROFILE_COVER_URL
  || 'https://pub-650d4cc5c6be42bc9a81e878e6042ea6.r2.dev/Plantillas/Portadas_Perfil/comprador-default.png';

// Los 3 métodos de envío que reconoce el sistema (ver src/data/shippingMethods.js).
// Antes el formulario era un input de texto libre separado por comas ("Starken,
// Chilexpress, Retiro en Tienda") que no coincidía con este modelo y no validaba
// nada; ahora se editan como checkboxes + precio opcional y se serializan al
// mismo formato de string que ya consume el resto de la app.

// Navegación del panel: cada rol ve solo los accesos que le corresponden.
// Los grupos se recorren tal cual para pintar el sidebar, así que un `id` no
// puede repetirse entre grupos (dos ítems quedarían activos a la vez).
const SELLER_SIDEBAR_GROUPS = [
  {
    title: null,
    items: [
      { id: 'resumen', label: 'Resumen', icon: LayoutGrid }
    ]
  },
  {
    title: 'VENTAS',
    items: [
      { id: 'pedidos', label: 'Pedidos recibidos', icon: ShoppingBag },
      { id: 'productos', label: 'Productos', icon: Package },
      { id: 'cotizaciones', label: 'Cotizaciones', icon: ReceiptText },
      { id: 'preguntas_productos', label: 'Preguntas de productos', icon: MessageCircleQuestion },
      { id: 'chats_compradores', label: 'Chats con compradores', icon: MessageSquare }
    ]
  },
  {
    // Un vendedor tambien es comprador: aca tiene el mismo grupo que ve un comprador en su
    // perfil. El backend solo le impide comprarse a si mismo; todo lo demas (comprar a otras
    // tiendas, pedir cotizaciones, preguntar en productos ajenos, guardar favoritos) es igual.
    title: 'MIS COMPRAS',
    items: [
      { id: 'compras', label: 'Mis compras', icon: ShoppingCart },
      { id: 'mis_cotizaciones', label: 'Mis cotizaciones', icon: ReceiptText },
      { id: 'mis_preguntas', label: 'Mis preguntas', icon: MessageCircleQuestion },
      { id: 'chats_vendedor', label: 'Chats con vendedor', icon: MessageSquare },
      { id: 'favoritos', label: 'Favoritos', icon: Heart }
    ]
  },
  {
    title: 'MI TIENDA',
    items: [
      { id: 'tienda_datos', label: 'Mi tienda y datos', icon: Store },
      { id: 'retiros', label: 'Retirar dinero', icon: Wallet },
      { id: 'anuncios', label: 'Gestión de anuncios', icon: Megaphone }
    ]
  },
  {
    title: 'SOPORTE',
    items: [
      { id: 'consultas', label: 'Reportes/Soporte', icon: MessageSquare },
      { id: 'soporte', label: 'Centro de ayuda', icon: Headphones, href: ROUTES.support }
    ]
  }
];

// Con la tienda bloqueada el backend YA rechaza publicar productos
// (`InventarioAccessSupport`), escribir en el chat (`ConversacionService`) y despachar
// (`PedidoEnvioSupport`), asi que dejar estas pestanas a la vista solo produce errores.
// Anuncios y retiros se ocultan por decision de producto: el backend no los bloquea, o
// sea que siguen alcanzables desde la app o por API hasta que exista un guard alla.
//
// `pedidos` NO esta en la lista a proposito: queda visible en SOLO LECTURA. Un vendedor
// que no ve lo que dejo pendiente tampoco entiende que esta colgando.
const SELLER_BLOCKED_HIDDEN_TABS = [
  'productos',
  'cotizaciones',
  'preguntas_productos',
  'retiros',
  'anuncios',
];

// Contraparte para comprador bloqueado. A diferencia del vendedor (que conserva
// pestanas de solo lectura), aqui se ocultan TODAS las de operacion: el backend
// rechaza con 403 cualquier compra, cotizacion, pregunta o chat del lado comprador
// mientras la cuenta este suspendida. Solo quedan "Resumen" (donde vive el aviso y
// la solicitud de revision) y "Soporte", igual que el vendedor.
const BUYER_BLOCKED_HIDDEN_TABS = [
  'pedidos',
  'cotizaciones',
  'mis_preguntas',
  'chats_vendedor',
  'favoritos',
  'datos',
  'anuncios',
];

const BUYER_SIDEBAR_GROUPS = [
  {
    title: null,
    items: [
      { id: 'resumen', label: 'Resumen', icon: LayoutGrid }
    ]
  },
  {
    title: 'MIS COMPRAS',
    items: [
      { id: 'pedidos', label: 'Mis pedidos', icon: Package },
      { id: 'cotizaciones', label: 'Mis cotizaciones', icon: ReceiptText },
      { id: 'mis_preguntas', label: 'Mis preguntas', icon: MessageCircleQuestion },
      { id: 'chats_vendedor', label: 'Chats con vendedor', icon: MessageSquare },
      { id: 'favoritos', label: 'Favoritos', icon: Heart }
    ]
  },
  {
    title: 'MI CUENTA',
    items: [
      { id: 'datos', label: 'Mis datos y perfil', icon: UserCog },
      { id: 'anuncios', label: 'Gestión de anuncios', icon: Megaphone }
    ]
  },
  {
    title: 'SOPORTE',
    items: [
      { id: 'consultas', label: 'Reportes/Soporte', icon: MessageSquare },
      { id: 'soporte', label: 'Centro de ayuda', icon: Headphones, href: ROUTES.support }
    ]
  }
];

const ORDER_STATUS_LABELS = {
  PENDIENTE: 'Pendiente de pago',
  PAGADO: 'Pagado',
  EN_PREPARACION: 'En preparación',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  EN_MEDIACION: 'En mediación',
  FINALIZADO: 'Finalizado',
};

const ORDER_STATUS_STYLES = {
  PENDIENTE: 'status-pending',
  PAGADO: 'status-pending',
  EN_PREPARACION: 'status-pending',
  ENVIADO: 'status-shipping',
  ENTREGADO: 'status-done',
  FINALIZADO: 'status-done',
  CANCELADO: 'status-cancelled',
  EN_MEDIACION: 'status-cancelled',
};

function initialsFromName(name) {
  if (!name) return 'RT';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function formatCLP(value) {
  return Number(value || 0).toLocaleString('es-CL');
}

function orderTitle(order) {
  const items = order.items || [];
  if (items.length === 0) return `Pedido #${order.id}`;
  if (items.length === 1) return items[0].nombre || items[0].name;
  return `${items[0].nombre || items[0].name} y ${items.length - 1} más`;
}

function OrderStatusIcon({ estado }) {
  const statusClass = ORDER_STATUS_STYLES[estado] || 'status-pending';
  const Icon = estado === 'ENTREGADO' || estado === 'FINALIZADO' ? PackageCheck : estado === 'ENVIADO' ? Truck : Clock;
  return (
    <div className={`order-icon-badge ${statusClass}`}>
      <Icon size={17} />
    </div>
  );
}

export function LoadingRow() {
  return (
    <div className="profile-loading-state">
      <Loader2 size={18} className="spin-icon" />
      <span>Cargando datos desde el servidor...</span>
    </div>
  );
}

export function EmptyState({ label }) {
  return (
    <div className="profile-empty-state">
      <Inbox size={22} />
      <span>{label}</span>
    </div>
  );
}

export default function ProfileDashboard({ onBackToStore, initialTab = 'resumen', onTabChange, paymentStatus, paymentOrderId, deepLinkOrderId, deepLinkTicketId, deepLinkQuoteId, onClearDeepLink, detailOrderId, detailPurchaseId }) {
  const { user, role, logout, refreshProfile } = useAuth();
  // El centro de ayuda dejó de ser una pestaña del perfil: vive en /ayuda y se
  // navega hacia allá desde el sidebar y los accesos rápidos.
  const navigate = useNavigate();
  const [activeTab, setActiveTabState] = useState(initialTab);

  useEffect(() => {
    setActiveTabState(initialTab);
  }, [initialTab]);

  // Cada pestaña es una URL propia (`/perfil/pedidos`), así el panel se puede
  // compartir, refrescar y recorrer con los botones atrás/adelante del navegador.
  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    onTabChange?.(tab);
  }, [onTabChange]);
  const [showMediaModal, setShowMediaModal] = useState(null);
  const [mediaInput, setMediaInput] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  // `alert()` no abre nada en un navegador embebido: el archivo invalido se rechazaba
  // en silencio y parecia que el boton no hacia nada. El aviso va dentro del modal.
  const [mediaError, setMediaError] = useState('');
  const [isSavingMedia, setIsSavingMedia] = useState(false);
  const [showCoverTemplatesModal, setShowCoverTemplatesModal] = useState(false);
  const [coverTemplates, setCoverTemplates] = useState([]);
  const [selectedCoverTemplateId, setSelectedCoverTemplateId] = useState(null);
  const [isLoadingCoverTemplates, setIsLoadingCoverTemplates] = useState(false);
  const [isSavingCoverTemplate, setIsSavingCoverTemplate] = useState(false);
  const [coverTemplateError, setCoverTemplateError] = useState('');
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);

  const [showBlockedReviewModal, setShowBlockedReviewModal] = useState(false);

  const inventoryPanelUrl = __DEPLOY_BRANCH__ === 'main'
    ? 'https://inventario.repuestop.cl'
    : 'https://dev-inventario.repuestop.cl';

  const handleOpenMediaModal = (type) => {
    setShowMediaModal(type);
    setMediaFile(null);
    setMediaInput(resolveMediaUrl(user?.userProfileUrl || storeInfo?.logoUrl || ''));
  };

  const handleOpenCoverTemplates = async () => {
    setShowCoverTemplatesModal(true);
    setCoverTemplateError('');
    setIsLoadingCoverTemplates(true);
    try {
      const templates = await getStoreCoverTemplatesApi();
      const normalizedTemplates = (Array.isArray(templates) ? templates : []).map((template) => ({
        ...template,
        url: resolveMediaUrl(template.url),
      }));
      const currentCover = resolveMediaUrl(user?.coverUrl || storeInfo?.coverUrl || '');
      const currentTemplate = normalizedTemplates.find((template) => template.url === currentCover);
      setCoverTemplates(normalizedTemplates);
      setSelectedCoverTemplateId(currentTemplate?.id || null);
    } catch (error) {
      setCoverTemplateError(error?.message || 'No se pudieron cargar las plantillas de portada.');
    } finally {
      setIsLoadingCoverTemplates(false);
    }
  };

  const handleSaveCoverTemplate = async () => {
    if (!selectedCoverTemplateId) return;
    setIsSavingCoverTemplate(true);
    setCoverTemplateError('');
    try {
      const result = await selectStoreCoverTemplateApi(selectedCoverTemplateId);
      const coverUrl = resolveMediaUrl(result.coverUrl);
      // storeInfo viene de React Query: se invalida la caché en vez de mutar
      // un estado local que ya no existe.
      queryClient.invalidateQueries({ queryKey: qk.sellerStore(effectiveSellerId) });
      await refreshProfile({ coverUrl });
      setShowCoverTemplatesModal(false);
    } catch (error) {
      setCoverTemplateError(error?.message || 'No se pudo guardar la portada seleccionada.');
    } finally {
      setIsSavingCoverTemplate(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaError('');
    if (!file.type.startsWith('image/')) {
      setMediaError('Selecciona un archivo de imagen válido (PNG, JPG o WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMediaError('La imagen no puede superar los 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setMediaInput(event.target.result);
        setMediaFile(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMediaUrl = async (e) => {
    e.preventDefault();
    if (!mediaFile || isSavingMedia) return;

    setIsSavingMedia(true);
    setMediaError('');
    try {
      const uploaded = await uploadProfileImageApi(mediaFile);
      const uploadedUrl = resolveMediaUrl(uploaded.userProfileUrl);
      await refreshProfile({ userProfileUrl: uploadedUrl, logoUrl: uploadedUrl });
      if (isSeller && effectiveSellerId) {
        queryClient.invalidateQueries({ queryKey: qk.sellerStore(effectiveSellerId) });
      }
      closeMediaModal();
    } catch (error) {
      setMediaError(error?.message || 'No se pudo guardar la imagen.');
    } finally {
      setIsSavingMedia(false);
    }
  };

  const closeMediaModal = () => {
    setShowMediaModal(null);
    setMediaInput('');
    setMediaFile(null);
    setMediaError('');
  };

  const queryClient = useQueryClient();

  // Datos del perfil y rol
  const isSeller = role === 'SELLER';
  const baseSidebarGroups = isSeller ? SELLER_SIDEBAR_GROUPS : BUYER_SIDEBAR_GROUPS;
  const effectiveSellerId = user?.sellerId || user?.proveedorId || user?.tiendaId || user?.userId || user?.id;
  const effectiveUserId = user?.userId || user?.buyerId || user?.compradorId || user?.id;
  const effectiveBuyerId = user?.buyerId || user?.compradorId;
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState(null);
  const [selectedTopProduct, setSelectedTopProduct] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);

  // Catálogo: paginado en el servidor
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogPageSize, setCatalogPageSize] = useState(CATALOG_PAGE_SIZE_OPTIONS[0]);
  const [catalogSearchInput, setCatalogSearchInput] = useState('');
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [catalogTopFeedback, setCatalogTopFeedback] = useState('');
  // Errores de acciones sobre el catálogo (marcar Top). El error de carga del
  // listado lo aporta React Query en `catalogQuery.error`.
  const [catalogActionError, setCatalogActionError] = useState(null);
  const [updatingTopProductId, setUpdatingTopProductId] = useState(null);
  const [updatingPauseProductId, setUpdatingPauseProductId] = useState(null);
  const [questionsProductFilter, setQuestionsProductFilter] = useState(null);
  const [showNewProductModal, setShowNewProductModal] = useState(false);

  // Queries centralizadas con TanStack Query
  const ordersQuery = useQuery({
    queryKey: isSeller ? qk.sellerOrders(effectiveSellerId) : qk.buyerOrders(effectiveUserId),
    queryFn: async ({ signal }) => {
      const res = isSeller
        ? await getSellerOrdersApi(effectiveSellerId, { signal })
        : await getBuyerOrdersApi(effectiveUserId, { signal });
      return res?.content || (Array.isArray(res) ? res : []);
    },
    enabled: Boolean(isSeller ? effectiveSellerId : effectiveUserId),
    staleTime: 60 * 1000,
  });

  // "Mis compras" del vendedor: los pedidos donde ES el comprador. Misma clave y forma que
  // el listado del comprador -- para un no-vendedor este query queda deshabilitado porque
  // `ordersQuery` ya trae esos mismos datos con esa misma clave.
  const purchasesQuery = useQuery({
    queryKey: qk.buyerOrders(effectiveUserId),
    queryFn: async ({ signal }) => {
      const res = await getBuyerOrdersApi(effectiveUserId, { signal });
      return res?.content || (Array.isArray(res) ? res : []);
    },
    enabled: Boolean(isSeller && effectiveUserId),
    staleTime: 60 * 1000,
  });

  const favoritesQuery = useQuery({
    queryKey: qk.favorites(effectiveUserId),
    queryFn: async ({ signal }) => {
      const res = await getFavoritesApi(effectiveUserId, { signal });
      return Array.isArray(res) ? res : (res?.content || []);
    },
    // Tambien para el vendedor: los favoritos son parte de su experiencia de comprador.
    enabled: Boolean(effectiveUserId),
    staleTime: 60 * 1000,
  });

  const conversationsQuery = useQuery({
    queryKey: qk.conversations(isSeller ? effectiveSellerId : effectiveUserId, isSeller),
    queryFn: ({ signal }) => isSeller ? getSellerConversationsApi(effectiveSellerId, { signal }) : getBuyerConversationsApi(effectiveUserId, { signal }),
    enabled: Boolean(isSeller ? effectiveSellerId : effectiveUserId),
    staleTime: 60 * 1000,
  });

  // "Mis cotizaciones" del vendedor: las conversaciones de cotizacion donde el es el
  // COMPRADOR. Para un no-vendedor `conversationsQuery` ya trae estas mismas.
  const buyerConversationsQuery = useQuery({
    queryKey: qk.conversations(effectiveUserId, false),
    queryFn: ({ signal }) => getBuyerConversationsApi(effectiveUserId, { signal }),
    enabled: Boolean(isSeller && effectiveUserId),
    staleTime: 60 * 1000,
  });

  const storeInfoQuery = useQuery({
    queryKey: qk.sellerStore(effectiveSellerId),
    queryFn: ({ signal }) => getSellerStoreApi(effectiveSellerId, { signal }),
    enabled: Boolean(isSeller && effectiveSellerId),
    staleTime: 5 * 60 * 1000,
  });

  // El estado de bloqueo lo resuelve `useSellerBlocked`, que es la misma fuente que usan
  // el header, el carrito y el centro de ayuda. Tenerlo resuelto en cada vista era como
  // termino este bug la primera vez: cinco nombres de campo inventados, ninguno real.
  const { isBlocked: isSellerBlocked, blockReason: sellerBlockReason, blockReasonIsClaim } = useSellerBlocked();
  const { isBlocked: isBuyerBlocked, blockReason: buyerBlockReason } = useBuyerBlocked();
  // Un usuario esta bloqueado por un lado u otro, nunca ambos a la vez en la
  // practica (son dos suspensiones independientes en el backend).
  const blockReason = isSellerBlocked ? sellerBlockReason : buyerBlockReason;

  // Se ocultan las pestanas de operacion, no la navegacion entera: resumen y
  // Reportes/Soporte siguen accesibles (para el vendedor ademas pedidos en solo
  // lectura). Soporte es justamente donde vive la mediacion que suele originar el
  // bloqueo.
  const sidebarGroups = useMemo(() => {
    const hiddenTabs = isSellerBlocked
      ? SELLER_BLOCKED_HIDDEN_TABS
      : isBuyerBlocked
        ? BUYER_BLOCKED_HIDDEN_TABS
        : null;
    if (!hiddenTabs) return baseSidebarGroups;
    return baseSidebarGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !hiddenTabs.includes(item.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [baseSidebarGroups, isSellerBlocked, isBuyerBlocked]);

  // Ocultar la pestana no basta: la web navega por URL (`/perfil/productos`), asi que
  // un enlace guardado o el boton atras entran igual. Al detectar el bloqueo se vuelve
  // al resumen.
  useEffect(() => {
    if (isSellerBlocked && SELLER_BLOCKED_HIDDEN_TABS.includes(activeTab)) {
      setActiveTab('resumen');
    }
    if (isBuyerBlocked && BUYER_BLOCKED_HIDDEN_TABS.includes(activeTab)) {
      setActiveTab('resumen');
    }
  }, [isSellerBlocked, isBuyerBlocked, activeTab, setActiveTab]);

  const inventorySummaryQuery = useQuery({
    queryKey: qk.sellerInventorySummary(effectiveSellerId),
    queryFn: ({ signal }) => getSellerInventorySummaryApi(effectiveSellerId, { signal }),
    enabled: Boolean(isSeller && effectiveSellerId),
    staleTime: 60 * 1000,
  });

  const catalogQuery = useQuery({
    queryKey: qk.sellerInventory(user?.sellerId, { page: catalogPage, size: catalogPageSize, texto: catalogSearchTerm }),
    queryFn: ({ signal }) => getSellerInventoryApi(user.sellerId, { page: catalogPage, size: catalogPageSize, texto: catalogSearchTerm || undefined, signal }),
    enabled: Boolean(isSeller && activeTab === 'productos' && user?.sellerId),
    staleTime: 60 * 1000,
  });

  const productQuestionsQuery = useQuery({
    queryKey: qk.sellerProductQuestions(user?.sellerId),
    queryFn: ({ signal }) => getSellerProductQuestionsApi(user.sellerId, { signal }),
    enabled: Boolean(isSeller && user?.sellerId && ['productos', 'preguntas_productos'].includes(activeTab)),
    staleTime: 60 * 1000,
  });

  const orders = ordersQuery.data || [];
  // Para el vendedor, sus compras salen del query aparte; para el comprador son las mismas.
  const purchases = isSeller ? (purchasesQuery.data || []) : orders;

  /**
   * Vuelta de Flow con el pago aprobado. El movil sondea `confirmar-pago` hasta 60
   * veces porque nunca abandona la pantalla; aca la pagina se destruyo al saltar a
   * Flow y volvio con el resultado en la URL, asi que una sola llamada basta para
   * que el pedido deje de verse PENDIENTE sin esperar al webhook.
   */
  useEffect(() => {
    if (paymentStatus !== 'success' || !paymentOrderId || !effectiveUserId) return undefined;
    let active = true;
    confirmOrderPaymentApi(effectiveUserId, paymentOrderId)
      .then(() => {
        if (active) queryClient.invalidateQueries({ queryKey: qk.buyerOrders(effectiveUserId) });
      })
      .catch(() => {
        // El webhook de Flow actualiza igual el pedido; esto solo adelanta el refresco.
      });
    return () => { active = false; };
  }, [paymentStatus, paymentOrderId, effectiveUserId, queryClient]);

  const favorites = favoritesQuery.data || [];
  const { savedAds: savedFavoriteAds, savedStores: savedFavoriteStores } = useSavedMarketplaceItems(effectiveUserId);
  const favoritesTotal = favorites.length + savedFavoriteAds.length + savedFavoriteStores.length;
  const conversations = conversationsQuery.data || [];
  // Cotizaciones donde el usuario es el COMPRADOR. Para el vendedor salen del query aparte;
  // para el comprador son las mismas de arriba. `quotesAsBuyer` decide con que set y en que
  // modo se pinta el panel de cotizaciones (el vendedor lo ve en modo comprador solo en la
  // pestaña "Mis cotizaciones").
  const buyerConversations = isSeller ? (buyerConversationsQuery.data || []) : conversations;
  const quotesAsBuyer = !isSeller || activeTab === 'mis_cotizaciones';
  const activeQuoteSource = quotesAsBuyer && isSeller ? buyerConversations : conversations;

  // Notificación de cotización: abre el detalle/chat apenas la lista esté cargada.
  const openedQuoteDeepLinkRef = useRef(null);
  useEffect(() => {
    if (!deepLinkQuoteId) {
      openedQuoteDeepLinkRef.current = null;
      return;
    }
    if (openedQuoteDeepLinkRef.current === deepLinkQuoteId) return;
    const found = (conversations || []).find((c) => (
      String(c.id) === String(deepLinkQuoteId) ||
      String(c.cotizacion?.id) === String(deepLinkQuoteId) ||
      String(c.cotizacionId) === String(deepLinkQuoteId)
    ));
    if (!found) return;
    openedQuoteDeepLinkRef.current = deepLinkQuoteId;
    setSelectedQuote(found);
  }, [deepLinkQuoteId, conversations]);
  const storeInfo = storeInfoQuery.data || null;
  const isSellerFounder = Boolean(storeInfo?.founder ?? user?.founder ?? user?.fundador);
  const inventorySummary = inventorySummaryQuery.data || null;
  const sellerProducts = catalogQuery.data?.content || [];
  const catalogTotalPages = catalogQuery.data?.totalPages ?? 0;
  const catalogTotalElements = catalogQuery.data?.totalElements ?? 0;
  const isCatalogLoading = catalogQuery.isLoading;
  const catalogError = catalogQuery.error?.message || catalogActionError || null;
  const productQuestions = productQuestionsQuery.data || [];
  const productQuestionsLoading = productQuestionsQuery.isLoading;
  const productQuestionsError = productQuestionsQuery.error?.message || '';

  const isLoadingData = isSeller ? (ordersQuery.isLoading || storeInfoQuery.isLoading) : ordersQuery.isLoading;
  const dataError = ordersQuery.error?.message || null;

  const displayName = user?.userName || user?.nombre || (isSeller ? user?.storeName : null) || 'Usuario Repuestop';
  const profileCoverUrl = isSeller
    ? resolveMediaUrl(user?.coverUrl || storeInfo?.coverUrl || '')
    : BUYER_PROFILE_COVER_URL;
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('es-CL', { year: 'numeric', month: 'long' }) : null;

  /**
   * `proveedorId` acota la transicion a UNA tienda: es como el comprador confirma la
   * recepcion y finaliza tienda por tienda. Nulo mantiene el alcance de siempre (todas las
   * subordenes vivas), que es lo que usan el pedido de una sola tienda y el listado.
   */
  const handleSaveCatalogProduct = async (productId, updatedFields) => {
    queryClient.invalidateQueries({ queryKey: qk.sellerInventory(user?.sellerId, { page: catalogPage, size: catalogPageSize, texto: catalogSearchTerm }) });
    setSelectedCatalogProduct((prev) =>
      prev && prev.id === productId ? { ...prev, ...updatedFields } : prev
    );
  };

  const handleSendQuoteResponse = async (quoteId, responseData) => {
    const savedQuote = await saveConversationQuoteApi(quoteId, responseData);
    const finalPrice = Number(savedQuote?.precioFinal ?? savedQuote?.precio ?? responseData.precioFinal ?? responseData.precio ?? 0);
    const notificationText = `Cotización enviada por $${finalPrice.toLocaleString('es-CL')}. ${responseData.condicionesEntrega || ''}`.trim();
    const sentMessage = await sendConversationMessageApi(quoteId, notificationText).catch(() => null);
    queryClient.invalidateQueries({ queryKey: qk.conversations(isSeller ? effectiveSellerId : effectiveUserId, isSeller) });
    setSelectedQuote((prev) =>
      prev && prev.id === quoteId ? { ...prev, cotizacion: savedQuote, ultimoMensaje: sentMessage?.texto || notificationText } : prev
    );
    return savedQuote;
  };

  const handleQuoteMarkedRead = useCallback(() => {
    // Refresca el set que corresponde: cuando el vendedor mira "Mis cotizaciones" es el
    // listado del comprador, no el suyo.
    queryClient.invalidateQueries({
      queryKey: quotesAsBuyer
        ? qk.conversations(effectiveUserId, false)
        : qk.conversations(isSeller ? effectiveSellerId : effectiveUserId, isSeller),
    });
  }, [quotesAsBuyer, isSeller, effectiveSellerId, effectiveUserId, queryClient]);

  const questionCountForProduct = (product) => {
    const embeddedCount = product.questionCount ?? product.preguntasCount ?? product.totalPreguntas;
    if (embeddedCount !== undefined && embeddedCount !== null) return Number(embeddedCount) || 0;
    return productQuestions.filter((question) => String(question.productoId ?? question.productId ?? question.product?.id ?? question.producto?.id ?? '') === String(product.id)).length;
  };

  const quoteSummary = useMemo(() => {
    const quoteOnly = (activeQuoteSource || []).filter((conversation) => (
      !conversation.tipo || String(conversation.tipo).toLowerCase() === 'cotizacion'
    ));
    return {
      total: quoteOnly.length,
      pending: quoteOnly.filter((conversation) => !conversation.cotizacion).length,
      sent: quoteOnly.filter((conversation) => Boolean(conversation.cotizacion)).length,
      unread: quoteOnly.reduce((total, conversation) => total + Number(conversation.mensajesNoLeidos || 0), 0),
    };
  }, [activeQuoteSource]);

  const handleCatalogSearchSubmit = (e) => {
    e.preventDefault();
    setCatalogPage(0);
    setCatalogSearchTerm(catalogSearchInput.trim());
  };

  const handleCatalogPageSizeChange = (size) => {
    setCatalogPageSize(size);
    setCatalogPage(0);
  };

  const handleCatalogProductCreated = () => {
    setCatalogPage(0);
    setCatalogSearchInput('');
    setCatalogSearchTerm('');
    queryClient.invalidateQueries({ queryKey: ['sellerInventory'] });
    queryClient.invalidateQueries({ queryKey: qk.sellerInventorySummary(effectiveSellerId) });
  };

  const handleCatalogProductSaved = (savedProduct) => {
    const pid = savedProduct?.id || selectedCatalogProduct?.id;
    setSelectedCatalogProduct(null);
    queryClient.invalidateQueries({ queryKey: ['sellerInventory'] });
    queryClient.invalidateQueries({ queryKey: qk.sellerInventorySummary(effectiveSellerId) });
    if (pid) {
      queryClient.invalidateQueries({ queryKey: qk.product(pid) });
      queryClient.invalidateQueries({ queryKey: ['products', pid] });
      queryClient.removeQueries({ queryKey: qk.product(pid) });
    }
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['compatVersionsForProduct'] });
    queryClient.invalidateQueries({ queryKey: ['vehicleCatalogDetails'] });
  };

  const handleToggleProductTop = (product) => {
    if (!user?.sellerId || !product?.id || updatingTopProductId) return;
    setCatalogActionError(null);
    setCatalogTopFeedback('');
    setSelectedTopProduct(product);
  };

  const handleProductTopUpdated = (updated, message) => {
    setUpdatingTopProductId(null);
    setCatalogTopFeedback(`${message} El repuesto tendrá prioridad en las búsquedas.`);
    queryClient.invalidateQueries({ queryKey: ['sellerInventory'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    setSelectedCatalogProduct((previous) => previous?.id === updated?.id ? { ...previous, ...updated } : previous);
  };

  const handleToggleProductPause = async (product, pause) => {
    if (!user?.sellerId || !product?.id || updatingPauseProductId) return;
    setUpdatingPauseProductId(product.id);
    setCatalogActionError(null);
    setCatalogTopFeedback('');
    try {
      if (pause) {
        await pauseSellerProductApi(user.sellerId, product.id);
        setCatalogTopFeedback('Publicación pausada: el producto no aparecerá en búsquedas públicas.');
      } else {
        await resumeSellerProductApi(user.sellerId, product.id);
        setCatalogTopFeedback('Publicación reanudada: el producto vuelve a estar visible para compradores.');
      }
      queryClient.invalidateQueries({ queryKey: ['sellerInventory'] });
      queryClient.invalidateQueries({ queryKey: qk.sellerInventorySummary(effectiveSellerId) });
    } catch (error) {
      setCatalogActionError(error.message || 'No se pudo cambiar el estado de la publicación.');
    } finally {
      setUpdatingPauseProductId(null);
    }
  };

  const handleLogout = () => {
    logout();
    onBackToStore();
  };

  const openFeedback = () => {
    setActiveTab('feedback');
  };

  const ordersThisMonthTotal = (orders || []).reduce((sum, o) => {
    if (!o.createdAt) return sum;
    const d = new Date(o.createdAt);
    const now = new Date();
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      return sum + Number(o.totalVendedor ?? o.total ?? 0);
    }
    return sum;
  }, 0);

  const shippingOrdersCount = (orders || []).filter((o) => o.estado === 'ENVIADO').length;

  // Checklist de puesta a punto de la cuenta. El vendedor completa su tienda;
  // el comprador completa los datos que necesita para comprar y recibir.
  const onboardingSteps = useMemo(() => {
    if (!isSeller) {
      return [
        {
          id: 'avatar',
          label: 'Subir tu foto de perfil',
          completed: Boolean(user?.userProfileUrl),
          action: () => handleOpenMediaModal('avatar')
        },
        {
          id: 'contacto',
          label: 'Completar nombre y teléfono',
          completed: Boolean((user?.userName || user?.nombre) && (user?.phone || user?.telefono)),
          action: () => setActiveTab('datos')
        },
        {
          id: 'rut',
          label: 'Registrar tu RUT',
          completed: Boolean(user?.taxId),
          action: () => setActiveTab('datos')
        },
        {
          id: 'direccion',
          label: 'Agregar una dirección de envío',
          completed: Boolean(user?.address),
          action: () => setActiveTab('datos')
        },
        {
          id: 'compra',
          label: 'Realizar tu primera compra',
          completed: (orders || []).length > 0,
          action: () => onBackToStore()
        },
      ];
    }
    return [
      {
        id: 'logo',
        label: 'Subir logo de la tienda',
        completed: Boolean(user?.userProfileUrl || storeInfo?.logoUrl),
        action: () => handleOpenMediaModal('avatar')
      },
      {
        id: 'desc',
        label: 'Completar descripción',
        completed: Boolean(storeInfo?.description && storeInfo.description.trim().length >= 15),
        action: () => setActiveTab('tienda_datos')
      },
      {
        id: 'shipping',
        label: 'Agregar métodos de envío',
        completed: Boolean(storeInfo?.shippingMethods && String(storeInfo.shippingMethods).trim().length > 0),
        action: () => setActiveTab('tienda_datos')
      },
      {
        id: 'payment',
        label: 'Configurar métodos de pago',
        completed: Boolean(storeInfo?.bankAccount || storeInfo?.accountNumber || user?.bankAccount),
        action: () => setActiveTab('retiros')
      },
      {
        id: 'products',
        label: 'Publicar al menos 5 productos',
        completed: (inventorySummary?.total || sellerProducts?.length || 0) >= 5,
        action: () => setShowNewProductModal(true)
      },
    ];
  }, [isSeller, user, storeInfo, inventorySummary, sellerProducts, orders]);

  const completedOnboardingCount = useMemo(
    () => onboardingSteps.filter((step) => step.completed).length,
    [onboardingSteps]
  );

  // KPIs del Resumen. Mismo layout para ambos roles, métricas distintas: el
  // vendedor ve su tienda, el comprador ve sus compras.
  const overviewStats = useMemo(() => {
    if (isSeller) {
      return [
        {
          id: 'productos', tone: 'blue', icon: Package, label: 'Productos publicados',
          value: inventorySummary?.total ?? sellerProducts?.length ?? 0,
          actionLabel: 'Ver catálogo', onClick: () => setActiveTab('productos'),
        },
        {
          id: 'pedidos', tone: 'emerald', icon: ShoppingBag, label: 'Pedidos recibidos',
          value: orders?.length ?? 0,
          actionLabel: 'Ver pedidos', onClick: () => setActiveTab('pedidos'),
        },
        {
          id: 'rating', tone: 'amber', icon: Star, label: 'Calificación promedio',
          value: storeInfo?.rating ? Number(storeInfo.rating).toFixed(1) : '—',
          actionLabel: 'Ver opiniones', onClick: () => setActiveTab('tienda_datos'),
        },
        {
          id: 'ventas', tone: 'purple', icon: TrendingUp, label: 'Ventas este mes',
          value: `$${formatCLP(ordersThisMonthTotal)}`,
          actionLabel: 'Ver estadísticas', onClick: () => setActiveTab('pedidos'),
        },
      ];
    }
    return [
      {
        id: 'pedidos', tone: 'blue', icon: Package, label: 'Pedidos realizados',
        value: orders?.length ?? 0,
        actionLabel: 'Ver pedidos', onClick: () => setActiveTab('pedidos'),
      },
      {
        id: 'envios', tone: 'emerald', icon: Truck, label: 'Envíos en camino',
        value: shippingOrdersCount,
        actionLabel: 'Seguir envíos', onClick: () => setActiveTab('pedidos'),
      },
      {
        id: 'cotizaciones', tone: 'amber', icon: ReceiptText, label: 'Cotizaciones activas',
        value: quoteSummary.total,
        actionLabel: 'Ver cotizaciones', onClick: () => setActiveTab('cotizaciones'),
      },
      {
        id: 'favoritos', tone: 'purple', icon: Heart, label: 'Favoritos guardados',
        value: favoritesTotal,
        actionLabel: 'Ver favoritos', onClick: () => setActiveTab('favoritos'),
      },
    ];
  }, [isSeller, inventorySummary, sellerProducts, orders, storeInfo, ordersThisMonthTotal,
      shippingOrdersCount, quoteSummary.total, favoritesTotal, setActiveTab]);

  const overviewActions = useMemo(() => {
    if (isSeller) {
      return [
        { id: 'pedidos', tone: 'blue', icon: ShoppingBag, title: 'Gestionar pedidos', description: 'Revisa, despacha y actualiza el estado de tus pedidos.', onClick: () => setActiveTab('pedidos') },
        { id: 'nuevo', tone: 'emerald', icon: Plus, title: 'Agregar producto', description: 'Publica nuevos repuestos en tu catálogo.', onClick: () => setShowNewProductModal(true) },
        { id: 'cotizaciones', tone: 'purple', icon: ReceiptText, title: 'Responder cotizaciones', description: 'Atiende solicitudes directas de clientes.', onClick: () => setActiveTab('cotizaciones') },
        { id: 'tienda', tone: 'sky', icon: Store, title: 'Mi tienda y datos', description: 'Edita la información comercial de tu tienda.', onClick: () => setActiveTab('tienda_datos') },
        { id: 'retiros', tone: 'emerald', icon: Wallet, title: 'Retirar dinero', description: 'Solicita el depósito bancario de tus ventas.', onClick: () => setActiveTab('retiros') },
        { id: 'anuncios', tone: 'amber', icon: Megaphone, title: 'Gestión de anuncios', description: 'Publica y destaca en el Mural de Anuncios.', onClick: () => setActiveTab('anuncios') },
      ];
    }
    return [
      { id: 'pedidos', tone: 'blue', icon: Package, title: 'Mis pedidos', description: 'Sigue el estado de tus compras y recepciones.', onClick: () => setActiveTab('pedidos') },
      { id: 'cotizaciones', tone: 'purple', icon: ReceiptText, title: 'Mis cotizaciones', description: 'Revisa las respuestas de las tiendas y compara precios.', onClick: () => setActiveTab('cotizaciones') },
      { id: 'favoritos', tone: 'amber', icon: Heart, title: 'Repuestos favoritos', description: 'Accede a los repuestos que guardaste.', onClick: () => setActiveTab('favoritos') },
      { id: 'datos', tone: 'sky', icon: UserCog, title: 'Mis datos y perfil', description: 'Actualiza tu información y direcciones de envío.', onClick: () => setActiveTab('datos') },
      { id: 'anuncios', tone: 'emerald', icon: Megaphone, title: 'Gestión de anuncios', description: 'Publica tu búsqueda en el Mural de Anuncios.', onClick: () => setActiveTab('anuncios') },
      { id: 'soporte', tone: 'blue', icon: Headphones, title: 'Centro de ayuda', description: 'Resuelve dudas o abre un reporte de compra.', onClick: () => navigate(ROUTES.support) },
    ];
  }, [isSeller, setActiveTab, navigate]);

  const recentActivities = useMemo(() => {
    const list = [];

    (orders || []).slice(0, 4).forEach((ord) => {
      list.push({
        id: `ord-${ord.id}`,
        type: 'order',
        title: isSeller ? 'Nuevo pedido' : 'Pedido realizado',
        detail: `Pedido #${ord.id} - ${orderTitle(ord)}`,
        date: ord.createdAt || ord.fecha || Date.now() - 86400000,
        badgeClass: 'badge-emerald',
        action: () => setActiveTab('pedidos')
      });
    });

    (conversations || []).slice(0, 3).forEach((conv) => {
      list.push({
        id: `conv-${conv.id}`,
        type: 'quote',
        title: 'Cotización respondida',
        detail: conv.partName ? `Cotización ${conv.partName}` : `Cotización #${conv.id}`,
        date: conv.updatedAt || conv.createdAt || Date.now() - 172800000,
        badgeClass: 'badge-purple',
        action: () => setActiveTab('cotizaciones')
      });
    });

    if (isSeller && (sellerProducts || []).length > 0) {
      (sellerProducts || []).slice(0, 2).forEach((prod) => {
        list.push({
          id: `prod-${prod.id}`,
          type: 'product',
          title: 'Producto publicado',
          detail: prod.nombre || prod.name || 'Repuesto en catálogo',
          date: prod.createdAt || Date.now() - 7200000,
          badgeClass: 'badge-blue',
          action: () => setActiveTab('productos')
        });
      });
    }

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list.slice(0, 5);
  }, [orders, conversations, isSeller, sellerProducts]);

  return (
    <div className={`profile-dashboard ${isSeller ? 'seller-profile-dashboard' : 'buyer-profile-dashboard'}`}>
      {/* Top Bar */}
      <div className="profile-topbar">
        <div className="profile-topbar-inner">
          <div className="profile-logo-group" onClick={onBackToStore}>
            <RepuesTopLogo height={38} />
          </div>

          <div className="profile-topbar-actions">
            <button className="btn-back-to-store" onClick={onBackToStore}>
              <ArrowLeft size={16} />
              <span>Volver a la tienda</span>
            </button>

            {isSeller && user?.sellerId && (
              <a
                className="btn-visit-my-store"
                href={storePath({ id: user.sellerId, nombre: storeInfo?.storeName || user?.storeName })}
                target="_blank"
                rel="noopener noreferrer"
                title="Se abre en una pestaña nueva: es exactamente como los compradores ven tu tienda."
              >
                <Store size={16} />
                <span>Visitar mi tienda</span>
                <ArrowUpRight size={14} />
              </a>
            )}
          </div>

          <div className="profile-topbar-user">
            <div className={`profile-role-chip ${isSeller ? 'chip-seller' : 'chip-buyer'}`}>
              {isSeller ? <Store size={13} /> : <ShoppingBag size={13} />}
              <span>{isSeller ? 'Proveedor' : 'Comprador'}</span>
            </div>
            <HeaderWalletButton variant="topbar" />
            <ProfileNotificationsBell user={user} />
            <button className="btn-topbar-logout" onClick={handleLogout}>
              <LogOut size={15} />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Facebook Style Cover & Hero Header */}
      <div className="facebook-cover-hero-container">
        {/* Cover Photo Banner */}
        <div
          className="facebook-cover-banner"
          style={{
            backgroundImage: profileCoverUrl
              ? `url(${profileCoverUrl})`
              : 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0066ff 100%)',
          }}
        >
          {isSeller && (
            <button
              className="btn-change-cover-photo"
              onClick={handleOpenCoverTemplates}
              title="Cambiar Foto de Portada"
            >
              <Camera size={15} />
              <span>Editar Portada</span>
            </button>
          )}
        </div>

        {/* Info Bar Below Cover (High Contrast) */}
        <div className="facebook-hero-bar">
          <div className="facebook-avatar-wrapper">
            <div className="profile-hero-avatar facebook-avatar-circle">
              {user?.userProfileUrl || storeInfo?.logoUrl ? (
                <img src={user?.userProfileUrl || storeInfo?.logoUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                initialsFromName(displayName)
              )}
            </div>
            <button
              className="btn-change-avatar-camera"
              onClick={() => handleOpenMediaModal('avatar')}
              title="Cambiar Foto de Perfil / Logo"
            >
              <Camera size={13} />
            </button>
          </div>

          <div className="facebook-hero-info">
            <div className="facebook-hero-title-row">
              <h1 className="facebook-hero-name">
                {isSeller ? (storeInfo?.storeName || user?.storeName || displayName) : displayName}
              </h1>
              {/* `EstadoTienda` tiene cuatro valores. Antes solo se miraba APPROVED y
                  todo lo demas caia en "Tienda en Revision", asi que una tienda
                  rechazada o suspendida se veia como si estuviera en tramite. */}
              {isSeller && storeInfo?.status && (
                <span className={`store-status-chip ${STORE_STATUS_CHIP[storeInfo.status]?.className || 'chip-pending'}`}>
                  <ShieldCheck size={13} />
                  <span>{STORE_STATUS_CHIP[storeInfo.status]?.label || 'Tienda en revisión'}</span>
                </span>
              )}
            </div>

            <p className="facebook-hero-email">{user?.email}</p>

            <div className="profile-hero-tags">
              {memberSince && (
                <span className="hero-tag tag-contrast">
                  <Clock size={13} /> Miembro desde {memberSince}
                </span>
              )}
              {/* Solo las tiendas marcadas como fundadoras en el backoffice
                  (`PATCH /backoffice/founders/{id}` -> `Proveedor.fundador`, que viaja
                  en `TiendaResponseDTO.founder`). Antes salía para TODO vendedor, así
                  que cualquiera creía tener la tarifa del 5%. */}
              {isSeller && storeInfo?.founder && (
                <span className="hero-tag founder-tag-contrast">
                  <Crown size={14} strokeWidth={2.4} /> Beneficio Tarifa Fundador Activo (5%)
                </span>
              )}
            </div>
          </div>

          {/* El hero es compartido por todas las pestañas: este CTA solo va en
              Resumen para no repetirse en cada pantalla (ya está en el sidebar
              y en Acciones rápidas del Resumen). */}
          {isSeller && activeTab === 'resumen' && (
            <button
              type="button"
              className="btn-withdraw-money-hero"
              onClick={() => setActiveTab('retiros')}
              title="Ir a Retirar dinero"
            >
              <Wallet size={16} />
              <span>Retirar dinero</span>
            </button>
          )}

          {!isSeller && activeTab === 'resumen' && (
            <button
              type="button"
              className="btn-hero-cta"
              onClick={() => navigate(ROUTES.catalog)}
              title="Ir al catálogo de repuestos"
            >
              <Search size={16} />
              <span>Buscar repuestos</span>
            </button>
          )}
        </div>
      </div>

      <div className="profile-body">
        {/* Sidebar Nav */}
        <aside className="profile-sidebar">
          <div className={`sidebar-mini-profile ${isSeller ? 'mini-seller' : 'mini-buyer'}`}>
            <div className="sidebar-mini-avatar">
              {user?.userProfileUrl ? (
                <img src={user.userProfileUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                initialsFromName(displayName)
              )}
            </div>
            <div className="sidebar-mini-info">
              <strong>{isSeller ? (storeInfo?.storeName || user?.storeName || displayName) : displayName}</strong>
              <span>{isSeller ? 'Cuenta Proveedor' : 'Cuenta Comprador'}</span>
            </div>
          </div>

          <nav className="sidebar-nav-list" aria-label={isSeller ? 'Menú de proveedor' : 'Menú de comprador'}>
            {sidebarGroups.map((group) => (
              <div key={group.title || 'general'} className="sidebar-nav-group">
                {group.title && <span className="sidebar-group-title">{group.title}</span>}
                <div className="sidebar-group-items">
                  {group.items.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = !tab.href && activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        className={`profile-nav-item ${isSeller ? 'nav-seller' : 'nav-buyer'} ${isActive ? 'active' : ''}`}
                        onClick={() => (tab.href ? navigate(tab.href) : setActiveTab(tab.id))}
                      >
                        <Icon size={17} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="profile-nav-final-actions">
              <button type="button" className={`profile-nav-item profile-nav-feedback ${activeTab === 'feedback' ? 'active' : ''}`} onClick={openFeedback}>
                <MessageSquare size={17} /><span>Dejar feedback</span>
              </button>
              <button type="button" className="profile-nav-item profile-nav-delete" onClick={() => setShowDeleteAccountModal(true)}>
                <Trash2 size={17} /><span>Cerrar cuenta</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="profile-main">
          {dataError && (
            <div className="auth-alert alert-error">
              <X size={16} />
              <span>{dataError}</span>
            </div>
          )}

          {(isSellerBlocked || isBuyerBlocked) && (
            <div
              className="seller-blocked-banner"
              style={{
                marginBottom: '20px',
                padding: '16px 20px',
                borderRadius: '12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#dc2626',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <strong style={{ display: 'block', color: '#991b1b', fontSize: '14.5px', fontWeight: 800 }}>
                    {isSellerBlocked ? 'Tu tienda se encuentra bloqueada' : 'Tu cuenta se encuentra suspendida'}
                  </strong>
                  <p style={{ margin: '3px 0 0', color: '#b91c1c', fontSize: '13px', lineHeight: 1.4 }}>
                    {blockReason} {isSellerBlocked
                      ? 'Mientras esté suspendida no podrás recibir nuevos pedidos ni publicar productos.'
                      : 'Mientras esté suspendida no podrás comprar, cotizar ni usar el resto de las funciones de la cuenta.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-auth-primary"
                style={{
                  backgroundColor: '#dc2626',
                  borderColor: '#b91c1c',
                  padding: '9px 18px',
                  fontSize: '13px',
                  height: 'auto',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => setShowBlockedReviewModal(true)}
              >
                <Scale size={16} />
                <span>Solicitar Revisión</span>
              </button>
            </div>
          )}

          {isLoadingData ? (
            <div className="profile-panel"><LoadingRow /></div>
          ) : (
            <>
              {activeTab === 'resumen' && (
                <ProfileSummaryPanel
                  isSeller={isSeller}
                  user={user}
                  overviewStats={overviewStats}
                  overviewActions={overviewActions}
                  recentActivities={recentActivities}
                  ordersThisMonthTotal={ordersThisMonthTotal}
                  ordersCount={orders?.length ?? 0}
                  quoteSummary={quoteSummary}
                  shippingOrdersCount={shippingOrdersCount}
                  onboardingSteps={onboardingSteps}
                  completedOnboardingCount={completedOnboardingCount}
                  onViewAllActivity={() => setActiveTab('pedidos')}
                />
              )}

              <ProfileOrdersPanel
                activeTab={activeTab}
                isSeller={isSeller}
                isSellerBlocked={isSellerBlocked}
                user={user}
                effectiveUserId={effectiveUserId}
                effectiveSellerId={effectiveSellerId}
                orders={orders}
                purchases={purchases}
                ordersLoading={ordersQuery.isLoading}
                purchasesLoading={purchasesQuery.isLoading}
                detailOrderId={detailOrderId}
                detailPurchaseId={detailPurchaseId}
                deepLinkOrderId={deepLinkOrderId}
                onClearDeepLink={onClearDeepLink}
                paymentStatus={paymentStatus}
                paymentOrderId={paymentOrderId}
              />

              {activeTab === 'mis_preguntas' && (
                <ProfileMyQuestionsPanel effectiveUserId={effectiveUserId} />
              )}

              {activeTab === 'favoritos' && (
                <ProfileFavoritesPanel
                  userId={effectiveUserId}
                  productFavorites={favorites}
                  isLoading={favoritesQuery.isLoading}
                  error={favoritesQuery.error}
                />
              )}

              {activeTab === 'tienda' && isSeller && (
                <ProfileStoreSummaryPanel
                  storeInfo={storeInfo}
                  displayName={displayName}
                  inventorySummary={inventorySummary}
                />
              )}

              {activeTab === 'productos' && isSeller && (
                <ProfileCatalogPanel
                  sellerProducts={sellerProducts}
                  catalogTotalElements={catalogTotalElements}
                  catalogTotalPages={catalogTotalPages}
                  isCatalogLoading={isCatalogLoading}
                  catalogError={catalogError}
                  catalogTopFeedback={catalogTopFeedback}
                  catalogSearchInput={catalogSearchInput}
                  setCatalogSearchInput={setCatalogSearchInput}
                  catalogSearchTerm={catalogSearchTerm}
                  onSearchSubmit={handleCatalogSearchSubmit}
                  catalogPage={catalogPage}
                  setCatalogPage={setCatalogPage}
                  catalogPageSize={catalogPageSize}
                  onPageSizeChange={handleCatalogPageSizeChange}
                  inventoryPanelUrl={inventoryPanelUrl}
                  questionCountForProduct={questionCountForProduct}
                  onSelectProduct={(item) => setSelectedCatalogProduct(item)}
                  onOpenQuestionsForProduct={(productId) => {
                    setQuestionsProductFilter(productId);
                    setActiveTab('preguntas_productos');
                  }}
                  onAddProduct={() => setShowNewProductModal(true)}
                  onToggleTop={handleToggleProductTop}
                  updatingTopProductId={updatingTopProductId}
                  onTogglePause={handleToggleProductPause}
                  updatingPauseProductId={updatingPauseProductId}
                />
              )}

              {activeTab === 'preguntas_productos' && isSeller && (
                <SellerProductQuestionsPanel
                  questions={productQuestions}
                  products={sellerProducts || []}
                  loading={productQuestionsLoading}
                  error={productQuestionsError}
                  initialProductId={questionsProductFilter}
                  onClearProduct={() => setQuestionsProductFilter(null)}
                  onQuestionAnswered={() => queryClient.invalidateQueries({ queryKey: qk.sellerProductQuestions(effectiveSellerId) })}
                />
              )}

              {(activeTab === 'cotizaciones' || (isSeller && activeTab === 'mis_cotizaciones')) && (
                <ProfileQuotesPanel
                  quotesAsBuyer={quotesAsBuyer}
                  quoteSummary={quoteSummary}
                  activeQuoteSource={activeQuoteSource}
                  onSelectQuote={setSelectedQuote}
                />
              )}

              {activeTab === 'anuncios' && (
                <AdsManagementSection
                  onNavigateToMural={() => window.location.assign('/mural-anuncios')}
                />
              )}

              {activeTab === 'retiros' && isSeller && (
                <SellerWithdrawalsPanel sellerId={user?.sellerId} sellerEmail={user?.email} />
              )}

              {activeTab === 'consultas' && (
                <ProfileSupportPanel user={user} deepLinkTicketId={deepLinkTicketId} onClearDeepLink={onClearDeepLink} />
              )}

              {activeTab === 'chats_vendedor' && (
                <SellerChatsView user={user} mode="buyer" orders={isSeller ? purchasesQuery.data : ordersQuery.data} />
              )}

              {activeTab === 'chats_compradores' && isSeller && (
                <SellerChatsView user={user} mode="seller" orders={ordersQuery.data} />
              )}

              {activeTab === 'feedback' && <ProfileFeedbackPanel />}

              {(activeTab === 'tienda_datos' || activeTab === 'datos') && (
                <ProfileAccountDataPanel
                  user={user}
                  isSeller={isSeller}
                  storeInfo={storeInfo}
                  effectiveSellerId={effectiveSellerId}
                  setActiveTab={setActiveTab}
                  onOpenMediaModal={() => handleOpenMediaModal('avatar')}
                  onOpenCoverTemplates={handleOpenCoverTemplates}
                />
              )}
            </>
          )}
        </main>
      </div>

      {selectedCatalogProduct && (
        <NewCatalogProductModal
          product={selectedCatalogProduct}
          sellerId={user?.sellerId}
          isFounder={isSellerFounder}
          onClose={() => setSelectedCatalogProduct(null)}
          onCreated={handleCatalogProductSaved}
        />
      )}

      {selectedTopProduct && (
        <ProductTopManagementModal
          product={selectedTopProduct}
          sellerId={user?.sellerId}
          onClose={() => setSelectedTopProduct(null)}
          onUpdated={handleProductTopUpdated}
        />
      )}

      {selectedQuote && (
        <QuoteDetailModal
          quote={selectedQuote}
          mode={quotesAsBuyer ? 'buyer' : 'seller'}
          isFounder={isSellerFounder}
          onClose={() => {
            setSelectedQuote(null);
            openedQuoteDeepLinkRef.current = null;
            onClearDeepLink?.('cotizacion');
          }}
          onSendQuoteResponse={handleSendQuoteResponse}
          onMarkedRead={handleQuoteMarkedRead}
          user={user}
        />
      )}

      <AccountClosureModal
        isOpen={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
        isSeller={isSeller}
      />

      {showCoverTemplatesModal && createPortal(
        <div
          className="store-cover-template-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingCoverTemplate) setShowCoverTemplatesModal(false);
          }}
        >
          <section className="store-cover-template-modal" role="dialog" aria-modal="true" aria-labelledby="cover-template-title">
            <header className="store-cover-template-header">
              <div className="store-cover-template-heading">
                <span className="store-cover-template-icon" aria-hidden="true"><ImageIcon size={22} /></span>
                <div>
                  <span className="store-cover-template-eyebrow"><Sparkles size={13} /> Portadas oficiales RepuesTop</span>
                  <h2 id="cover-template-title">Elige el fondo de tu tienda</h2>
                  <p>Selecciona una plantilla profesional. La imagen se adaptará automáticamente a tu portada.</p>
                </div>
              </div>
              <button
                type="button"
                className="store-cover-template-close"
                onClick={() => setShowCoverTemplatesModal(false)}
                disabled={isSavingCoverTemplate}
                aria-label="Cerrar selector de portadas"
              >
                <X size={20} />
              </button>
            </header>

            <div className="store-cover-template-body">
              <div className="store-cover-template-notice">
                <ShieldCheck size={17} />
                <span>Puedes escoger una de estas imágenes de fondo. Por seguridad y consistencia visual, no se permiten portadas personales.</span>
              </div>

              {isLoadingCoverTemplates ? (
                <div className="store-cover-template-loading"><Loader2 className="spin-icon" size={24} /> Cargando plantillas...</div>
              ) : (
                <div className="store-cover-template-grid" role="radiogroup" aria-label="Plantillas de portada disponibles">
                  {coverTemplates.map((template) => {
                    const isSelected = selectedCoverTemplateId === template.id;
                    return (
                      <button
                        type="button"
                        key={template.id}
                        className={`store-cover-template-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setSelectedCoverTemplateId(template.id)}
                        role="radio"
                        aria-checked={isSelected}
                      >
                        <span className="store-cover-template-preview">
                          <img src={template.url} alt={`Vista previa: ${template.name}`} />
                          <span className="store-cover-template-check"><Check size={16} strokeWidth={3} /></span>
                        </span>
                        <span className="store-cover-template-copy">
                          <strong>{template.name}</strong>
                          <small>{template.description}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {coverTemplateError && (
                <div className="store-cover-template-error" role="alert"><AlertTriangle size={16} /> {coverTemplateError}</div>
              )}
            </div>

            <footer className="store-cover-template-footer">
              <span><ShieldCheck size={15} /> Imágenes alojadas de forma segura en Cloudflare R2</span>
              <div>
                <button type="button" className="btn-auth-secondary" onClick={() => setShowCoverTemplatesModal(false)} disabled={isSavingCoverTemplate}>
                  Cancelar
                </button>
                <button type="button" className="btn-auth-primary" onClick={handleSaveCoverTemplate} disabled={!selectedCoverTemplateId || isSavingCoverTemplate}>
                  {isSavingCoverTemplate ? <Loader2 size={16} className="spin-icon" /> : <Check size={16} />}
                  {isSavingCoverTemplate ? 'Guardando...' : 'Usar esta portada'}
                </button>
              </div>
            </footer>
          </section>
        </div>,
        document.body
      )}

      {showMediaModal && (
        <div className="order-modal-backdrop" onClick={() => setShowMediaModal(null)}>
          <div className="order-modal-container" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="order-modal-header">
              <div className="order-modal-title-group">
                <div className="order-modal-icon-badge">
                  <Camera size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {showMediaModal === 'avatar' ? 'Cambiar Foto de Perfil / Logo' : 'Cambiar Imagen de Portada'}
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {showMediaModal === 'avatar' ? 'Imagen comercial de perfil' : 'Banner de fondo estilo Facebook'}
                  </span>
                </div>
              </div>
              <button type="button" className="btn-close-modal" onClick={closeMediaModal} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleSaveMediaUrl} className="order-modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Resolution Spec Badge */}
              <div className={`resolution-spec-badge ${showMediaModal === 'avatar' ? 'spec-badge-blue' : 'spec-badge-purple'}`}>
                <ImageIcon size={15} />
                <div>
                  <span className="spec-badge-title">Resolución Recomendada Exacta:</span>
                  <strong className="spec-badge-value">
                    {showMediaModal === 'avatar' ? '400 x 400 px (Formato Cuadrado / Circular 1:1)' : '1200 x 450 px (Formato Panorámico 8:3)'}
                  </strong>
                </div>
              </div>

              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {showMediaModal === 'avatar'
                  ? 'Sube tu logo o foto de perfil. Para una visualización óptima en la plataforma y en las tarjetas del Home, utiliza una imagen cuadrada de al menos 400x400 píxeles.'
                  : 'Sube la imagen de portada de tu tienda. Para un encuadre perfecto en la cabecera estilo Facebook, utiliza una imagen panorámica de al menos 1200x450 píxeles.'}
              </p>

              {/* Upload File Button Box */}
              <div className="upload-file-option-box">
                <label className="btn-upload-file-picker">
                  <Upload size={20} />
                  <div className="upload-btn-text">
                    <strong>Cargar archivo desde mi equipo</strong>
                    <span>
                      {showMediaModal === 'avatar'
                        ? 'Formato PNG, JPG o WEBP (Sugerido: 400 x 400 px)'
                        : 'Formato PNG, JPG o WEBP (Sugerido: 1200 x 450 px)'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {mediaInput && (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Vista Previa en Vivo:
                  </span>
                  {showMediaModal === 'avatar' ? (
                    <div className="avatar-preview-circle">
                      <img src={mediaInput} alt="Preview" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                  ) : (
                    <div className="cover-preview-rect">
                      <img src={mediaInput} alt="Preview" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                  )}
                </div>
              )}

              {mediaError && <p className="confirm-dialog-error">{mediaError}</p>}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', marginTop: '4px' }}>
                <button type="button" className="btn-auth-secondary" onClick={closeMediaModal} disabled={isSavingMedia}>
                  Cancelar
                </button>
                <button type="submit" className="btn-auth-primary" disabled={!mediaFile || isSavingMedia} style={{ width: 'auto' }}>
                  {isSavingMedia ? <Loader2 size={16} className="spin-icon" /> : <Save size={16} />}
                  {isSavingMedia ? 'Guardando…' : 'Guardar Imagen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewProductModal && isSeller && (
        <NewCatalogProductModal
          sellerId={user?.sellerId}
          isFounder={isSellerFounder}
          onClose={() => setShowNewProductModal(false)}
          onCreated={handleCatalogProductCreated}
        />
      )}

      {/* Modal de Solicitud de Revisión de Cuenta Bloqueada */}
      <BlockedAccountReviewModal
        isOpen={showBlockedReviewModal}
        onClose={() => setShowBlockedReviewModal(false)}
        isBuyerBlocked={isBuyerBlocked}
        blockReason={blockReason}
        blockReasonIsClaim={blockReasonIsClaim}
        effectiveSellerId={effectiveSellerId}
        effectiveBuyerId={effectiveBuyerId}
      />

    </div>
  );
}
