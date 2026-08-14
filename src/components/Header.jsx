import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Truck, ShieldCheck, Store, HelpCircle, Search, ShoppingCart, User,
  ChevronDown, ChevronRight, X, LogOut, LayoutDashboard, MessageSquare, Menu,
  Package, Tag, Info
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '../services/queryKeys';
import { CATEGORY_VISUALS, HEADER_CATEGORIES } from '../data/categories';
import RepuesTopLogo from './RepuesTopLogo';
import { useAuth } from '../context/AuthContext';
import { getPartCategoriesApi, getPartSubcategoriesApi, getPublicProductsApi, resolveMediaUrl } from '../services/api';
import CategoryIconTile from './CategoryIconTile';

export default function Header({
  cartCount,
  onOpenCart,
  onOpenAuthModal,
  onOpenSellerModal,
  onOpenProfile,
  onOpenHome,
  onOpenStores,
  onOpenCatalog,
  onOpenAbout,
  onOpenHelp,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  onSelectCategory
}) {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [activeHeaderCategoryId, setActiveHeaderCategoryId] = useState(HEADER_CATEGORIES[0].id);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [highlightedSubcategory, setHighlightedSubcategory] = useState('');
  const [subcategoryInventory, setSubcategoryInventory] = useState({});
  const [showUserMenu, setShowUserMenu] = useState(false);
  const categorySearchInputRef = useRef(null);
  const categoryMenuRef = useRef(null);
  const userMenuRef = useRef(null);
  const categoryButtonRefs = useRef(new Map());
  const subcategoryCardRefs = useRef(new Map());
  const { user, isLoggedIn, role, logout } = useAuth();
  const isSellerAccount = String(user?.role || role || '').toUpperCase() === 'SELLER'
    && Boolean(user?.sellerId);
  const inventoryPanelUrl = __DEPLOY_BRANCH__ === 'main'
    ? 'https://inventario.repuestop.cl'
    : 'https://dev-inventario.repuestop.cl';

  const openInventoryPanel = () => {
    setShowUserMenu(false);
    window.location.assign(inventoryPanelUrl);
  };

  const activeHeaderCategory = useMemo(
    () => HEADER_CATEGORIES.find((category) => category.id === activeHeaderCategoryId) || HEADER_CATEGORIES[0],
    [activeHeaderCategoryId]
  );

  const normalizeCatalogName = (value) => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');

  const normalizeSearchText = (value) => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();

  const categorySearchResults = useMemo(() => {
    const query = normalizeSearchText(categorySearchQuery);
    if (!query) return [];

    return HEADER_CATEGORIES.flatMap((category) => {
      const categoryMatch = normalizeSearchText(category.nombre).includes(query)
        ? [{ type: 'category', category, label: category.nombre }]
        : [];
      const subcategoryMatches = category.subcategories
        .filter((subcategory) => normalizeSearchText(subcategory).includes(query))
        .map((subcategory) => ({ type: 'subcategory', category, label: subcategory }));
      return [...categoryMatch, ...subcategoryMatches];
    }).sort((left, right) => {
      const leftStarts = normalizeSearchText(left.label).startsWith(query) ? 0 : 1;
      const rightStarts = normalizeSearchText(right.label).startsWith(query) ? 0 : 1;
      return leftStarts - rightStarts || left.label.localeCompare(right.label, 'es');
    }).slice(0, 12);
  }, [categorySearchQuery]);

  const { data: backendCategories = [] } = useQuery({
    queryKey: qk.categories(),
    queryFn: async ({ signal }) => {
      try {
        const items = await getPartCategoriesApi({ signal });
        return Array.isArray(items) ? items : [];
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  const getBackendCategory = (category) => backendCategories.find((item) =>
    normalizeCatalogName(item.nombre) === normalizeCatalogName(category.nombre));

  // Se consulta una página por subcategoría para recibir totalElements: el número
  // mostrado es el total publicado en el sistema, no solo los elementos cargados.
  //
  // PERF: el panel de subcategorías solo se monta con showCategoryMenu === true
  // (linea ~311), pero antes este efecto no lo comprobaba y disparaba las N
  // peticiones (una por subcategoría de la categoría activa, con su propio
  // preflight CORS cada una) en cada carga de página, en todo el sitio, aunque
  // el usuario nunca abriera el menú. No existe un endpoint agregado de
  // subcategorías (a diferencia de /resumen-categorias) porque este panel
  // también necesita una imagen representativa por subcategoría, no solo el
  // total; mientras no exista, la mitigación real es no pagar el costo hasta
  // que el usuario efectivamente abre el menú.
  useEffect(() => {
    if (!showCategoryMenu) return undefined;
    let active = true;
    const backendCategory = getBackendCategory(activeHeaderCategory);
    if (!backendCategory?.id) return () => { active = false; };

    const loadCounts = async () => {
      let backendSubcategories = [];
      try {
        backendSubcategories = await getPartSubcategoriesApi(backendCategory.id);
      } catch {
        return;
      }
      const subcategoriesByName = new Map((Array.isArray(backendSubcategories) ? backendSubcategories : [])
        .map((subcategory) => [normalizeCatalogName(subcategory.nombre), subcategory]));
      const pending = activeHeaderCategory.subcategories.filter((subcategory) => {
        const key = `${activeHeaderCategory.id}:${subcategory}`;
        return subcategoriesByName.has(normalizeCatalogName(subcategory)) && subcategoryInventory[key] === undefined;
      });
      if (!pending.length) return;
      const entries = await Promise.all(pending.map(async (subcategory) => {
        const backendSubcategory = subcategoriesByName.get(normalizeCatalogName(subcategory));
        try {
          const page = await getPublicProductsApi({ page: 0, size: 1, subcategoriaId: backendSubcategory.id, sort: 'createdAt,desc' });
          return [
            `${activeHeaderCategory.id}:${subcategory}`,
            { count: Number(page?.totalElements || 0), image: page?.content?.[0]?.imageUrls?.[0] || null, subcategoryId: backendSubcategory.id },
          ];
        } catch {
          return [`${activeHeaderCategory.id}:${subcategory}`, { count: 0, image: null }];
        }
      }));
      if (active) setSubcategoryInventory((current) => ({ ...current, ...Object.fromEntries(entries) }));
    };
    loadCounts();
    return () => { active = false; };
  }, [showCategoryMenu, activeHeaderCategory, backendCategories, subcategoryInventory]);

  useEffect(() => {
    if (showCategoryMenu) requestAnimationFrame(() => categorySearchInputRef.current?.focus());
    else {
      setCategorySearchQuery('');
      setHighlightedSubcategory('');
    }
  }, [showCategoryMenu]);

  useEffect(() => {
    if (!highlightedSubcategory || categorySearchQuery) return;
    requestAnimationFrame(() => {
      categoryButtonRefs.current.get(activeHeaderCategoryId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      subcategoryCardRefs.current.get(highlightedSubcategory)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [activeHeaderCategoryId, categorySearchQuery, highlightedSubcategory]);

  const hoverTimeoutRef = useRef(null);
  const searchSelectionLockRef = useRef(false);

  useEffect(() => {
    if (!showCategoryMenu && !showUserMenu) return;
    const handleClickOutside = (event) => {
      if (showCategoryMenu && categoryMenuRef.current && !categoryMenuRef.current.contains(event.target)) {
        setShowCategoryMenu(false);
      }
      if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showCategoryMenu, showUserMenu]);

  const handleCategoryMouseEnter = (categoryId) => {
    if (searchSelectionLockRef.current) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const delay = highlightedSubcategory ? 300 : 80;
    hoverTimeoutRef.current = setTimeout(() => {
      if (searchSelectionLockRef.current) return;
      setActiveHeaderCategoryId(categoryId);
      setHighlightedSubcategory('');
    }, delay);
  };

  const handleCategorySearchResult = (result) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    searchSelectionLockRef.current = true;
    setTimeout(() => {
      searchSelectionLockRef.current = false;
    }, 600);
    setActiveHeaderCategoryId(result.category.id);
    setHighlightedSubcategory(result.type === 'subcategory' ? result.label : '');
    setCategorySearchQuery('');
  };

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
        <button className="brand-logo-official" onClick={() => { onOpenHome?.(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <RepuesTopLogo height={66} />
        </button>

        <form className="header-search-console" onSubmit={(event) => { event.preventDefault(); onSearchSubmit(); }}>
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input-main"
              placeholder="Ingresa tu patente, código OEM o repuesto"
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
          <div ref={userMenuRef} className={`user-login-box ${isLoggedIn ? 'logged-in' : ''}`} onClick={handleUserBoxClick}>
            <div className="avatar-wrap">
              {isLoggedIn && user?.userProfileUrl ? (
                <img src={user.userProfileUrl} alt="" className="user-avatar-photo" referrerPolicy="no-referrer" />
              ) : isLoggedIn && isSellerAccount ? <Store size={22} /> : <User size={23} />}
            </div>
            <div className="user-meta">
              <span className="user-main">{isLoggedIn ? (user?.userName || user?.storeName || 'Mi cuenta') : 'Mi cuenta'}</span>
              <span className="user-sub">
                {isLoggedIn ? 'Ver perfil' : 'Iniciar sesión'}
                {isLoggedIn && <ChevronDown size={13} aria-hidden="true" />}
              </span>
            </div>

            {isLoggedIn && showUserMenu && (
              <div className="user-dropdown-menu" onClick={(event) => event.stopPropagation()}>
                <div className="user-dropdown-header">
                  <strong>{user?.userName || user?.storeName || 'Usuario RepuestosTop'}</strong>
                  <span className="dropdown-user-email">{user?.email}</span>
                </div>
                <div className="user-dropdown-body">
                  <button className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenProfile?.(); }}><LayoutDashboard size={15} /> Mi perfil</button>
                  {isSellerAccount && (
                    <button className="dropdown-item" onClick={openInventoryPanel}><Package size={15} /> Panel de inventario</button>
                  )}
                  <button className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenProfile?.('consultas'); }}><MessageSquare size={15} /> Reportes/Disputa</button>
                  <button className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenHelp?.(); }}><HelpCircle size={15} /> Soporte</button>
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
            </div>
          </button>
        </div>
      </div>

      <nav className="header-primary-nav">
        <div className="container primary-nav-inner">
          <div ref={categoryMenuRef} className="categories-nav-wrap">
            <button className="categories-nav-button" onClick={() => setShowCategoryMenu((open) => !open)}>
              <Menu size={20} /> Categorías
            </button>
            {showCategoryMenu && (
              <div className="header-category-dropdown header-category-mega-menu">
                <div className="header-category-search-wrap">
                  <Search size={16} aria-hidden="true" />
                  <input
                    ref={categorySearchInputRef}
                    type="search"
                    value={categorySearchQuery}
                    onChange={(event) => setCategorySearchQuery(event.target.value)}
                    placeholder="Buscar categoría o subcategoría"
                    aria-label="Buscar categoría o subcategoría"
                    autoComplete="off"
                  />
                  {categorySearchQuery && (
                    <button type="button" className="header-category-search-clear" onClick={() => setCategorySearchQuery('')} aria-label="Limpiar búsqueda de categorías">
                      <X size={15} />
                    </button>
                  )}
                </div>

                {categorySearchQuery ? (
                  <div className="header-category-search-results" aria-live="polite">
                    {categorySearchResults.length ? categorySearchResults.map((result) => (
                      <button
                        type="button"
                        key={`${result.type}:${result.category.id}:${result.label}`}
                        className="header-category-search-result"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleCategorySearchResult(result);
                        }}
                      >
                        <CategoryIconTile iconName={CATEGORY_VISUALS[result.category.id].iconName} color={CATEGORY_VISUALS[result.category.id].color} size={17} />
                        <span className="header-category-result-copy">
                          <strong>{result.label}</strong>
                          <small>{result.type === 'category' ? 'Categoría' : `Subcategoría de ${result.category.nombre}`}</small>
                        </span>
                        <span className="header-category-result-type">{result.type === 'category' ? 'Categoría' : 'Subcategoría'}</span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    )) : (
                      <div className="header-category-search-empty">
                        <Search size={22} aria-hidden="true" />
                        <strong>No encontramos coincidencias</strong>
                        <span>Prueba con otro nombre de categoría o repuesto.</span>
                      </div>
                    )}
                  </div>
                ) : <>
                <div className="header-category-list" aria-label="Categorías de repuestos">
                  {HEADER_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      ref={(node) => {
                        if (node) categoryButtonRefs.current.set(category.id, node);
                        else categoryButtonRefs.current.delete(category.id);
                      }}
                      className={category.id === activeHeaderCategory.id ? 'active' : ''}
                      onMouseEnter={() => handleCategoryMouseEnter(category.id)}
                      onFocus={() => handleCategoryMouseEnter(category.id)}
                      onClick={() => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                        setShowCategoryMenu(false);
                        onSelectCategory({ category: category.id, categoryId: getBackendCategory(category)?.id, categoryName: category.nombre });
                      }}
                    >
                      <span className="header-category-label"><CategoryIconTile iconName={CATEGORY_VISUALS[category.id].iconName} color={CATEGORY_VISUALS[category.id].color} size={16} />{category.nombre}</span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <div className="header-subcategory-panel">
                  <div className="header-subcategory-panel-title">
                    <strong>{activeHeaderCategory.nombre}</strong>
                    <button onClick={() => {
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      setShowCategoryMenu(false);
                      onSelectCategory({ category: activeHeaderCategory.id, categoryId: getBackendCategory(activeHeaderCategory)?.id, categoryName: activeHeaderCategory.nombre });
                    }}>Ver más <ChevronRight size={16} /></button>
                  </div>
                  <div className="header-subcategory-grid">
                    {activeHeaderCategory.subcategories.map((subcategory) => {
                      const inventory = subcategoryInventory[`${activeHeaderCategory.id}:${subcategory}`];
                      const productImage = inventory?.image;
                      const categoryImage = activeHeaderCategory.subcategoryImages?.[subcategory];
                      return (
                        <button
                          key={subcategory}
                          ref={(node) => {
                            if (node) subcategoryCardRefs.current.set(subcategory, node);
                            else subcategoryCardRefs.current.delete(subcategory);
                          }}
                          className={`header-subcategory-card ${highlightedSubcategory === subcategory ? 'search-highlighted' : ''}`}
                          onClick={() => {
                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                            setShowCategoryMenu(false);
                            onSelectCategory({ category: activeHeaderCategory.id, categoryId: getBackendCategory(activeHeaderCategory)?.id, categoryName: activeHeaderCategory.nombre, subcategoryId: inventory?.subcategoryId, subcategory: subcategory });
                          }}
                        >
                          <img src={categoryImage || (productImage ? resolveMediaUrl(productImage) : activeHeaderCategory.image)} alt="" />
                          <span className="header-subcategory-name">{subcategory}</span>
                          <span className="header-subcategory-count">{inventory?.count ?? 0} repuestos</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                </>}
              </div>
            )}
          </div>
          <button onClick={onOpenStores}><Store size={16} /> Tiendas</button>
          <button onClick={onOpenCatalog}><Package size={16} /> Catálogo de repuestos</button>
          <button className="offers-nav-link" onClick={onOpenCatalog}><Tag size={16} /> Ofertas</button>
          <button onClick={onOpenAbout}><Info size={16} /> Sobre RepuesTop</button>
          <button onClick={onOpenHelp}><HelpCircle size={16} /> Ayuda</button>
        </div>
      </nav>
    </header>
  );
}
