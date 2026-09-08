import React, { useEffect, useState } from 'react';
import { Cookie, Settings2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { helpCategoryPath } from '../routes/paths';

const CONSENT_KEY = 'repuestop_cookie_consent_v1';

const initialConsent = () => {
  try {
    return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
  } catch {
    return null;
  }
};

/**
 * Consentimiento explícito y granular preparado para la Ley 21.719, vigente
 * desde el 1 de diciembre de 2026. Las categorías opcionales empiezan apagadas.
 */
export default function CookieConsentBanner() {
  const [savedConsent] = useState(initialConsent);
  const [isOpen, setIsOpen] = useState(Boolean(!savedConsent));
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState(Boolean(savedConsent?.preferences));
  const [analytics, setAnalytics] = useState(Boolean(savedConsent?.analytics));
  const [marketing, setMarketing] = useState(Boolean(savedConsent?.marketing));

  useEffect(() => {
    const openSettings = () => {
      const current = initialConsent();
      setPreferences(Boolean(current?.preferences));
      setAnalytics(Boolean(current?.analytics));
      setMarketing(Boolean(current?.marketing));
      setShowSettings(true);
      setIsOpen(true);
    };
    window.addEventListener('repuestop:manage-cookies', openSettings);
    return () => window.removeEventListener('repuestop:manage-cookies', openSettings);
  }, []);

  if (!isOpen) return null;

  const save = (selection) => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      necessary: true,
      preferences: Boolean(selection.preferences),
      analytics: Boolean(selection.analytics),
      marketing: Boolean(selection.marketing),
      updatedAt: new Date().toISOString(),
      version: 1,
    }));
    setIsOpen(false);
  };

  return (
    <section className="cookie-consent" role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title">
      <div className="cookie-consent-copy">
        <Cookie aria-hidden="true" />
        <div>
          <h2 id="cookie-consent-title">Tu privacidad, tus decisiones</h2>
          <p>
            Usamos tecnologías necesarias para que RepuesTop funcione. Las cookies opcionales solo se activan con tu autorización.
            Revisa el detalle en nuestra <Link to={helpCategoryPath('politicas')}>Política de cookies</Link>.
          </p>
        </div>
      </div>

      {showSettings && (
        <fieldset className="cookie-consent-options">
          <legend>Configura tus preferencias</legend>
          <label><input type="checkbox" checked disabled /> <span><strong>Necesarias</strong>Inicio de sesión, seguridad, carrito y preferencias esenciales. Siempre activas.</span></label>
          <label><input type="checkbox" checked={preferences} onChange={(event) => setPreferences(event.target.checked)} /> <span><strong>Preferencias</strong>Recuerdan opciones no esenciales de navegación.</span></label>
          <label><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /> <span><strong>Analítica</strong>Ayudan a medir y mejorar el uso del sitio.</span></label>
          <label><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /> <span><strong>Marketing</strong>Permiten mostrar comunicaciones o publicidad más relevante.</span></label>
        </fieldset>
      )}

      <div className="cookie-consent-actions">
        <button type="button" className="cookie-consent-settings" onClick={() => setShowSettings(!showSettings)} aria-expanded={showSettings}>
          <Settings2 size={15} /> {showSettings ? 'Ocultar configuración' : 'Configurar'}
        </button>
        <button type="button" className="cookie-consent-reject" onClick={() => save({})}>Solo necesarias</button>
        {showSettings ? (
          <button type="button" className="cookie-consent-accept" onClick={() => save({ preferences, analytics, marketing })}>Guardar selección</button>
        ) : (
          <button type="button" className="cookie-consent-accept" onClick={() => save({ preferences: true, analytics: true, marketing: true })}>Aceptar todas</button>
        )}
      </div>
      <button type="button" className="cookie-consent-close" onClick={() => save({})} aria-label="Cerrar y conservar solo cookies necesarias"><X size={16} /></button>
    </section>
  );
}
