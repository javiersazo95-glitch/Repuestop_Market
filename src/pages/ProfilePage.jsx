import React, { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import ProfileDashboard from '../components/ProfileDashboard';
import { PROFILE_TABS, profilePath, ROUTES } from '../routes/paths';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';

export default function ProfilePage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  useDocumentTitle('Mi cuenta');
  const nav = useAppNavigation();

  const handleTabChange = useCallback((nextTab) => {
    navigate(profilePath(nextTab));
  }, [navigate]);

  // Compatibilidad con enlaces antiguos: Direcciones dejó de formar parte del
  // perfil y cualquier URL guardada debe volver al resumen de la cuenta.
  if (tab === 'direcciones') {
    return <Navigate to={profilePath('resumen')} replace />;
  }

  if (!PROFILE_TABS.includes(tab)) {
    return <Navigate to={ROUTES.notFound} state={{ requestedPath: `${ROUTES.profile}/${tab}` }} replace />;
  }

  return (
    <ProfileDashboard
      initialTab={tab}
      onTabChange={handleTabChange}
      onBackToStore={nav.goHome}
    />
  );
}
