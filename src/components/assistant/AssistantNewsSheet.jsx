import React, { useEffect, useMemo } from 'react';
import { Bell, CheckCircle2, Lightbulb, MessageCircle, MessagesSquare, Search, Tag, X, XCircle } from 'lucide-react';
import { groupAssistantNews, timeAgo } from '../../utils/partAssistant';
import { PartyAvatar, RepuestinAvatar } from './AssistantBits';

/** Qué hacer con cada novedad: la acción principal y, si ayuda, una segunda (`AssistantNewsSheet.tsx`). */
const KINDS = {
  CONSULTA_REPUESTO_OFRECIDO: {
    Icon: Tag, tone: 'blue', label: 'Te ofreció un repuesto',
    tip: 'Revisa su ficha, fotos y precio. Lo compras como cualquier compra, con despacho o retiro.',
    primary: { label: 'Ver la oferta', action: 'chat' },
  },
  CONSULTA_SIN_REPUESTO: {
    Icon: XCircle, tone: 'red', label: 'No tiene tu repuesto',
    tip: 'No te preocupes: otras casas aún pueden tenerlo. Si lo encargas, todas las tiendas verán tu pedido.',
    primary: { label: 'Encargar el repuesto', action: 'order' },
    secondary: { label: 'Ver el chat', action: 'chat' },
  },
  CONSULTA_REPUESTO_COMPRADO: {
    Icon: CheckCircle2, tone: 'green', label: 'Compró el repuesto que le ofreciste',
    tip: 'El pago ya está confirmado. Prepara el despacho o el retiro desde Ventas.',
    primary: { label: 'Ir a Ventas', action: 'sales' },
    secondary: { label: 'Ver el chat', action: 'chat' },
  },
  CONSULTA_REPUESTO: {
    Icon: Search, tone: 'amber', label: 'Te escribió buscando un repuesto',
    tip: 'Si lo tienes, cárgalo y ofrécelo. Si no, avísale con «No lo tengo»: una respuesta rápida suma ventas.',
    primary: { label: 'Responder', action: 'chat' },
  },
  CONSULTA_REPUESTO_RESPUESTA: {
    Icon: MessageCircle, tone: 'blue', label: 'Respondió tu consulta',
    tip: 'Léelo y responde en el chat: si tiene el repuesto, puede ofrecértelo para comprarlo directo.',
    primary: { label: 'Ver el chat', action: 'chat' },
  },
};
const FALLBACK = { Icon: Bell, tone: 'blue', label: '', tip: '', primary: { label: 'Ver el chat', action: 'chat' } };
const ROLE_LABEL = { TIENDA: 'Casa de repuestos', COMPRADOR: 'Comprador' };

const kindOf = (item) => KINDS[String(item?.type || '').toUpperCase()] ?? FALLBACK;

function topicCount(topic) {
  const n = topic.threads.length;
  const role = topic.threads[0]?.latest.counterpartRole;
  if (role === 'TIENDA') return n === 1 ? '1 casa de repuestos' : `${n} casas de repuestos`;
  if (role === 'COMPRADOR') return n === 1 ? '1 comprador' : `${n} compradores`;
  return n === 1 ? '1 chat' : `${n} chats`;
}

function TopicHeader({ topic }) {
  const forBuyer = topic.threads[0]?.latest.counterpartRole === 'TIENDA';
  const eyebrow = topic.searchedPart ? (forBuyer ? 'Tu búsqueda' : 'Te buscan') : 'Otras consultas';
  return (
    <div className="ra-topic" role="heading" aria-level={3}>
      {topic.searchedPart ? <Search size={16} /> : <MessagesSquare size={16} />}
      <div className="ra-topic-copy">
        <span className="ra-topic-eyebrow">{eyebrow.toUpperCase()}</span>
        {topic.searchedPart && <strong>{topic.searchedPart}</strong>}
        {topic.vehicle && <small>Para {topic.vehicle}</small>}
      </div>
      <span className="ra-topic-count">{topicCount(topic)}</span>
    </div>
  );
}

