import React, { useEffect, useRef, useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { shareLink } from '../utils/shareLink';

/**
 * Boton "Compartir" de un repuesto, una tienda o un anuncio. Lleva el estilo del lugar donde
 * se monta (`className`: `btn-view-details`, `btn-auth-secondary`, `btn-mgmt-icon`...) y solo
 * suma la logica: hoja nativa en el celular, copiar el enlace en escritorio, y el aviso
 * "Enlace copiado" durante un par de segundos.
 *
 * `stopPropagation` va activo por defecto porque casi siempre vive dentro de una tarjeta
 * clickeable (abrir el producto): compartir no debe abrirla.
 */
export default function ShareLinkButton({
  url,
  title,
  text,
  label = 'Compartir',
  className = '',
  iconSize = 14,
  iconOnly = false,
  stopPropagation = true,
  ...rest
}) {
  const [state, setState] = useState('idle'); // idle | copied | failed
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleClick = async (event) => {
    if (stopPropagation) event.stopPropagation();
    const result = await shareLink({ url, title, text });
    if (result !== 'copied' && result !== 'failed') return;
    setState(result);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState('idle'), 2200);
  };

  const feedback = state === 'copied' ? 'Enlace copiado' : state === 'failed' ? 'No se pudo compartir' : '';

  return (
    <button
      type="button"
      className={`share-link-button ${className} ${state !== 'idle' ? `is-${state}` : ''}`.trim()}
      onClick={handleClick}
      title={feedback || label}
      aria-label={feedback || label}
      aria-live="polite"
      {...rest}
    >
      {state === 'copied' ? <Check size={iconSize} /> : <Share2 size={iconSize} />}
      {!iconOnly && <span>{feedback || label}</span>}
    </button>
  );
}
