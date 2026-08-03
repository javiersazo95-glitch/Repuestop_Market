import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, LayoutGrid, Package, Heart, MapPin, UserCog, Store, ShoppingBag,
  MessageSquare, LogOut, Star, Layers, TrendingUp, Truck, Check, Pencil, Save, X,
  Clock, ShieldCheck, Building2, PackageCheck, Loader2, Inbox, ChevronLeft, ChevronRight, Search,
  CreditCard, Award, Phone, Mail, FileText, ArrowUpRight, Sliders, Sparkles, Camera, Upload, Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import RepuesTopLogo from './RepuesTopLogo';
import {
  getBuyerOrdersApi, getSellerOrdersApi, getFavoritesApi,
  getSellerInventoryApi, getSellerInventorySummaryApi, getSellerConversationsApi, getSellerStoreApi,
  updateOrderStatusApi
} from '../services/api';
import OrderCard from './OrderCard';
import OrderDetailModal from './OrderDetailModal';
import CatalogCard from './CatalogCard';
import CatalogDetailModal from './CatalogDetailModal';
import QuoteCard from './QuoteCard';
import QuoteDetailModal from './QuoteDetailModal';
import { getShippingIconConfig } from './NewOnboardedStoresSection';

const CATALOG_PAGE_SIZE_OPTIONS = [12, 24, 48];

const BUYER_TABS = [
  { id: 'resumen', label: 'Resumen', icon: LayoutGrid },
  { id: 'pedidos', label: 'Mis Pedidos', icon: Package },
  { id: 'favoritos', label: 'Favoritos', icon: Heart },
  { id: 'direcciones', label: 'Direcciones', icon: MapPin },
  { id: 'datos', label: 'Mis Datos y Perfil', icon: UserCog },
];

const SELLER_TABS = [
  { id: 'resumen', label: 'Resumen', icon: LayoutGrid },
  { id: 'pedidos', label: 'Pedidos Recibidos', icon: ShoppingBag },
  { id: 'productos', label: 'Catálogo', icon: Package },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: MessageSquare },
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

