import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X } from 'lucide-react';
import AuctionQuestionsPanel from './AuctionQuestionsPanel';
import '../styles/auction-questions.css';

/** Popup con todas las preguntas de las tiendas a una búsqueda, donde el comprador las responde. */
export default function AuctionQuestionsModal({ auctionId, title, canReply, onPendingChange, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const view = (
    <div className="qq-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="qq-modal" role="dialog" aria-modal="true" aria-label="Preguntas a tu búsqueda">
        <header className="qq-modal-head">
          <div>
            <span><MessageCircle size={14} /> Preguntas a tu búsqueda</span>
            <h3>{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="qq-modal-body">
          <AuctionQuestionsPanel auctionId={auctionId} canReply={canReply} onPendingChange={onPendingChange} />
        </div>
      </div>
    </div>
  );
  return createPortal(view, document.body);
}
