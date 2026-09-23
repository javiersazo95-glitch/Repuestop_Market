import { useState } from 'react';
import { X } from 'lucide-react';
import { GOOGLE_PLAY_URL } from '../config/mobileApp';

const DISMISSED_KEY = 'repuestop_mobile_app_notice_dismissed';

function isPhone() {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgentData?.mobile === true
    || /Android.*Mobile|iPhone|iPod|Windows Phone|Opera Mini/i.test(navigator.userAgent);
}

export default function MobileAppNotice() {
  const [visible, setVisible] = useState(() => {
    if (!isPhone()) return false;
    try { return sessionStorage.getItem(DISMISSED_KEY) !== '1'; }
    catch { return true; }
  });

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); }
    catch { /* Private browsing can disable storage. The current page still closes. */ }
  };

  return (
    <aside className="mobile-app-notice" aria-label="Aplicación móvil RepuesTop">
      <img src="/repuestop_icon.png" alt="" className="mobile-app-notice__logo" />
      <div className="mobile-app-notice__text">
        <strong>RepuesTop</strong>
        <span>{GOOGLE_PLAY_URL
          ? 'La app RepuesTop para Android está disponible en Google Play'
          : 'La app RepuesTop para Android llegará pronto a Google Play'}</span>
      </div>
      {GOOGLE_PLAY_URL && (
        <a className="mobile-app-notice__link" href={GOOGLE_PLAY_URL} target="_blank" rel="noopener noreferrer">
          Descargar
        </a>
      )}
      <button type="button" className="mobile-app-notice__close" onClick={dismiss} aria-label="Cerrar aviso de la aplicación móvil">
        <X size={20} aria-hidden="true" />
      </button>
    </aside>
  );
}