export default function ProfileDashboard({ onBackToStore }) {
  const { user, role, logout, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('resumen');
  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.userName || user?.nombre || '');
  const [phoneDraft, setPhoneDraft] = useState(user?.phone || user?.telefono || '');
  const [storeNameDraft, setStoreNameDraft] = useState(user?.storeName || '');
  const [taxIdDraft, setTaxIdDraft] = useState(user?.taxId || '');
  const [addressDraft, setAddressDraft] = useState(user?.address || '');
  const [comunaDraft, setComunaDraft] = useState(user?.comuna || '');
  const [regionDraft, setRegionDraft] = useState(user?.region || '');
  const [shippingMethodsDraft, setShippingMethodsDraft] = useState('Retiro en tienda, Envío dentro de la comuna, Envío fuera de la comuna');
  const [bancoDraft, setBancoDraft] = useState('Banco de Chile');
  const [tipoCuentaDraft, setTipoCuentaDraft] = useState('Cuenta Corriente');
  const [numCuentaDraft, setNumCuentaDraft] = useState('123-45678-90');
  const [rutTitularDraft, setRutTitularDraft] = useState(user?.taxId || '');

  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(null);
  const [mediaInput, setMediaInput] = useState('');

  const handleOpenMediaModal = (type) => {
    setShowMediaModal(type);
    if (type === 'avatar') {
      setMediaInput(user?.userProfileUrl || storeInfo?.logoUrl || '');
    } else {
      setMediaInput(user?.coverUrl || storeInfo?.coverUrl || '');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setMediaInput(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMediaUrl = async (e) => {
    e.preventDefault();
    if (!mediaInput.trim()) return;

    const type = showMediaModal;
    const payload = type === 'avatar'
      ? { userProfileUrl: mediaInput.trim(), logoUrl: mediaInput.trim() }
      : { coverUrl: mediaInput.trim() };

    await updateProfile(payload);
    if (storeInfo) {
      setStoreInfo((prev) => ({
        ...prev,
        ...(type === 'avatar' ? { logoUrl: mediaInput.trim(), userProfileUrl: mediaInput.trim() } : { coverUrl: mediaInput.trim() })
      }));
    }
    setShowMediaModal(null);
  };

  // Datos reales traídos del backend (sin datos de ejemplo)
  const [orders, setOrders] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [favorites, setFavorites] = useState(null);
  const [inventorySummary, setInventorySummary] = useState(null);
  const [conversations, setConversations] = useState(null);
  const [storeInfo, setStoreInfo] = useState(null);
  const [dataError, setDataError] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await updateOrderStatusApi(orderId, newStatus);
    } catch (err) {
      console.warn('Servidor sin endpoint persistente de cambio de estado o error:', err);
    }
    // Actualizar estado local del array de pedidos y del pedido seleccionado si está abierto
    setOrders((prevOrders) =>
      (prevOrders || []).map((ord) =>
        ord.id === orderId ? { ...ord, estado: newStatus, status: newStatus } : ord
      )
    );
    setSelectedOrder((prevSelected) =>
      prevSelected && prevSelected.id === orderId
        ? { ...prevSelected, estado: newStatus, status: newStatus }
        : prevSelected
    );
  };

  const handleSaveCatalogProduct = async (productId, updatedFields) => {
    setSellerProducts((prev) =>
      (prev || []).map((p) => (p.id === productId ? { ...p, ...updatedFields } : p))
    );
    setSelectedCatalogProduct((prev) =>
      prev && prev.id === productId ? { ...prev, ...updatedFields } : prev
    );
  };

  const handleSendQuoteResponse = async (quoteId, responseData) => {
    setConversations((prev) =>
      (prev || []).map((c) => (c.id === quoteId ? { ...c, ...responseData } : c))
    );
    setSelectedQuote((prev) =>
      prev && prev.id === quoteId ? { ...prev, ...responseData } : prev
    );
  };

  // Catálogo: paginado en el servidor para no cargar todo el inventario en memoria de una vez
  const [sellerProducts, setSellerProducts] = useState(null);
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogPageSize, setCatalogPageSize] = useState(CATALOG_PAGE_SIZE_OPTIONS[0]);
  const [catalogTotalPages, setCatalogTotalPages] = useState(0);
  const [catalogTotalElements, setCatalogTotalElements] = useState(0);
  const [catalogSearchInput, setCatalogSearchInput] = useState('');
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(null);

  const isSeller = role === 'SELLER';
  const tabs = isSeller ? SELLER_TABS : BUYER_TABS;
  const displayName = user?.userName || user?.nombre || (isSeller ? user?.storeName : null) || 'Usuario Repuestop';
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('es-CL', { year: 'numeric', month: 'long' }) : null;

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      if (isSeller) {
        if (!user?.sellerId) throw new Error('No se encontró el identificador de tu tienda.');
        const [ordersRes, summaryRes, conversationsRes, storeRes] = await Promise.all([
          getSellerOrdersApi(user.sellerId),
          getSellerInventorySummaryApi(user.sellerId),
          getSellerConversationsApi(user.sellerId),
          getSellerStoreApi(user.sellerId),
        ]);
        setOrders(ordersRes?.content || []);
        setInventorySummary(summaryRes);
        setConversations(conversationsRes || []);
        setStoreInfo(storeRes);
      } else {
        if (!user?.userId) throw new Error('No se encontró tu identificador de usuario.');
        const [ordersRes, favoritesRes] = await Promise.all([
          getBuyerOrdersApi(user.userId),
          getFavoritesApi(user.userId),
        ]);
        setOrders(ordersRes?.content || []);
        setFavorites(favoritesRes || []);
      }
    } catch (error) {
      setDataError(error.message || 'No se pudieron cargar tus datos.');
    } finally {
      setIsLoadingData(false);
    }
  }, [isSeller, user?.sellerId, user?.userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Catálogo del proveedor: se pide en páginas acotadas (12/24/48) en vez de
  // traer todo el inventario de una sola vez, para no sobrecargar la memoria
  // del navegador cuando la tienda tiene cientos de productos.
  useEffect(() => {
    if (!isSeller || activeTab !== 'productos' || !user?.sellerId) return;

    let cancelled = false;
    setIsCatalogLoading(true);
    setCatalogError(null);

    getSellerInventoryApi(user.sellerId, { page: catalogPage, size: catalogPageSize, texto: catalogSearchTerm || undefined })
      .then((res) => {
        if (cancelled) return;
        setSellerProducts(res?.content || []);
        setCatalogTotalPages(res?.totalPages ?? 0);
        setCatalogTotalElements(res?.totalElements ?? 0);
      })
      .catch((error) => {
        if (cancelled) return;
        setCatalogError(error.message || 'No se pudo cargar el catálogo.');
      })
      .finally(() => {
        if (!cancelled) setIsCatalogLoading(false);
      });

    return () => { cancelled = true; };
  }, [isSeller, activeTab, user?.sellerId, catalogPage, catalogPageSize, catalogSearchTerm]);

  const handleCatalogSearchSubmit = (e) => {
    e.preventDefault();
    setCatalogPage(0);
    setCatalogSearchTerm(catalogSearchInput.trim());
  };

  const handleCatalogPageSizeChange = (size) => {
    setCatalogPageSize(size);
    setCatalogPage(0);
  };

  const handleLogout = () => {
    logout();
    onBackToStore();
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    const payload = {
      userName: nameDraft,
      phone: phoneDraft,
      address: addressDraft,
      comuna: comunaDraft,
      region: regionDraft,
    };

    if (isSeller) {
      payload.storeName = storeNameDraft;
      payload.taxId = taxIdDraft;
      payload.shippingMethods = shippingMethodsDraft;
    }

    const result = await updateProfile(payload);
    setIsSaving(false);

    if (result.success) {
      // Actualizar también el estado local de la tienda
      if (storeInfo) {
        setStoreInfo((prev) => ({
          ...prev,
          storeName: storeNameDraft || prev?.storeName,
          taxId: taxIdDraft || prev?.taxId,
          address: addressDraft || prev?.address,
          comuna: comunaDraft || prev?.comuna,
          region: regionDraft || prev?.region,
          shippingMethods: shippingMethodsDraft || prev?.shippingMethods,
          banco: bancoDraft,
          tipoCuenta: tipoCuentaDraft,
          numCuenta: numCuentaDraft,
          rutTitular: rutTitularDraft,
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

          <button className="btn-back-to-store" onClick={onBackToStore}>
            <ArrowLeft size={16} />
            <span>Volver a la tienda</span>
          </button>

          <div className="profile-topbar-user">
            <div className={`profile-role-chip ${isSeller ? 'chip-seller' : 'chip-buyer'}`}>
              {isSeller ? <Store size={13} /> : <ShoppingBag size={13} />}
              <span>{isSeller ? 'Proveedor' : 'Comprador'}</span>
            </div>
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
            backgroundImage: user?.coverUrl || storeInfo?.coverUrl
              ? `url(${user?.coverUrl || storeInfo?.coverUrl})`
              : 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0066ff 100%)',
          }}
        >
          <button
            className="btn-change-cover-photo"
            onClick={() => handleOpenMediaModal('cover')}
            title="Cambiar Foto de Portada"
          >
            <Camera size={15} />
            <span>Editar Portada</span>
          </button>
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
                  <Sparkles size={13} /> Beneficio Tarifa Fundador Activo (5%)
                </span>
              )}
            </div>
          </div>
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
                            <div className="shortcut-icon shortcut-amber"><Package size={20} /></div>
                            <div className="shortcut-info">
                              <strong>Administrar Catálogo</strong>
                              <span>Ajustar precios, stock e inventario publicado</span>
                            </div>
                            <ArrowUpRight size={16} className="shortcut-arrow" />
                          </div>

                          <div className="quick-shortcut-card" onClick={() => setActiveTab('cotizaciones')}>
                            <div className="shortcut-icon shortcut-purple"><MessageSquare size={20} /></div>
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

                          <div className="quick-shortcut-card" onClick={() => setActiveTab('direcciones')}>
                            <div className="shortcut-icon shortcut-amber"><MapPin size={20} /></div>
                            <div className="shortcut-info">
                              <strong>Dirección de Entrega</strong>
                              <span>Gestiona tus ubicaciones de despacho</span>
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
                <div className="profile-panel">
                  <h2 className="profile-panel-title">{isSeller ? 'Pedidos Recibidos' : 'Mis Pedidos'}</h2>
                  {(orders || []).length === 0 ? (
                    <EmptyState label={isSeller ? 'Aún no has recibido pedidos.' : 'Aún no has realizado pedidos.'} />
                  ) : (
                    <div className="profile-orders-cards-grid">
                      {orders.map((order) => (
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

              {activeTab === 'direcciones' && !isSeller && (
                <div className="profile-panel">
                  <h2 className="profile-panel-title">Mis Direcciones</h2>
                  {(user?.address || user?.comuna) ? (
                    <div className="profile-address-card">
                      <MapPin size={18} />
                      <div>
                        <strong>{user?.address || 'Dirección registrada'}</strong>
                        <span>{[user?.comuna, user?.region].filter(Boolean).join(', ')}</span>
                      </div>
                      <span className="address-default-tag">Principal</span>
                    </div>
                  ) : (
                    <EmptyState label="Aún no tienes una dirección registrada." />
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

                    <form className="catalog-search-form" onSubmit={handleCatalogSearchSubmit}>
                      <Search size={14} />
                      <input
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        value={catalogSearchInput}
                        onChange={(e) => setCatalogSearchInput(e.target.value)}
                      />
                    </form>
                  </div>

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
                      <div className="profile-orders-cards-grid">
                        {sellerProducts.map((p) => (
                          <CatalogCard
                            key={p.id}
                            product={p}
                            onSelectProduct={(item) => setSelectedCatalogProduct(item)}
                            onQuickEditStock={(item) => setSelectedCatalogProduct(item)}
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

              {activeTab === 'cotizaciones' && isSeller && (
                <div className="profile-panel">
                  <h2 className="profile-panel-title">Solicitudes de Cotización</h2>
                  {(conversations || []).length === 0 ? (
                    <EmptyState label="Aún no tienes solicitudes de cotización." />
                  ) : (
                    <div className="profile-orders-cards-grid">
                      {conversations.map((c) => (
                        <QuoteCard
                          key={c.id}
                          quote={c}
                          onSelectQuote={(item) => setSelectedQuote(item)}
                          onQuickRespond={(item) => setSelectedQuote(item)}
                        />
                      ))}
                    </div>
                  )}
                </div>
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
                          setComunaDraft(storeInfo?.comuna || user?.comuna || '');
                          setRegionDraft(storeInfo?.region || user?.region || '');
                          setShippingMethodsDraft(storeInfo?.shippingMethods || 'Starken, Chilexpress, Retiro en Tienda');
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
                      <div className="form-section-title">Datos Personales y de Representante</div>
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label>Nombre Completo / Representante</label>
                          <input type="text" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} required />
                        </div>
                        <div className="form-group">
                          <label>Teléfono Móvil</label>
                          <input type="tel" value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} placeholder="+56 9 1234 5678" />
                        </div>
                      </div>

                      {isSeller && (
                        <>
                          <div className="form-section-title" style={{ marginTop: '16px' }}>Datos de la Tienda y Empresa</div>
                          <div className="form-grid-2">
                            <div className="form-group">
                              <label>Nombre de la Tienda</label>
                              <input type="text" value={storeNameDraft} onChange={(e) => setStoreNameDraft(e.target.value)} required />
                            </div>
                            <div className="form-group">
                              <label>RUT Empresa / Identificador Fiscal</label>
                              <input type="text" value={taxIdDraft} onChange={(e) => setTaxIdDraft(e.target.value)} placeholder="12.345.678-K" />
                            </div>
                          </div>

                          <div className="form-group">
                            <label>Dirección Comercial de Despacho</label>
                            <input type="text" value={addressDraft} onChange={(e) => setAddressDraft(e.target.value)} placeholder="Av. Italia 1234, Local 5" />
                          </div>

                          <div className="form-grid-2">
                            <div className="form-group">
                              <label>Comuna</label>
                              <input type="text" value={comunaDraft} onChange={(e) => setComunaDraft(e.target.value)} placeholder="Providencia" />
                            </div>
                            <div className="form-group">
                              <label>Región</label>
                              <input type="text" value={regionDraft} onChange={(e) => setRegionDraft(e.target.value)} placeholder="Región Metropolitana" />
                            </div>
                          </div>

                          <div className="form-group">
                            <label>Métodos de Envío Aceptados</label>
                            <input type="text" value={shippingMethodsDraft} onChange={(e) => setShippingMethodsDraft(e.target.value)} placeholder="Starken, Chilexpress, Retiro en Tienda" />
                          </div>

                          <div className="form-section-title" style={{ marginTop: '16px' }}>Datos de Cuenta Bancaria de Cobro</div>
                          <div className="form-grid-2">
                            <div className="form-group">
                              <label>Banco Destino</label>
                              <input type="text" value={bancoDraft} onChange={(e) => setBancoDraft(e.target.value)} placeholder="Banco de Chile / BCI / Estado" />
                            </div>
                            <div className="form-group">
                              <label>Tipo de Cuenta</label>
                              <select value={tipoCuentaDraft} onChange={(e) => setTipoCuentaDraft(e.target.value)} className="status-select-input">
                                <option value="Cuenta Corriente">Cuenta Corriente</option>
                                <option value="Cuenta Vista">Cuenta Vista / RUT</option>
                                <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
                              </select>
                            </div>
                          </div>
                          <div className="form-grid-2">
                            <div className="form-group">
                              <label>Número de Cuenta</label>
                              <input type="text" value={numCuentaDraft} onChange={(e) => setNumCuentaDraft(e.target.value)} placeholder="123456789" />
                            </div>
                            <div className="form-group">
                              <label>RUT Titular de la Cuenta</label>
                              <input type="text" value={rutTitularDraft} onChange={(e) => setRutTitularDraft(e.target.value)} placeholder="76.123.456-7" />
                            </div>
                          </div>
                        </>
                      )}

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
                                <Sparkles size={12} /> Beneficio Tarifa Fundador Activo (5%)
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
                            <div className="details-info-row">
                              <span className="info-label">Tipo de Cuenta</span>
                              <strong className="info-value">{isSeller ? 'Proveedor Oficial RepuesTop' : 'Comprador Verificado'}</strong>
                            </div>
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
                          <div className="details-info-list">
                            <div className="details-info-row">
                              <span className="info-label"><MapPin size={13} /> Dirección Comercial</span>
                              <strong className="info-value">{storeInfo?.address || user?.address || 'Dirección no registrada'}</strong>
                            </div>
                            <div className="details-info-row">
                              <span className="info-label">Comuna / Región</span>
                              <strong className="info-value">
                                {[storeInfo?.comuna || user?.comuna, storeInfo?.region || user?.region].filter(Boolean).join(', ') || '—'}
                              </strong>
                            </div>
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
                              <div className="details-info-row">
                                <span className="info-label">Banco Destino</span>
                                <strong className="info-value">{storeInfo?.banco || 'Banco de Chile'}</strong>
                              </div>
                              <div className="details-info-row">
                                <span className="info-label">Tipo de Cuenta</span>
                                <strong className="info-value">{storeInfo?.tipoCuenta || 'Cuenta Corriente'}</strong>
                              </div>
                              <div className="details-info-row">
                                <span className="info-label">Número de Cuenta</span>
                                <strong className="info-value bank-account-number">{storeInfo?.numCuenta || '123-45678-90'}</strong>
                              </div>
                              <div className="details-info-row">
                                <span className="info-label">RUT del Titular</span>
                                <strong className="info-value">{storeInfo?.rutTitular || storeInfo?.taxId || user?.taxId || '—'}</strong>
                              </div>
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
        <CatalogDetailModal
          product={selectedCatalogProduct}
          onClose={() => setSelectedCatalogProduct(null)}
          onSaveProduct={handleSaveCatalogProduct}
        />
      )}

      {selectedQuote && (
        <QuoteDetailModal
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onSendQuoteResponse={handleSendQuoteResponse}
        />
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

              <div className="media-url-divider">
                <span>O ingresa la URL de la imagen</span>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Enlace URL de la Imagen
                </label>
                <input
                  type="url"
                  placeholder={showMediaModal === 'avatar' ? 'https://... (400x400 px)' : 'https://... (1200x450 px)'}
                  value={mediaInput}
                  onChange={(e) => setMediaInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '13.5px',
                    background: '#f8fafc',
                    color: 'var(--text-primary)'
                  }}
                />
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
                <button type="submit" className="btn-auth-primary" disabled={!mediaInput} style={{ width: 'auto' }}>
                  <Save size={16} /> Guardar Imagen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
