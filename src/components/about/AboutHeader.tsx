import { ChevronDown } from 'lucide-react';

interface AboutHeaderProps {
  onHome: () => void;
  onCatalog: () => void;
  onSeller: () => void;
  onHelp: () => void;
  onLogin: () => void;
}

export default function AboutHeader({
  onHome,
  onCatalog,
  onSeller,
  onHelp,
  onLogin,
}: AboutHeaderProps) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="rt-about-header">
      <div className="rt-about-header__inner">
        <button className="rt-about-header__logo" type="button" onClick={onHome} aria-label="Ir al inicio">
          <img src="/repuestop_horizontal_logo.png" alt="RepuesTop" width="630" height="153" />
        </button>

        <nav aria-label="Navegación de Sobre RepuesTop">
          <button type="button" onClick={onCatalog}>Para compradores</button>
          <button type="button" onClick={onSeller}>Para casas de repuestos</button>
          <button type="button" onClick={() => scrollTo('como-funciona')}>Cómo funciona</button>
          <button type="button" onClick={onSeller}>Precios</button>
          <button type="button" onClick={onHelp}>Recursos <ChevronDown /></button>
        </nav>

        <div className="rt-about-header__actions">
          <button type="button" className="rt-about-header__login" onClick={onLogin}>Iniciar sesión</button>
          <button type="button" className="rt-about-header__signup" onClick={onSeller}>Crear cuenta gratis</button>
        </div>
      </div>
    </header>
  );
}
