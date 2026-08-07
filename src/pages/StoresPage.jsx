import React from 'react';
import StoresDirectoryView from '../components/StoresDirectoryView';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';

export default function StoresPage() {
  useDocumentTitle('Tiendas verificadas');
  const nav = useAppNavigation();

  return (
    <StoresDirectoryView
      onBackToStore={nav.goHome}
      onSelectStore={nav.goStore}
    />
  );
}
