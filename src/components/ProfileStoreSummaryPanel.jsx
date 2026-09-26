import React from 'react';
import { Building2, Layers, Star, Truck } from 'lucide-react';
import { EmptyState } from './ProfileDashboard';
import ShareLinkButton from './ShareLinkButton';

/**
 * Pestaña "Mi Tienda" del panel de perfil (tarjeta resumen: nombre, ubicacion,
 * cantidad de productos, calificacion y metodos de envio). Extraida de
 * ProfileDashboard: es de solo lectura, sin estado propio.
 */
export default function ProfileStoreSummaryPanel({ storeInfo, displayName, inventorySummary, storeUrl }) {
  const storeName = storeInfo?.storeName || displayName || 'mi tienda';
  return (
    <div className="profile-panel">
      <div className="profile-panel-header-row store-summary-header">
        <h2 className="profile-panel-title">Mi Tienda</h2>
        {storeUrl && (
          <ShareLinkButton
            className="btn-auth-secondary store-share-button"
            iconSize={16}
            url={storeUrl}
            title={storeName}
            text={`Mira los repuestos de ${storeName} en RepuesTop`}
            label="Compartir tienda"
          />
        )}
      </div>
      {storeInfo ? (
        <div className="profile-store-card">
          <div className="store-card-header">
            <div className="store-card-icon"><Building2 size={22} /></div>
            <div>
              <strong>{storeInfo.storeName || displayName}</strong>
              <span>{[storeInfo.comuna, storeInfo.region].filter(Boolean).join(', ') || 'Ubicación no registrada'}</span>
            </div>
          </div>
          <div className="store-card-stats">
            <div><Layers size={14} /> {inventorySummary?.total ?? 0} productos</div>
            <div><Star size={14} /> {storeInfo.rating ? Number(storeInfo.rating).toFixed(1) : '—'} calificación ({storeInfo.reviewCount ?? 0})</div>
          </div>
          {storeInfo.shippingMethods && (
            <div className="seller-shipping-row" style={{ borderTop: 'none', paddingTop: 0, marginTop: 4 }}>
              <Truck size={14} className="shipping-truck-icon" />
              <div className="shipping-methods-pills">
                {String(storeInfo.shippingMethods).split(',').map((m, i) => (
                  <span key={i} className="shipping-method-pill">{m.trim()}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState label="No se pudo cargar la información de tu tienda." />
      )}
    </div>
  );
}
