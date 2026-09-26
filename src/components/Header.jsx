import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Truck, ShieldCheck, Store, HelpCircle, Search, ShoppingCart, User,
  ChevronDown, ChevronRight, ArrowLeft, X, LogOut, LayoutDashboard, MessageSquare, Menu,
  Package, Info, Megaphone, Wrench, Heart
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '../services/queryKeys';
import { CATEGORY_VISUALS, HEADER_CATEGORIES } from '../data/categories';
import RepuesTopLogo from './RepuesTopLogo';
import { useAuth } from '../context/AuthContext';
import { INVENTORY_PANEL_URL } from '../config/inventoryPanel';
import HeaderWalletButton from './HeaderWalletButton';
import { useSellerBlocked } from '../hooks/useSellerBlocked';
import { useBuyerBlocked } from '../hooks/useBuyerBlocked';
import { getPartCategoriesApi, getPartSubcategoriesApi, getPublicProductsApi, resolveMediaUrl } from '../services/api';
import { ROUTES, buyerProfilePath, productPath } from '../routes/paths';
import CategoryIconTile from './CategoryIconTile';

// Mínimo de caracteres antes de consultar sugerencias: menos que eso trae
// demasiado ruido del backend para un autocompletado.
const SEARCH_SUGGEST_MIN_LENGTH = 2;
const SEARCH_SUGGEST_DEBOUNCE_MS = 300;

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
  onOpenAdsWall,
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
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [mobileCategoryDetail, setMobileCategoryDetail] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const categorySearchInputRef = useRef(null);
  const mobileDrawerCloseRef = useRef(null);
  const categoryMenuRef = useRef(null);
  const userMenuRef = useRef(null);
  const searchConsoleRef = useRef(null);
  const suggestDebounceRef = useRef(null);
  const categoryButtonRefs = useRef(new Map());
  const subcategoryCardRefs = useRef(new Map());
  const navigate = useNavigate();
  // Seccion activa de la barra de navegacion (aria-current="page"): la pinta el CSS.
  const { pathname } = useLocation();
  const navCurrent = (prefix) => (pathname === prefix || pathname.startsWith(`${prefix}/`) ? 'page' : undefined);
  const { user, isLoggedIn, role, logout } = useAuth();
  const { isBlocked: isSellerBlockedAccount } = useSellerBlocked();
  const { isBlocked: isBuyerBlockedAccount } = useBuyerBlocked();
  const isBlockedAccount = isSellerBlockedAccount || isBuyerBlockedAccount;
  const isSellerAccount = String(user?.role || role || '').toUpperCase() === 'SELLER'
    && Boolean(user?.sellerId);
  const inventoryPanelUrl = INVENTORY_PANEL_URL;

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
    // En el celular no se enfoca solo: abriria el teclado y taparia la lista de categorias.
    if (showCategoryMenu && !window.matchMedia('(max-width: 768px)').matches) requestAnimationFrame(() => categorySearchInputRef.current?.focus());
    else {
      setCategorySearchQuery('');
      setHighlightedSubcategory('');
      setMobileCategoryDetail(false);
    }
  }, [showCategoryMenu]);

  useEffect(() => {
    if (!showMobileNav) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => mobileDrawerCloseRef.current?.focus());
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setShowCategoryMenu(false);
        setShowMobileNav(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showMobileNav]);

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
    if (!showCategoryMenu && !showUserMenu && !isSuggestOpen) return;
    const handleClickOutside = (event) => {
      if (showCategoryMenu && categoryMenuRef.current && !categoryMenuRef.current.contains(event.target)) {
        setShowCategoryMenu(false);
      }
      if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (isSuggestOpen && searchConsoleRef.current && !searchConsoleRef.current.contains(event.target)) {
        setIsSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showCategoryMenu, showUserMenu, isSuggestOpen]);

  // Sugerencias de repuesto/código OEM mientras se escribe en la barra del header:
  // el mismo endpoint público de catálogo (`texto=`) ya matchea nombre y OEM en el backend.
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < SEARCH_SUGGEST_MIN_LENGTH) {
      setProductSuggestions([]);
      setIsSuggestLoading(false);
      return undefined;
    }

    setIsSuggestLoading(true);
    const controller = new AbortController();
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const page = await getPublicProductsApi({ texto: query, page: 0, size: 5, signal: controller.signal });
        setProductSuggestions(Array.isArray(page?.content) ? page.content : []);
      } catch {
        setProductSuggestions([]);
      } finally {
        setIsSuggestLoading(false);
      }
    }, SEARCH_SUGGEST_DEBOUNCE_MS);

    return () => {
      controller.abort();
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [searchQuery]);

  const goToSuggestion = (product) => {
    setIsSuggestOpen(false);
    setSearchQuery('');
    navigate(productPath(product));
  };

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
    if (window.matchMedia('(max-width: 640px)').matches) setMobileCategoryDetail(true);
  };

  const handleUserBoxClick = () => {
    if (isLoggedIn) setShowUserMenu((open) => !open);
    else onOpenAuthModal();
  };

  // Cerrar sesión lleva al home: quedarse en la página actual dejaba al siguiente usuario
  // que entraba parado en una pantalla ajena, p. ej. la compra exitosa del comprador anterior
  // (pruebas de lanzamiento, 25-sep).
  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
    navigate(ROUTES.home);
  };

  return (
    <header className={`trust-header-main light-market-header ${showMobileNav ? 'mobile-nav-active' : ''}`}>
      <div className="top-trust-bar-vivid">
        <div className="container top-trust-content-vivid">
          <div className="trust-items-left-vivid">
            <span className="trust-item-plain"><Truck size={15} /> Envíos a todo Chile</span>
            <span className="trust-item-plain"><ShieldCheck size={15} /> Compra protegida</span>
            <button className="trust-item-plain utility-link" onClick={onOpenStores}>
              <Store size={15} /> Casas de repuestos verificadas
            </button>
          </div>
          <div className="trust-items-right-vivid">
            <button className="trust-item-plain utility-link" onClick={onOpenHelp}>
              Centro de ayuda <HelpCircle size={14} />
            </button>
            <button className="top-seller-link" onClick={onOpenSellerModal}>
              <Store size={14} /> Vende en RepuestosTop
            </button>
          </div>
        </div>
      </div>

      <div className="container header-brand-row">
        <button className="brand-logo-official" onClick={() => { setShowMobileNav(false); setShowCategoryMenu(false); onOpenHome?.(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <RepuesTopLogo height={66} />
        </button>
        <div className="mobile-header-actions">
          <button type="button" aria-label={isLoggedIn ? 'Abrir mi perfil' : 'Iniciar sesión'} onClick={() => isLoggedIn ? onOpenProfile?.() : onOpenAuthModal?.()}><User size={22} /></button>
          {!isBlockedAccount && <button type="button" aria-label={`Abrir carrito${cartCount ? `, ${cartCount} productos` : ''}`} onClick={onOpenCart}><ShoppingCart size={22} />{cartCount > 0 && <span className="mobile-cart-count">{cartCount}</span>}</button>}
          <button type="button" className="mobile-nav-toggle" aria-label={showMobileNav ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={showMobileNav} aria-controls="marketplace-navigation" onClick={() => { if (showMobileNav) setShowCategoryMenu(false); setShowMobileNav((open) => !open); }}>{showMobileNav ? <X size={24} /> : <Menu size={24} />}</button>
        </div>

        <div ref={searchConsoleRef} className="header-search-console-wrap">
          <form
            className="header-search-console"
            onSubmit={(event) => { event.preventDefault(); setIsSuggestOpen(false); setShowMobileNav(false); onSearchSubmit(); }}
          >
            <div className="search-input-wrapper">
              <input
                type="text"
                className="search-input-main"
                placeholder="Ingresa el nombre del repuesto o código OEM"
                value={searchQuery}
                onChange={(event) => { setSearchQuery(event.target.value); setIsSuggestOpen(true); }}
                onFocus={() => searchQuery.trim().length >= SEARCH_SUGGEST_MIN_LENGTH && setIsSuggestOpen(true)}
                onKeyDown={(event) => event.key === 'Escape' && setIsSuggestOpen(false)}
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isSuggestOpen}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn-clear-text"
                  onClick={() => { setSearchQuery(''); setIsSuggestOpen(false); }}
                  aria-label="Limpiar búsqueda"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button type="submit" className="btn-search-blue">
              <Search size={20} />
              <span>Buscar repuestos</span>
            </button>
          </form>

          {isSuggestOpen && searchQuery.trim().length >= SEARCH_SUGGEST_MIN_LENGTH && (
            <ul className="header-search-suggestions" role="listbox">
              {isSuggestLoading && <li className="header-search-suggest-status">Buscando coincidencias…</li>}
              {!isSuggestLoading && productSuggestions.length === 0 && (
                <li className="header-search-suggest-status">Sin coincidencias. Presiona Enter para buscar “{searchQuery.trim()}”.</li>
              )}
              {!isSuggestLoading && productSuggestions.map((product) => (
                <li key={product.id}>
                  <button type="button" onMouseDown={(event) => { event.preventDefault(); goToSuggestion(product); }}>
                    <span className="header-search-suggest-name">{product.nombrePublicado || product.repuestoNombre}</span>
                    {product.referenciaOem && <span className="header-search-suggest-oem">OEM {product.referenciaOem}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
                  <button className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenProfile?.('anuncios'); }}><Megaphone size={15} /> Gestión de anuncios</button>
                  {isSellerAccount && (
                    <button className="dropdown-item" onClick={openInventoryPanel}><Package size={15} /> Panel de inventario</button>
                  )}
                  <button className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenProfile?.('consultas'); }}><MessageSquare size={15} /> Reportes / Chats con vendedor</button>
                  <button className="dropdown-item" onClick={() => { setShowUserMenu(false); onOpenHelp?.(); }}><HelpCircle size={15} /> Soporte</button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item logout-item" onClick={handleLogout}><LogOut size={15} /> Cerrar sesión</button>
                </div>
              </div>
            )}
          </div>

          {isLoggedIn && (
            <>
              <div className="header-divider" />
              <HeaderWalletButton variant="header" />
            </>
          )}

          {/* Con la cuenta bloqueada el carrito no se muestra: el backend responde 403 a
              todo el lado comprador, asi que el boton solo llevaria a un checkout que
              falla sin explicar por que. */}
          {!isBlockedAccount && (
            <>
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
            </>
          )}
        </div>
      </div>

      {showMobileNav && <button type="button" className="mobile-nav-backdrop" aria-label="Cerrar menú" onClick={() => { setShowCategoryMenu(false); setShowMobileNav(false); }} />}
      <nav id="marketplace-navigation" className={`header-primary-nav ${showMobileNav ? 'mobile-nav-open' : ''}`}>
        <div className="mobile-drawer-head">
          <button
            type="button"
            className="mobile-drawer-close"
            ref={mobileDrawerCloseRef}
            aria-label="Cerrar menú"
            onClick={() => { setShowCategoryMenu(false); setShowMobileNav(false); }}
          >
            <X size={22} />
          </button>

          <div className="mobile-drawer-profile-centered">
            <button
              type="button"
              className="mobile-drawer-profile-btn"
              onClick={() => {
                setShowMobileNav(false);
                if (isLoggedIn) onOpenProfile?.();
                else onOpenAuthModal?.();
              }}
              aria-label={isLoggedIn ? 'Abrir mi perfil' : 'Iniciar sesión'}
            >
              <div className="mobile-drawer-avatar">
                {isLoggedIn && user?.userProfileUrl ? (
                  <img
                    src={user.userProfileUrl}
                    alt={user?.userName || 'Foto de perfil'}
                    className="mobile-drawer-avatar-img"
                    referrerPolicy="no-referrer"
                  />
                ) : isLoggedIn && isSellerAccount ? (
                  <Store size={26} />
                ) : (
                  <User size={26} />
                )}
              </div>
            </button>

            <div className="mobile-drawer-user-info">
              <strong>{isLoggedIn ? `Hola, ${user?.userName || user?.storeName || 'bienvenido'}` : '¡Hola!'}</strong>
              <span>{isLoggedIn ? (user?.email || 'Tu cuenta RepuesTop') : 'Ingresa a tu cuenta'}</span>
            </div>

            <button
              type="button"
              className="mobile-drawer-account"
              onClick={() => { setShowMobileNav(false); if (isLoggedIn) onOpenProfile?.(); else onOpenAuthModal?.(); }}
            >
              {isLoggedIn ? 'Ir a mi perfil' : 'Iniciar sesión'}
            </button>
          </div>

          {/* Solo movil (public-mobile.css): lo que mas se busca al abrir el menu. */}
          <div className="mobile-drawer-quick mobile-only-nav-item">
            <button type="button" onClick={() => { setShowMobileNav(false); if (isLoggedIn) navigate(buyerProfilePath(user, 'purchases')); else onOpenAuthModal?.(); }}>
              <Package size={20} /><span>Mis compras</span>
            </button>
            <button type="button" onClick={() => { setShowMobileNav(false); if (isLoggedIn) navigate(buyerProfilePath(user, 'favorites')); else onOpenAuthModal?.(); }}>
              <Heart size={20} /><span>Favoritos</span>
            </button>
            {!isBlockedAccount && (
              <button type="button" onClick={() => { setShowMobileNav(false); onOpenCart(); }}>
                <ShoppingCart size={20} /><span>Carrito</span>{cartCount > 0 && <b>{cartCount}</b>}
              </button>
            )}
          </div>
        </div>
        <div className="container primary-nav-inner">
          <p className="mobile-drawer-section-title is-explore mobile-only-nav-item">Explorar</p>
          <div ref={categoryMenuRef} className="categories-nav-wrap">
            <button className="categories-nav-button" aria-expanded={showCategoryMenu} onClick={() => setShowCategoryMenu((open) => !open)}>
              <Wrench size={19} /> <span className="nav-label-desktop">Categorías</span>
              {/* Escritorio: flecha que indica que es un desplegable (gira al abrir). En movil la
                  reemplaza la flecha del menu lateral (public-mobile.css). */}
              <ChevronDown size={17} className="categories-nav-chevron" aria-hidden="true" />
              {/* Solo movil: deja claro que es un desplegable. */}
              <span className="nav-label-mobile nav-dropdown-copy">
                <strong>Categorías</strong>
                <small>{showCategoryMenu ? 'Elige una para ver más' : `Desplegar ${HEADER_CATEGORIES.length} categorías`}</small>
              </span>
            </button>
            {showCategoryMenu && (
              <div className={`header-category-dropdown header-category-mega-menu ${mobileCategoryDetail ? 'mobile-category-detail' : ''}`}>
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
                  <button type="button" className="header-category-mobile-close" onClick={() => setShowCategoryMenu(false)} aria-label="Cerrar categorías"><X size={20} /></button>
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
                        if (window.matchMedia('(max-width: 768px)').matches) {
                          setActiveHeaderCategoryId(category.id);
                          setMobileCategoryDetail(true);
                          return;
                        }
                        setShowCategoryMenu(false);
                        setShowMobileNav(false);
                        onSelectCategory({ category: category.id, categoryId: getBackendCategory(category)?.id, categoryName: category.nombre });
                      }}
                    >
                      <span className="header-category-label"><CategoryIconTile iconName={CATEGORY_VISUALS[category.id].iconName} color={CATEGORY_VISUALS[category.id].color} size={16} />{category.nombre}</span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <div className="header-subcategory-panel">
                  <button type="button" className="mobile-category-back" onClick={() => setMobileCategoryDetail(false)}><ArrowLeft size={18} /> Todas las categorías</button>
                  <div className="header-subcategory-panel-title">
                    <strong>{activeHeaderCategory.nombre}</strong>
                    <button onClick={() => {
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      setShowCategoryMenu(false);
                      setShowMobileNav(false);
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
                            setShowMobileNav(false);
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
          {/* "Ofertas" se elimino: llevaba al mismo catalogo que "Catálogo de repuestos". */}
          <button type="button" className="nav-item-stores" aria-current={navCurrent(ROUTES.stores)} onClick={() => { setShowMobileNav(false); onOpenStores(); }}><Store size={16} /> <span>Casas de repuestos</span></button>
          <button type="button" className="nav-item-catalog" aria-current={navCurrent(ROUTES.catalog)} onClick={() => { setShowMobileNav(false); onOpenCatalog(); }}><Package size={16} /> <span>Catálogo de repuestos</span></button>
          <button type="button" className="nav-item-about" aria-current={navCurrent(ROUTES.about)} onClick={() => { setShowMobileNav(false); onOpenAbout(); }}><Info size={16} /> <span>Sobre RepuesTop</span></button>
          <button type="button" className="nav-item-ads" aria-current={navCurrent(ROUTES.adsWall)} onClick={() => { setShowMobileNav(false); onOpenAdsWall(); }}><Megaphone size={16} /> <span>Mural de anuncios</span></button>
          <p className="mobile-drawer-section-title is-more mobile-only-nav-item">RepuesTop</p>
          <button type="button" className="nav-item-help" aria-current={navCurrent(ROUTES.support)} onClick={() => { setShowMobileNav(false); onOpenHelp(); }}><HelpCircle size={16} /> <span className="nav-label-desktop">Ayuda</span><span className="nav-label-mobile">Centro de ayuda</span></button>
          {/* Solo movil: en escritorio este acceso vive en la barra superior, que en el celular
              no existe. Tarjeta destacada: es la puerta de entrada de las casas de repuestos. */}
          <button type="button" className="mobile-only-nav-item mobile-drawer-seller-cta" onClick={() => { setShowMobileNav(false); onOpenSellerModal?.(); }}>
            <Store size={20} />
            <span><strong>Vende en RepuesTop</strong><small>Publica tu inventario y vende en todo Chile</small></span>
            <ChevronRight size={18} />
          </button>
          {isLoggedIn && (
            <button type="button" className="mobile-drawer-logout" onClick={() => { setShowMobileNav(false); handleLogout(); }}>
              <LogOut size={16} /> <span>Cerrar sesión</span>
            </button>
          )}
          <div className="mobile-drawer-legal mobile-only-nav-item">
            <button type="button" onClick={() => { setShowMobileNav(false); navigate(ROUTES.terms); }}>Términos</button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => { setShowMobileNav(false); navigate(ROUTES.privacy); }}>Privacidad</button>
          </div>
        </div>
      </nav>
    </header>
  );
}
