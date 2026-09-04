import React from 'react';
import HelpHeader from '../components/help/HelpHeader';
import LegalDocument from '../components/help/LegalDocument';
import Footer from '../components/Footer';
import { PRIVACIDAD_POLICY, PRIVACIDAD_WEB_EXTRA } from '../data/legalTexts';
import { useDocumentTitle } from '../routes/useDocumentTitle';

/** Política de privacidad, con las secciones propias del sitio web al final. */
export default function PrivacyPage() {
  useDocumentTitle('Política de privacidad');

  return (
    <div className="help-center-page">
      <HelpHeader />

      <main className="help-center-main legal-main">
        <LegalDocument
          titulo="Política de privacidad"
          descripcion="Cómo RepuesTop trata tus datos personales, conforme a la Ley N° 19.628 y a la Ley N° 21.719 cuando resulte exigible."
          texto={PRIVACIDAD_POLICY}
          extra={PRIVACIDAD_WEB_EXTRA}
        />
      </main>

      <Footer />
    </div>
  );
}

