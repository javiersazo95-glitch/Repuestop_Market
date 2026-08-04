import React, { useState } from 'react';
import {
  Truck, ShieldCheck, Store, HelpCircle, Search, ShoppingCart, User,
  ChevronDown, X, LogOut, LayoutDashboard, Building2, Wrench, Menu,
  Package, Tag
} from 'lucide-react';
import { SIDEBAR_CATEGORIES } from '../data/categories';
import RepuesTopLogo from './RepuesTopLogo';
import { useAuth } from '../context/AuthContext';

export default function Header({
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
  onSelectCategory
}) {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, isLoggedIn, role, logout } = useAuth();

  const handleUserBoxClick = () => {
    if (isLoggedIn) setShowUserMenu((open) => !open);
    else onOpenAuthModal();
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
  };

  return (
    <header className="trust-header-main light-market-header">
      <div className="top-trust-bar-vivid">
        <div className="container top-trust-content-vivid">
          <div className="trust-items-left-vivid">
            <span className="trust-item-plain"><Truck size={15} /> Envíos a todo Chile</span>
            <span className="trust-item-plain"><ShieldCheck size={15} /> Compra protegida</span>
            <button className="trust-item-plain utility-link" onClick={onOpenStores}>
              <Store size={15} /> Más de 500 tiendas verificadas
            </button>
          </div>
          <div className="trust-items-right-vivid">
            <button className="trust-item-plain utility-link" onClick={onOpenHelp}>
              Centro de ayuda <HelpCircle size={14} />
            </button>
            <button className="top-seller-link" onClick={onOpenSellerModal}>Vende en RepuestosTop</button>
          </div>
        </div>
      </div>

      <div className="container header-brand-row">
        <button className="brand-logo-official" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <RepuesTopLogo height={66} />
        </button>

        <form className="header-search-console" onSubmit={(event) => { event.preventDefault(); onSearchSubmit(); }}>
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input-main"
              placeholder="Ingresa tu patente, código OEM, VIN o repuesto"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchQuery && (
              <button type="button" className="btn-clear-text" onClick={() => setSearchQuery('')} aria-label="Limpiar búsqueda">
                <X size={15} />
              </button>
            )}
            <ChevronDown size={16} className="header-search-chevron" />
          </div>
          <button type="submit" className="btn-search-blue">
            <Search size={20} />
            <span>Buscar repuestos</span>
          </button>
        </form>

        <div className="header-user-group">
          <div className={`user-login-box ${isLoggedIn ? 'logged-in' : ''}`} onClick={handleUserBoxClick}>
            <div className="avatar-wrap">
              {isLoggedIn && user?.userProfileUrl ? (
                <img src={user.userProfileUrl} alt="" className="user-avatar-photo" referrerPolicy="no-referrer" />
              ) : isLoggedIn && role === 'SELLER' ? <Store size={22} /> : <User size={23} />}
            </div>
            <div className="user-meta">
              <span className="user-main">{isLoggedIn ? (user?.userName || user?.storeName || 'Mi cuenta') : 'Mi cuenta'}</span>
              <span className="user-sub">{isLoggedIn ? 'Ver perfil' : 'Iniciar sesión'}</span>
            </div>

            {isLoggedIn && showUserMenu && (
              <div className="user-dropdown-menu" onClick={(event) => event.stopPropagation()}>
                <div className="user-dropdown-header">
                  <strong>{user?.userName || user?.storeName || 'Usuario RepuestosTop'}</strong>
                  <span className="dropdown-user-email">{user?.email}</span>
                </div>
                <div className="user-dropdown-body">
                  <button className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenProfile?.(); }}><LayoutDashboard size={15} /> Mi perfil</button>
                  <button className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenStores?.(); }}><Building2 size={15} /> Tiendas verificadas</button>
                  <button className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenCatalog?.(); }}><Wrench size={15} /> Catálogo de repuestos</button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item logout-item" onClick={handleLogout}><LogOut size={15} /> Cerrar sesión</button>
                </div>
              </div>
            )}
          </div>

          <div className="header-divider" />
          <button className="cart-trigger-box" onClick={onOpenCart}>
            <div className="cart-badge-wrap">
              <ShoppingCart size={24} />
              {cartCount > 0 && <span className="cart-badge-num">{cartCount}</span>}
            </div>
            <div className="cart-meta">
              <span className="cart-lbl">Mi carrito</span>
              <span className="cart-val">{cartCount}</span>
            </div>
          </button>
        </div>
      </div>

      <nav className="header-primary-nav">
        <div className="container primary-nav-inner">
          <div className="categories-nav-wrap">
            <button className="categories-nav-button" onClick={() => setShowCategoryMenu((open) => !open)}>
              <Menu size={20} /> Categorías
            </button>
            {showCategoryMenu && (
              <div className="header-category-dropdown">
                {SIDEBAR_CATEGORIES.map((category) => (
                  <button key={category.id} onClick={() => { setShowCategoryMenu(false); onSelectCategory(category.id); }}>
                    {category.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={onOpenStores}><Store size={16} /> Tiendas</button>
          <button onClick={onOpenCatalog}><Package size={16} /> Catálogo de repuestos</button>
          <button className="offers-nav-link" onClick={onOpenCatalog}><Tag size={16} /> Ofertas</button>
          <button onClick={onOpenHelp}><HelpCircle size={16} /> Ayuda</button>
        </div>
      </nav>
    </header>
  );
}
