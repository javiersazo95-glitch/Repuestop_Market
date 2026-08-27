import React, { useCallback, lazy, Suspense } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PROFILE_TABS, profilePath, ROUTES } from '../routes/paths';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import { useSellerApproval } from '../hooks/useSellerApproval';
import { useSellerBlocked } from '../hooks/useSellerBlocked';

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
  // Enlaces profundos de la campana de notificaciones: `?pedido=` abre el detalle del
  // pedido y `?ticket=` la consulta de soporte. Sin esto la notificacion dejaba al
  // usuario en la pestaña correcta pero sin abrir lo que le avisaron.
  const deepLinkOrderId = searchParams.get('pedido');
  const deepLinkTicketId = searchParams.get('ticket');

  // Una tienda que el backoffice todavia no aprueba no tiene panel: su lugar es el flujo
  // de postulacion, que es donde sube documentos y ve en que fase va. Solo la aprobacion
  // del backoffice abre esta puerta.
  const { isSeller, isApproved, isUnknown } = useSellerApproval();
  // La tienda BLOQUEADA es otro caso y NO va a `/vender`: tiene banner y apelacion en el
  // panel. Mandarla a postular seria decirle que se registre de nuevo.
  const { isBlocked } = useSellerBlocked();
  const mustCompleteApplication = isSeller && !isBlocked && !isUnknown && !isApproved;

  const handleTabChange = useCallback((nextTab) => {
    navigate(profilePath(nextTab));
  }, [navigate]);

  // El centro de ayuda salió del perfil: los enlaces y marcadores viejos a
  // /perfil/soporte siguen funcionando apuntando a la vista propia.
  if (tab === 'soporte') {
    return <Navigate to={ROUTES.support} replace />;
  }

  if (mustCompleteApplication) {
    return <Navigate to={ROUTES.sellerRegister} replace />;
  }

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
        deepLinkOrderId={deepLinkOrderId}
        deepLinkTicketId={deepLinkTicketId}
        onBackToStore={nav.goHome}
        paymentStatus={paymentStatus}
        paymentOrderId={paymentOrderId}
      />
    </Suspense>
  );
}

