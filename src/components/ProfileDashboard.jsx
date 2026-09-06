import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, LayoutGrid, Package, Heart, UserCog, Store, ShoppingBag,
  MessageSquare, LogOut, Star, Layers, TrendingUp, Truck, Check, Pencil, Save, X,
  Clock, ShieldCheck, Building2, PackageCheck, Loader2, Inbox, ChevronLeft, ChevronRight, Search,
  CreditCard, Phone, Mail, ArrowUpRight, Sliders, Sparkles, Camera, Upload, Image as ImageIcon,
  Trash2, AlertTriangle, ReceiptText, Boxes, Plus, MessageCircleQuestion, Scale, Headphones, Wallet, Info, Crown,
  CheckCircle, Send, Megaphone, Lightbulb, CheckCircle2, Circle, Lock, ShoppingCart
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import RepuesTopLogo from './RepuesTopLogo';
import {
  getBuyerOrdersApi, getBuyerOrderByIdApi, getSellerOrdersApi, getFavoritesApi,
  retryOrderPaymentApi, confirmOrderPaymentApi,
  getSellerInventoryApi, getSellerInventorySummaryApi, getSellerConversationsApi, getBuyerConversationsApi, getSellerStoreApi, getSellerProductQuestionsApi,
  updateOrderStatusApi, uploadProfileImageApi, resolveMediaUrl, getVehicleBrandsApi, updateStoreSpecialistBrandsApi,
  getStoreCoverTemplatesApi, selectStoreCoverTemplateApi,
  saveConversationQuoteApi, sendConversationMessageApi, requestBlockedAccountReviewApi,
  cancelSellerOrderApi, cancelBuyerSubOrderApi, registerOrderDispatchApi, registerSaleReceiptApi, declareOrderDeliveryApi, createOrderClaimApi,
  pauseSellerProductApi, resumeSellerProductApi, updateSellerShippingMethodsApi,
  getSellerVerificationStatusApi, submitSellerVerificationApi, appealSellerVerificationApi, acceptSellerAdhesionApi,
  getBuyerProductQuestionsApi, createSystemFeedbackApi, getMySystemFeedbackApi
} from '../services/api';
import { qk } from '../services/queryKeys';
import ShippingMethodsPicker from './ShippingMethodsPicker';
import { useSellerBlocked } from '../hooks/useSellerBlocked';
import OrderCard from './OrderCard';
import OrderDetailView from './OrderDetailView';
import CatalogCard from './CatalogCard';
import ProductTopManagementModal from './ProductTopManagementModal';
import ProductTopBadge from './ProductTopBadge';
import QuoteCard from './QuoteCard';
import QuoteDetailModal from './QuoteDetailModal';
import ProfileSupportPanel from './ProfileSupportPanel';
import ProfileNotificationsBell from './ProfileNotificationsBell';
import HeaderWalletButton from './HeaderWalletButton';
import NewCatalogProductModal from './NewCatalogProductModal';
import SellerVerificationCard from './SellerVerificationCard';
import SellerProductQuestionsPanel from './SellerProductQuestionsPanel';
import { getShippingIconConfig } from './NewOnboardedStoresSection';
import {
  SHIPPING_METHOD_DEFS, parseShippingSelections, buildShippingMethodsString,
} from '../data/shippingMethods';
import VehicleBrandLogo from './VehicleBrandLogo';
import SellerWithdrawalsPanel from './SellerWithdrawalsPanel';
import SellerOrdersPanel from './SellerOrdersPanel';
import BuyerAddressBook from './BuyerAddressBook';
import AdsManagementSection from './ads/AdsManagementSection';
import CapturerContactCard from './CapturerContactCard';
import ProfileFavoritesPanel from './ProfileFavoritesPanel';
import { useSavedMarketplaceItems } from '../hooks/useSavedMarketplaceItems';
import { formatRut, isValidRut, isValidClPhone } from '../services/adapters';
import { Link, useNavigate } from 'react-router-dom';
import { helpContactPath, productPath, profileOrderPath, profilePurchasePath, ROUTES, storePath } from '../routes/paths';

const CATALOG_PAGE_SIZE_OPTIONS = [12, 24, 48];

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

/** Deja pasar solo dígitos y, si estaba al inicio, un único "+" (prefijo de país). */
function sanitizePhoneInput(rawValue) {
  const value = String(rawValue || '');
  const hasLeadingPlus = value.trimStart().startsWith('+');
  const digits = value.replace(/\D/g, '');
  return (hasLeadingPlus ? '+' : '') + digits;
}

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
      { id: 'preguntas_productos', label: 'Preguntas de productos', icon: MessageCircleQuestion }
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
      { id: 'consultas', label: 'Reportes/Disputa', icon: Scale },
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
      { id: 'consultas', label: 'Reportes/Disputa', icon: Scale },
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

