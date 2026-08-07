import React from 'react';
import AboutRepuesTopPage from '../components/AboutRepuesTopPage';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';

export default function AboutPage() {
  useDocumentTitle('Quiénes somos');
  const nav = useAppNavigation();

  return (
    <AboutRepuesTopPage
      onBack={nav.goHome}
      onContact={nav.goSupport}
      onOpenSeller={nav.goSellerRegister}
    />
  );
}
