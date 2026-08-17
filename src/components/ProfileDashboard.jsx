import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, LayoutGrid, Package, Heart, UserCog, Store, ShoppingBag,
  MessageSquare, LogOut, Star, Layers, TrendingUp, Truck, Check, Pencil, Save, X,
  Clock, ShieldCheck, Building2, PackageCheck, Loader2, Inbox, ChevronLeft, ChevronRight, Search,
  CreditCard, Award, Phone, Mail, FileText, ArrowUpRight, Sliders, Sparkles, Camera, Upload, Image as ImageIcon,
  Trash2, AlertTriangle, ReceiptText, Wrench, Boxes, Plus, MessageCircleQuestion, Scale, Headphones, Wallet, Info, Crown,
  CheckCircle, Send, MapPin, Megaphone, Coins
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import RepuesTopLogo from './RepuesTopLogo';
import {
  getBuyerOrdersApi, getSellerOrdersApi, getFavoritesApi,
  getSellerInventoryApi, getSellerInventorySummaryApi, getSellerConversationsApi, getBuyerConversationsApi, getSellerStoreApi, getSellerProductQuestionsApi,
  updateOrderStatusApi, uploadProfileImageApi, resolveMediaUrl, getVehicleBrandsApi, updateStoreSpecialistBrandsApi,
  getStoreCoverTemplatesApi, selectStoreCoverTemplateApi, updateSellerProductTopApi,
  saveConversationQuoteApi, sendConversationMessageApi, getRegionesApi, getComunasApi
} from '../services/api';
import { qk } from '../services/queryKeys';
import OrderCard from './OrderCard';
import OrderDetailModal from './OrderDetailModal';
import CatalogCard from './CatalogCard';
import QuoteCard from './QuoteCard';
import QuoteDetailModal from './QuoteDetailModal';
import ProfileSupportPanel from './ProfileSupportPanel';
import ProfileNotificationsBell from './ProfileNotificationsBell';
import NewCatalogProductModal from './NewCatalogProductModal';
import SellerProductQuestionsPanel from './SellerProductQuestionsPanel';
import SupportHelpPanel from './SupportHelpPanel';
import { getShippingIconConfig } from './NewOnboardedStoresSection';
import VehicleBrandLogo from './VehicleBrandLogo';
import SellerWithdrawalsPanel from './SellerWithdrawalsPanel';
import SellerOrdersPanel from './SellerOrdersPanel';
import BuyerAddressBook from './BuyerAddressBook';
import AdsManagementSection from './ads/AdsManagementSection';
import { formatRut } from '../services/adapters';
import { storePath } from '../routes/paths';

const CATALOG_PAGE_SIZE_OPTIONS = [12, 24, 48];
const BUYER_PROFILE_COVER_URL = import.meta.env.VITE_BUYER_PROFILE_COVER_URL
  || 'https://pub-650d4cc5c6be42bc9a81e878e6042ea6.r2.dev/Plantillas/Portadas_Perfil/comprador-default.png';

const BUYER_TABS = [
  { id: 'resumen', label: 'Resumen', icon: LayoutGrid },
  { id: 'anuncios', label: 'Gestión de Anuncios', icon: Megaphone },
  { id: 'pedidos', label: 'Mis Pedidos', icon: Package },
  { id: 'cotizaciones', label: 'Mis Cotizaciones', icon: ReceiptText },
  { id: 'favoritos', label: 'Favoritos', icon: Heart },
  { id: 'datos', label: 'Mis Datos y Perfil', icon: UserCog },
];

const SELLER_TABS = [
  { id: 'resumen', label: 'Resumen', icon: LayoutGrid },
  { id: 'anuncios', label: 'Gestión de Anuncios', icon: Megaphone },
  { id: 'pedidos', label: 'Pedidos Recibidos', icon: ShoppingBag },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: ReceiptText },
  { id: 'preguntas_productos', label: 'Preguntas de productos', icon: MessageCircleQuestion },
  { id: 'retiros', label: 'Retirar dinero', icon: Wallet },
  { id: 'tienda_datos', label: 'Mi Tienda y Datos', icon: Store },
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

