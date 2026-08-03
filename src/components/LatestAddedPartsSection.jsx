import React, { useState, useEffect } from 'react';
import { Sparkles, Clock, CheckCircle2, ShoppingCart, MessageSquare, ShieldCheck, MapPin, Loader2, Inbox } from 'lucide-react';
import { CATEGORY_ICON_BY_ID, CATEGORY_COLOR_BY_ID, CATEGORY_IMAGE_BY_ID } from '../data/categories';
import CategoryIconTile from './CategoryIconTile';
import { getPublicProductsApi } from '../services/api';
import { adaptPage, adaptLatestPart } from '../services/adapters';

const LATEST_PARTS_COUNT = 4;

export default function LatestAddedPartsSection({ onAddToCart, onQuickView, onOpenQuote, onOpenCatalog }) {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Feed real de las últimas publicaciones: GET /api/v1/inventario/productos
  // ordenado por fecha de creación descendente (endpoint público).
  useEffect(() => {
    let isMounted = true;

    getPublicProductsApi({ page: 0, size: LATEST_PARTS_COUNT, sort: 'createdAt,desc' })
      .then((data) => {
        if (!isMounted) return;
        setParts(adaptPage(data, adaptLatestPart).items);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'No se pudieron cargar las últimas publicaciones.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  return (
    <section className="latest-parts-section container">
      <div className="section-title-header-flex">
        <div className="title-left-group">
          <div className="title-badge-pulse">
            <span className="pulse-dot"></span>
            <span>FEED EN VIVO DE PUBLICACIONES</span>
          </div>
          <h2>📦 Últimos Repuestos Agregados al Sistema</h2>
          <p>Publicaciones sincronizadas en tiempo real desde los sistemas de casas de repuestos y desarmadurías en Chile.</p>
        </div>

        <div className="latest-header-right-actions">
          <span className="live-update-tag"><Clock size={14} /> Actualizado automáticamente cada 5 min</span>
          {onOpenCatalog && (
            <button className="btn-view-directory-blue" onClick={onOpenCatalog}>
              <span>Ver Todos los Repuestos →</span>
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="latest-parts-state">
          <Loader2 size={22} className="spin-icon" />
          <span>Cargando últimas publicaciones…</span>
        </div>
      )}

      {!loading && error && (
        <div className="latest-parts-state latest-parts-state-error">
          <Inbox size={22} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && parts.length === 0 && (
        <div className="latest-parts-state">
          <Inbox size={22} />
          <span>Aún no hay repuestos publicados en el sistema.</span>
        </div>
      )}

      <div className="latest-parts-grid-4">
        {parts.map(part => (
          <div key={part.id} className="latest-part-card-rich">
            <div className="part-card-top-tag">
              <span className="time-ago-pill"><Clock size={12} /> {part.agregadoHace}</span>
              <span className="stock-count-pill">{part.stockAvailable} en stock</span>
            </div>


            <div className="part-card-img-box" onClick={() => onQuickView(part)}>
              <CategoryIconTile
                iconName={CATEGORY_ICON_BY_ID[part.categoria]}
                color={CATEGORY_COLOR_BY_ID[part.categoria]}
                image={CATEGORY_IMAGE_BY_ID[part.categoria]}
                size={36}
              />
              {part.descuento > 0 && (
                <span className="discount-red-badge">-{part.descuento}% OFF</span>
              )}
            </div>

            <div className="part-card-body-rich">
              <span className="oem-code-tag">OEM: {part.oemCode}</span>
              <h3 className="part-title" onClick={() => onQuickView(part)}>{part.titulo}</h3>
              
              <div className="part-compat-sub">
                <CheckCircle2 size={13} className="text-green-icon" />
                <span>{part.compatibilidadSummary}</span>
              </div>

              <div className="vendor-info-line">
                <ShieldCheck size={14} className="text-blue-icon" />
                <strong>{part.vendedor}</strong>
                <span className="city-span"><MapPin size={11} /> {part.ciudad}</span>
              </div>

              <div className="price-and-action-row">
                <div className="price-stack">
                  {part.soloCotizacion ? (
                    <span className="price-main-bold">A cotizar</span>
                  ) : (
                    <>
                      <span className="price-main-bold">${part.precio.toLocaleString('es-CL')}</span>
                      {part.precioOriginal > 0 && (
                        <span className="price-old">${part.precioOriginal.toLocaleString('es-CL')}</span>
                      )}
                    </>
                  )}
                </div>

                <div className="part-btn-group">
                  <button
                    className="btn-quote-chat"
                    title="Cotizar por chat con el vendedor"
                    onClick={() => onOpenQuote ? onOpenQuote(part) : onQuickView(part)}
                  >
                    <MessageSquare size={15} />
                  </button>
                  <button className="btn-add-cart-red" onClick={() => onAddToCart(part)}>
                    <ShoppingCart size={15} />
                    <span>Comprar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
