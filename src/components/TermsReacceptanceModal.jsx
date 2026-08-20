import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LegalDocument from './help/LegalDocument';
import {
  COMPRADOR_TERMS, PRIVACIDAD_POLICY, PRIVACIDAD_WEB_EXTRA, VENDEDOR_TERMS,
} from '../data/legalTexts';
import { HELP_ROLES, resolveReportType } from '../data/helpContent';
import { ROUTES } from '../routes/paths';

/**
 * Aviso de re-aceptación: aparece cuando el perfil trae `requiereAceptarTerminos`, o sea
 * cuando los documentos legales cambiaron desde la última vez que esta persona aceptó.
 *
 * El texto va DENTRO del aviso, no en otra pestaña: así el consentimiento ocurre en un
 * solo flujo y el documento estuvo delante antes de aceptar, que es lo que le da valor a
 * la evidencia. La primera versión enlazaba a /terminos y el propio aviso terminaba
 * tapando el texto en esa pestaña.
 *
 * No tiene botón de cerrar a propósito —seguir usando la plataforma implica aceptar—,
 * pero sí tiene salida: cerrar sesión.
 */
export default function TermsReacceptanceModal() {
  const { user, role, isLoggedIn, acceptTerms, logout } = useAuth();
  const location = useLocation();
  const [documento, setDocumento] = useState('terminos');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  // Red de seguridad: si alguien llega a las páginas legales por su cuenta, el aviso no
  // debe taparlas.
  const enPaginaLegal = location.pathname === ROUTES.terms || location.pathname === ROUTES.privacy;

  if (!isLoggedIn || !user?.requiereAceptarTerminos || enPaginaLegal) return null;

  const esVendedor = resolveReportType(role, user) === HELP_ROLES.SELLER;

  const aceptar = async () => {
    setEnviando(true);
    setError('');
    const resultado = await acceptTerms();
    if (!resultado.success) {
      setError(resultado.error || 'No pudimos registrar tu aceptación. Intenta nuevamente.');
      setEnviando(false);
    }
    // Si sale bien, el aviso se desmonta solo: la bandera baja en el contexto.
  };

  return (
    <div className="terms-reaccept-backdrop" role="presentation">
      <section className="terms-reaccept" role="dialog" aria-modal="true" aria-labelledby="terms-reaccept-title">
        <header>
          <span><ShieldCheck size={20} /></span>
          <div>
            <h2 id="terms-reaccept-title">Actualizamos nuestros términos</h2>
            <p>Revísalos y acéptalos para seguir usando tu cuenta.</p>
          </div>
        </header>

        <nav className="terms-reaccept-tabs" aria-label="Documento legal">
          <button
            type="button"
            className={documento === 'terminos' ? 'active' : ''}
            onClick={() => setDocumento('terminos')}
          >
            Términos y Condiciones
          </button>
          <button
            type="button"
            className={documento === 'privacidad' ? 'active' : ''}
            onClick={() => setDocumento('privacidad')}
          >
            Política de Privacidad
          </button>
        </nav>

        <div className="terms-reaccept-scroll" tabIndex={0}>
          {documento === 'terminos' ? (
            <LegalDocument
              titulo={esVendedor ? 'Términos y condiciones para vendedores' : 'Términos y condiciones para compradores'}
              texto={esVendedor ? VENDEDOR_TERMS : COMPRADOR_TERMS}
            />
          ) : (
            <LegalDocument
              titulo="Política de privacidad"
              texto={PRIVACIDAD_POLICY}
              extra={PRIVACIDAD_WEB_EXTRA}
            />
          )}
        </div>

        {error && <p className="terms-reaccept-error"><AlertTriangle size={15} /> {error}</p>}

        <footer>
          <button type="button" className="terms-reaccept-logout" onClick={logout} disabled={enviando}>
            Cerrar sesión
          </button>
          <button type="button" className="terms-reaccept-accept" onClick={aceptar} disabled={enviando}>
            {enviando ? <Loader2 size={16} className="spin-icon" /> : <ShieldCheck size={16} />}
            {enviando ? 'Registrando…' : 'Acepto ambos documentos'}
          </button>
        </footer>
      </section>
    </div>
  );
}
