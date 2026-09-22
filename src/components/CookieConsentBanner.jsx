import React, { useEffect, useState } from 'react';
import { Cookie, Settings2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { helpCategoryPath } from '../routes/paths';

const CONSENT_KEY = 'repuestop_cookie_consent_v1';

const leerRegistro = () => {
  try {
    return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
  } catch {
    return null;
  }
};

/**
 * Qué se guarda hoy en el navegador y para qué. Es la lista real, no una promesa:
 * si alguien agrega almacenamiento nuevo, va aquí.
 */
const ALMACENAMIENTO = [
  ['Sesión y seguridad', 'Te mantiene con la sesión iniciada y protege tu cuenta entre pestañas.'],
  ['Carrito y compra', 'Conserva lo que agregaste y el último pedido mientras dura la compra.'],
  ['Tu vehículo', 'Recuerda la patente y el vehículo activo para mostrarte repuestos compatibles.'],
  ['Diagnóstico de errores', 'Si algo falla, se envía el error a nuestro proveedor de monitoreo para poder arreglarlo. No se envían datos de contacto, ni bancarios, ni grabaciones de tu sesión.'],
];

/**
 * Aviso de almacenamiento local.
 *
 * ANTES era un consentimiento granular con cuatro categorías (necesarias, preferencias,
 * analítica y marketing) y **ninguna hacía nada**: la selección se guardaba en
 * `repuestop_cookie_consent_v1` y ningún otro módulo leía esa clave. Se le prometía a la
 * persona un control que no existía, y la política de privacidad lo repetía por escrito.
 *
 * Hoy el sitio no tiene analítica ni marketing: no hay Google Analytics, ni píxel de Meta,
 * ni ningún rastreador de terceros -- el `connect-src` de la CSP solo admite la API, Google
 * Sign-In y el monitoreo de errores --. Todo lo que se guarda es necesario para operar, y
 * el monitoreo de errores no escribe nada en el dispositivo. Con eso no queda ninguna
 * categoría opcional real, así que el aviso es informativo y no un formulario de
 * consentimiento falso.
 *
 * **Si algún día entra un rastreador de verdad**, esto vuelve a ser un consentimiento con
 * casillas: hay que reponer las categorías, que empiecen apagadas y, sobre todo, que algo
 * LEA esta clave antes de inicializar nada. La plomería se conserva por eso.
 */
export default function CookieConsentBanner() {
  const [registro] = useState(leerRegistro);
  const [isOpen, setIsOpen] = useState(Boolean(!registro));
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    // Entrada desde el centro de ayuda ("Gestionar cookies"). Reabre el aviso con el
    // detalle desplegado, que es la forma de consultarlo después de haberlo cerrado.
    const abrir = () => {
      setShowDetail(true);
      setIsOpen(true);
    };
    window.addEventListener('repuestop:manage-cookies', abrir);
    return () => window.removeEventListener('repuestop:manage-cookies', abrir);
  }, []);

  if (!isOpen) return null;

  const cerrar = () => {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({
        necessary: true,
        acknowledgedAt: new Date().toISOString(),
        // v2: el registro dejó de ser una selección de categorías y pasó a ser el acuse
        // de haber visto el aviso. Se conserva la MISMA clave para que a quien ya lo
        // cerró no le vuelva a aparecer.
        version: 2,
      }));
    } catch {
      // Modo privado o almacenamiento bloqueado: el aviso reaparecerá, que es lo correcto.
    }
    setIsOpen(false);
  };

  return (
    <section className="cookie-consent" role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title">
      <div className="cookie-consent-copy">
        <Cookie aria-hidden="true" />
        <div>
          <h2 id="cookie-consent-title">Cómo usamos el almacenamiento de tu navegador</h2>
          <p>
            RepuesTop guarda en tu navegador solo lo necesario para que el sitio funcione: tu sesión, tu
            carrito y el vehículo que estés consultando. No usamos cookies de publicidad ni rastreadores
            de terceros. Revisa el detalle en nuestra <Link to={helpCategoryPath('politicas')}>Política de cookies</Link>.
          </p>
        </div>
      </div>

      {showDetail && (
        <fieldset className="cookie-consent-options">
          <legend>Qué se guarda y para qué</legend>
          {ALMACENAMIENTO.map(([titulo, detalle]) => (
            <p key={titulo}><strong>{titulo}</strong>{detalle}</p>
          ))}
        </fieldset>
      )}

      <div className="cookie-consent-actions">
        <button type="button" className="cookie-consent-settings" onClick={() => setShowDetail(!showDetail)} aria-expanded={showDetail}>
          <Settings2 size={15} /> {showDetail ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
        <button type="button" className="cookie-consent-accept" onClick={cerrar}>Entendido</button>
      </div>
      <button type="button" className="cookie-consent-close" onClick={cerrar} aria-label="Cerrar el aviso"><X size={16} /></button>
    </section>
  );
}
