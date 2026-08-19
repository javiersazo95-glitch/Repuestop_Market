import React from 'react';
import { ArrowUpRight, ChevronLeft, LogIn, Store, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HELP_ROLES, resolveReportType } from '../../data/helpContent';
import { profilePath, ROUTES, storePath } from '../../routes/paths';

/**
 * Barra propia del centro de ayuda. La vista vive fuera de `AppLayout` (no usa
 * el Header del marketplace) porque se entra desde muchos puntos distintos y
 * debe verse igual en todos: sin buscador de repuestos ni carrito.
 *
 * La acción de la derecha depende de la sesión: el vendedor va a su tienda
 * pública, el comprador a su perfil y el invitado al login.
 */
export default function HelpHeader() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const reportType = resolveReportType(role, user);
  const isSeller = reportType === HELP_ROLES.SELLER;
  const isGuest = reportType === HELP_ROLES.GUEST;

  // `AppLayout` abre el AuthModal cuando la navegación trae `requireAuth`.
  const goLogin = () => navigate(ROUTES.home, { state: { requireAuth: true } });

  return (
    <header className="help-header">
      <div className="help-header-inner">
        <Link to={ROUTES.home} className="help-header-brand">
          <img src="/repuestop_icon.png" alt="" />
          <span>Repues<b>Top</b></span>
        </Link>

        <div className="help-header-actions">
          <button type="button" className="help-header-back" onClick={() => navigate(ROUTES.home)}>
            <ChevronLeft size={16} />
            <span>Volver a la tienda</span>
          </button>

          {isGuest && (
            <button type="button" className="help-header-cta" onClick={goLogin}>
              <LogIn size={16} />
              <span>Iniciar sesión</span>
            </button>
          )}

          {isSeller && user?.sellerId && (
            <a
              className="help-header-cta"
              href={storePath({ id: user.sellerId, nombre: user?.storeName })}
              target="_blank"
              rel="noopener noreferrer"
              title="Se abre en una pestaña nueva: es como los compradores ven tu tienda."
            >
              <Store size={16} />
              <span>Visitar mi tienda</span>
              <ArrowUpRight size={14} />
            </a>
          )}

          {!isGuest && !isSeller && (
            <button type="button" className="help-header-cta" onClick={() => navigate(profilePath('resumen'))}>
              <UserRound size={16} />
              <span>Mi perfil</span>
            </button>
          )}

          {!isGuest && (
            <span className={`help-role-chip ${isSeller ? 'chip-seller' : 'chip-buyer'}`}>
              {isSeller ? <Store size={13} /> : <UserRound size={13} />}
              {isSeller ? 'Proveedor' : 'Comprador'}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

