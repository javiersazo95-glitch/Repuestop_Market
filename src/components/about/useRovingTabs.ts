import { useCallback, useRef, type KeyboardEvent } from 'react';

/**
 * Navegacion por teclado del patron tablist (flechas, Home y End con
 * wrap-around). El rail es vertical en escritorio y horizontal bajo 1024px,
 * asi que acepta los cuatro cursores.
 */
export function useRovingTabs(count: number, onSelect: (index: number) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const register = useCallback(
    (index: number) => (el: HTMLButtonElement | null) => {
      refs.current[index] = el;
    },
    []
  );

  const focusTab = useCallback(
    (index: number) => {
      const next = ((index % count) + count) % count;
      onSelect(next);
      const el = refs.current[next];
      if (!el) return;
      el.focus();
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    },
    [count, onSelect]
  );

  const onKeyDown = useCallback(
    (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
      const moves: Record<string, number | undefined> = {
        ArrowDown: index + 1,
        ArrowRight: index + 1,
        ArrowUp: index - 1,
        ArrowLeft: index - 1,
        Home: 0,
        End: count - 1,
      };
      const target = moves[event.key];
      if (target === undefined) return;
      event.preventDefault();
      focusTab(target);
    },
    [count, focusTab]
  );

  return { register, onKeyDown };
}
