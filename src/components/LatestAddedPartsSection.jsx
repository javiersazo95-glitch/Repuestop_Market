import React from 'react';
import { Sparkles, Clock, CheckCircle2, ShoppingCart, MessageSquare, ShieldCheck, MapPin } from 'lucide-react';
import { LATEST_ADDED_PARTS } from '../data/liveMarketplaceData';

export default function LatestAddedPartsSection({ onAddToCart, onQuickView }) {
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

        <span className="live-update-tag"><Clock size={14} /> Actualizado automáticamente cada 5 min</span>
      </div>

      <div className="latest-parts-grid-4">
        {LATEST_ADDED_PARTS.map(part => (
          <div key={part.id} className="latest-part-card-rich">
            <div className="part-card-top-tag">
              <span className="time-ago-pill"><Clock size={12} /> {part.agregadoHace}</span>
              <span className="stock-count-pill">{part.stockAvailable} en stock</span>
            </div>

            <div className="part-card-img-box" onClick={() => onQuickView(part)}>
              <img src={part.imagen} alt={part.titulo} />
              <span className="discount-red-badge">-{part.descuento}% OFF</span>
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
                  <span className="price-main-bold">${part.precio.toLocaleString('es-CL')}</span>
                  <span className="price-old">${part.precioOriginal.toLocaleString('es-CL')}</span>
                </div>

                <div className="part-btn-group">
                  <button className="btn-quote-chat" title="Cotizar por chat con el vendedor">
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
