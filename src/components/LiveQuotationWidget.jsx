import React, { useState } from 'react';
import { MessageSquare, Send, CheckCircle2, Search, Clock, Building2, ShieldCheck, Sparkles } from 'lucide-react';
import { LIVE_QUOTATIONS } from '../data/liveMarketplaceData';

export default function LiveQuotationWidget() {
  const [quotePatente, setQuotePatente] = useState('');
  const [partDesc, setPartDesc] = useState('');
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);

  const handleSubmitQuote = (e) => {
    e.preventDefault();
    if (!quotePatente || !partDesc) return;
    setQuoteSubmitted(true);
    setTimeout(() => {
      setQuoteSubmitted(false);
      setQuotePatente('');
      setPartDesc('');
    }, 4000);
  };

  return (
    <section className="quotations-section container">
      <div className="quotations-grid-layout">
        {/* Left Side: Interactive Live Quotation Form */}
        <div className="quote-form-card">
          <div className="quote-header-tag">
            <MessageSquare size={16} className="icon-chat-blue" />
            <span>COTIZADOR EN VIVO POR PATENTE</span>
          </div>

          <h2>¿No encuentras tu repuesto? Solicita Cotización Directa</h2>
          <p>Envía tu requerimiento por patente y las casas de repuestos verificadas te enviarán sus mejores ofertas por chat.</p>

          {!quoteSubmitted ? (
            <form onSubmit={handleSubmitQuote} className="quote-form-body">
              <div className="form-group-flex">
                <label>Patente de tu auto (Obligatorio)</label>
                <div className="patente-input-wrap">
                  <span className="flag-chile-mini">🇨🇱</span>
                  <input 
                    type="text" 
                    placeholder="Ej: BB-CL-12" 
                    value={quotePatente} 
                    onChange={(e) => setQuotePatente(e.target.value.toUpperCase())}
                    required 
                  />
                </div>
              </div>

              <div className="form-group-flex">
                <label>Descripción del repuesto necesitado</label>
                <textarea 
                  placeholder="Ej: Necesito amortiguadores delanteros KYB, bomba de agua o espejo retrovisor derecho..."
                  value={partDesc}
                  onChange={(e) => setPartDesc(e.target.value)}
                  rows={3}
                  required
                />
              </div>

              <button type="submit" className="btn-send-quote-red">
                <Send size={16} />
                <span>Enviar Cotización a +1.200 Tiendas</span>
              </button>

              <div className="quote-micro-trust">
                <ShieldCheck size={14} className="icon-green" />
                <span>Recibirás respuestas de tiendas con precio, marca y garantía de calce.</span>
              </div>
            </form>
          ) : (
            <div className="quote-success-banner">
              <CheckCircle2 size={36} className="icon-success" />
              <h3>¡Cotización Enviada con Éxito!</h3>
              <p>Notificamos a las tiendas verificadas compatibles con Patente <strong>{quotePatente}</strong>. Recibirás ofertas en tu panel.</p>
            </div>
          )}
        </div>

        {/* Right Side: Real-time Live Quotes Feed */}
        <div className="quote-tracker-card">
          <div className="tracker-header-title">
            <Sparkles size={16} className="icon-sparkle" />
            <span>COTIZACIONES ACTIVAS EN TIEMPO REAL</span>
          </div>

          <div className="quotes-list-tracker">
            {LIVE_QUOTATIONS.map(q => (
              <div key={q.id} className="quote-tracker-item">
                <div className="item-top-row">
                  <span className="quote-id-tag">ID #{q.id}</span>
                  <span className="quote-time-pill"><Clock size={11} /> {q.tiempoSolicitud}</span>
                </div>

                <h4 className="user-name">{q.comprador}</h4>
                <p className="vehicle-line">🚘 {q.vehiculo}</p>
                <p className="part-desc-line">"{q.repuestoSolicitado}"</p>

                <div className="item-bottom-status">
                  <span className="bids-badge">
                    <Building2 size={13} /> {q.respuestasTiendas} Respuestas de Tiendas
                  </span>
                  <span className="status-pill">{q.estado}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
