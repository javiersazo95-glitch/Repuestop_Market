import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes/paths';

/**
 * Barra propia del centro de ayuda. La vista vive fuera de `AppLayout` (no usa
 * el Header del marketplace) porque se entra desde muchos puntos distintos y
 * debe verse igual en todos: sin buscador de repuestos ni carrito.
 *
 * Fase 2 agrega la acción contextual por rol (Visitar mi tienda / Mi perfil /
 * Iniciar sesión) y el chip de rol.
 */
export default function HelpHeader() {
  const navigate = useNavigate();

  return (
    <header className="help-header">
      <div className="help-header-inner">
        <Link to={ROUTES.home} className="help-header-brand">
          <img src="/repuestop_icon.png" alt="" />
          <span>Repues<b>Top</b></span>
        </Link>

        <button type="button" className="help-header-back" onClick={() => navigate(ROUTES.home)}>
          <ChevronLeft size={16} />
          <span>Volver a la tienda</span>
        </button>
      </div>
    </header>
  );
}
