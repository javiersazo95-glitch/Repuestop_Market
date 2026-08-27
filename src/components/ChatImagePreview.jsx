import React from 'react';
import { X } from 'lucide-react';

/**
 * Imagen adjunta a la espera de enviarse, para los chats del pedido.
 *
 * Nacio como bloque con estilos en linea dentro de `QuoteDetailModal`; se extrajo al
 * necesitarlo tambien el chat de mediacion. Los dos hilos son equivalentes para el
 * usuario y tienen que verse igual.
 *
 * El boton de quitar lleva `padding: 0` en su regla a proposito: vive dentro de
 * `.quote-ws-composer` y de `.dispute-composer`, y ambos definen un `button` con
 * `padding: 9px 16px`. Sin anularlo, sobre un boton de 26px el padding heredado deja el
 * icono en cero de ancho y la caja se ve VACIA -que fue exactamente lo que paso-.
 */
export default function ChatImagePreview({ previewUrl, fileName, fileSize, hint, onRemove }) {
  if (!previewUrl) return null;

  const peso = fileSize ? `${(fileSize / 1024).toFixed(0)} KB` : null;

  return (
    <div className="chat-image-preview">
      <img src={previewUrl} alt="Vista previa de la imagen adjunta" />
      <div>
        <span>{fileName || 'Imagen adjunta'}</span>
        <small>{[peso, hint].filter(Boolean).join(' · ')}</small>
      </div>
      <button type="button" onClick={onRemove} title="Quitar imagen" aria-label="Quitar imagen">
        <X size={16} />
      </button>
    </div>
  );
}
