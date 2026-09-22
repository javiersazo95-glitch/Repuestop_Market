import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

interface AboutHeaderProps {
  onBack: () => void;
  onHome: () => void;
  onSeller: () => void;
  onLogin: () => void;
}

/**
 * Secciones de /nosotros a las que apunta el menu.
 *
 * Antes la navegacion no tenia relacion con la pagina: "Para compradores" y "Para casas de
 * repuestos" sacaban al usuario a otras vistas, "Recursos" abria el centro de ayuda con un
 * chevron que prometia un desplegable inexistente, y "Precios" llevaba al alta de vendedor
 * aunque en esta pagina no hay ninguna seccion de precios. De cinco items, uno solo
 * navegaba la vista. Ahora los cinco son anclas que existen en el documento.
 */
const SECTIONS = [
  { id: 'patente', label: 'Búsqueda por patente' },
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'app', label: 'App móvil' },
  { id: 'mural', label: 'Mural' },
  { id: 'precios', label: 'Precios' },
  { id: 'preguntas', label: 'Preguntas' },
] as const;

export default function AboutHeader({ onBack, onHome, onSeller, onLogin }: AboutHeaderProps) {
  const [active, setActive] = useState<string>('');

  // Marca en el menu la seccion que se esta leyendo. Se usa IntersectionObserver y no el
  // scroll: no corre en cada pixel y respeta la cabecera fija con el rootMargin.
  useEffect(() => {
    const targets = SECTIONS
      .map(({ id }) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (!targets.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-70px 0px -55% 0px', threshold: [0.05, 0.25, 0.5] },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="rt-about-header">
      <div className="rt-about-header__inner">
        {/* El texto se oculta en pantallas angostas (ver about.css); la flecha y el
            aria-label se quedan, para que el control siga siendo entendible. */}
        <button className="rt-about-header__back" type="button" onClick={onBack} aria-label="Volver atrás">
          <ArrowLeft aria-hidden="true" />
          <span>Volver</span>
        </button>

        <button className="rt-about-header__logo" type="button" onClick={onHome} aria-label="Ir al inicio">
          <img src="/repuestop_horizontal_logo.png" alt="RepuesTop" width="630" height="153" />
        </button>

        <nav aria-label="Secciones de Sobre RepuesTop">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={active === id ? 'is-active' : undefined}
              aria-current={active === id ? 'true' : undefined}
              onClick={() => scrollTo(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="rt-about-header__actions">
          <button type="button" className="rt-about-header__login" onClick={onLogin}>Iniciar sesión</button>
          <button type="button" className="rt-about-header__signup" onClick={onSeller}>Crear cuenta gratis</button>
        </div>
      </div>
    </header>
  );
}
