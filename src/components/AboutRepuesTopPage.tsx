import { useEffect, useState } from 'react';
import FounderModal from './FounderModal';
import AndroidDownloadModal from './about/AndroidDownloadModal';
import HeroSection from './about/HeroSection';
import MetricsStrip from './about/MetricsStrip';
import BrandStrip from './about/BrandStrip';
import CommunitiesSection from './about/CommunitiesSection';
import FeaturesSection from './about/FeaturesSection';
import ProductPreviewSection from './about/ProductPreviewSection';
import CoverageBand from './about/CoverageBand';
import TrustBand from './about/TrustBand';
import FaqSection from './about/FaqSection';
import FinalCtaSection from './about/FinalCtaSection';
import './about/about.css';

interface AboutRepuesTopPageProps {
  onBack: () => void;
  onContact: () => void;
  onOpenSeller: () => void;
  onOpenCatalog?: () => void;
  onOpenStores?: () => void;
  onOpenAdsWall?: () => void;
}

const FOUNDER_SEEN_KEY = 'repuestop_founder_about_seen';

export default function AboutRepuesTopPage({
  onBack,
  onContact,
  onOpenSeller,
  onOpenCatalog,
  onOpenStores,
  onOpenAdsWall,
}: AboutRepuesTopPageProps) {
  const [androidModalOpen, setAndroidModalOpen] = useState(false);
  const [founderModalOpen, setFounderModalOpen] = useState(false);

  // Invitacion a la campana de tiendas fundadoras, una sola vez por sesion.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (sessionStorage.getItem(FOUNDER_SEEN_KEY)) return;
      setFounderModalOpen(true);
      sessionStorage.setItem(FOUNDER_SEEN_KEY, 'true');
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  // El titulo lo fija AboutPage con useDocumentTitle; aqui solo la descripcion,
  // restaurando la original al salir para no contaminar las otras rutas.
  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]');
    if (!meta) return;
    const previous = meta.getAttribute('content');
    meta.setAttribute(
      'content',
      'Conoce RepuesTop: búsqueda por patente chilena sin margen de error, compra protegida, cuotas sin interés, cotizaciones por chat y casas de repuestos verificadas.'
    );
    return () => {
      if (previous !== null) meta.setAttribute('content', previous);
    };
  }, []);

  const handleCatalog = onOpenCatalog || onBack;
  const handleStores = onOpenStores || onBack;
  const handleAdsWall = onOpenAdsWall || onBack;

  return (
    <div className="rt-about">
      {/* Las reglas `.repuestop-about-page .founder-modal-*` necesitan ese
          ancestro. `display: contents` evita que el envoltorio aporte caja. */}
      <div className="repuestop-about-page rt-founder-scope">
        <FounderModal
          isOpen={founderModalOpen}
          onClose={() => setFounderModalOpen(false)}
          onApply={onOpenSeller}
        />
      </div>

      <AndroidDownloadModal isOpen={androidModalOpen} onClose={() => setAndroidModalOpen(false)} />

      <main>
        <HeroSection
          onCatalog={handleCatalog}
          onOpenSeller={onOpenSeller}
          onOpenAndroid={() => setAndroidModalOpen(true)}
        />
        <MetricsStrip />
        <BrandStrip />
        <CommunitiesSection onCatalog={handleCatalog} onOpenSeller={onOpenSeller} />
        <FeaturesSection />
        <ProductPreviewSection
          onCatalog={handleCatalog}
          onStores={handleStores}
          onAdsWall={handleAdsWall}
          onContact={onContact}
          onOpenSeller={onOpenSeller}
        />
        <CoverageBand />
        <TrustBand />
        <FaqSection onContact={onContact} />
        <FinalCtaSection onCatalog={handleCatalog} onOpenSeller={onOpenSeller} />
      </main>
    </div>
  );
}
