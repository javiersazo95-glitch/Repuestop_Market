import React, { useState, useEffect } from 'react';
import { Zap, Clock, Star, ShieldCheck, Check, ShoppingBag, Eye } from 'lucide-react';

export default function FlashDeals({ products, activeVehicle, onQuickView, onAddToCart }) {
  const flashProducts = products.filter(p => p.isFlashDeal);

  // Live Countdown Timer (04h : 28m : 15s)
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 28, seconds: 45 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 5, minutes: 0, seconds: 0 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTwoDigits = (num) => String(num).padStart(2, '0');

  return (
    <section className="flash-deals-section container">
      <div className="flash-header-banner">
        <div className="flash-title-group">
          <div className="flash-icon-box">
            <Zap size={24} className="flash-bolt-icon" />
          </div>
          <div>
            <div className="flash-subtitle">OFERTAS DE TIEMPO LIMITADO</div>
            <h2 className="flash-main-title">Ofertas Relámpago AliExpress Style</h2>
          </div>
        </div>

        {/* Live Countdown Clock */}
        <div className="countdown-clock-wrapper">
          <div className="clock-label">
            <Clock size={16} /> Termina en:
          </div>
          <div className="clock-digits">
            <div className="digit-box">
              <span className="digit-num">{formatTwoDigits(timeLeft.hours)}</span>
              <span className="digit-unit">HORAS</span>
            </div>
            <span className="clock-colon">:</span>
            <div className="digit-box">
              <span className="digit-num">{formatTwoDigits(timeLeft.minutes)}</span>
              <span className="digit-unit">MIN</span>
            </div>
            <span className="clock-colon">:</span>
            <div className="digit-box">
              <span className="digit-num">{formatTwoDigits(timeLeft.seconds)}</span>
              <span className="digit-unit">SEG</span>
            </div>
          </div>
        </div>
      </div>

      {/* Flash Deals Horizontal Carousel / Grid */}
      <div className="flash-products-grid">
        {flashProducts.map((prod) => {
          const isCompatible = activeVehicle ? prod.compatibilidad.some(
            c => c.marca.toLowerCase() === activeVehicle.marca.toLowerCase() ||
                 c.modelo.toLowerCase().includes(activeVehicle.modelo.toLowerCase())
          ) : false;

          const percentageSold = Math.round((prod.flashStockVendido / prod.flashStockTotal) * 100);

          return (
            <div key={prod.id} className={`flash-product-card ${isCompatible ? 'compatible-glow' : ''}`}>
              <div className="card-top-badges">
                <span className="discount-tag">-{prod.descuentoPercent}%</span>
                {isCompatible && (
                  <span className="compatibility-tag-badge">
                    <Check size={12} /> Calza en {activeVehicle.patente}
                  </span>
                )}
              </div>

              <div className="product-image-container" onClick={() => onQuickView(prod)}>
                <img src={prod.imagen} alt={prod.titulo} />
                <button className="quick-view-hover-btn" onClick={(e) => { e.stopPropagation(); onQuickView(prod); }}>
                  <Eye size={16} /> Vista Rápida
                </button>
              </div>

              <div className="product-info-box">
                <div className="product-oem-code">OEM: {prod.oemCode}</div>
                <h3 className="product-title" onClick={() => onQuickView(prod)}>{prod.titulo}</h3>

                <div className="rating-row">
                  <div className="stars">
                    <Star size={14} className="star-filled" />
                    <span>{prod.rating}</span>
                  </div>
                  <span className="sales-count">({prod.vendidosCount} vendidos)</span>
                </div>

                <div className="price-group">
                  <span className="price-current">${prod.precio.toLocaleString('es-CL')}</span>
                  <span className="price-original">${prod.precioOriginal.toLocaleString('es-CL')}</span>
                </div>

                {/* Stock Meter Progress Bar */}
                <div className="stock-meter-wrapper">
                  <div className="meter-bar-outer">
                    <div className="meter-bar-inner" style={{ width: `${percentageSold}%` }}></div>
                  </div>
                  <div className="meter-text">
                    <span>{percentageSold}% vendido</span>
                    <span>Quedan {prod.flashStockTotal - prod.flashStockVendido} unid.</span>
                  </div>
                </div>

                <button className="add-to-cart-flash-btn" onClick={() => onAddToCart(prod)}>
                  <ShoppingBag size={16} /> Agregar al Carrito
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
