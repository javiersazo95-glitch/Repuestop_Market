import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION).matches;
}

/**
 * Aparicion al entrar en viewport.
 *
 * Tres detalles que la version anterior no tenia y que dejaban contenido
 * invisible:
 *   1. Con `prefers-reduced-motion` no se anima nada ni se monta el observer.
 *   2. Lo que ya esta en pantalla al montar arranca visible, sin parpadeo.
 *   3. Un temporizador de rescate lo muestra igual si el observer no dispara
 *      (saltos de scroll bruscos, navegadores raros).
 */
export default function Reveal({
  children,
  delay = 0,
  as: Tag = 'div' as ElementType,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    // Ya visible al montar: nada que animar.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      setInView(true);
      return;
    }

    const rescue = window.setTimeout(() => setInView(true), 1200);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        window.clearTimeout(rescue);
        setInView(true);
        io.disconnect();
      },
      { threshold: 0, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);

    return () => {
      window.clearTimeout(rescue);
      io.disconnect();
    };
  }, []);

  return (
    <Tag
      ref={ref}
      className={`rt-reveal${inView ? ' is-in' : ''}${className ? ' ' + className : ''}`}
      style={{ transitionDelay: `${Math.min(delay, 240)}ms` }}
    >
      {children}
    </Tag>
  );
}
