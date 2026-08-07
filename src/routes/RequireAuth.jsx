import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from './paths';

/**
 * Protege las rutas privadas. Al refrescar con sesión guardada hay un instante en
 * que existe el token pero todavía no el perfil: ahí se espera en lugar de expulsar
 * al usuario al home, que era lo que hacía perder la página al recargar.
 */
export default function RequireAuth({ children }) {
  const { isLoggedIn, isRestoringSession } = useAuth();
  const location = useLocation();

  if (isRestoringSession) {
    return (
      <div className="route-status-panel">
        <Loader2 size={34} className="route-status-spinner" aria-hidden="true" />
        <p>Restaurando tu sesión…</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to={ROUTES.home}
        replace
        state={{ requireAuth: true, from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
