import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { RepuestinAvatar } from './AssistantBits';

export const BUBBLE_SIZE = 60;
const MARGIN = 8;
/** Máximo que muestra el contador: más de esto se ve como "9+". */
export const MAX_BADGE = 9;
const DISMISS_SIZE = 64;
/** Distancia del centro de la "X" al borde inferior de la pantalla. */
const DISMISS_OFFSET = 96;
const DISMISS_RADIUS = 72;

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

/** Lo que tapa abajo: la barra de pestañas del celular (Market o perfil). */
function bottomInset(isMobile) {
  return isMobile ? 76 : 0;
}

function clampBubble(position, isMobile) {
  const screen = viewport();
  const maxX = screen.width - BUBBLE_SIZE - MARGIN;
  const maxY = screen.height - BUBBLE_SIZE - bottomInset(isMobile) - MARGIN;
  return {
    x: Math.min(Math.max(position.x, MARGIN), Math.max(maxX, MARGIN)),
    y: Math.min(Math.max(position.y, MARGIN + 56), Math.max(maxY, MARGIN)),
  };
}

/** Esquina inferior derecha, por encima de la barra de pestañas. */
function defaultPosition(isMobile) {
  const screen = viewport();
  return clampBubble({ x: screen.width - BUBBLE_SIZE - (isMobile ? 16 : 28), y: screen.height - bottomInset(isMobile) - BUBBLE_SIZE - (isMobile ? 24 : 28) }, isMobile);
}

/** Al soltarla, se pega al borde más cercano para no tapar el contenido. */
function snapToEdge(position) {
  const screen = viewport();
  return { x: position.x + BUBBLE_SIZE / 2 < screen.width / 2 ? MARGIN : screen.width - BUBBLE_SIZE - MARGIN, y: position.y };
}

function dismissCenter() {
  const screen = viewport();
  return { x: screen.width / 2, y: screen.height - DISMISS_OFFSET };
}

function isOverDismiss(position) {
  const target = dismissCenter();
  return Math.hypot(position.x + BUBBLE_SIZE / 2 - target.x, position.y + BUBBLE_SIZE / 2 - target.y) <= DISMISS_RADIUS;
}

/**
 * Burbuja de Repuestín (`components/assistant/PartAssistantBubble.tsx`): queda en pantalla mientras no haya dejado un
 * mensaje a las casas de repuestos ni creado un encargo, o mientras haya novedades. Se arrastra (mouse o dedo); un toque
 * abre el chat. Al arrastrarla aparece una "X" abajo al centro: soltarla encima la quita, como las burbujas de Messenger.
 * En escritorio además muestra una "x" pequeña al pasar el mouse.
 */
export default function AssistantBubble({ count, hasNews, position, isMobile, onPress, onMove, onDismiss }) {
  const [pos, setPos] = useState(() => clampBubble(position ?? defaultPosition(isMobile), isMobile));
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pulse, setPulse] = useState(false);
  const drag = useRef(null);

  // Al pasar de escritorio a celular (o al revés) cambia lo que tapa abajo: se reubica.
  const firstLayout = useRef(true);
  useEffect(() => {
    if (firstLayout.current) { firstLayout.current = false; return; }
    setPos(clampBubble(position ?? defaultPosition(isMobile), isMobile));
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar el tamaño de la ventana, la burbuja sigue dentro de la pantalla.
  useEffect(() => {
    const onResize = () => setPos((current) => clampBubble(current, isMobile));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isMobile]);

  // Como una campana: cada aviso nuevo hace "saltar" la burbuja.
  useEffect(() => {
    if (count <= 0) return undefined;
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 420);
    return () => clearTimeout(timer);
  }, [count]);

  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, origin: pos, moved: false };
  };

  const onPointerMove = (event) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.abs(dx) + Math.abs(dy) > 6) {
      state.moved = true;
      setDragging(true);
    }
    if (!state.moved) return;
    const next = { x: state.origin.x + dx, y: state.origin.y + dy };
    setPos(next);
    setOver(Boolean(onDismiss) && isOverDismiss(next));
  };

  const finish = (event, cancelled = false) => {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!state.moved) {
      if (!cancelled) onPress();
      return;
    }
    setDragging(false);
    const dropped = { x: state.origin.x + event.clientX - state.startX, y: state.origin.y + event.clientY - state.startY };
    if (!cancelled && onDismiss && isOverDismiss(dropped)) {
      const center = dismissCenter();
      setPos({ x: center.x - BUBBLE_SIZE / 2, y: center.y - BUBBLE_SIZE / 2 });
      setLeaving(true);
      setTimeout(() => { setOver(false); onDismiss(); }, 220);
      return;
    }
    setOver(false);
    const target = snapToEdge(clampBubble(cancelled ? state.origin : dropped, isMobile));
    setPos(target);
    onMove(target);
  };

  const badge = count > MAX_BADGE ? `${MAX_BADGE}+` : String(count);
  const label = hasNews
    ? `Repuestín: tienes ${count} novedad${count === 1 ? '' : 'es'} de tu consulta. Toca para verlas`
    : count > 0
      ? `Repuestín: tienes ${count} aviso${count === 1 ? '' : 's'}. Toca para seguir buscando tu repuesto`
      : 'Repuestín: toca para seguir buscando tu repuesto';
  const target = dismissCenter();

  return (
    <>
      {onDismiss && dragging && (
        <div
          className={`ra-dismiss-target${over ? ' is-over' : ''}`}
          style={{ left: target.x - DISMISS_SIZE / 2, top: target.y - DISMISS_SIZE / 2 }}
          aria-hidden="true"
        >
          <X size={30} />
        </div>
      )}
      <div
        className={`ra-bubble-wrap${dragging ? ' is-dragging' : ''}${leaving ? ' is-leaving' : ''}`}
        style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
      >
        <button
          type="button"
          className={`ra-floating${pulse ? ' is-pulse' : ''}`}
          aria-label={label}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => finish(event)}
          onPointerCancel={(event) => finish(event, true)}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPress(); } }}
        >
          <RepuestinAvatar size={BUBBLE_SIZE - 6} />
          {count > 0 && <span className="ra-floating-badge" aria-hidden="true">+{badge}</span>}
        </button>
        {!isMobile && onDismiss && (
          <button type="button" className="ra-floating-close" onClick={onDismiss} aria-label="Quitar la burbuja de Repuestín">
            <X size={12} />
          </button>
        )}
      </div>
    </>
  );
}
