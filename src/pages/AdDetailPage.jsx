import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import AdDetailView from '../components/ads/AdDetailView';
import { useAppNavigation } from '../routes/useAppNavigation';
import { parseIdSlug } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import { fetchPublicAd, getCachedWallAds } from '../services/adsStorage';
import { qk } from '../services/queryKeys';
import PageLoadingSkeleton from '../components/skeletons/PageLoadingSkeleton';

async function fetchAdById(adId, signal) {
  try {
    const ad = await fetchPublicAd(adId, { signal });
    if (ad && ad.id) return ad;
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    // sigue al respaldo desde la cache del mural
  }
  const cached = getCachedWallAds().find((item) => String(item.id) === String(adId));
  if (!cached) throw new Error('Este anuncio ya no está publicado.');
  return cached;
}

export default function AdDetailPage() {
  const { adId: adParam } = useParams();
  const location = useLocation();
  const nav = useAppNavigation();

  const adId = parseIdSlug(adParam);
  const preloaded = location.state?.ad;
  const initialData = preloaded && String(preloaded.id) === String(adId) ? preloaded : undefined;

  const { data: ad, isLoading, error } = useQuery({
    queryKey: qk.publicAd(adId),
    queryFn: ({ signal }) => fetchAdById(adId, signal),
    initialData,
    initialDataUpdatedAt: 0,
    enabled: Boolean(adId),
    staleTime: 30 * 1000,
  });

  useDocumentTitle(ad?.title || 'Anuncio');

  if (error) {
    return (
      <div className="route-status-panel">
        <AlertCircle size={38} aria-hidden="true" />
        <h2>No encontramos este anuncio</h2>
        <p>{error?.message || 'No se pudo cargar la información del anuncio.'}</p>
        <button type="button" className="route-status-action" onClick={() => nav.goAdsWall()}>
          <ArrowLeft size={16} /> Volver al mural
        </button>
      </div>
    );
  }

  if (isLoading || !ad) {
    return <PageLoadingSkeleton />;
  }

  return <AdDetailView ad={ad} onBack={() => nav.goAdsWall()} />;
}
