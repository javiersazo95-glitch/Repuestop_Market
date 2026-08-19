import React, { useState } from 'react';
import HelpHeader from '../components/help/HelpHeader';
import LegalDocument from '../components/help/LegalDocument';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { COMPRADOR_TERMS, VENDEDOR_TERMS } from '../data/legalTexts';
import { HELP_ROLES, resolveReportType } from '../data/helpContent';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';

/**
 * Términos y condiciones. Hay dos documentos distintos —comprador y vendedor—,
 * así que se muestran en pestañas y arranca la del rol de la sesión.
 */
export default function TermsPage() {
  useDocumentTitle('Términos y condiciones');
  const nav = useAppNavigation();
  const { user, role } = useAuth();
  const reportType = resolveReportType(role, user);
  const [tab, setTab] = useState(reportType === HELP_ROLES.SELLER ? 'vendedor' : 'comprador');

  return (
    <div className="help-center-page">
      <HelpHeader />

      <main className="help-center-main legal-main">
        <nav className="legal-tabs" aria-label="Tipo de términos">
          <button type="button" className={tab === 'comprador' ? 'active' : ''} onClick={() => setTab('comprador')}>
            Para compradores
          </button>
          <button type="button" className={tab === 'vendedor' ? 'active' : ''} onClick={() => setTab('vendedor')}>
            Para vendedores
          </button>
        </nav>

        {tab === 'comprador' ? (
          <LegalDocument
            titulo="Términos y condiciones para compradores"
            descripcion="Reglas de uso de RepuesTop al buscar, cotizar y comprar repuestos."
            texto={COMPRADOR_TERMS}
          />
        ) : (
          <LegalDocument
            titulo="Términos y condiciones para vendedores"
            descripcion="Reglas de uso de RepuesTop al publicar, vender y despachar repuestos."
            texto={VENDEDOR_TERMS}
          />
        )}
      </main>

      <Footer
        onOpenSellerModal={nav.goSellerRegister}
        onOpenStores={nav.goStores}
        onOpenCatalog={() => nav.goCatalog()}
        onOpenAdsWall={nav.goAdsWall}
        onOpenHelp={nav.goHelp}
        onOpenTerms={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onOpenPrivacy={nav.goPrivacy}
      />
    </div>
  );
}