function ThreadCard({ thread, onAction }) {
  const item = thread.latest;
  const kind = kindOf(item);
  const when = timeAgo(item.createdAt);
  const hasIdentity = Boolean(item.counterpartName);
  const isStore = item.counterpartRole === 'TIENDA';
  const roleLabel = item.counterpartRole ? ROLE_LABEL[item.counterpartRole] : undefined;
  const headline = hasIdentity && kind.label ? kind.label : item.title;
  const earlier = thread.items.slice(1);
  const type = String(item.type || '').toUpperCase();
  const showOffered = Boolean(item.offeredPart) && (type === 'CONSULTA_REPUESTO_OFRECIDO' || type === 'CONSULTA_REPUESTO_COMPRADO');
  const { Icon } = kind;
  return (
    <article className="ra-news-item">
      <div className="ra-news-head">
        <div className="ra-news-avatar">
          {hasIdentity
            ? <PartyAvatar photo={item.counterpartPhoto} name={item.counterpartName} size={44} store={isStore} />
            : <span className={`ra-news-icon is-${kind.tone}`}><Icon size={20} /></span>}
          {hasIdentity && <span className={`ra-news-kind is-${kind.tone}`}><Icon size={12} /></span>}
        </div>
        <div className="ra-news-copy">
          {hasIdentity ? (
            <>
              <div className="ra-news-title"><strong>{item.counterpartName}</strong>{when && <small>{when}</small>}</div>
              {roleLabel && <small className="ra-subtle">{roleLabel}</small>}
              <span className={`ra-news-headline is-${kind.tone}`}>{headline}</span>
            </>
          ) : (
            <div className="ra-news-title"><strong>{headline}</strong>{when && <small>{when}</small>}</div>
          )}
        </div>
      </div>
      {(item.searchedPart || showOffered) && (
        <div className="ra-news-facts">
          {item.searchedPart && <p><Search size={12} /><span><b>{isStore ? 'Tu búsqueda: ' : 'Busca: '}</b>{item.searchedPart}{item.vehicle ? ` · ${item.vehicle}` : ''}</span></p>}
          {showOffered && <p><Tag size={12} /><span><b>Ofrecido: </b>{item.offeredPart}</span></p>}
        </div>
      )}
      <p className="ra-news-message">{item.message}</p>
      {earlier.length > 0 && (
        <div className="ra-news-earlier">
          <small><b>{earlier.length === 1 ? 'Antes, en este mismo chat:' : `Antes, en este mismo chat (${earlier.length}):`}</b></small>
          {earlier.slice(0, 3).map((older) => {
            const olderWhen = timeAgo(older.createdAt);
            return <small key={older.id}>• {(hasIdentity && kindOf(older).label) || older.title}{olderWhen ? ` (${olderWhen})` : ''}</small>;
          })}
        </div>
      )}
      {kind.tip && <div className="ra-news-tip"><Lightbulb size={14} /><span>{kind.tip}</span></div>}
      <div className="ra-news-actions">
        {kind.secondary && <button type="button" className="ra-btn ra-btn-outline ra-btn-sm" onClick={() => onAction(item.id, kind.secondary.action)}>{kind.secondary.label}</button>}
        <button type="button" className="ra-btn ra-btn-primary ra-btn-sm" onClick={() => onAction(item.id, kind.primary.action)}>{kind.primary.label}</button>
      </div>
    </article>
  );
}

/**
 * Lo que pasó en las preguntas de disponibilidad, contado por Repuestín: por búsqueda y, dentro, una tarjeta por chat
 * con la foto y el nombre de la otra parte. Celular: hoja desde abajo; escritorio: ventana junto a la burbuja.
 */
export default function AssistantNewsSheet({ open, items, isMobile, onClose, onAction, onDismissAll, onContinueSearch }) {
  const count = items.length;
  const topics = useMemo(() => groupAssistantNews(items), [items]);
  const chats = topics.reduce((total, topic) => total + topic.threads.length, 0);
  const summary = count === 1
    ? 'Pasó algo en una de tus preguntas.'
    : chats === count ? `Pasaron ${count} cosas en tus preguntas.`
      : chats === 1 ? `Pasaron ${count} cosas en el mismo chat.` : `Pasaron ${count} cosas en ${chats} chats.`;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={`ra-news-root${isMobile ? ' is-mobile' : ' is-desktop'}`}>
      {isMobile && <button type="button" className="ra-backdrop" aria-label="Cerrar" onClick={onClose} />}
      <section className="ra-news-sheet" role="dialog" aria-label="Novedades de Repuestín">
        {isMobile && <span className="ra-handle" aria-hidden="true" />}
        <header className="ra-news-header">
          <RepuestinAvatar size={44} />
          <div className="ra-news-header-copy">
            <strong>¡Hola! Tengo novedades</strong>
            <small>{summary}</small>
          </div>
          <button type="button" className="ra-close is-light" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="ra-news-list">
          {topics.map((topic) => (
            <div key={topic.key} className="ra-topic-group">
              <TopicHeader topic={topic} />
              {topic.threads.map((thread) => <ThreadCard key={thread.key} thread={thread} onAction={onAction} />)}
            </div>
          ))}
        </div>
        <footer className="ra-news-footer">
          {onContinueSearch && <button type="button" className="ra-btn ra-btn-outline ra-btn-block" onClick={onContinueSearch}>Seguir buscando mi repuesto</button>}
          <button type="button" className="ra-link ra-link-muted" onClick={onDismissAll}>{count === 1 ? 'Ya lo vi' : 'Marcar todo como visto'}</button>
        </footer>
      </section>
    </div>
  );
}
