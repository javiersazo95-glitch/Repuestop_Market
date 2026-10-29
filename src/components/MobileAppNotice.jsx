import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { GOOGLE_PLAY_URL } from '../config/mobileApp';

const DISMISSED_KEY = 'repuestop_mobile_app_notice_dismissed';

// La app está en Google Play (Android): solo se invita desde un celular Android; en computador o iPhone no se muestra.
function isAndroidPhone() {
  if (typeof navigator === 'undefined') return false;
  return /Android.*Mobile/i.test(navigator.userAgent);
}

/**
 * Invitación a usar la app: al entrar desde un celular Android sube una hoja desde abajo (como la de
 * Mercado Libre) con el enlace a Google Play. No ocupa espacio en la página: flota sobre ella y, si se
 * cierra o se elige seguir en la web, no vuelve a salir durante esa sesión.
 */
export default function MobileAppNotice() {
  const [allowed] = useState(() => {
    if (!isAndroidPhone()) return false;
    try { return sessionStorage.getItem(DISMISSED_KEY) !== '1'; }
    catch { return true; }
  });
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(allowed);

  // Sube un instante después de entrar, para que se vea la animación.
  useEffect(() => {
    if (!allowed) return undefined;
    const timer = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(timer);
  }, [allowed]);

  if (!mounted) return null;

  const dismiss = () => {
    setOpen(false);
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); }
    catch { /* Navegación privada: se cierra igual en esta página. */ }
    setTimeout(() => setMounted(false), 300);
  };

  return (
    <div className={`app-invite ${open ? 'is-open' : ''}`}>
      <button type="button" className="app-invite__backdrop" onClick={dismiss} aria-label="Cerrar invitación a la app" tabIndex={open ? 0 : -1} />
      <section className="app-invite__sheet" role="dialog" aria-label="Descarga la app RepuesTop" aria-hidden={!open}>
        <button type="button" className="app-invite__close" onClick={dismiss} aria-label="Cerrar"><X size={20} aria-hidden="true" /></button>
        <img src="/icon-192.png" alt="" width="64" height="64" className="app-invite__logo" />
        <h2>Usa la app de RepuesTop</h2>
        <p>Ya estamos en Google Play. Busca repuestos por patente, cotiza y sigue tus pedidos más rápido desde la app.</p>
        <a className="app-invite__cta" href={GOOGLE_PLAY_URL} target="_blank" rel="noopener noreferrer" onClick={dismiss}>
          Descargar en Google Play
        </a>
        <button type="button" className="app-invite__skip" onClick={dismiss}>Seguir en la web</button>
      </section>
    </div>
  );
}
