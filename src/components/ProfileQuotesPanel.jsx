import React, { useMemo, useState } from 'react';
import { Clock, Inbox, MessageSquare, ReceiptText, Search, Send, Sliders, X } from 'lucide-react';
import QuoteCard from './QuoteCard';
import { EmptyState } from './ProfileDashboard';

/**
 * Pestaña "Cotizaciones"/"Mis cotizaciones" del panel de perfil. Extraida de
 * ProfileDashboard: el buscador, el filtro y el orden (quoteSearch/quoteFilter/
 * quoteSort) solo alimentaban esta pestaña, asi que se mueven enteros junto con
 * el useMemo que arma la lista filtrada. `quotesAsBuyer` y `quoteSummary` siguen
 * viniendo del padre porque Resumen tambien los usa para sus KPIs.
 */
export default function ProfileQuotesPanel({
  quotesAsBuyer,
  quoteSummary,
  activeQuoteSource,
  onSelectQuote,
}) {
  const [quoteFilter, setQuoteFilter] = useState('all');
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteSort, setQuoteSort] = useState('newest');

  const quoteConversations = useMemo(() => {
    const query = quoteSearch.trim().toLowerCase();
    return (activeQuoteSource || [])
      .filter((conversation) => !conversation.tipo || String(conversation.tipo).toLowerCase() === 'cotizacion')
      .filter((conversation) => {
        if (quoteFilter === 'pending') return !conversation.cotizacion;
        if (quoteFilter === 'sent') return Boolean(conversation.cotizacion);
        if (quoteFilter === 'unread') return Number(conversation.mensajesNoLeidos || 0) > 0;
        return true;
      })
      .filter((conversation) => {
        if (!query) return true;
        return [conversation.id, conversation.otroParticipanteNombre, conversation.productoNombre, conversation.ultimoMensaje]
          .some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const leftTime = new Date(left.ultimoMensajeFecha || left.updatedAt || 0).getTime() || 0;
        const rightTime = new Date(right.ultimoMensajeFecha || right.updatedAt || 0).getTime() || 0;
        return quoteSort === 'newest' ? rightTime - leftTime : leftTime - rightTime;
      });
  }, [activeQuoteSource, quoteFilter, quoteSearch, quoteSort]);

  return (
    <div className="profile-panel seller-quotes-panel">
      <div className="seller-quotes-heading">
        <div>
          <span className="seller-quotes-eyebrow"><ReceiptText size={14} /> {quotesAsBuyer ? 'Conversaciones de cotización' : 'Centro de cotizaciones'}</span>
          <h2 className="profile-panel-title">{quotesAsBuyer ? 'Mis cotizaciones' : 'Cotizaciones de compradores'}</h2>
          <p>{quotesAsBuyer ? 'Revisa las respuestas de las tiendas, conversa y consulta cada propuesta con su vigencia y condiciones.' : 'Revisa solicitudes, responde con tus condiciones comerciales y mantén cada oferta vinculada a su conversación.'}</p>
        </div>
        <div className="seller-quotes-heading-actions">
          {!quotesAsBuyer && <span className="seller-quotes-total-badge">{quoteSummary.total} {quoteSummary.total === 1 ? 'solicitud' : 'solicitudes'}</span>}
          <button type="button" className="seller-quotes-sort" onClick={() => setQuoteSort((current) => current === 'newest' ? 'oldest' : 'newest')}>
            <Sliders size={15} /> {quoteSort === 'newest' ? 'Más recientes' : 'Más antiguas'}
          </button>
        </div>
      </div>

      <div className="seller-quotes-summary">
        <article><MessageSquare size={18} /><span><strong>{quoteSummary.total}</strong>Total</span></article>
        <article className="is-pending"><Clock size={18} /><span><strong>{quoteSummary.pending}</strong>Por responder</span></article>
        <article className="is-sent"><Send size={18} /><span><strong>{quoteSummary.sent}</strong>Ofertas enviadas</span></article>
        <article className="is-unread"><Inbox size={18} /><span><strong>{quoteSummary.unread}</strong>Mensajes sin leer</span></article>
      </div>

      <div className="seller-quotes-toolbar">
        <label className="seller-quotes-search"><Search size={15} /><input value={quoteSearch} onChange={(event) => setQuoteSearch(event.target.value)} placeholder={quotesAsBuyer ? 'Buscar tienda, producto o cotización...' : 'Buscar comprador, producto o cotización...'} />{quoteSearch && <button type="button" onClick={() => setQuoteSearch('')} aria-label="Limpiar búsqueda"><X size={13} /></button>}</label>
        <div className="seller-quotes-filters" role="group" aria-label="Filtrar cotizaciones">
          {[['all', 'Todas'], ['pending', 'Sin responder'], ['sent', 'Enviadas'], ['unread', 'Sin leer']].map(([value, label]) => (
            <button key={value} type="button" className={quoteFilter === value ? 'active' : ''} onClick={() => setQuoteFilter(value)}>{label}</button>
          ))}
        </div>
      </div>

      {quoteSummary.total === 0 ? (
        <EmptyState label={quotesAsBuyer ? 'Aún no has pedido cotizaciones a otras tiendas.' : 'Aún no tienes solicitudes de cotización.'} />
      ) : quoteConversations.length === 0 ? (
        <EmptyState label="No encontramos cotizaciones con esos filtros." />
      ) : (
        <div className="profile-orders-cards-grid seller-quotes-grid">
          {quoteConversations.map((c) => (
            <QuoteCard
              key={c.id}
              quote={c}
              mode={quotesAsBuyer ? 'buyer' : 'seller'}
              onSelectQuote={onSelectQuote}
              onQuickRespond={onSelectQuote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
