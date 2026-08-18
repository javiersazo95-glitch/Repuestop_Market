import React, { useCallback, lazy, Suspense } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PROFILE_TABS, profilePath, ROUTES } from '../routes/paths';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';

const ProfileDashboard = lazy(() => import('../components/ProfileDashboard'));

function ProfileSkeleton() {
  return (
    <div className="container py-12 flex justify-center items-center min-h-[400px]">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-slate-200" />
        <div className="h-4 w-48 bg-slate-200 rounded" />
        <div className="h-3 w-32 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  useDocumentTitle('Mi cuenta');
  const nav = useAppNavigation();
  // plan_retorno_flow.md Fase 3: PagoController redirige aqui con
  // ?status=failure|pending&orderId=... cuando el pago no quedo aprobado. Se pasa a
  // ProfileDashboard como prop en vez de que cada tab lea la URL por su cuenta.
  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get('status');
  const paymentOrderId = searchParams.get('orderId');

  const handleTabChange = useCallback((nextTab) => {
    navigate(profilePath(nextTab));
  }, [navigate]);

  if (tab === 'direcciones') {
    return <Navigate to={profilePath('resumen')} replace />;
  }

  if (!PROFILE_TABS.includes(tab)) {
    return <Navigate to={ROUTES.notFound} state={{ requestedPath: `${ROUTES.profile}/${tab}` }} replace />;
  }

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileDashboard
        initialTab={tab}
        onTabChange={handleTabChange}
        onBackToStore={nav.goHome}
        paymentStatus={paymentStatus}
        paymentOrderId={paymentOrderId}
      />
    </Suspense>
  );
}
