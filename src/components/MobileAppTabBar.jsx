import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MOBILE_APP_TABS } from '../data/mobileAppTabs';
import { profilePath, ROUTES } from '../routes/paths';
import '../styles/mobile-app-tabbar.css';

// Rutas donde la barra estorba: el pago (ya trae su propia barra fija de compra) y el éxito de la compra.
const isHidden = (pathname) => pathname.startsWith(ROUTES.checkout) || pathname.startsWith(ROUTES.purchaseSuccess) || /^\/subastas\/[^/]+\/pago/.test(pathname);

/** ¿Qué pestaña corresponde a la vista pública en la que está la persona? (para marcarla como actual) */
function activeKeyFor(pathname, items) {
  const exact = items.find((item) => (item.tab ? pathname === profilePath(item.tab) : item.to === pathname));
  if (exact) return exact.key;
  const by = (key) => items.find((item) => item.key === key)?.key;
  if (pathname.startsWith(ROUTES.catalog)) return by('repuestos');
  if (pathname.startsWith(ROUTES.faults)) return by('fallas');
  if (pathname.startsWith(ROUTES.auctions)) return by('busco') || by('buscan');
  return null;
}

/**
 * Barra de navegación inferior del market en el celular para quien ya inició sesión: las mismas pestañas, etiquetas e iconos
 * que la de la intranet (`AppBottomTabBar.tsx` de la app) y siempre a la vista, también en el catálogo, las fallas, los encargos, las
 * tiendas y los talleres, para saltar a otra vista sin volver al panel. Dentro del panel `/perfil` la pone el propio panel.
 */
export default function MobileAppTabBar() {
  const { isLoggedIn, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const profile = role === 'SELLER' ? 'seller' : role === 'WORKSHOP' ? 'workshop' : role === 'BUYER' ? 'buyer' : null;
  const visible = isLoggedIn && Boolean(profile) && !isHidden(location.pathname);
  useEffect(() => {
    if (!visible) return undefined;
    document.body.classList.add('has-app-tabbar');
    return () => document.body.classList.remove('has-app-tabbar');
  }, [visible]);
  if (!visible) return null;

  const items = MOBILE_APP_TABS[profile];
  const activeKey = activeKeyFor(location.pathname, items);

  return (
    <nav className="mobile-app-tabbar" aria-label="Secciones principales">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            className={isActive ? 'active' : ''}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => navigate(item.to || profilePath(item.tab))}
          >
            <Icon size={24} />
            <span>{item.label}</span>
          </button>
        );
      })}
      {/* «Más» abre el menú completo dentro del panel de la cuenta. */}
      <button type="button" aria-haspopup="dialog" onClick={() => navigate(`${profilePath('resumen')}?mas=1`)}>
        <Menu size={22} />
        <span>Más</span>
      </button>
    </nav>
  );
}
