import React, { useState } from 'react';
import { 
  Truck, Store, ShieldCheck, Headphones, Camera, 
  Search, ShoppingCart, User, ChevronDown, X, Lock, CheckCircle2, Database, Layers, ArrowRight 
} from 'lucide-react';
import { SIDEBAR_CATEGORIES } from '../data/categories';
import RepuesTopLogo from './RepuesTopLogo';

export default function Header({ 
  activeVehicle, 
  onOpenSellerModal, 
  cartCount, 
  onOpenCart,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  selectedCategory,
  onSelectCategory
}) {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  return (
    <header className="trust-header-main">
      {/* 1. RESTORED: Top High-Trust Inventory & Security Bar */}
      <div className="top-trust-bar-vivid">
        <div className="container top-trust-content-vivid">
          <div className="trust-items-left-vivid">
            <span className="trust-item-pill">
              <Database size={14} className="icon-cyan-glow" /> 
              <span><strong>Red Nacional de Inventarios</strong> (+1.200 Vendedores)</span>
            </span>

            <span className="top-bar-dot">•</span>

            <span className="trust-item-pill">
              <Layers size={14} className="icon-blue-glow" /> 
              <span><strong>+450.000 Repuestos</strong> Sincronizados</span>
            </span>

            <span className="top-bar-dot">•</span>

            <span className="trust-item-pill">
              <Lock size={13} className="icon-green-glow" /> 
              <span>Boleta y Factura Electrónica</span>
            </span>
          </div>

          <div className="trust-items-right-vivid">
            <button className="seller-badge-btn" onClick={onOpenSellerModal}>
              <Store size={13} className="icon-cyan" /> 
              <span><strong>¿Vendes repuestos?</strong> Conectar Mi Inventario (Bsale/ERP)</span>
              <ArrowRight size={12} />
            </button>

            <span className="top-divider-vivid">|</span>

            <span className="top-help-link-vivid">
              <Headphones size={13} className="icon-cyan" /> 
              <span>Mesa de Soporte: <strong>+56 2 2938 4000</strong></span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Brand Header Row */}
      <div className="container header-brand-row">
        {/* Official Brand Logo */}
        <div className="brand-logo-official" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <RepuesTopLogo height={48} />
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
          <div className="user-login-box">
            <User size={22} className="user-avatar-icon" />
            <div className="user-meta">
              <span className="user-sub">Portal Clientes</span>
              <span className="user-main">Iniciar sesión <ChevronDown size={12} /></span>
            </div>
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

      {/* 3. Active Garage Vehicle Tag Bar */}
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
