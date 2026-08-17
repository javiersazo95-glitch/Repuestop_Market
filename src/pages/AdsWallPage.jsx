import React from 'react';
import AdsWallView from '../components/AdsWallView';
import { useDocumentTitle } from '../routes/useDocumentTitle';

export default function AdsWallPage() {
  useDocumentTitle('Mural de Anuncios y Servicios Automotrices');

  return <AdsWallView />;
}