function formatCLP(value) {
  return Number(value || 0).toLocaleString('es-CL');
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRelativeTime(date) {
  if (!date) return 'Reciente';
  const diffMs = Date.now() - new Date(date).getTime();
  const diffHrs = Math.floor(diffMs / 3600000);
  if (diffHrs < 1) return 'Hace unos minutos';
  if (diffHrs < 24) return `Hace ${diffHrs} ${diffHrs === 1 ? 'hora' : 'horas'}`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
  return formatDate(date);
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

function LoadingRow() {
  return (
    <div className="profile-loading-state">
      <Loader2 size={18} className="spin-icon" />
      <span>Cargando datos desde el servidor...</span>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="profile-empty-state">
      <Inbox size={22} />
      <span>{label}</span>
    </div>
  );
}

export default function ProfileDashboard({ onBackToStore, initialTab = 'resumen', onTabChange, paymentStatus, paymentOrderId, deepLinkOrderId, deepLinkTicketId, deepLinkQuoteId, onClearDeepLink, detailOrderId, detailPurchaseId }) {
  const { user, role, logout, updateProfile, refreshProfile, deleteAccount } = useAuth();
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
  const [isEditing, setIsEditing] = useState(false);

  // Al salir de la pestaña de datos se descarta el formulario de edición: como
  // el dashboard nunca desmonta al cambiar de pestaña, sin esto el formulario
  // quedaba abierto "en segundo plano" y reaparecía igual al volver.
  useEffect(() => {
    if (activeTab !== 'tienda_datos' && activeTab !== 'datos') {
      setIsEditing(false);
      setFormErrors({});
    }
  }, [activeTab]);
  const [nameDraft, setNameDraft] = useState(user?.userName || user?.nombre || '');
  const [phoneDraft, setPhoneDraft] = useState(user?.phone || user?.telefono || '');
  const [taxIdDraft, setTaxIdDraft] = useState(user?.taxId || '');
  const [shippingSelectionsDraft, setShippingSelectionsDraft] = useState(() => parseShippingSelections(''));
  const [availableVehicleBrands, setAvailableVehicleBrands] = useState([]);
  const [specialistBrandIdsDraft, setSpecialistBrandIdsDraft] = useState([]);
  const [showSpecialistBrandsModal, setShowSpecialistBrandsModal] = useState(false);
  const [specialistBrandSearch, setSpecialistBrandSearch] = useState('');

  const [saveStatus, setSaveStatus] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
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
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState(null);
  const [feedbackTab, setFeedbackTab] = useState('nuevo');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [isLoadingFeedbackHistory, setIsLoadingFeedbackHistory] = useState(false);

  const [showBlockedReviewModal, setShowBlockedReviewModal] = useState(false);
  const [blockedReviewText, setBlockedReviewText] = useState('');
  const [blockedReviewContact, setBlockedReviewContact] = useState('');
  const [isSubmittingBlockedReview, setIsSubmittingBlockedReview] = useState(false);
  const [blockedReviewSuccess, setBlockedReviewSuccess] = useState(false);
  const [blockedReviewError, setBlockedReviewError] = useState(null);

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
  const [ratingPromptOrderId, setRatingPromptOrderId] = useState(null);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState(null);
  const [selectedTopProduct, setSelectedTopProduct] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [quoteFilter, setQuoteFilter] = useState('all');
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteSort, setQuoteSort] = useState('newest');

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

  const buyerQuestionsQuery = useQuery({
    queryKey: qk.buyerProductQuestions(effectiveUserId),
    queryFn: ({ signal }) => getBuyerProductQuestionsApi({ signal }),
    // Tambien para el vendedor: son las preguntas que hizo EL en productos de otras tiendas
    // (el backend las resuelve por el JWT), distintas de las que recibe en sus propios productos.
    enabled: Boolean(effectiveUserId),
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
  const { isBlocked: isSellerBlocked, blockReason, blockReasonIsClaim } = useSellerBlocked();

  // Se ocultan las pestanas de operacion, no la navegacion entera: resumen, pedidos
  // (solo lectura), mi tienda/datos y Reportes/Disputa siguen accesibles. Disputa es
  // justamente donde vive la mediacion que suele originar el bloqueo.
  const sidebarGroups = useMemo(() => {
    if (!isSellerBlocked) return baseSidebarGroups;
    return baseSidebarGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !SELLER_BLOCKED_HIDDEN_TABS.includes(item.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [baseSidebarGroups, isSellerBlocked]);

  // Ocultar la pestana no basta: la web navega por URL (`/perfil/productos`), asi que
  // un enlace guardado o el boton atras entran igual. Al detectar el bloqueo se vuelve
  // al resumen.
  useEffect(() => {
    if (isSellerBlocked && SELLER_BLOCKED_HIDDEN_TABS.includes(activeTab)) {
      setActiveTab('resumen');
    }
  }, [isSellerBlocked, activeTab, setActiveTab]);

  const handleSubmitBlockedReview = async (e) => {
    e.preventDefault();
    if (!blockedReviewText.trim()) {
      setBlockedReviewError('Por favor describe el motivo o justificación de tu solicitud.');
      return;
    }
    if (!effectiveSellerId) {
      setBlockedReviewError('No se encontró el identificador de la tienda.');
      return;
    }
    setIsSubmittingBlockedReview(true);
    setBlockedReviewError(null);
    try {
      await requestBlockedAccountReviewApi(effectiveSellerId, {
        mensaje: blockedReviewText.trim(),
        contactoAlternativo: blockedReviewContact.trim(),
      });
      setBlockedReviewSuccess(true);
    } catch (err) {
      setBlockedReviewError(err?.message || 'No se pudo enviar la solicitud de revisión.');
    } finally {
      setIsSubmittingBlockedReview(false);
    }
  };

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

  // plan_retorno_flow.md Fase 3: PagoController redirige aqui con
  // ?status=pending|failure&orderId=... cuando el pago no quedo aprobado. Se busca
  // primero en el listado ya cargado; si no aparece (recien creado, otra pestaña)
  // se trae por id directo con el endpoint nuevo.
  const [paymentBannerOrder, setPaymentBannerOrder] = useState(null);

  // Notificacion de pedido: abre el detalle apenas la lista este cargada. Se usa una
  // marca para no reabrirlo si el usuario lo cierra y la URL sigue teniendo `?pedido=`.
  const openedDeepLinkRef = useRef(null);
  // `?pedido=<id>` es el enlace que genera la campana de notificaciones y viaja en correos ya
  // enviados, asi que sigue funcionando: en vez de abrir el popup, REDIRIGE a la ruta del
  // detalle. Se hace con `replace` para que el "atras" del navegador lleve al listado y no de
  // vuelta a la URL con el parametro, que volveria a redirigir.
  //
  // No espera a que el pedido este en el listado: la ruta sabe cargarlo sola y esperar aqui
  // dejaba la notificacion sin efecto mientras el listado no hubiera llegado.
  useEffect(() => {
    if (!deepLinkOrderId) {
      openedDeepLinkRef.current = null;
      return;
    }
    if (openedDeepLinkRef.current === deepLinkOrderId) return;
    openedDeepLinkRef.current = deepLinkOrderId;
    onClearDeepLink?.('pedido');
    navigate(profileOrderPath(deepLinkOrderId), { replace: true });
  }, [deepLinkOrderId, navigate, onClearDeepLink]);
  useEffect(() => {
    if (!paymentOrderId || !paymentStatus || paymentStatus === 'success') {
      setPaymentBannerOrder(null);
      return undefined;
    }
    const found = orders.find((o) => String(o.id) === String(paymentOrderId));
    if (found) {
      setPaymentBannerOrder(found);
      return undefined;
    }
    if (!effectiveUserId) return undefined;
    let active = true;
    getBuyerOrderByIdApi(effectiveUserId, paymentOrderId)
      .then((order) => { if (active) setPaymentBannerOrder(order); })
      .catch(() => {});
    return () => { active = false; };
  }, [paymentStatus, paymentOrderId, orders, effectiveUserId]);

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
  const buyerQuestions = buyerQuestionsQuery.data || [];
  const buyerQuestionsLoading = buyerQuestionsQuery.isLoading;
  const buyerQuestionsError = buyerQuestionsQuery.error?.message || '';

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
  const handleUpdateOrderStatus = async (orderId, newStatus, pin, proveedorId) => {
    try {
      const updatedOrder = await updateOrderStatusApi(orderId, newStatus, pin, proveedorId);
      queryClient.invalidateQueries({ queryKey: isSeller ? qk.sellerOrders(effectiveSellerId) : qk.buyerOrders(effectiveUserId) });
      const merged = { ...updatedOrder, estado: updatedOrder?.estado || newStatus, status: updatedOrder?.status || newStatus };
      setSelectedOrder((prevSelected) => String(prevSelected?.id) === String(orderId)
        ? { ...prevSelected, ...merged }
        : prevSelected);
      // Al confirmar la recepcion se ofrece calificar en el acto, igual que la app.
      // Tiene que vivir aca y no en el modal porque el comprador suele marcar recibido
      // desde la TARJETA del listado, sin haber abierto el detalle.
      //
      // Se decide por el estado que DEVOLVIO el backend -el derivado-, no por el que se
      // pidio: con la recepcion por tienda, confirmar la primera deja el pedido todavia en
      // ENVIADO, y `PedidoPostVentaSupport` exige calificar TODOS los items de un pedido
      // ENTREGADO/FINALIZADO. Mirando `newStatus` el modal se abria con la segunda tienda en
      // viaje y el POST moria en 400.
      const estadoResultante = String(updatedOrder?.estado || updatedOrder?.status || newStatus).toUpperCase();
      if (!isSeller && ['ENTREGADO', 'RECEIVED'].includes(estadoResultante)) {
        const base = orders.find((candidate) => String(candidate.id) === String(orderId)) || {};
        setSelectedOrder({ ...base, ...merged });
        setRatingPromptOrderId(orderId);
      }
      return updatedOrder;
    } catch (err) {
      console.warn('No se pudo actualizar el estado del pedido:', err);
      throw err;
    }
  };

  /**
   * Igual que `handleUpdateOrderStatus` pero con semantica de COMPRADOR: lo usa el vendedor
   * cuando gestiona una de sus compras desde "Mis compras". Refresca la lista de compras y
   * ofrece calificar al recibir, sin importar que `isSeller` sea true.
   */
  const handlePurchaseUpdateStatus = async (orderId, newStatus, pin, proveedorId) => {
    try {
      const updatedOrder = await updateOrderStatusApi(orderId, newStatus, pin, proveedorId);
      queryClient.invalidateQueries({ queryKey: qk.buyerOrders(effectiveUserId) });
      const merged = { ...updatedOrder, estado: updatedOrder?.estado || newStatus, status: updatedOrder?.status || newStatus };
      setSelectedOrder((prevSelected) => String(prevSelected?.id) === String(orderId)
        ? { ...prevSelected, ...merged }
        : prevSelected);
      const estadoResultante = String(updatedOrder?.estado || updatedOrder?.status || newStatus).toUpperCase();
      if (['ENTREGADO', 'RECEIVED'].includes(estadoResultante)) {
        const base = purchases.find((candidate) => String(candidate.id) === String(orderId)) || {};
        setSelectedOrder({ ...base, ...merged });
        setRatingPromptOrderId(orderId);
      }
      return updatedOrder;
    } catch (err) {
      console.warn('No se pudo actualizar el estado de la compra:', err);
      throw err;
    }
  };

  /**
   * "Retomar pago" de un pedido que quedo en PENDIENTE.
   *
   * Equivalente de `retryOrderPayment()` del movil, sin su sondeo: alla Flow se
   * abre en un navegador incrustado y la pantalla sigue viva, asi que sondea
   * `confirmar-pago` 60 veces. Aca la pagina se va ENTERA a Flow, asi que no hay
   * donde sondear; la confirmacion se hace al volver, con el `?status=success`
   * del efecto de mas abajo.
   */
  const handleRetryPayment = async (order) => {
    const orderId = order?.id;
    if (!effectiveUserId || !orderId) return;
    const renewed = await retryOrderPaymentApi(effectiveUserId, orderId);

    // Si es un token mock de prueba o local, simula la confirmación inmediata sin redireccionar fuera
    const isMock = Boolean(renewed?.urlPago && /mock_flow_token_/i.test(renewed.urlPago));
    if (isMock) {
      try {
        const confirmed = await confirmOrderPaymentApi(effectiveUserId, orderId);
        queryClient.invalidateQueries({ queryKey: qk.buyerOrders(effectiveUserId) });
        if (confirmed && selectedOrder && String(selectedOrder.id) === String(orderId)) {
          setSelectedOrder(confirmed);
        }
        return;
      } catch (err) {
        console.warn('Error confirmando pago simulado al retomar:', err);
      }
    }

    if (!renewed?.urlPago) {
      throw new Error('No se recibió la URL de pago desde la pasarela.');
    }
    window.location.href = renewed.urlPago;
  };

  /**
   * El comprador desiste de un pedido que todavia no paga. Va por la transicion de
   * estado y no por el endpoint de cancelacion, que es del vendedor y exige motivo.
   * El backend solo lo permite en PENDIENTE: ya pagado hay que reembolsar.
   */
  const handleCancelOrder = async (order) => {
    if (!order?.id) return;
    await handleUpdateOrderStatus(order.id, 'CANCELADO');
  };

  /**
   * Deja el pedido de la pantalla con las calificaciones recien guardadas.
   *
   * La nota es POR TIENDA, asi que despues de calificar una el modal tiene que saber cuales
   * quedan: sin esto seguia ofreciendo "Calificar" en la tienda ya evaluada hasta cerrar y
   * reabrir el detalle.
   */
  // El pedido que pide la URL. Sale del listado que el panel ya carga: no hace falta otra
  // peticion, y asi el detalle y la lista miran SIEMPRE el mismo dato -- que es lo que hace que
  // al volver del detalle la tarjeta ya muestre el estado nuevo.
  // Abrir un pedido es NAVEGAR, no levantar un popup: asi el "atras" del navegador vuelve al
  // listado, la URL se puede compartir y los dialogos que el detalle abre dejan de ser un modal
  // encima de otro modal.
  const openOrderDetail = (order) => {
    if (!order?.id) return;
    navigate(profileOrderPath(order.id));
  };

  // El vendedor abre una de SUS compras: mismo patron, otra ruta y otra lista de origen.
  const openPurchaseDetail = (order) => {
    if (!order?.id) return;
    navigate(profilePurchasePath(order.id));
  };

  // El detalle abierto: puede ser un pedido recibido (`detailOrderId`) o una compra
  // (`detailPurchaseId`). Solo uno llega a la vez.
  const activeDetailId = detailOrderId || detailPurchaseId;
  const detailIsPurchase = Boolean(detailPurchaseId);
  const detailSourceList = detailIsPurchase ? purchases : orders;

  const detailFromList = activeDetailId
    ? (detailSourceList || []).find((candidate) => String(candidate.id) === String(activeDetailId))
    : null;
  // `selectedOrder` es el buffer donde los handlers escriben la respuesta del backend apenas
  // llega (confirmar por tienda, cancelar, calificar). `invalidateQueries` refresca el listado,
  // pero es asincrono: sin mezclarlo, la accion se veia con retraso -- o no se veia -- porque
  // la pagina seguia leyendo la version vieja de la lista.
  const detailOrder = !activeDetailId
    ? null
    : (selectedOrder && String(selectedOrder.id) === String(activeDetailId)
      ? { ...detailFromList, ...selectedOrder }
      : detailFromList);

  useEffect(() => {
    if (!activeDetailId) return;
    if (selectedOrder && String(selectedOrder.id) === String(activeDetailId)) return;
    if (detailFromList) setSelectedOrder(detailFromList);
    // `selectedOrder` no va en las dependencias a proposito: cada actualizacion del buffer
    // volveria a disparar el efecto y lo pisaria con la version vieja de la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDetailId, detailFromList]);

  const handleOrderRated = (updatedOrder) => {
    if (!updatedOrder?.id) return;
    queryClient.invalidateQueries({ queryKey: qk.buyerOrders(effectiveUserId) });
    setSelectedOrder((prev) => (prev && String(prev.id) === String(updatedOrder.id)
      ? { ...prev, ...updatedOrder }
      : prev));
  };

  /**
   * El comprador cancela su compra a UNA tienda
   * (`POST /pedidos/{id}/proveedores/{id}/cancelacion-comprador`).
   *
   * No se toca `estado` a mano en la copia local: con dos tiendas el pedido sigue vivo
   * mientras quede una en pie, y quien decide eso es el backend. Se mezcla lo que
   * respondió y listo.
   */
  const handleCancelBuyerSubOrder = async (order, proveedorId, { reasonDetail } = {}) => {
    const orderId = order?.id;
    if (!orderId || !proveedorId) return;
    const updated = await cancelBuyerSubOrderApi(orderId, proveedorId, { reasonDetail });
    queryClient.invalidateQueries({ queryKey: qk.buyerOrders(effectiveUserId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated }
      : prev);
    return updated;
  };

  /**
   * Cancelación formal del vendedor con motivo (`POST /proveedores/{id}/pedidos/{id}/cancelacion`).
   */
  const handleCancelSellerOrder = async (order, { reasonCode, reasonDetail } = {}) => {
    const orderId = order?.id;
    if (!effectiveSellerId || !orderId) return;
    const updated = await cancelSellerOrderApi(effectiveSellerId, orderId, { reasonCode, reasonDetail });
    queryClient.invalidateQueries({ queryKey: qk.sellerOrders(effectiveSellerId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated, estado: 'CANCELADO', status: 'CANCELADO', motivoCancelacion: reasonCode, detalleCancelacion: reasonDetail }
      : prev
    );
    return updated;
  };

  /**
   * Registro de despacho por courier con número de seguimiento y comprobante opcional (`POST /pedidos/{id}/envio`).
   */
  const handleRegisterOrderDispatch = async (order, dispatchData) => {
    const orderId = order?.id;
    if (!orderId) return;
    const updated = await registerOrderDispatchApi(orderId, dispatchData);
    queryClient.invalidateQueries({ queryKey: qk.sellerOrders(effectiveSellerId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated, estado: 'ENVIADO', status: 'ENVIADO', courier: dispatchData.courier, trackingNumber: dispatchData.trackingNumber }
      : prev
    );
    return updated;
  };

  /**
   * El vendedor sube la boleta / factura de su venta (`POST /pedidos/{id}/boleta-venta`).
   * Es obligatoria para confirmar el pedido: el modal de confirmación la exige y, tras
   * subirla, dispara la transición a EN_PREPARACION con `handleUpdateOrderStatus`.
   */
  const handleRegisterSaleReceipt = async (order, file) => {
    const orderId = order?.id;
    if (!orderId || !file) return;
    const updated = await registerSaleReceiptApi(orderId, file);
    queryClient.invalidateQueries({ queryKey: qk.sellerOrders(effectiveSellerId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated }
      : prev
    );
    return updated;
  };

  /**
   * El vendedor reporta que un courier externo (Uber Flash, Didi, un fletero propio) ya
   * entrego el pedido (`POST /pedidos/{id}/entrega-declarada`). Arranca la ventana de veto de
   * 48 horas: el pedido NO cambia de estado -sigue "Enviado"-, asi que a diferencia del resto
   * de los handlers de esta pantalla no hay un `estado`/`status` que forzar en el merge; con
   * lo que devuelve el backend (`entregaDeclaradaAt`) alcanza para que el banner aparezca.
   */
  const handleDeclareOrderDelivery = async (order) => {
    const orderId = order?.id;
    if (!orderId) return;
    const updated = await declareOrderDeliveryApi(orderId);
    queryClient.invalidateQueries({ queryKey: qk.sellerOrders(effectiveSellerId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated }
      : prev
    );
    return updated;
  };

  /**
   * El comprador vetea una entrega que el vendedor declaro: abre un reclamo con motivo fijo
   * `not_received`, el mismo que ya reconoce `MediacionBackofficeService` para clasificar el
   * caso. Un solo tap y sin pedirle que retipee nada -el comprador ya dijo con el boton mismo
   * que no la recibio-, a diferencia del reclamo libre de "Reportes/Disputa".
   */
  const handleDisputeDeclaredDelivery = async (order) => {
    const orderId = order?.id;
    if (!orderId) return;
    const updated = await createOrderClaimApi(effectiveUserId, orderId, {
      motivo: 'not_received',
      descripcion: 'El vendedor reportó que el pedido fue entregado, pero no lo recibí.',
    });
    queryClient.invalidateQueries({ queryKey: qk.buyerOrders(effectiveUserId) });
    setSelectedOrder((prev) => prev && String(prev.id) === String(orderId)
      ? { ...prev, ...updated }
      : prev
    );
    return updated;
  };

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

  // La dirección Comercial principal de BuyerAddressBook se sincroniza con
  // RT_tienda al guardarse (ver BuyerAddressBook.jsx); esto refresca storeInfo
  // en el perfil para que "Dirección Comercial de Tienda" muestre el dato
  // recién guardado sin esperar a un reload completo de la página.
  const refreshStoreInfoAfterAddressSync = useCallback(() => {
    if (!isSeller || !effectiveSellerId) return;
    queryClient.invalidateQueries({ queryKey: qk.sellerStore(effectiveSellerId) });
  }, [isSeller, effectiveSellerId, queryClient]);

  useEffect(() => {
    if (!isSeller || !isEditing || availableVehicleBrands.length) return;
    let cancelled = false;
    getVehicleBrandsApi()
      .then((brands) => {
        if (!cancelled) setAvailableVehicleBrands(Array.isArray(brands) ? brands : []);
      })
      .catch((error) => console.warn('No se pudieron cargar las marcas de vehículo:', error));
    return () => { cancelled = true; };
  }, [isSeller, isEditing, availableVehicleBrands.length]);

  const questionCountForProduct = (product) => {
    const embeddedCount = product.questionCount ?? product.preguntasCount ?? product.totalPreguntas;
    if (embeddedCount !== undefined && embeddedCount !== null) return Number(embeddedCount) || 0;
    return productQuestions.filter((question) => String(question.productoId ?? question.productId ?? question.product?.id ?? question.producto?.id ?? '') === String(product.id)).length;
  };

  const quoteConversations = useMemo(() => {
    const query = quoteSearch.trim().toLowerCase();
    return (activeQuoteSource || [])
      .filter((conversation) => !conversation.tipo || String(conversation.tipo).toLowerCase() === 'cotizacion')
      .filter((conversation) => {
        if (quoteFilter === 'pending') return !conversation.cotizacion;
        if (quoteFilter === 'sent') return Boolean(conversation.cotizacion);
        if (quoteFilter === 'unread') return Number(conversation.mensajesNoLeidos || 0) > 0;
        return true;
      })
      .filter((conversation) => {
        if (!query) return true;
        return [conversation.id, conversation.otroParticipanteNombre, conversation.productoNombre, conversation.ultimoMensaje]
          .some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const leftTime = new Date(left.ultimoMensajeFecha || left.updatedAt || 0).getTime() || 0;
        const rightTime = new Date(right.ultimoMensajeFecha || right.updatedAt || 0).getTime() || 0;
        return quoteSort === 'newest' ? rightTime - leftTime : leftTime - rightTime;
      });
  }, [activeQuoteSource, quoteFilter, quoteSearch, quoteSort]);

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

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteAccountError(null);
    const result = await deleteAccount();
    setIsDeletingAccount(false);

    if (!result.success) {
      setDeleteAccountError(result.error || 'No se pudo eliminar la cuenta. Inténtalo nuevamente.');
      return;
    }

    setShowDeleteAccountModal(false);
    onBackToStore();
  };

  const loadFeedbackHistory = async () => {
    setIsLoadingFeedbackHistory(true);
    try {
      setFeedbackHistory(await getMySystemFeedbackApi());
    } catch (error) {
      setFeedbackStatus({ type: 'error', message: error?.message || 'No pudimos cargar tu historial de feedback.' });
    } finally {
      setIsLoadingFeedbackHistory(false);
    }
  };

  const openFeedback = () => {
    setFeedbackStatus(null);
    setActiveTab('feedback');
    loadFeedbackHistory();
  };

  const handleSendFeedback = async (event) => {
    event.preventDefault();
    if (!feedbackRating || !feedbackText.trim() || isSendingFeedback) return;
    setIsSendingFeedback(true);
    setFeedbackStatus(null);
    try {
      await createSystemFeedbackApi({ calificacion: feedbackRating, comentario: feedbackText.trim() });
      setFeedbackRating(0);
      setFeedbackText('');
      setFeedbackStatus({ type: 'success', message: 'Gracias por tu feedback. Lo recibimos correctamente.' });
      await loadFeedbackHistory();
    } catch (error) {
      setFeedbackStatus({ type: 'error', message: error?.message || 'No pudimos enviar tu feedback. Inténtalo nuevamente.' });
    } finally {
      setIsSendingFeedback(false);
    }
  };

  // Mismas reglas que ya existen en el resto de la app: el chequeo de dígito
  // verificador del RUT es el que usa Retirar dinero (src/services/adapters.js),
  // y el celular sigue el formato chileno estándar (9 + 8 dígitos).
  const validateProfileForm = () => {
    const errors = {};

    if (nameDraft.trim().length < 2) {
      errors.name = 'Ingresa un nombre válido.';
    }

    if (phoneDraft.trim() && !isValidClPhone(phoneDraft)) {
      errors.phone = 'Ingresa un celular chileno válido, ej: +56 9 1234 5678.';
    }

    if (!isSeller) {
      if (!taxIdDraft.trim()) {
        errors.taxId = 'Ingresa tu RUT.';
      } else if (!isValidRut(taxIdDraft)) {
        errors.taxId = 'El RUT ingresado no es válido.';
      }
    }

    if (isSeller) {
      // La dirección comercial (con región/comuna) ya no se valida acá: se
      // edita y se valida una sola vez en BuyerAddressBook, más abajo.
      const hasShippingMethod = SHIPPING_METHOD_DEFS.some((def) => shippingSelectionsDraft[def.id]?.enabled);
      if (!hasShippingMethod) {
        errors.shippingMethods = 'Selecciona al menos un método de envío.';
      }
    }

    return errors;
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    const validationErrors = validateProfileForm();
    setFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setSaveStatus({ type: 'error', message: 'Revisa los campos marcados antes de guardar.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    const payload = {
      userName: nameDraft,
      phone: phoneDraft,
    };

    if (!isSeller) {
      payload.taxId = taxIdDraft;
    }

    // Nombre y RUT de la tienda ya no se editan desde este formulario (ver
    // bloque de solo lectura más abajo): son datos de identidad que deben
    // cambiarse a través de soporte, no con un input libre. La dirección
    // comercial (address/comunaId) tampoco se envía desde acá: BuyerAddressBook
    // ya la sincroniza directamente al guardar una dirección de despacho.
    //
    // Los métodos de envío NO van en `payload`: `ActualizarPerfilRequestDTO` no
    // tiene ese campo y el PATCH los descartaba en silencio. El único que los
    // persiste es `PUT /proveedores/{id}/shipping-methods`.
    const shippingMethodsDraft = isSeller
      ? buildShippingMethodsString(shippingSelectionsDraft)
      : null;

    let result;
    try {
      if (isSeller) {
        await updateStoreSpecialistBrandsApi(user.sellerId, specialistBrandIdsDraft);
        if (shippingMethodsDraft) {
          // Sin `.catch()`: si esto falla, el usuario tiene que enterarse. Antes se
          // tragaba el error y el aviso de "actualizado correctamente" salía igual,
          // que es justo el modo de falla silenciosa que este endpoint vino a cerrar.
          await updateSellerShippingMethodsApi(user.sellerId, shippingMethodsDraft);
        }
      }
      result = await updateProfile(payload);
    } catch (error) {
      setIsSaving(false);
      setSaveStatus({ type: 'error', message: error?.message || 'No se pudo actualizar la información de la tienda.' });
      return;
    }
    setIsSaving(false);

    if (result.success) {
      // El backend es la fuente autoritativa de la tienda (comuna/región vienen
      // con nombre resuelto), así que se refetchea storeInfo desde React Query.
      if (isSeller && effectiveSellerId) {
        queryClient.invalidateQueries({ queryKey: qk.sellerStore(effectiveSellerId) });
      }
      setSaveStatus({ type: 'success', message: 'Los datos de tu tienda y perfil se actualizaron correctamente.' });
      setIsEditing(false);
    } else {
      setSaveStatus({ type: 'error', message: result.error || 'No se pudo actualizar la información.' });
    }
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
        action: () => { setSelectedOrder(ord); }
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
              <button type="button" className="profile-nav-item profile-nav-delete" onClick={() => { setDeleteAccountError(null); setShowDeleteAccountModal(true); }}>
                <Trash2 size={17} /><span>Eliminar cuenta</span>
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

          {isSellerBlocked && (
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
                    Tu tienda se encuentra bloqueada
                  </strong>
                  <p style={{ margin: '3px 0 0', color: '#b91c1c', fontSize: '13px', lineHeight: 1.4 }}>
                    {blockReason} Mientras esté suspendida no podrás recibir nuevos pedidos ni publicar productos.
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
                onClick={() => {
                  setBlockedReviewError(null);
                  setBlockedReviewSuccess(false);
                  setBlockedReviewText('');
                  setBlockedReviewContact('');
                  setShowBlockedReviewModal(true);
                }}
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
                <div className="profile-overview-grid">
                  {/* Columna principal */}
                  <div className="profile-overview-main-col">
                    {/* 1. KPIs del rol */}
                    <div className="profile-stats-grid-v2">
                      {overviewStats.map((stat) => {
                        const Icon = stat.icon;
                        return (
                          <button
                            key={stat.id}
                            type="button"
                            className={`profile-stat-card-v2 stat-v2-${stat.tone}`}
                            onClick={stat.onClick}
                          >
                            <div className="stat-v2-top">
                              <span className="stat-v2-label">{stat.label}</span>
                              <span className="stat-v2-icon"><Icon size={20} /></span>
                            </div>
                            <strong className="stat-v2-val">{stat.value}</strong>
                            <span className="stat-v2-action">
                              {stat.actionLabel} <ArrowUpRight size={13} />
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* 2. Acciones rápidas */}
                    <section className="profile-panel-clean">
                      <h2 className="profile-section-title">Acciones rápidas</h2>
                      <div className="quick-actions-grid-v2">
                        {overviewActions.map((action) => {
                          const Icon = action.icon;
                          return (
                            <button
                              key={action.id}
                              type="button"
                              className="quick-action-card-v2"
                              onClick={action.onClick}
                            >
                              <span className={`action-v2-icon bg-${action.tone}-subtle`}><Icon size={20} /></span>
                              <span className="action-v2-body">
                                <strong>{action.title}</strong>
                                <span className="action-v2-desc">{action.description}</span>
                              </span>
                              <ChevronRight size={16} className="action-v2-arrow" />
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {/* 3. Actividad reciente */}
                    <section className="profile-panel-clean">
                      <div className="profile-panel-header-row">
                        <h2 className="profile-section-title">Actividad reciente</h2>
                        <button type="button" className="btn-view-details" onClick={() => setActiveTab('pedidos')}>
                          Ver todo
                        </button>
                      </div>

                      {recentActivities.length === 0 ? (
                        <EmptyState label="Aún no hay actividad reciente registrada." />
                      ) : (
                        <div className="activity-feed-table">
                          <div className="activity-feed-header">
                            <span>Actividad</span>
                            <span>Detalle</span>
                            <span>Fecha</span>
                          </div>
                          <div className="activity-feed-rows">
                            {recentActivities.map((act) => (
                              <button
                                key={act.id}
                                type="button"
                                className="activity-feed-row"
                                onClick={act.action}
                              >
                                <span className="activity-type-col">
                                  <span className={`activity-dot ${act.badgeClass}`} />
                                  <strong>{act.title}</strong>
                                </span>
                                <span className="activity-detail-col">{act.detail}</span>
                                <span className="activity-date-col">{formatRelativeTime(act.date)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  </div>

                  {/* Columna lateral (widgets de apoyo) */}
                  <aside className="profile-overview-side-col">
                    {isSeller && (
                      <CapturerContactCard capturer={user?.captadorCasaRepuestos} context="store" />
                    )}

                    {/* El resumen de compras se mantiene para compradores. El
                        rendimiento de la tienda no se muestra hasta contar con
                        datos reales del backend. */}
                    {!isSeller && <div className="overview-widget-card">
                      <div className="widget-header-row">
                        <h3>{isSeller ? 'Rendimiento de la tienda' : 'Resumen de tus compras'}</h3>
                        <span className="widget-tag">Este mes</span>
                      </div>
                      <div className="widget-metric-box">
                        <span className="metric-label">{isSeller ? 'Ventas' : 'Total comprado'}</span>
                        <strong className="metric-value">${formatCLP(ordersThisMonthTotal)}</strong>
                        <span className="metric-sub">
                          {isSeller
                            ? `${orders?.length ?? 0} pedidos recibidos en total`
                            : `${orders?.length ?? 0} pedidos realizados en total`}
                        </span>
                      </div>
                      <div className="widget-metric-split">
                        <div>
                          <span className="metric-label">{isSeller ? 'Por responder' : 'En camino'}</span>
                          <strong>{isSeller ? quoteSummary.pending : shippingOrdersCount}</strong>
                        </div>
                        <div>
                          <span className="metric-label">{isSeller ? 'Sin leer' : 'Cotizaciones'}</span>
                          <strong>{isSeller ? quoteSummary.unread : quoteSummary.total}</strong>
                        </div>
                      </div>
                    </div>}

                    {/* Widget 2: checklist de la cuenta */}
                    <div className="overview-widget-card">
                      <div className="widget-header-row">
                        <h3>{isSeller ? 'Completa tu tienda' : 'Completa tu perfil'}</h3>
                      </div>
                      <div className="onboarding-progress-meta">
                        <span>{completedOnboardingCount} de {onboardingSteps.length} completado</span>
                        <div
                          className="onboarding-progress-bar"
                          role="progressbar"
                          aria-valuenow={completedOnboardingCount}
                          aria-valuemin={0}
                          aria-valuemax={onboardingSteps.length}
                        >
                          <div
                            className="onboarding-progress-fill"
                            style={{ width: `${onboardingSteps.length ? (completedOnboardingCount / onboardingSteps.length) * 100 : 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="onboarding-steps-list">
                        {onboardingSteps.map((step) => (
                          <button
                            key={step.id}
                            type="button"
                            className={`onboarding-step-row ${step.completed ? 'completed' : 'pending'}`}
                            onClick={step.action}
                          >
                            {step.completed ? (
                              <CheckCircle2 size={17} className="step-icon-done" />
                            ) : (
                              <Circle size={17} className="step-icon-todo" />
                            )}
                            <span>{step.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Widget 3: consejos según rol */}
                    <div className="overview-widget-card tips-widget">
                      <div className="tips-widget-icon-row">
                        <Lightbulb size={18} className="tips-icon" />
                        <h4>{isSeller ? 'Consejos para vender más' : 'Consejos para comprar mejor'}</h4>
                      </div>
                      <p className="tips-widget-text">
                        {isSeller
                          ? 'Responde rápido a las cotizaciones y mantén tu catálogo actualizado con fotos nítidas para aumentar tus ventas.'
                          : 'Consulta por patente para filtrar repuestos compatibles y pide cotizaciones a varias tiendas antes de comprar.'}
                      </p>
                      <button type="button" className="tips-widget-link" onClick={() => navigate(ROUTES.support)}>
                        Ver más consejos <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </aside>
                </div>
              )}

              {/* `/perfil/pedidos/:orderId` y `/perfil/compras/:orderId`: el detalle ocupa el
                  lugar del listado, dentro del panel. Una compra del vendedor se ve SIEMPRE en
                  modo comprador. */}
              {(activeTab === 'pedidos' || activeTab === 'compras') && activeDetailId ? (
                detailOrder ? (
                  (() => {
                    const asBuyerView = detailIsPurchase || !isSeller;
                    return (
                      <OrderDetailView
                        layout="page"
                        order={detailOrder}
                        mode={asBuyerView ? 'buyer' : 'seller'}
                        sellerId={effectiveSellerId}
                        userId={effectiveUserId}
                        onClose={() => navigate(detailIsPurchase ? `${ROUTES.profile}/compras` : `${ROUTES.profile}/pedidos`)}
                        onUpdateStatus={detailIsPurchase ? handlePurchaseUpdateStatus : handleUpdateOrderStatus}
                        onRetryPayment={asBuyerView ? handleRetryPayment : undefined}
                        onCancelOrder={asBuyerView ? handleCancelOrder : undefined}
                        onCancelBuyerSubOrder={asBuyerView ? handleCancelBuyerSubOrder : undefined}
                        autoOpenRating={asBuyerView && ratingPromptOrderId != null && String(detailOrder.id) === String(ratingPromptOrderId)}
                        onRatingPromptShown={() => setRatingPromptOrderId(null)}
                        onOrderRated={handleOrderRated}
                        onCancelSellerOrder={!asBuyerView && !isSellerBlocked ? handleCancelSellerOrder : undefined}
                        onRegisterDispatch={!asBuyerView && !isSellerBlocked ? handleRegisterOrderDispatch : undefined}
                        onRegisterSaleReceipt={!asBuyerView && !isSellerBlocked ? handleRegisterSaleReceipt : undefined}
                        onDeclareDelivery={!asBuyerView && !isSellerBlocked ? handleDeclareOrderDelivery : undefined}
                        onDisputeDeclaredDelivery={asBuyerView ? handleDisputeDeclaredDelivery : undefined}
                        readOnly={!asBuyerView && isSellerBlocked}
                      />
                    );
                  })()
                ) : (
                  <div className="profile-panel">
                    {(detailIsPurchase ? purchasesQuery.isLoading : ordersQuery.isLoading)
                      ? <EmptyState label={detailIsPurchase ? 'Cargando la compra…' : 'Cargando el pedido…'} />
                      : <EmptyState label="No encontramos ese pedido en tu cuenta." />}
                  </div>
                )
              ) : activeTab === 'pedidos' && (
                isSeller ? (
                  <SellerOrdersPanel
                    orders={orders || []}
                    sellerId={user?.sellerId}
                    onSelectOrder={openOrderDetail}
                    onUpdateStatus={handleUpdateOrderStatus}
                    onRegisterSaleReceipt={isSellerBlocked ? undefined : handleRegisterSaleReceipt}
                    readOnly={isSellerBlocked}
                  />
                ) : (
                  <div className="profile-panel">
                    {paymentStatus && paymentStatus !== 'success' && (
                      <div
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20,
                          padding: '14px 16px', borderRadius: 12,
                          background: paymentStatus === 'pending' ? '#fffbeb' : '#fef2f2',
                          border: `1px solid ${paymentStatus === 'pending' ? '#fcd34d' : '#fca5a5'}`,
                        }}
                      >
                        <AlertTriangle size={18} color={paymentStatus === 'pending' ? '#b45309' : '#b91c1c'} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                          <strong>{paymentStatus === 'pending' ? 'Estamos confirmando tu pago' : 'Tu pago no pudo procesarse'}</strong>
                          <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#4b5563' }}>
                            {paymentStatus === 'pending'
                              ? 'En unos minutos verás el estado actualizado en este pedido.'
                              : 'Revisa el detalle del pedido para reintentar el pago.'}
                          </p>
                        </div>
                        {paymentBannerOrder && (
                          <button
                            type="button"
                            className="btn-view-details"
                            onClick={() => setSelectedOrder(paymentBannerOrder)}
                          >
                            Ver pedido
                          </button>
                        )}
                      </div>
                    )}
                    <h2 className="profile-panel-title">Mis Pedidos</h2>
                    {(orders || []).length === 0 ? <EmptyState label="Aún no has realizado pedidos." /> : <div className="profile-orders-cards-grid">{orders.map((order) => <OrderCard key={order.id} order={order} mode="buyer" onSelectOrder={openOrderDetail} onUpdateStatus={handleUpdateOrderStatus} onRetryPayment={handleRetryPayment} onCancelOrder={handleCancelOrder} />)}</div>}
                  </div>
                )
              )}

              {/* "Mis compras" del vendedor: los pedidos donde ES el comprador, con la MISMA
                  vista que un comprador (tarjetas + detalle en modo buyer). */}
              {activeTab === 'compras' && isSeller && !activeDetailId && (
                <div className="profile-panel">
                  <h2 className="profile-panel-title"><ShoppingCart size={20} /> Mis compras</h2>
                  <p style={{ margin: '4px 0 16px', color: '#64748b', fontSize: '13.5px' }}>
                    Los repuestos que has comprado a otras tiendas. Se gestionan igual que cualquier compra.
                  </p>
                  {purchasesQuery.isLoading
                    ? <EmptyState label="Cargando tus compras…" />
                    : (purchases || []).length === 0
                      ? <EmptyState label="Aún no has comprado repuestos a otras tiendas." />
                      : (
                        <div className="profile-orders-cards-grid">
                          {purchases.map((order) => (
                            <OrderCard
                              key={order.id}
                              order={order}
                              mode="buyer"
                              onSelectOrder={openPurchaseDetail}
                              onUpdateStatus={handlePurchaseUpdateStatus}
                              onRetryPayment={handleRetryPayment}
                              onCancelOrder={handleCancelOrder}
                            />
                          ))}
                        </div>
                      )}
                </div>
              )}

              {activeTab === 'mis_preguntas' && (
                <div className="profile-panel">
                  <div className="profile-panel-header-row">
                    <div>
                      <h2 className="profile-panel-title">
                        <MessageCircleQuestion size={20} /> Mis Preguntas en Productos
                      </h2>
                      <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13.5px' }}>
                        Revisa las consultas que has realizado en las publicaciones de las tiendas y sus respuestas.
                      </p>
                    </div>
                  </div>

                  {buyerQuestionsError && (
                    <div className="auth-alert alert-error" style={{ margin: '14px 0' }}>
                      <X size={16} />
                      <span>{buyerQuestionsError}</span>
                    </div>
                  )}

                  {buyerQuestionsLoading ? (
                    <LoadingRow />
                  ) : buyerQuestions.length === 0 ? (
                    <EmptyState label="Aún no has realizado preguntas en productos publicados." />
                  ) : (
                    <div className="seller-question-list" style={{ marginTop: '16px' }}>
                      {buyerQuestions.map((q, idx) => {
                        const hasAnswer = Boolean(q.respuesta || q.answer);
                        return (
                          <div className="seller-question-item" key={q.id || idx} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
                            <div className="seller-question-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span className={hasAnswer ? 'answered' : 'pending'} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', backgroundColor: hasAnswer ? '#dcfce7' : '#fef9c3', color: hasAnswer ? '#15803d' : '#a16207' }}>
                                {hasAnswer ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                                {hasAnswer ? 'Respondida por la tienda' : 'Esperando respuesta'}
                              </span>
                              <small style={{ color: '#94a3b8', fontSize: '12px' }}>
                                {q.fechaPregunta || q.createdAt ? new Date(q.fechaPregunta || q.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                              </small>
                            </div>
                            {/* El producto con su foto y un enlace de vuelta: una pregunta
                                sirve para decidir la compra, asi que desde aca hay que
                                poder volver a la ficha. `ProductoPreguntaResponseDTO` ya
                                trae nombre, imagen e id; antes solo se usaba el nombre.
                                El SKU se omite a proposito: al comprador no le dice nada. */}
                            <div className="buyer-question-product">
                              {q.productoImagenUrl && (
                                <img src={resolveMediaUrl(q.productoImagenUrl)} alt="" />
                              )}
                              <h4>
                                {q.productoId ? (
                                  <Link to={productPath({ id: q.productoId, titulo: q.productoNombre })}>
                                    {q.productoNombre || q.productName || q.producto?.nombrePublicado || 'Repuesto'}
                                  </Link>
                                ) : (
                                  q.productoNombre || q.productName || q.producto?.nombrePublicado || 'Repuesto'
                                )}
                              </h4>
                            </div>
                            <p style={{ margin: '0 0 10px', fontSize: '13.5px', color: '#334155' }}>
                              <strong>Tu pregunta:</strong> {q.pregunta || q.texto || q.question}
                            </p>
                            {hasAnswer ? (
                              <div style={{ backgroundColor: '#f8fafc', borderLeft: '3px solid #0066ff', padding: '10px 14px', borderRadius: '0 8px 8px 0' }}>
                                <strong style={{ display: 'block', fontSize: '12px', color: '#0066ff', marginBottom: '2px' }}>
                                  Respuesta de {q.tiendaNombre || 'la tienda'}:
                                </strong>
                                <p style={{ margin: 0, fontSize: '13px', color: '#1e293b' }}>
                                  {q.respuesta || q.answer}
                                </p>
                              </div>
                            ) : (
                              <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                                La tienda aún no ha respondido tu consulta. Te notificaremos en cuanto haya una respuesta.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                <div className="profile-panel">
                  <h2 className="profile-panel-title">Mi Tienda</h2>
                  {storeInfo ? (
                    <div className="profile-store-card">
                      <div className="store-card-header">
                        <div className="store-card-icon"><Building2 size={22} /></div>
                        <div>
                          <strong>{storeInfo.storeName || displayName}</strong>
                          <span>{[storeInfo.comuna, storeInfo.region].filter(Boolean).join(', ') || 'Ubicación no registrada'}</span>
                        </div>
                      </div>
                      <div className="store-card-stats">
                        <div><Layers size={14} /> {inventorySummary?.total ?? 0} productos</div>
                        <div><Star size={14} /> {storeInfo.rating ? Number(storeInfo.rating).toFixed(1) : '—'} calificación ({storeInfo.reviewCount ?? 0})</div>
                      </div>
                      {storeInfo.shippingMethods && (
                        <div className="seller-shipping-row" style={{ borderTop: 'none', paddingTop: 0, marginTop: 4 }}>
                          <Truck size={14} className="shipping-truck-icon" />
                          <div className="shipping-methods-pills">
                            {String(storeInfo.shippingMethods).split(',').map((m, i) => (
                              <span key={i} className="shipping-method-pill">{m.trim()}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <EmptyState label="No se pudo cargar la información de tu tienda." />
                  )}
                </div>
              )}

              {activeTab === 'productos' && isSeller && (
                <div className="profile-panel">
                  <div className="profile-panel-header-row">
                    <h2 className="profile-panel-title">
                      Catálogo Publicado {catalogTotalElements > 0 && <span className="catalog-total-badge">{catalogTotalElements}</span>}
                    </h2>
                    <div className="catalog-header-actions">
                      <form className="catalog-search-form" onSubmit={handleCatalogSearchSubmit}>
                        <Search size={14} />
                        <input
                          type="text"
                          placeholder="Buscar por nombre o SKU..."
                          value={catalogSearchInput}
                          onChange={(e) => setCatalogSearchInput(e.target.value)}
                        />
                      </form>
                      <button type="button" className="catalog-add-product-button" onClick={() => setShowNewProductModal(true)}>
                        <Plus size={16} /> Agregar producto
                      </button>
                    </div>
                  </div>

                  <div className="catalog-bulk-inventory-notice">
                    <div className="catalog-bulk-inventory-icon"><Boxes size={19} /></div>
                    <p><strong>¿Necesitas cargar o editar muchos productos?</strong><span>Para cargas masivas y ediciones masivas de tu inventario, ingresa al Panel de inventario.</span></p>
                    <a href={inventoryPanelUrl} target="_blank" rel="noreferrer">Ir al panel <ArrowUpRight size={15} /></a>
                  </div>

                  <div className="catalog-top-info">
                    <ProductTopBadge compact className="catalog-top-info-badge" />
                    <p><strong>Destaca tus productos Top Ventas</strong><span>Las primeras 2 activaciones son gratis. Puedes mantener hasta 10 productos Top; la insignia y la prioridad duran 30 días y luego puedes renovarlas con Monedas.</span></p>
                  </div>

                  {catalogTopFeedback && (
                    <div className="catalog-top-feedback"><CheckCircle size={15} /> {catalogTopFeedback}</div>
                  )}

                  <div className="catalog-range-filter">
                    <span>Mostrar por página:</span>
                    {CATALOG_PAGE_SIZE_OPTIONS.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`catalog-range-pill ${catalogPageSize === size ? 'active' : ''}`}
                        onClick={() => handleCatalogPageSizeChange(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>

                  {catalogError && (
                    <div className="auth-alert alert-error" style={{ margin: '0 0 16px' }}>
                      <X size={16} />
                      <span>{catalogError}</span>
                    </div>
                  )}

                  {isCatalogLoading ? (
                    <LoadingRow />
                  ) : (sellerProducts || []).length === 0 ? (
                    <EmptyState label={catalogSearchTerm ? `Sin resultados para "${catalogSearchTerm}".` : 'Aún no has publicado productos en tu catálogo.'} />
                  ) : (
                    <>
                      <div className="profile-orders-cards-grid seller-catalog-grid">
                        {sellerProducts.map((p) => (
                          <CatalogCard
                            key={p.id}
                            product={p}
                            questionCount={questionCountForProduct(p)}
                            onSelectProduct={(item) => setSelectedCatalogProduct(item)}
                            onQuickEditStock={(item) => setSelectedCatalogProduct(item)}
                            onOpenQuestions={(item) => {
                              setQuestionsProductFilter(item.id);
                              setActiveTab('preguntas_productos');
                            }}
                            onToggleTop={handleToggleProductTop}
                            isUpdatingTop={updatingTopProductId === p.id}
                            onTogglePause={handleToggleProductPause}
                            isUpdatingPause={updatingPauseProductId === p.id}
                          />
                        ))}
                      </div>

                      {catalogTotalPages > 1 && (
                        <div className="catalog-pagination">
                          <button
                            type="button"
                            className="catalog-page-btn"
                            disabled={catalogPage === 0}
                            onClick={() => setCatalogPage((p) => Math.max(0, p - 1))}
                          >
                            <ChevronLeft size={16} /> Anterior
                          </button>
                          <span className="catalog-page-indicator">
                            Página {catalogPage + 1} de {catalogTotalPages}
                          </span>
                          <button
                            type="button"
                            className="catalog-page-btn"
                            disabled={catalogPage >= catalogTotalPages - 1}
                            onClick={() => setCatalogPage((p) => Math.min(catalogTotalPages - 1, p + 1))}
                          >
                            Siguiente <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
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
                <div className="profile-panel seller-quotes-panel">
                  <div className="seller-quotes-heading">
                    <div>
                      <span className="seller-quotes-eyebrow"><ReceiptText size={14} /> {quotesAsBuyer ? 'Conversaciones de cotización' : 'Centro de cotizaciones'}</span>
                      <h2 className="profile-panel-title">{quotesAsBuyer ? 'Mis cotizaciones' : 'Cotizaciones de compradores'}</h2>
                      <p>{quotesAsBuyer ? 'Revisa las respuestas de las tiendas, conversa y consulta cada propuesta con su vigencia y condiciones.' : 'Revisa solicitudes, responde con tus condiciones comerciales y mantén cada oferta vinculada a su conversación.'}</p>
                    </div>
                    <div className="seller-quotes-heading-actions">
                      {!quotesAsBuyer && <span className="seller-quotes-total-badge">{quoteSummary.total} {quoteSummary.total === 1 ? 'solicitud' : 'solicitudes'}</span>}
                      <button type="button" className="seller-quotes-sort" onClick={() => setQuoteSort((current) => current === 'newest' ? 'oldest' : 'newest')}>
                        <Sliders size={15} /> {quoteSort === 'newest' ? 'Más recientes' : 'Más antiguas'}
                      </button>
                    </div>
                  </div>

                  <div className="seller-quotes-summary">
                    <article><MessageSquare size={18} /><span><strong>{quoteSummary.total}</strong>Total</span></article>
                    <article className="is-pending"><Clock size={18} /><span><strong>{quoteSummary.pending}</strong>Por responder</span></article>
                    <article className="is-sent"><Send size={18} /><span><strong>{quoteSummary.sent}</strong>Ofertas enviadas</span></article>
                    <article className="is-unread"><Inbox size={18} /><span><strong>{quoteSummary.unread}</strong>Mensajes sin leer</span></article>
                  </div>

                  <div className="seller-quotes-toolbar">
                    <label className="seller-quotes-search"><Search size={15} /><input value={quoteSearch} onChange={(event) => setQuoteSearch(event.target.value)} placeholder={quotesAsBuyer ? 'Buscar tienda, producto o cotización...' : 'Buscar comprador, producto o cotización...'} />{quoteSearch && <button type="button" onClick={() => setQuoteSearch('')} aria-label="Limpiar búsqueda"><X size={13} /></button>}</label>
                    <div className="seller-quotes-filters" role="group" aria-label="Filtrar cotizaciones">
                      {[['all', 'Todas'], ['pending', 'Sin responder'], ['sent', 'Enviadas'], ['unread', 'Sin leer']].map(([value, label]) => (
                        <button key={value} type="button" className={quoteFilter === value ? 'active' : ''} onClick={() => setQuoteFilter(value)}>{label}</button>
                      ))}
                    </div>
                  </div>

                  {quoteSummary.total === 0 ? (
                    <EmptyState label={quotesAsBuyer ? 'Aún no has pedido cotizaciones a otras tiendas.' : 'Aún no tienes solicitudes de cotización.'} />
                  ) : quoteConversations.length === 0 ? (
                    <EmptyState label="No encontramos cotizaciones con esos filtros." />
                  ) : (
                    <div className="profile-orders-cards-grid seller-quotes-grid">
                      {quoteConversations.map((c) => (
                        <QuoteCard
                          key={c.id}
                          quote={c}
                          mode={quotesAsBuyer ? 'buyer' : 'seller'}
                          onSelectQuote={(item) => setSelectedQuote(item)}
                          onQuickRespond={(item) => setSelectedQuote(item)}
                        />
                      ))}
                    </div>
                  )}
                </div>
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

              {activeTab === 'feedback' && (
                <section className="profile-panel profile-feedback-panel" aria-labelledby="profile-feedback-title">
                  <div className="profile-panel-header-row"><div><h2 id="profile-feedback-title" className="profile-panel-title"><MessageSquare size={19} /> Dejar feedback</h2><p>Tu opinión nos ayuda a mejorar RepuesTop.</p></div></div>
                  <div className="profile-feedback-tabs" role="tablist" aria-label="Feedback del sistema">
                    <button type="button" role="tab" aria-selected={feedbackTab === 'nuevo'} className={feedbackTab === 'nuevo' ? 'active' : ''} onClick={() => setFeedbackTab('nuevo')}>Dejar comentario</button>
                    <button type="button" role="tab" aria-selected={feedbackTab === 'historial'} className={feedbackTab === 'historial' ? 'active' : ''} onClick={() => { setFeedbackTab('historial'); loadFeedbackHistory(); }}>Mi historial</button>
                  </div>
                  {feedbackTab === 'nuevo' ? (
                    <form className="profile-feedback-form" onSubmit={handleSendFeedback}>
                      <fieldset className="profile-feedback-rating"><legend>¿Cómo calificarías el sistema?</legend><div>{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={value <= feedbackRating ? 'selected' : ''} onClick={() => setFeedbackRating(value)} aria-label={`${value} de 5 estrellas`}><Star size={22} fill="currentColor" /></button>)}</div></fieldset>
                      <label htmlFor="profile-feedback-message">Tu comentario<textarea id="profile-feedback-message" value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Escribe aquí tu sugerencia, comentario o problema que encontraste..." maxLength={1500} required /></label>
                      <div className="profile-feedback-footer"><span>{feedbackText.length}/1500</span><button type="submit" className="btn-auth-primary" disabled={!feedbackRating || !feedbackText.trim() || isSendingFeedback}>{isSendingFeedback ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}{isSendingFeedback ? 'Enviando...' : 'Enviar feedback'}</button></div>
                    </form>
                  ) : (
                    <div className="profile-feedback-history">
                      {isLoadingFeedbackHistory ? <p> Cargando tu historial…</p> : feedbackHistory.length === 0 ? <p>Aún no has registrado feedback.</p> : feedbackHistory.map((item) => <article key={item.id}><div><span className="profile-feedback-stars">{'★'.repeat(item.calificacion)}{'☆'.repeat(5 - item.calificacion)}</span><time>{item.fechaCreacion ? new Date(item.fechaCreacion).toLocaleDateString('es-CL') : ''}</time></div><p>{item.comentario}</p></article>)}
                    </div>
                  )}
                  {feedbackStatus && <p className={`profile-feedback-status ${feedbackStatus.type}`}>{feedbackStatus.message}</p>}
                </section>
              )}

              {(activeTab === 'tienda_datos' || activeTab === 'datos') && (
                <div className="profile-panel">
                  <div className="profile-panel-header-row">
                    <h2 className="profile-panel-title">
                      {isSeller ? 'Mi Tienda, Perfil y Datos Bancarios' : 'Mis Datos y Perfil'}
                    </h2>
                    {!isEditing && (
                      <button
                        className="btn-edit-profile"
                        onClick={() => {
                          setIsEditing(true);
                          setSaveStatus(null);
                          setFormErrors({});
                          setNameDraft(user?.userName || user?.nombre || '');
                          setPhoneDraft(user?.phone || user?.telefono || '');
                          setTaxIdDraft(storeInfo?.taxId || user?.taxId || '');
                          setShippingSelectionsDraft(parseShippingSelections(storeInfo?.shippingMethods));
                          setSpecialistBrandIdsDraft((storeInfo?.marcasEspecialistas || []).map((brand) => String(brand.id)));
                        }}
                      >
                        <Pencil size={14} /> Editar Información
                      </button>
                    )}
                  </div>

                  {saveStatus && (
                    <div className={`auth-alert ${saveStatus.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ margin: '0 0 16px' }}>
                      {saveStatus.type === 'success' ? <Check size={16} /> : <X size={16} />}
                      <span>{saveStatus.message}</span>
                    </div>
                  )}

                  {isEditing ? (
                    <form className="profile-data-form unified-profile-form" onSubmit={handleSaveProfile}>
                      <div className="form-section-title">Datos Personales y de Contacto</div>
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label>
                            {isSeller ? 'Nombre Completo / Representante' : 'Nombre Completo'}
                            <span className="char-counter">{nameDraft.length}/80</span>
                          </label>
                          <input
                            type="text"
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            maxLength={80}
                            required
                            className={formErrors.name ? 'input-invalid' : ''}
                          />
                          {formErrors.name && <small className="field-error-text">{formErrors.name}</small>}
                        </div>
                        <div className="form-group">
                          <label>
                            Teléfono Móvil
                            <span className="char-counter">{phoneDraft.length}/20</span>
                          </label>
                          <input
                            type="tel"
                            inputMode="tel"
                            value={phoneDraft}
                            onChange={(e) => setPhoneDraft(sanitizePhoneInput(e.target.value))}
                            placeholder="+56 9 1234 5678"
                            maxLength={20}
                            className={formErrors.phone ? 'input-invalid' : ''}
                          />
                          {formErrors.phone && <small className="field-error-text">{formErrors.phone}</small>}
                          <small className="form-helper-text">Solo números y, al inicio, el signo + (código de país).</small>
                        </div>
                      </div>
                      {!isSeller && (
                        <div className="form-group">
                          <label>
                            RUT / Identificador Fiscal
                            <span className="char-counter">{taxIdDraft.length}/12</span>
                          </label>
                          <input
                            type="text"
                            value={taxIdDraft}
                            onChange={(e) => setTaxIdDraft(formatRut(e.target.value))}
                            placeholder="12.345.678-K"
                            maxLength={12}
                            required
                            className={formErrors.taxId ? 'input-invalid' : ''}
                          />
                          {formErrors.taxId && <small className="field-error-text">{formErrors.taxId}</small>}
                        </div>
                      )}

                      {/* La dirección comercial de despacho (con región/comuna) ya se
                          edita una sola vez, más abajo, en "Gestión de Direcciones" — ese
                          widget sincroniza automáticamente comuna/región con la tienda al
                          guardar (ver refreshStoreInfoAfterAddressSync). Repetirla acá
                          arriba como un segundo input de texto libre era una segunda fuente
                          de verdad para el mismo dato, y confundía cuál mandaba. */}

                      {isSeller && (
                        <>
                          <div className="form-section-title" style={{ marginTop: '20px' }}>Datos de la Tienda</div>
                          {/* Nombre y RUT son la identidad legal de la tienda ya verificada:
                              se muestran de solo lectura y cualquier cambio pasa por soporte,
                              en vez de un input libre que permitiría alterarlos sin control. */}
                          <div className="form-grid-2">
                            <div className="form-group">
                              <label>Nombre de la Tienda</label>
                              <div className="form-locked-value">
                                <Lock size={13} />
                                <span>{storeInfo?.storeName || user?.storeName || '—'}</span>
                              </div>
                            </div>
                            <div className="form-group">
                              <label>RUT de la Tienda / Identificador Fiscal</label>
                              <div className="form-locked-value">
                                <Lock size={13} />
                                <span>{storeInfo?.taxId || user?.taxId || '—'}</span>
                              </div>
                            </div>
                          </div>
                          <small className="form-helper-text">
                            Para corregir el nombre o RUT de tu tienda, contáctanos desde{' '}
                            <button type="button" className="form-helper-inline-link" onClick={() => { setIsEditing(false); navigate(helpContactPath()); }}>
                              Centro de ayuda
                            </button>.
                          </small>

                          <div className="form-group" style={{ marginTop: '16px' }}>
                            <label>Métodos de Envío Aceptados</label>
                            <ShippingMethodsPicker
                              selections={shippingSelectionsDraft}
                              onChange={setShippingSelectionsDraft}
                            />
                            {formErrors.shippingMethods && <small className="field-error-text">{formErrors.shippingMethods}</small>}
                            <small className="form-helper-text">Elige los métodos que ofrece tu tienda. Deja el precio en blanco si es gratuito.</small>
                          </div>

                          <div className="form-group">
                            <label>Marcas especialistas</label>
                            <button
                              type="button"
                              className="btn-manage-specialist-brands"
                              onClick={() => {
                                setSpecialistBrandSearch('');
                                setShowSpecialistBrandsModal(true);
                              }}
                            >
                              <span>Ver marcas</span>
                              <strong>{specialistBrandIdsDraft.length} seleccionada{specialistBrandIdsDraft.length === 1 ? '' : 's'}</strong>
                            </button>
                            <small className="form-helper-text">Selecciona las marcas de vehículo con las que trabaja tu tienda.</small>
                          </div>

                          <div className="form-section-title" style={{ marginTop: '16px' }}>Datos de Cuenta Bancaria de Cobro</div>
                          <div className="withdrawal-info-banner">
                            <Info size={18} />
                            <span>Los datos bancarios se validan y guardan desde el apartado Retirar dinero.</span>
                            <button type="button" className="withdrawal-bank-button" onClick={() => { setIsEditing(false); setActiveTab('retiros'); }}>
                              <Wallet size={16} /> Gestionar cuenta bancaria
                            </button>
                          </div>
                        </>
                      )}

                      {/* La libreta de direcciones se gestiona solo en la vista principal
                          ("Ubicación y Logística de Despacho"): se guarda sola con sus
                          propios botones, no con "Guardar Información" de este formulario,
                          así que repetirla acá adentro era el mismo widget dos veces. */}

                      <div className="profile-data-form-actions" style={{ marginTop: '20px' }}>
                        <button type="button" className="btn-auth-secondary" onClick={() => { setIsEditing(false); setFormErrors({}); }}>
                          Cancelar
                        </button>
                        <button type="submit" className="btn-auth-primary" disabled={isSaving} style={{ width: 'auto' }}>
                          <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar Información'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="store-unified-container">
                      {/* La identidad (nombre, estado de verificación, tag de fundador) ya
                          se muestra en el hero de portada de arriba; repetirla aquí en un
                          segundo banner era información duplicada. */}

                      {/* Modular Grid of Cards */}
                      <div className="store-profile-unified-grid">
                        {/* Card: Identidad y Contacto (fusiona los datos comerciales del
                            representante con sus datos de contacto personal) */}
                        <div className="details-card-block store-section-card">
                          <div className="details-card-header-row">
                            <h3 className="section-subtitle">
                              <span className="section-subtitle-icon"><Building2 size={16} /></span>
                              <span>{isSeller ? 'Identidad y Contacto' : 'Mis Datos'}</span>
                            </h3>
                            {/* Único punto de entrada para cambiar logo/portada: el botón
                                flotante sobre la foto de portada se ocultó a propósito en
                                el hero compacto del vendedor. */}
                            {isSeller && (
                              <div className="details-card-header-actions">
                                <button type="button" className="details-card-link-button" onClick={() => handleOpenMediaModal('avatar')}>
                                  <Camera size={13} /> Cambiar logo
                                </button>
                                <button type="button" className="details-card-link-button" onClick={handleOpenCoverTemplates}>
                                  <ImageIcon size={13} /> Cambiar portada
                                </button>
                              </div>
                            )}
                          </div>
                          {/* Grid de 2-3 columnas en vez de una fila por dato: la tarjeta
                              ahora ocupa el ancho completo del panel, así que el espacio
                              extra se usa para mostrar los campos en pares en vez de dejar
                              un hueco en blanco al costado de una lista angosta. */}
                          <div className="details-info-grid">
                            {isSeller && (
                              <div className="details-info-row">
                                <span className="info-label">Nombre Comercial de Tienda</span>
                                <strong className="info-value">{storeInfo?.storeName || user?.storeName || '—'}</strong>
                              </div>
                            )}
                            <div className="details-info-row">
                              <span className="info-label">RUT / Identificador Fiscal</span>
                              <strong className="info-value">{storeInfo?.taxId || user?.taxId || '—'}</strong>
                            </div>
                            {!isSeller && (
                              <div className="details-info-row">
                                <span className="info-label">Tipo de Cuenta</span>
                                <strong className="info-value">Comprador Verificado</strong>
                              </div>
                            )}
                            <div className="details-info-row">
                              <span className="info-label">{isSeller ? 'Representante Legal' : 'Nombre Completo'}</span>
                              <strong className="info-value">{user?.userName || user?.nombre || '—'}</strong>
                            </div>
                            <div className="details-info-row">
                              <span className="info-label"><Mail size={13} /> Correo Electrónico</span>
                              <strong className="info-value">{user?.email || '—'}</strong>
                            </div>
                            <div className="details-info-row">
                              <span className="info-label"><Phone size={13} /> Teléfono Móvil</span>
                              <strong className="info-value">{user?.phone || user?.telefono || '—'}</strong>
                            </div>
                            {isSeller && (
                              <div className="details-info-row details-info-row-wide">
                                <span className="info-label">Marcas especialistas</span>
                                <div className="profile-specialist-brands">
                                  {(storeInfo?.marcasEspecialistas || []).length ? (storeInfo.marcasEspecialistas || []).map((brand) => (
                                    <VehicleBrandLogo key={brand.id || brand.nombre} brand={brand.nombre} />
                                  )) : <strong className="info-value">Sin marcas registradas</strong>}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Un solo botón no justifica una tarjeta completa del mismo peso
                            que "Identidad y Contacto": queda como aviso liviano en vez de
                            tarjeta vacía (mismo patrón que ya usa el formulario de edición). */}
                        {isSeller && (
                          <div className="withdrawal-info-banner">
                            <CreditCard size={18} />
                            <span>Los datos bancarios de cobro se validan y guardan desde el apartado Retirar dinero.</span>
                            <button type="button" className="withdrawal-bank-button" onClick={() => setActiveTab('retiros')}>
                              <Wallet size={16} /> Ir a Retirar dinero
                            </button>
                          </div>
                        )}

                        {/* Logística y Ubicación: contiene la libreta de direcciones,
                            mucho más densa que el resto. */}
                        <div className="details-card-block store-section-card">
                          <h3 className="section-subtitle">
                            <span className="section-subtitle-icon icon-amber"><Truck size={16} /></span>
                            <span>Ubicación y Logística de Despacho</span>
                          </h3>
                          <BuyerAddressBook usuarioId={user?.userId} onCommercialAddressSynced={refreshStoreInfoAfterAddressSync} />
                          {isSeller && (
                            <div className="details-info-list store-shipping-methods-row">
                              <div className="details-info-row">
                                <span className="info-label">Métodos de Envío Registrados</span>
                                <div className="shipping-methods-pills" style={{ marginTop: '6px', gap: '8px' }}>
                                  {String(storeInfo?.shippingMethods || 'Retiro en tienda, Envío dentro de la comuna, Envío fuera de la comuna')
                                    .split(',')
                                    .map((m, idx) => {
                                      const config = getShippingIconConfig(m.trim());
                                      const Icon = config.icon;
                                      return (
                                        <span
                                          key={idx}
                                          className="shipping-method-pill"
                                          style={{
                                            color: config.color,
                                            backgroundColor: config.bg,
                                            borderColor: config.color,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '4px 10px',
                                            fontWeight: 700
                                          }}
                                          title={config.label}
                                        >
                                          <Icon size={14} />
                                          <span>{config.name}</span>
                                        </span>
                                      );
                                    })}
                                </div>
                              </div>
                            </div>
                          )}
                        {/* Verificación y adhesión: estado REAL desde
                            `GET /proveedores/{id}/verificacion`. Antes eran dos líneas
                            fijas que decían "Tienda Verificada" y "Términos aceptados"
                            pasara lo que pasara. */}
                        {isSeller && <SellerVerificationCard sellerId={effectiveSellerId} />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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

      {showDeleteAccountModal && (
        <div
          className="order-modal-backdrop delete-account-backdrop"
          onClick={() => !isDeletingAccount && setShowDeleteAccountModal(false)}
        >
          <section
            className="delete-account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="delete-account-icon" aria-hidden="true"><AlertTriangle size={25} /></div>
            <h2 id="delete-account-title">¿Eliminar tu cuenta?</h2>
            <p>
              Esta acción desactivará tu cuenta y eliminará tus credenciales de acceso. Esta operación no se puede deshacer.
            </p>
            {deleteAccountError && (
              <div className="auth-alert alert-error"><span>{deleteAccountError}</span></div>
            )}
            <div className="delete-account-actions">
              <button
                type="button"
                className="btn-auth-secondary"
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={isDeletingAccount}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-delete-account-confirm"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
              >
                <Trash2 size={16} />
                {isDeletingAccount ? 'Eliminando cuenta...' : 'Sí, eliminar cuenta'}
              </button>
            </div>
          </section>
        </div>
      )}

      {showSpecialistBrandsModal && (
        <div className="order-modal-backdrop specialist-brands-backdrop" onClick={() => setShowSpecialistBrandsModal(false)}>
          <section className="specialist-brands-modal" role="dialog" aria-modal="true" aria-labelledby="specialist-brands-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2 id="specialist-brands-title">Marcas especialistas</h2>
                <p>Selecciona todas las marcas con las que trabaja tu tienda.</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setShowSpecialistBrandsModal(false)}><X size={19} /></button>
            </header>
            <div className="specialist-brands-selected" aria-label="Marcas ya seleccionadas">
              <span>Seleccionadas:</span>
              {availableVehicleBrands.filter((brand) => specialistBrandIdsDraft.includes(String(brand.id))).length ? (
                availableVehicleBrands
                  .filter((brand) => specialistBrandIdsDraft.includes(String(brand.id)))
                  .map((brand) => (
                    <span key={brand.id} className="specialist-selected-chip" title={brand.nombre}>
                      <VehicleBrandLogo brand={brand.nombre} />
                      {brand.nombre}
                    </span>
                  ))
              ) : <em>Aún no has seleccionado marcas</em>}
            </div>
            <div className="specialist-brands-search">
              <Search size={17} />
              <input autoFocus value={specialistBrandSearch} onChange={(event) => setSpecialistBrandSearch(event.target.value)} placeholder="Buscar marca de vehículo..." />
            </div>
            <div className="specialist-brands-options">
              {availableVehicleBrands
                .filter((brand) => brand.nombre?.toLowerCase().includes(specialistBrandSearch.trim().toLowerCase()))
                .map((brand) => {
                  const id = String(brand.id);
                  const selected = specialistBrandIdsDraft.includes(id);
                  return (
                    <button
                      type="button"
                      key={brand.id}
                      className={`specialist-brand-option ${selected ? 'is-selected' : ''}`}
                      onClick={() => setSpecialistBrandIdsDraft((current) => selected ? current.filter((currentId) => currentId !== id) : [...current, id])}
                    >
                      <VehicleBrandLogo brand={brand.nombre} />
                      <span>{brand.nombre}</span>
                      <span className="specialist-brand-tick" aria-hidden="true">{selected && <Check size={15} />}</span>
                    </button>
                  );
                })}
              {!availableVehicleBrands.length && <p className="specialist-brands-empty">No hay marcas disponibles para seleccionar.</p>}
            </div>
            <footer>
              <span>{specialistBrandIdsDraft.length} marca{specialistBrandIdsDraft.length === 1 ? '' : 's'} seleccionada{specialistBrandIdsDraft.length === 1 ? '' : 's'}</span>
              <button type="button" className="btn-auth-primary" onClick={() => setShowSpecialistBrandsModal(false)}><Check size={16} /> Listo</button>
            </footer>
          </section>
        </div>
      )}

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
      {showBlockedReviewModal && (
        <div className="order-modal-backdrop" onClick={() => setShowBlockedReviewModal(false)}>
          <div className="order-modal-container blocked-review-modal" onClick={(e) => e.stopPropagation()}>
            <div className="order-modal-header">
              <div className="order-modal-title-group">
                <div className="order-modal-icon-badge badge-moderation">
                  <Scale size={20} />
                </div>
                <div className="order-subdialog-heading">
                  <h2>Solicitar revisión de cuenta</h2>
                  <span className="order-modal-subtitle">
                    Envía tus descargos o justificación al equipo de moderación
                  </span>
                </div>
              </div>
              <button type="button" className="btn-close-modal" onClick={() => setShowBlockedReviewModal(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            {blockedReviewSuccess ? (
              <div className="order-modal-body" style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#f0fdf4',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <CheckCircle2 size={32} />
                </div>
                <h4 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
                  ¡Solicitud Enviada con Éxito!
                </h4>
                <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px' }}>
                  Tu solicitud ha sido registrada y está siendo revisada por el equipo de moderación de RepuesTop. Te contactaremos a la brevedad.
                </p>
                <button
                  type="button"
                  className="btn-auth-primary"
                  onClick={() => setShowBlockedReviewModal(false)}
                >
                  Entendido
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitBlockedReview} className="order-modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {blockedReviewError && (
                  <div className="auth-alert alert-error">
                    <AlertTriangle size={16} />
                    <span>{blockedReviewError}</span>
                  </div>
                )}

                <div className="blocked-review-reason">
                  <strong>{blockReasonIsClaim ? 'Reclamo que originó la mediación:' : 'Motivo actual:'}</strong>
                  <span>{blockReason}</span>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    Motivo / Explicación de la solicitud *
                  </label>
                  <textarea
                    required
                    rows={4}
                    maxLength={1000}
                    placeholder="Explica detalladamente por qué consideras que tu cuenta debe ser desbloqueada..."
                    value={blockedReviewText}
                    onChange={(e) => setBlockedReviewText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                  <small style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'right' }}>
                    {blockedReviewText.length} / 1000 caracteres
                  </small>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    Teléfono o correo de contacto alternativo (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: +56 9 1234 5678 o contacto@tienda.cl"
                    value={blockedReviewContact}
                    onChange={(e) => setBlockedReviewContact(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    className="btn-auth-secondary"
                    onClick={() => setShowBlockedReviewModal(false)}
                    disabled={isSubmittingBlockedReview}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-auth-primary"
                    disabled={isSubmittingBlockedReview || !blockedReviewText.trim()}
                    style={{ width: 'auto' }}
                  >
                    {isSubmittingBlockedReview ? 'Enviando...' : 'Enviar Solicitud'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