export default function ProfileDashboard({ onBackToStore, initialTab = 'resumen', onTabChange }) {
  const { user, role, logout, updateProfile, refreshProfile, deleteAccount } = useAuth();
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
  const [nameDraft, setNameDraft] = useState(user?.userName || user?.nombre || '');
  const [phoneDraft, setPhoneDraft] = useState(user?.phone || user?.telefono || '');
  const [storeNameDraft, setStoreNameDraft] = useState(user?.storeName || '');
  const [taxIdDraft, setTaxIdDraft] = useState(user?.taxId || '');
  const [addressDraft, setAddressDraft] = useState(user?.address || '');
  const [regionIdDraft, setRegionIdDraft] = useState('');
  const [comunaIdDraft, setComunaIdDraft] = useState('');
  const [regionesOptions, setRegionesOptions] = useState([]);
  const [comunasOptions, setComunasOptions] = useState([]);
  const [geoLoadingProfile, setGeoLoadingProfile] = useState(false);
  const [shippingMethodsDraft, setShippingMethodsDraft] = useState('Retiro en tienda, Envío dentro de la comuna, Envío fuera de la comuna');
  const [availableVehicleBrands, setAvailableVehicleBrands] = useState([]);
  const [specialistBrandIdsDraft, setSpecialistBrandIdsDraft] = useState([]);
  const [showSpecialistBrandsModal, setShowSpecialistBrandsModal] = useState(false);
  const [specialistBrandSearch, setSpecialistBrandSearch] = useState('');

  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(null);
  const [mediaInput, setMediaInput] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [showCoverTemplatesModal, setShowCoverTemplatesModal] = useState(false);
  const [coverTemplates, setCoverTemplates] = useState([]);
  const [selectedCoverTemplateId, setSelectedCoverTemplateId] = useState(null);
  const [isLoadingCoverTemplates, setIsLoadingCoverTemplates] = useState(false);
  const [isSavingCoverTemplate, setIsSavingCoverTemplate] = useState(false);
  const [coverTemplateError, setCoverTemplateError] = useState('');
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState(null);

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
      setStoreInfo((current) => current ? { ...current, coverUrl } : current);
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

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5 MB.');
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
    if (!mediaFile) return;

    try {
      const uploaded = await uploadProfileImageApi(mediaFile);
      const uploadedUrl = resolveMediaUrl(uploaded.userProfileUrl);
      await refreshProfile({ userProfileUrl: uploadedUrl, logoUrl: uploadedUrl });
      if (storeInfo) {
        setStoreInfo((prev) => ({
          ...prev,
          ...{ logoUrl: uploadedUrl, userProfileUrl: uploadedUrl }
        }));
      }
      setShowMediaModal(null);
    } catch (error) {
      alert(error?.message || 'No se pudo guardar la imagen.');
    }
  };

  const queryClient = useQueryClient();

  // Datos del perfil y rol
  const isSeller = role === 'SELLER';
  const tabs = isSeller ? SELLER_TABS : BUYER_TABS;
  const effectiveSellerId = user?.sellerId || user?.proveedorId || user?.tiendaId || user?.userId || user?.id;
  const effectiveUserId = user?.userId || user?.buyerId || user?.compradorId || user?.id;

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState(null);
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
  const [updatingTopProductId, setUpdatingTopProductId] = useState(null);
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

  const favoritesQuery = useQuery({
    queryKey: qk.favorites(effectiveUserId),
    queryFn: async ({ signal }) => {
      const res = await getFavoritesApi(effectiveUserId, { signal });
      return Array.isArray(res) ? res : (res?.content || []);
    },
    enabled: Boolean(!isSeller && effectiveUserId),
    staleTime: 60 * 1000,
  });

  const conversationsQuery = useQuery({
    queryKey: qk.conversations(isSeller ? effectiveSellerId : effectiveUserId, isSeller),
    queryFn: ({ signal }) => isSeller ? getSellerConversationsApi(effectiveSellerId, { signal }) : getBuyerConversationsApi(effectiveUserId, { signal }),
    enabled: Boolean(isSeller ? effectiveSellerId : effectiveUserId),
    staleTime: 60 * 1000,
  });

  const storeInfoQuery = useQuery({
    queryKey: qk.sellerStore(effectiveSellerId),
    queryFn: ({ signal }) => getSellerStoreApi(effectiveSellerId, { signal }),
    enabled: Boolean(isSeller && effectiveSellerId),
    staleTime: 5 * 60 * 1000,
  });

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
  const favorites = favoritesQuery.data || [];
  const conversations = conversationsQuery.data || [];
  const storeInfo = storeInfoQuery.data || null;
  const inventorySummary = inventorySummaryQuery.data || null;
  const sellerProducts = catalogQuery.data?.content || [];
  const catalogTotalPages = catalogQuery.data?.totalPages ?? 0;
  const catalogTotalElements = catalogQuery.data?.totalElements ?? 0;
  const isCatalogLoading = catalogQuery.isLoading;
  const catalogError = catalogQuery.error?.message || null;
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

  const handleUpdateOrderStatus = async (orderId, newStatus, pin) => {
    try {
      const updatedOrder = await updateOrderStatusApi(orderId, newStatus, pin);
      queryClient.invalidateQueries({ queryKey: isSeller ? qk.sellerOrders(effectiveSellerId) : qk.buyerOrders(effectiveUserId) });
      setSelectedOrder((prevSelected) => String(prevSelected?.id) === String(orderId)
        ? { ...prevSelected, ...updatedOrder, estado: updatedOrder?.estado || newStatus, status: updatedOrder?.status || newStatus }
        : prevSelected);
      return updatedOrder;
    } catch (err) {
      console.warn('No se pudo actualizar el estado del pedido:', err);
      throw err;
    }
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

  const handleQuoteMarkedRead = useCallback((quoteId) => {
    queryClient.invalidateQueries({ queryKey: qk.conversations(isSeller ? effectiveSellerId : effectiveUserId, isSeller) });
  }, [isSeller, effectiveSellerId, effectiveUserId, queryClient]);

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
    return (conversations || [])
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
  }, [conversations, quoteFilter, quoteSearch, quoteSort]);

  const quoteSummary = useMemo(() => {
    const quoteOnly = (conversations || []).filter((conversation) => (
      !conversation.tipo || String(conversation.tipo).toLowerCase() === 'cotizacion'
    ));
    return {
      total: quoteOnly.length,
      pending: quoteOnly.filter((conversation) => !conversation.cotizacion).length,
      sent: quoteOnly.filter((conversation) => Boolean(conversation.cotizacion)).length,
      unread: quoteOnly.reduce((total, conversation) => total + Number(conversation.mensajesNoLeidos || 0), 0),
    };
  }, [conversations]);

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
    queryClient.invalidateQueries({ queryKey: ['sellerInventory'] });
    queryClient.invalidateQueries({ queryKey: qk.sellerInventorySummary(effectiveSellerId) });
  };

  const handleToggleProductTop = async (product, destacado) => {
    if (!user?.sellerId || !product?.id || updatingTopProductId) return;
    setUpdatingTopProductId(product.id);
    setCatalogError(null);
    setCatalogTopFeedback('');
    try {
      const updated = await updateSellerProductTopApi(user.sellerId, product.id, destacado);
      queryClient.invalidateQueries({ queryKey: ['sellerInventory'] });
      setSelectedCatalogProduct((previous) => previous?.id === product.id
        ? { ...previous, ...updated, destacado: Boolean(updated?.destacado ?? destacado) }
        : previous);
      setCatalogTopFeedback(destacado
        ? 'Producto marcado como Top: tendrá prioridad dentro de tu tienda.'
        : 'El producto dejó de tener prioridad Top.');
    } catch (error) {
      setCatalogError(error.message || 'No se pudo actualizar el producto Top.');
    } finally {
      setUpdatingTopProductId(null);
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

  // Chile es el único país operativo del marketplace (ver selector "🇨🇱 CHILE"
  // fijo en el catálogo), así que se hardcodea el paisId en vez de agregar un
  // selector de país que solo tendría una opción.
  const CHILE_PAIS_ID = 'CL';

  const handleRegionDraftChange = (regionId) => {
    setRegionIdDraft(regionId);
    setComunaIdDraft('');
    setComunasOptions([]);
    if (!regionId) return;
    setGeoLoadingProfile(true);
    getComunasApi(regionId)
      .then((data) => setComunasOptions(Array.isArray(data) ? data : []))
      .catch(() => setComunasOptions([]))
      .finally(() => setGeoLoadingProfile(false));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    const payload = {
      userName: nameDraft,
      phone: phoneDraft,
      taxId: taxIdDraft,
    };

    if (isSeller) {
      payload.storeName = storeNameDraft;
      payload.address = addressDraft;
      if (comunaIdDraft) payload.comunaId = Number(comunaIdDraft);
      payload.shippingMethods = shippingMethodsDraft;
    }

    let result;
    try {
      if (isSeller) {
        await updateStoreSpecialistBrandsApi(user.sellerId, specialistBrandIdsDraft);
      }
      result = await updateProfile(payload);
    } catch (error) {
      setIsSaving(false);
      setSaveStatus({ type: 'error', message: error?.message || 'No se pudieron actualizar las marcas especialistas.' });
      return;
    }
    setIsSaving(false);

    if (result.success) {
      // Actualizar también el estado local de la tienda. El backend (result.user)
      // es la fuente autoritativa para comuna/región (viene con nombre resuelto),
      // pero por si el DTO no las trae se cae a las opciones ya cargadas en el form.
      if (storeInfo) {
        const selectedComuna = comunasOptions.find((c) => String(c.id) === String(comunaIdDraft));
        const selectedRegion = regionesOptions.find((r) => String(r.id) === String(regionIdDraft));
        setStoreInfo((prev) => ({
          ...prev,
          storeName: storeNameDraft || prev?.storeName,
          taxId: taxIdDraft || prev?.taxId,
          address: addressDraft || prev?.address,
          comunaId: result.user?.comunaId || (comunaIdDraft ? Number(comunaIdDraft) : prev?.comunaId),
          comuna: result.user?.comuna || selectedComuna?.nombre || prev?.comuna,
          regionId: regionIdDraft ? Number(regionIdDraft) : prev?.regionId,
          region: result.user?.region || selectedRegion?.nombre || prev?.region,
          shippingMethods: shippingMethodsDraft || prev?.shippingMethods,
          marcasEspecialistas: availableVehicleBrands.filter((brand) => specialistBrandIdsDraft.includes(String(brand.id))),
        }));
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

  return (
    <div className="profile-dashboard">
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
              {isSeller && (
                <span className={`store-status-chip ${storeInfo?.status === 'APPROVED' ? 'chip-approved' : 'chip-pending'}`}>
                  <ShieldCheck size={13} />
                  <span>{storeInfo?.status === 'APPROVED' ? 'Tienda Verificada' : 'Tienda en Revisión'}</span>
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
              {isSeller && (
                <span className="hero-tag founder-tag-contrast">
                  <Crown size={14} strokeWidth={2.4} /> Beneficio Tarifa Fundador Activo (5%)
                </span>
              )}
            </div>
          </div>

          {isSeller && (
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

          <div className="sidebar-nav-list">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`profile-nav-item ${isSeller ? 'nav-seller' : 'nav-buyer'} ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={17} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              className={`profile-nav-item ${isSeller ? 'nav-seller' : 'nav-buyer'} ${activeTab === 'consultas' ? 'active' : ''}`}
              onClick={() => setActiveTab('consultas')}
            >
              <Scale size={17} />
              <span>Reportes/Disputa</span>
            </button>
            <button type="button" className={`profile-nav-item ${isSeller ? 'nav-seller' : 'nav-buyer'} ${activeTab === 'soporte' ? 'active' : ''}`} onClick={() => setActiveTab('soporte')}>
              <Headphones size={17} />
              <span>Soporte</span>
            </button>
            {isSeller && (
              <>
                <button
                  type="button"
                  className={`profile-nav-item profile-nav-service profile-nav-service-start nav-seller ${activeTab === 'productos' ? 'active' : ''}`}
                  onClick={() => setActiveTab('productos')}
                >
                  <Wrench size={17} />
                  <span>Catálogo</span>
                </button>
                <button
                  type="button"
                  className="profile-nav-item profile-nav-service"
                  onClick={() => window.location.assign(inventoryPanelUrl)}
                >
                  <Boxes size={17} />
                  <span>Panel de inventario</span>
                </button>
              </>
            )}
            <button
              type="button"
              className="profile-nav-item profile-nav-delete"
              onClick={() => {
                setDeleteAccountError(null);
                setShowDeleteAccountModal(true);
              }}
            >
              <Trash2 size={17} />
              <span>Eliminar cuenta</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="profile-main">
          {dataError && (
            <div className="auth-alert alert-error">
              <X size={16} />
              <span>{dataError}</span>
            </div>
          )}

          {isLoadingData ? (
            <div className="profile-panel"><LoadingRow /></div>
          ) : (
            <>
              {activeTab === 'resumen' && (
                <>
                  {/* Stats Grid */}
                  <div className="profile-stats-grid">
                    {isSeller ? (
                      <>
                        <div className="profile-stat-card stat-blue clickable-stat-card" onClick={() => setActiveTab('productos')}>
                          <div className="stat-icon-badge"><Layers size={19} /></div>
                          <strong>{inventorySummary?.total ?? sellerProducts?.length ?? 0}</strong>
                          <span>Productos Publicados</span>
                        </div>
                        <div className="profile-stat-card stat-navy clickable-stat-card" onClick={() => setActiveTab('pedidos')}>
                          <div className="stat-icon-badge"><ShoppingBag size={19} /></div>
                          <strong>{orders?.length ?? 0}</strong>
                          <span>Pedidos Recibidos</span>
                        </div>
                        <div className="profile-stat-card stat-amber clickable-stat-card" onClick={() => setActiveTab('tienda_datos')}>
                          <div className="stat-icon-badge"><Star size={19} /></div>
                          <strong>{storeInfo?.rating ? Number(storeInfo.rating).toFixed(1) : '—'}</strong>
                          <span>Calificación Promedio ({storeInfo?.reviewCount ?? 0})</span>
                        </div>
                        <div className="profile-stat-card stat-green clickable-stat-card" onClick={() => setActiveTab('pedidos')}>
                          <div className="stat-icon-badge"><TrendingUp size={19} /></div>
                          <strong>${formatCLP(ordersThisMonthTotal)}</strong>
                          <span>Ventas este Mes</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="profile-stat-card stat-blue clickable-stat-card" onClick={() => setActiveTab('pedidos')}>
                          <div className="stat-icon-badge"><Package size={19} /></div>
                          <strong>{orders?.length ?? 0}</strong>
                          <span>Pedidos Totales</span>
                        </div>
                        <div className="profile-stat-card stat-navy clickable-stat-card" onClick={() => setActiveTab('favoritos')}>
                          <div className="stat-icon-badge"><Heart size={19} /></div>
                          <strong>{favorites?.length ?? 0}</strong>
                          <span>Favoritos Guardados</span>
                        </div>
                        <div className="profile-stat-card stat-amber clickable-stat-card" onClick={() => setActiveTab('pedidos')}>
                          <div className="stat-icon-badge"><Truck size={19} /></div>
                          <strong>{shippingOrdersCount}</strong>
                          <span>Envíos en Camino</span>
                        </div>
                        <div className="profile-stat-card stat-green">
                          <div className="stat-icon-badge"><ShieldCheck size={19} /></div>
                          <strong>100%</strong>
                          <span>Compras Protegidas</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Accesos Directos Rápido */}
                  <div className="profile-panel">
                    <h2 className="profile-panel-title">Acciones Rápidas</h2>
                    <div className="quick-shortcuts-grid">
                      {isSeller ? (
                        <>
                          <div className="quick-shortcut-card" onClick={() => setActiveTab('pedidos')}>
                            <div className="shortcut-icon shortcut-blue"><ShoppingBag size={20} /></div>
                            <div className="shortcut-info">
                              <strong>Gestionar Pedidos Recibidos</strong>
                              <span>Revisar ventas, despachos y actualizar estados</span>
                            </div>
                            <ArrowUpRight size={16} className="shortcut-arrow" />
                          </div>

                          <div className="quick-shortcut-card" onClick={() => setActiveTab('productos')}>
                            <div className="shortcut-icon shortcut-amber"><Wrench size={20} /></div>
                            <div className="shortcut-info">
                              <strong>Administrar Catálogo</strong>
                              <span>Ajustar precios, stock e inventario publicado</span>
                            </div>
                            <ArrowUpRight size={16} className="shortcut-arrow" />
                          </div>

                          <div className="quick-shortcut-card" onClick={() => setActiveTab('cotizaciones')}>
                            <div className="shortcut-icon shortcut-purple"><ReceiptText size={20} /></div>
                            <div className="shortcut-info">
                              <strong>Responder Cotizaciones</strong>
                              <span>Atender preguntas y solicitudes de clientes</span>
                            </div>
                            <ArrowUpRight size={16} className="shortcut-arrow" />
                          </div>

                          <div className="quick-shortcut-card" onClick={() => setActiveTab('tienda_datos')}>
                            <div className="shortcut-icon shortcut-green"><Store size={20} /></div>
                            <div className="shortcut-info">
                              <strong>Mi Tienda y Datos Bancarios</strong>
                              <span>Configurar datos comerciales y cuenta de cobro</span>
                            </div>
                            <ArrowUpRight size={16} className="shortcut-arrow" />
                          </div>

                          <div className="quick-shortcut-card" onClick={() => setActiveTab('retiros')}>
                            <div className="shortcut-icon shortcut-green"><Wallet size={20} /></div>
                            <div className="shortcut-info">
                              <strong>Retirar dinero</strong>
                              <span>Solicitar el depósito de ventas finalizadas</span>
                            </div>
                            <ArrowUpRight size={16} className="shortcut-arrow" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="quick-shortcut-card" onClick={() => setActiveTab('pedidos')}>
                            <div className="shortcut-icon shortcut-blue"><Package size={20} /></div>
                            <div className="shortcut-info">
                              <strong>Mis Pedidos Realizados</strong>
                              <span>Sigue el estado de tus compras y recepciones</span>
                            </div>
                            <ArrowUpRight size={16} className="shortcut-arrow" />
                          </div>

                          <div className="quick-shortcut-card" onClick={() => setActiveTab('favoritos')}>
                            <div className="shortcut-icon shortcut-pink"><Heart size={20} /></div>
                            <div className="shortcut-info">
                              <strong>Repuestos Favoritos</strong>
                              <span>Accede a tus repuestos guardados</span>
                            </div>
                            <ArrowUpRight size={16} className="shortcut-arrow" />
                          </div>

                          <div className="quick-shortcut-card" onClick={() => setActiveTab('datos')}>
                            <div className="shortcut-icon shortcut-green"><UserCog size={20} /></div>
                            <div className="shortcut-info">
                              <strong>Mis Datos y Perfil</strong>
                              <span>Actualiza tu información personal</span>
                            </div>
                            <ArrowUpRight size={16} className="shortcut-arrow" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actividad Reciente en Formato OrderCard */}
                  <div className="profile-panel">
                    <div className="profile-panel-header-row">
                      <h2 className="profile-panel-title">Actividad Reciente</h2>
                      {(orders || []).length > 0 && (
                        <button className="btn-view-details" onClick={() => setActiveTab('pedidos')}>
                          Ver todos los pedidos ({orders.length}) <ChevronRight size={15} />
                        </button>
                      )}
                    </div>

                    {(orders || []).length === 0 ? (
                      <EmptyState label={isSeller ? 'Aún no has recibido pedidos.' : 'Aún no tienes pedidos.'} />
                    ) : (
                      <div className="profile-orders-cards-grid">
                        {orders.slice(0, 3).map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            mode={isSeller ? 'seller' : 'buyer'}
                            onSelectOrder={(ord) => setSelectedOrder(ord)}
                            onUpdateStatus={handleUpdateOrderStatus}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'pedidos' && (
                isSeller ? (
                  <SellerOrdersPanel
                    orders={orders || []}
                    sellerId={user?.sellerId}
                    onSelectOrder={(order) => setSelectedOrder(order)}
                    onUpdateStatus={handleUpdateOrderStatus}
                  />
                ) : (
                  <div className="profile-panel">
                    <h2 className="profile-panel-title">Mis Pedidos</h2>
                    {(orders || []).length === 0 ? <EmptyState label="Aún no has realizado pedidos." /> : <div className="profile-orders-cards-grid">{orders.map((order) => <OrderCard key={order.id} order={order} mode="buyer" onSelectOrder={(item) => setSelectedOrder(item)} onUpdateStatus={handleUpdateOrderStatus} />)}</div>}
                  </div>
                )
              )}

              {activeTab === 'favoritos' && !isSeller && (
                <div className="profile-panel">
                  <h2 className="profile-panel-title">Repuestos Favoritos</h2>
                  {(favorites || []).length === 0 ? (
                    <EmptyState label="Aún no has guardado repuestos favoritos." />
                  ) : (
                    <div className="profile-products-grid">
                      {favorites.map((f, i) => (
                        <div key={f.id} className="profile-product-card">
                          {f.imagenUrl ? (
                            <div className="product-card-thumb-img">
                              <img src={f.imagenUrl} alt="" />
                            </div>
                          ) : (
                            <div className={`product-card-thumb thumb-${i % 4}`}>
                              <Package size={26} />
                            </div>
                          )}
                          <h4>{f.nombre}</h4>
                          <div className="product-card-price-row">
                            <strong>${formatCLP(f.precio)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                    <span className="catalog-top-info-icon"><Star size={17} fill="currentColor" /></span>
                    <p><strong>Destaca tus productos estrella</strong><span>Un Producto Top recibe mayor visibilidad y prioridad dentro de tu tienda. Puedes activarlo o quitarlo directamente en cada tarjeta.</span></p>
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
                />
              )}

              {activeTab === 'cotizaciones' && (
                <div className="profile-panel seller-quotes-panel">
                  <div className="seller-quotes-heading">
                    <div>
                      <span className="seller-quotes-eyebrow"><ReceiptText size={14} /> {isSeller ? 'Centro de cotizaciones' : 'Conversaciones de cotización'}</span>
                      <h2 className="profile-panel-title">{isSeller ? 'Cotizaciones de compradores' : 'Mis cotizaciones'}</h2>
                      <p>{isSeller ? 'Revisa solicitudes, responde con tus condiciones comerciales y mantén cada oferta vinculada a su conversación.' : 'Revisa las respuestas de las tiendas, conversa y consulta cada propuesta con su vigencia y condiciones.'}</p>
                    </div>
                    <button type="button" className="seller-quotes-sort" onClick={() => setQuoteSort((current) => current === 'newest' ? 'oldest' : 'newest')}>
                      <Sliders size={15} /> {quoteSort === 'newest' ? 'Más recientes' : 'Más antiguas'}
                    </button>
                  </div>

                  <div className="seller-quotes-summary">
                    <article><MessageSquare size={18} /><span><strong>{quoteSummary.total}</strong>Total</span></article>
                    <article className="is-pending"><Clock size={18} /><span><strong>{quoteSummary.pending}</strong>Por responder</span></article>
                    <article className="is-sent"><Send size={18} /><span><strong>{quoteSummary.sent}</strong>Ofertas enviadas</span></article>
                    <article className="is-unread"><Inbox size={18} /><span><strong>{quoteSummary.unread}</strong>Mensajes sin leer</span></article>
                  </div>

                  <div className="seller-quotes-toolbar">
                    <label className="seller-quotes-search"><Search size={15} /><input value={quoteSearch} onChange={(event) => setQuoteSearch(event.target.value)} placeholder="Buscar comprador, producto o cotización..." />{quoteSearch && <button type="button" onClick={() => setQuoteSearch('')} aria-label="Limpiar búsqueda"><X size={13} /></button>}</label>
                    <div className="seller-quotes-filters" role="group" aria-label="Filtrar cotizaciones">
                      {[['all', 'Todas'], ['pending', 'Sin responder'], ['sent', 'Enviadas'], ['unread', 'Sin leer']].map(([value, label]) => (
                        <button key={value} type="button" className={quoteFilter === value ? 'active' : ''} onClick={() => setQuoteFilter(value)}>{label}</button>
                      ))}
                    </div>
                  </div>

                  {quoteSummary.total === 0 ? (
                    <EmptyState label="Aún no tienes solicitudes de cotización." />
                  ) : quoteConversations.length === 0 ? (
                    <EmptyState label="No encontramos cotizaciones con esos filtros." />
                  ) : (
                    <div className="profile-orders-cards-grid seller-quotes-grid">
                      {quoteConversations.map((c) => (
                        <QuoteCard
                          key={c.id}
                          quote={c}
                          mode={isSeller ? 'seller' : 'buyer'}
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
                  user={user}
                  onNavigateToMural={() => window.location.assign('/mural-anuncios')}
                />
              )}

              {activeTab === 'retiros' && isSeller && (
                <SellerWithdrawalsPanel sellerId={user?.sellerId} sellerEmail={user?.email} />
              )}

              {activeTab === 'consultas' && (
                <ProfileSupportPanel user={user} orders={orders || []} isSeller={isSeller} />
              )}

              {activeTab === 'soporte' && (
                <SupportHelpPanel user={user} role={role} onViewCases={() => setActiveTab('consultas')} />
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
                          setNameDraft(user?.userName || user?.nombre || '');
                          setPhoneDraft(user?.phone || user?.telefono || '');
                          setStoreNameDraft(storeInfo?.storeName || user?.storeName || '');
                          setTaxIdDraft(storeInfo?.taxId || user?.taxId || '');
                          setAddressDraft(storeInfo?.address || user?.address || '');
                          setShippingMethodsDraft(storeInfo?.shippingMethods || 'Starken, Chilexpress, Retiro en Tienda');
                          setSpecialistBrandIdsDraft((storeInfo?.marcasEspecialistas || []).map((brand) => String(brand.id)));

                          const initialRegionId = storeInfo?.regionId ? String(storeInfo.regionId) : '';
                          const initialComunaId = storeInfo?.comunaId ? String(storeInfo.comunaId) : '';
                          setRegionIdDraft(initialRegionId);
                          setComunaIdDraft(initialComunaId);
                          setComunasOptions([]);
                          if (isSeller) {
                            setGeoLoadingProfile(true);
                            getRegionesApi(CHILE_PAIS_ID)
                              .then((regiones) => {
                                setRegionesOptions(Array.isArray(regiones) ? regiones : []);
                                if (initialRegionId) {
                                  return getComunasApi(initialRegionId)
                                    .then((comunas) => setComunasOptions(Array.isArray(comunas) ? comunas : []));
                                }
                                return null;
                              })
                              .catch(() => {})
                              .finally(() => setGeoLoadingProfile(false));
                          }
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
                          <label>{isSeller ? 'Nombre Completo / Representante' : 'Nombre Completo'}</label>
                          <input type="text" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} required />
                        </div>
                        <div className="form-group">
                          <label>Teléfono Móvil</label>
                          <input type="tel" value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} placeholder="+56 9 1234 5678" />
                        </div>
                      </div>
                      {!isSeller && (
                        <div className="form-group">
                          <label>RUT / Identificador Fiscal</label>
                          <input type="text" value={taxIdDraft} onChange={(e) => setTaxIdDraft(formatRut(e.target.value))} placeholder="12.345.678-K" maxLength={12} />
                        </div>
                      )}

                      {isSeller && (
                        <>
                          <div className="form-section-title" style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>Dirección Comercial de Despacho</span>
                            <span className="info-tooltip-wrapper" tabIndex={0} role="note" aria-label="Información sobre la dirección comercial">
                              <Info size={15} className="info-tooltip-icon" />
                              <span className="info-tooltip-content">
                                Ubicación física oficial de tu tienda, local o bodega. Desde esta dirección se originan y preparan los envíos hacia los compradores, y se coordinan los retiros en tienda.
                              </span>
                            </span>
                          </div>
                          <div className="form-group">
                            <label>Dirección</label>
                            <input type="text" value={addressDraft} onChange={(e) => setAddressDraft(e.target.value)} placeholder="Av. Italia 1234, Local 5" />
                          </div>
                          <div className="form-grid-2">
                            <div className="form-group">
                              <label>Región {geoLoadingProfile && <Loader2 size={12} className="spin-icon" />}</label>
                              <select value={regionIdDraft} onChange={(e) => handleRegionDraftChange(e.target.value)}>
                                <option value="">Selecciona una región</option>
                                {regionesOptions.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Comuna</label>
                              <select
                                value={comunaIdDraft}
                                onChange={(e) => setComunaIdDraft(e.target.value)}
                                disabled={!regionIdDraft}
                              >
                                <option value="">Selecciona una comuna</option>
                                {comunasOptions.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {isSeller && (
                        <>
                          <div className="form-section-title" style={{ marginTop: '20px' }}>Datos de la Tienda</div>
                          <div className="form-grid-2">
                            <div className="form-group">
                              <label>Nombre de la Tienda</label>
                              <input type="text" value={storeNameDraft} onChange={(e) => setStoreNameDraft(e.target.value)} required />
                            </div>
                            <div className="form-group">
                              <label>RUT de la Tienda / Identificador Fiscal</label>
                              <input type="text" value={taxIdDraft} onChange={(e) => setTaxIdDraft(formatRut(e.target.value))} placeholder="12.345.678-K" maxLength={12} />
                            </div>
                          </div>

                          <div className="form-group">
                            <label>Métodos de Envío Aceptados</label>
                            <input type="text" value={shippingMethodsDraft} onChange={(e) => setShippingMethodsDraft(e.target.value)} placeholder="Starken, Chilexpress, Retiro en Tienda" />
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

                      <div className="form-section-title" style={{ marginTop: '24px' }}>Gestión de Direcciones (Personales y Despacho)</div>
                      <BuyerAddressBook usuarioId={user?.userId} />

                      <div className="profile-data-form-actions" style={{ marginTop: '20px' }}>
                        <button type="button" className="btn-auth-secondary" onClick={() => setIsEditing(false)}>
                          Cancelar
                        </button>
                        <button type="submit" className="btn-auth-primary" disabled={isSaving} style={{ width: 'auto' }}>
                          <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar Información'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="store-unified-container">
                      {/* Top Banner Identity */}
                      <div className="store-identity-banner">
                        <div className="store-identity-avatar">
                          {user?.userProfileUrl ? (
                            <img src={user.userProfileUrl} alt="" referrerPolicy="no-referrer" />
                          ) : (
                            initialsFromName(isSeller ? (storeInfo?.storeName || displayName) : displayName)
                          )}
                        </div>
                        <div className="store-identity-info">
                          <div className="store-identity-title-row">
                            <h3>{isSeller ? (storeInfo?.storeName || user?.storeName || displayName) : displayName}</h3>
                            {isSeller && (
                              <span className={`store-status-chip ${storeInfo?.status === 'APPROVED' ? 'chip-approved' : 'chip-pending'}`}>
                                <ShieldCheck size={13} />
                                <span>{storeInfo?.status === 'APPROVED' ? 'Tienda Verificada' : 'Tienda en Revisión'}</span>
                              </span>
                            )}
                          </div>
                          <span className="store-identity-sub">
                            {isSeller ? `RUT Empresa: ${storeInfo?.taxId || user?.taxId || 'No registrado'}` : user?.email}
                          </span>
                          <div className="store-identity-tags">
                            {memberSince && (
                              <span className="hero-tag"><Clock size={12} /> Miembro desde {memberSince}</span>
                            )}
                            {isSeller && (
                              <span className="hero-tag founder-tag">
                                <Crown size={13} strokeWidth={2.4} /> Beneficio Tarifa Fundador Activo (5%)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Modular Grid of Cards */}
                      <div className="store-profile-unified-grid">
                        {/* Card 1: Identidad y Datos Comerciales */}
                        <div className="details-card-block store-section-card">
                          <h3 className="section-subtitle">
                            <Building2 size={16} />
                            <span>{isSeller ? 'Identidad Comercial de la Tienda' : 'Datos de la Cuenta'}</span>
                          </h3>
                          <div className="details-info-list">
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
                            {isSeller ? (
                              <div className="details-info-row">
                                <span className="info-label">Marcas especialistas</span>
                                <div className="profile-specialist-brands">
                                  {(storeInfo?.marcasEspecialistas || []).length ? (storeInfo.marcasEspecialistas || []).map((brand) => (
                                    <VehicleBrandLogo key={brand.id || brand.nombre} brand={brand.nombre} />
                                  )) : <strong className="info-value">Sin marcas registradas</strong>}
                                </div>
                              </div>
                            ) : (
                              <div className="details-info-row">
                                <span className="info-label">Tipo de Cuenta</span>
                                <strong className="info-value">Comprador Verificado</strong>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card 2: Representante & Contacto */}
                        <div className="details-card-block store-section-card">
                          <h3 className="section-subtitle">
                            <UserCog size={16} />
                            <span>{isSeller ? 'Representante Legal y Contacto' : 'Datos de Contacto'}</span>
                          </h3>
                          <div className="details-info-list">
                            <div className="details-info-row">
                              <span className="info-label">Nombre Completo</span>
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
                          </div>
                        </div>

                        {/* Card 3: Logística y Ubicación */}
                        <div className="details-card-block store-section-card">
                          <h3 className="section-subtitle">
                            <Truck size={16} />
                            <span>Ubicación y Logística de Despacho</span>
                          </h3>
                          <BuyerAddressBook usuarioId={user?.userId} onCommercialAddressSynced={refreshStoreInfoAfterAddressSync} />
                          <div className="details-info-list" style={{ marginTop: '16px' }}>
                            {isSeller && (
                              <>
                                <div className="details-info-row">
                                  <span className="info-label"><MapPin size={13} /> Dirección Comercial de Tienda</span>
                                  <strong className="info-value">{storeInfo?.address || user?.address || 'Dirección no registrada'}</strong>
                                </div>
                                <div className="details-info-row">
                                  <span className="info-label">Comuna / Región Comercial</span>
                                  <strong className="info-value">
                                    {[storeInfo?.comuna || user?.comuna, storeInfo?.region || user?.region].filter(Boolean).join(', ') || '—'}
                                  </strong>
                                </div>
                              </>
                            )}
                            {isSeller && (
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
                            )}
                          </div>
                        </div>

                        {/* Card 4: Cobro y Datos Bancarios (Vendedor) */}
                        {isSeller && (
                          <div className="details-card-block store-section-card bank-card">
                            <h3 className="section-subtitle">
                              <CreditCard size={16} />
                              <span>Datos Bancarios para Depósito de Ventas</span>
                            </h3>
                            <div className="details-info-list">
                              <p className="bank-card-helper">Registra o actualiza la cuenta donde recibirás el depósito de tus ventas y revisa tus solicitudes de retiro.</p>
                              <button type="button" className="withdrawal-bank-button" onClick={() => setActiveTab('retiros')}>
                                <Wallet size={16} /> Ir a Retirar dinero
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          mode={isSeller ? 'seller' : 'buyer'}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={handleUpdateOrderStatus}
        />
      )}

      {selectedCatalogProduct && (
        <NewCatalogProductModal
          product={selectedCatalogProduct}
          sellerId={user?.sellerId}
          onClose={() => setSelectedCatalogProduct(null)}
          onCreated={handleCatalogProductSaved}
        />
      )}

      {selectedQuote && (
        <QuoteDetailModal
          quote={selectedQuote}
          mode={isSeller ? 'seller' : 'buyer'}
          onClose={() => setSelectedQuote(null)}
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
              <button className="order-modal-close-btn" onClick={() => setShowMediaModal(null)}>
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

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', marginTop: '4px' }}>
                <button type="button" className="btn-auth-secondary" onClick={() => setShowMediaModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-auth-primary" disabled={!mediaFile} style={{ width: 'auto' }}>
                  <Save size={16} /> Guardar Imagen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewProductModal && isSeller && (
        <NewCatalogProductModal
          sellerId={user?.sellerId}
          onClose={() => setShowNewProductModal(false)}
          onCreated={handleCatalogProductCreated}
        />
      )}

    </div>
  );
}
