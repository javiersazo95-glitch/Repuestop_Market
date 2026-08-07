import React from 'react';
import { useLocation } from 'react-router-dom';
import { Compass, Home, Package, Store } from 'lucide-react';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Página no encontrada');
  const location = useLocation();
  const nav = useAppNavigation();
  const requestedPath = location.state?.requestedPath || location.pathname;

  return (
    <div className="route-status-panel route-not-found">
      <Compass size={40} aria-hidden="true" />
      <h2>Esta página no existe</h2>
      <p>
        No encontramos <code>{requestedPath}</code> en RepuesTop. Puede que el enlace
        esté vencido o que la publicación ya no esté disponible.
      </p>
      <div className="route-status-actions">
        <button type="button" className="route-status-action" onClick={nav.goHome}>
          <Home size={16} /> Ir al inicio
        </button>
        <button type="button" className="route-status-action secondary" onClick={() => nav.goCatalog()}>
          <Package size={16} /> Ver catálogo
        </button>
        <button type="button" className="route-status-action secondary" onClick={nav.goStores}>
          <Store size={16} /> Ver tiendas
        </button>
      </div>
    </div>
  );
}
