import React from 'react';
import TalleresDirectoryView from '../components/talleres/TalleresDirectoryView';
import { useDocumentTitle } from '../routes/useDocumentTitle';

export default function TalleresPage() {
  useDocumentTitle('Talleres y servicios automotrices');

  return <TalleresDirectoryView />;
}
