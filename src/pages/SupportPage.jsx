import React from 'react';
import SupportHelpPanel from '../components/SupportHelpPanel';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';

export default function SupportPage() {
  const { user, role, isLoggedIn } = useAuth();
  useDocumentTitle('Centro de ayuda');
  const nav = useAppNavigation();

  return (
    <SupportHelpPanel
      user={user}
      role={role}
      standalone
      onBack={nav.goHome}
      onViewCases={() => (isLoggedIn ? nav.goProfile('consultas') : nav.goHome())}
    />
  );
}
