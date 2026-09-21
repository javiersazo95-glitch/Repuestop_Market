import { useEffect, useState, type RefObject } from 'react';

export type RailScroll = 'start' | 'middle' | 'end';

/**
 * Dice si el rail esta al principio, en medio o al final de su scroll. Sirve
 * para pintar el degradado que avisa de que hay mas opciones abajo.
 */
export function useRailScrollState(ref: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<RailScroll>('start');
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const more = el.scrollHeight - el.clientHeight > 4;
        setOverflows(more);
        if (!more) { setState('end'); return; }
        const atStart = el.scrollTop <= 2;
        const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
        setState(atStart ? 'start' : atEnd ? 'end' : 'middle');
      });
    };

    measure();
    el.addEventListener('scroll', measure, { passive: true });

    // El rail cambia de vertical a horizontal en el breakpoint, asi que hay
    // que volver a medir cuando cambia de tamano.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref]);

  return { state, overflows };
}
