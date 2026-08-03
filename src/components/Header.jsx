import React, { useState } from 'react';
import {
  Truck, Users, ShieldCheck, MessageCircle, Package, HelpCircle,
  Search, ShoppingCart, User, ChevronDown, X, CheckCircle2, LogOut, Store, Car, LayoutDashboard,
  Building2, Wrench
} from 'lucide-react';
import { SIDEBAR_CATEGORIES } from '../data/categories';
import RepuesTopLogo from './RepuesTopLogo';
import { useAuth } from '../context/AuthContext';

export default function Header({
  activeVehicle,
  cartCount,
  onOpenCart,
  onOpenAuthModal,
  onOpenSellerModal,
  onOpenProfile,
  onOpenStores,
  onOpenCatalog,
  onOpenHelp,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  selectedCategory,
  onSelectCategory
}) {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const { user, isLoggedIn, role, logout } = useAuth();

  const handleUserBoxClick = () => {
    if (isLoggedIn) {
      setShowUserMenu(!showUserMenu);
    } else {
      onOpenAuthModal();
    }
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
  };

  return (
    <header className="trust-header-main">
      {/* 1. Minimal Top Utility Bar */}
      <div className="top-trust-bar-vivid">
        <div className="container top-trust-content-vivid">
          <div className="trust-items-left-vivid">
            <span className="trust-item-plain">
              <Truck size={15} />
              <span>Envíos a todo Chile</span>
            </span>

            <span className="trust-item-plain" onClick={onOpenStores} style={{ cursor: 'pointer' }} title="Ver Directorio Completo de Tiendas">
              <Users size={15} />
              <span>Más de 500 vendedores</span>
            </span>

            <span className="trust-item-plain">
              <ShieldCheck size={15} />
              <span>Compra segura</span>
            </span>

            <span className="trust-item-plain" onClick={onOpenHelp} style={{ cursor: 'pointer' }} title="Centro de Soporte y Mediación">
              <MessageCircle size={15} />
              <span>Soporte</span>
            </span>
          </div>

          <div className="trust-items-right-vivid">
            <span className="trust-item-plain" onClick={handleUserBoxClick} style={{ cursor: 'pointer' }}>
              <Package size={15} />
              <span>Mis pedidos</span>
            </span>

            <span className="trust-item-plain" onClick={onOpenHelp} style={{ cursor: 'pointer' }} title="Centro de Ayuda y Preguntas Frecuentes">
              <HelpCircle size={15} />
              <span>Ayuda</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Brand Header Row */}
      <div className="container header-brand-row">
        {/* Official Brand Logo */}
        <div className="brand-logo-official" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <RepuesTopLogo height={64} />
        </div>

        {/* Central Search Bar Console */}
        <form className="header-search-console" onSubmit={(e) => { e.preventDefault(); onSearchSubmit(); }}>
          <div className="cat-selector-btn" onClick={() => setShowCategoryMenu(!showCategoryMenu)}>
            <span>{selectedCategory ? SIDEBAR_CATEGORIES.find(c => c.id === selectedCategory)?.nombre : 'Todas las categorías'}</span>
            <ChevronDown size={14} />

            {showCategoryMenu && (
              <div className="cat-dropdown-menu">
                <div className="cat-dropdown-item" onClick={() => onSelectCategory(null)}>Todas las categorías</div>
                {SIDEBAR_CATEGORIES.map(cat => (
                  <div key={cat.id} className="cat-dropdown-item" onClick={() => onSelectCategory(cat.id)}>
                    {cat.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="search-input-wrapper">
            <input 
              type="text"
              className="search-input-main"
              placeholder={activeVehicle ? `Buscar en el inventario para ${activeVehicle.marca} ${activeVehicle.modelo}...` : 'Consultar inventario por repuesto, código OEM o modelo...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" className="btn-clear-text" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <button type="submit" className="btn-search-blue">
            <Search size={18} />
            <span>Consultar</span>
          </button>
        </form>

        {/* User Account & Cart Drawer Trigger */}
        <div className="header-user-group">
          <div className={`user-login-box ${isLoggedIn ? 'logged-in' : ''}`} onClick={handleUserBoxClick}>
            <div className="avatar-wrap">
              {isLoggedIn && user?.userProfileUrl ? (
                <img src={user.userProfileUrl} alt="" className="user-avatar-photo" referrerPolicy="no-referrer" />
              ) : isLoggedIn && role === 'SELLER' ? (
                <Store size={20} className="user-avatar-icon seller-icon" />
              ) : (
                <User size={22} className="user-avatar-icon" />
              )}
            </div>

            <div className="user-meta">
              {isLoggedIn ? (
                <>
                  <span className="user-sub">
                    {role === 'SELLER' ? 'Tienda Vendedora' : 'Modo Comprador'}
                  </span>
                  <span className="user-main font-semibold">
                    {user?.userName || user?.storeName || user?.email?.split('@')[0] || 'Mi Cuenta'}
                    <ChevronDown size={12} />
                  </span>
                </>
              ) : (
                <>
                  <span className="user-sub">Portal Clientes</span>
                  <span className="user-main">Iniciar sesión <ChevronDown size={12} /></span>
                </>
              )}
            </div>

            {/* Dropdown Menu when Logged In */}
            {isLoggedIn && showUserMenu && (
              <div className="user-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                <div className="user-dropdown-header">
                  {user?.userProfileUrl && (
                    <img src={user.userProfileUrl} alt="" className="dropdown-user-photo" referrerPolicy="no-referrer" />
                  )}
                  <span className="dropdown-user-name">{user?.userName || user?.storeName || 'Usuario Repuestop'}</span>
                  <span className="dropdown-user-email">{user?.email}</span>
                  <span className={`dropdown-role-badge ${role === 'SELLER' ? 'badge-seller' : 'badge-buyer'}`}>
                    {role === 'SELLER' ? 'PROVEEDOR ACTIVO' : 'COMPRADOR ACTIVO'}
                  </span>
                </div>

                <div className="user-dropdown-body">
                  <div className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenProfile?.(); }}>
                    <LayoutDashboard size={15} />
                    <span>Mi Perfil</span>
                  </div>

                  <div className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenStores?.(); }}>
                    <Building2 size={15} />
                    <span>Directorio de Tiendas Verificadas</span>
                  </div>

                  <div className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenCatalog?.(); }}>
                    <Wrench size={15} />
                    <span>Catálogo General de Repuestos</span>
                  </div>

                  {role === 'SELLER' && (
                    <div className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenProfile?.(); }}>
                      <Store size={15} />
                      <span>Panel Tienda / Inventario</span>
                    </div>
                  )}

                  <div className="dropdown-divider" />

                  <div className="dropdown-item logout-item" onClick={handleLogout}>
                    <LogOut size={15} />
                    <span>Cerrar Sesión</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="cart-trigger-box" onClick={onOpenCart}>
            <div className="cart-badge-wrap">
              <ShoppingCart size={22} />
              {cartCount > 0 && <span className="cart-badge-num">{cartCount}</span>}
            </div>
            <div className="cart-meta">
              <span className="cart-lbl">Mi Carrito</span>
              <span className="cart-val">{cartCount} repuesto{cartCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Quick Navigation Bar with Action Buttons */}
      <div className="header-quick-nav-bar">
        <div className="container quick-nav-inner">
          <button className="quick-nav-btn btn-nav-stores" onClick={onOpenStores}>
            <Building2 size={15} />
            <span>Visitar Tiendas Verificadas</span>
          </button>
          <button className="quick-nav-btn btn-nav-catalog" onClick={onOpenCatalog}>
            <Wrench size={15} />
            <span>Catálogo General de Repuestos</span>
          </button>
          <button className="quick-nav-btn btn-nav-help" onClick={onOpenHelp}>
            <HelpCircle size={15} />
            <span>Centro de Ayuda & Soporte</span>
          </button>
          <button className="quick-nav-btn btn-nav-seller" onClick={onOpenSellerModal}>
            <Store size={15} />
            <span>¿Tienes una Tienda? Vende Aquí</span>
          </button>
        </div>
      </div>

      {/* 4. Active Garage Vehicle Tag Bar */}
      {activeVehicle && (
        <div className="active-garage-subbar">
          <div className="container garage-subbar-content">
            <div className="garage-active-info">
              <span className="garage-tag-label">INVENTARIO FILTRADO POR PATENTE:</span>
              <span className="plate-badge-yellow">{activeVehicle.patente}</span>
              <strong className="car-model-text">{activeVehicle.marca} {activeVehicle.modelo} ({activeVehicle.anio})</strong>
              <span className="motor-text">• Motor {activeVehicle.motor}</span>
              <span className="guarantee-check"><CheckCircle2 size={14} /> Ficha Técnica de Fábrica Conectada</span>
            </div>

            <button className="btn-change-vehicle" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Consultar Otra Patente
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
