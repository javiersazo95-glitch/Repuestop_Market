import { useEffect, useRef, useState } from 'react';

const REDUCED = '(prefers-reduced-motion: reduce)';

function prefersReduced() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED).matches;
}

/**
 * Cuenta hasta `to` la primera vez que entra en pantalla y luego se queda
 * quieto. Con movimiento reducido pinta el valor final de una.
 */
export default function CountUp({ to, format }: { to: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [n, setN] = useState(() => (prefersReduced() ? to : 0));

  useEffect(() => {
    if (prefersReduced()) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setN(to); return; }

    let raf = 0;
    const run = () => {
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min((t - t0) / 900, 1);
        // easeOutCubic: arranca rapido y frena, que es como se lee un numero
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      run();
    }, { threshold: 0.4 });
    io.observe(el);

    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);

  return <span ref={ref}>{format(n)}</span>;
}
