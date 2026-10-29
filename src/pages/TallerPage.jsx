import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import TallerProfileView from '../components/talleres/TallerProfileView';
import { useAppNavigation } from '../routes/useAppNavigation';
import { ROUTES, parseIdSlug } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import { fetchTaller, getCachedTalleres } from '../services/talleresStorage';
import { qk } from '../services/queryKeys';
import PageLoadingSkeleton from '../components/skeletons/PageLoadingSkeleton';

async function fetchTallerById(tallerId, signal) {
  try {
    const taller = await fetchTaller(tallerId, { signal });
    if (taller && taller.id) return taller;
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    // sigue al respaldo desde la cache del buscador
  }
  const cached = getCachedTalleres().find((item) => String(item.id) === String(tallerId));
  if (!cached) throw new Error('Este taller ya no está publicado.');
  return cached;
}

export default function TallerPage() {
  const { workshopId: tallerParam } = useParams();
  const location = useLocation();
  const nav = useAppNavigation();

  const tallerId = parseIdSlug(tallerParam);
  const preloaded = location.state?.taller;
  const initialData = preloaded && String(preloaded.id) === String(tallerId) ? preloaded : undefined;

  const { data: taller, isLoading, error } = useQuery({
    queryKey: qk.taller(tallerId),
    queryFn: ({ signal }) => fetchTallerById(tallerId, signal),
    initialData,
    initialDataUpdatedAt: 0,
    enabled: Boolean(tallerId),
    staleTime: 30 * 1000,
  });

  useDocumentTitle(taller?.name || 'Taller');

  if (error) {
    return (
      <div className="route-status-panel">
        <AlertCircle size={38} aria-hidden="true" />
        <h2>No encontramos este taller</h2>
        <p>{error?.message || 'No se pudo cargar el perfil del taller.'}</p>
        <button type="button" className="route-status-action" onClick={() => nav.goBack(ROUTES.talleres)}>
          <ArrowLeft size={16} /> {nav.canGoBack ? 'Volver' : 'Volver a talleres'}
        </button>
      </div>
    );
  }

  if (isLoading || !taller) {
    return <PageLoadingSkeleton />;
  }

  return (
    <TallerProfileView
      taller={taller}
      onBack={() => nav.goBack(ROUTES.talleres)}
      backLabel={nav.canGoBack ? 'Volver' : 'Volver a talleres'}
    />
  );
}
