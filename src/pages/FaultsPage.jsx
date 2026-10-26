import React from 'react';
import { Link } from 'react-router-dom';
import FaultsList from '../components/faults/FaultsList';
import { ROUTES } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import '../styles/faults.css';

/** `/fallas`: fallas automotrices (el comprador registra las suyas; el taller diagnostica las de los clientes). */
export default function FaultsPage() {
  useDocumentTitle('Fallas automotrices');
  return (
    <div className="ft-page">
      <div className="ft-shell" style={{ paddingBottom: 0 }}>
        <nav className="ft-sub" aria-label="Ruta"><Link to={ROUTES.home}>Inicio</Link> / <span aria-current="page">Fallas automotrices</span></nav>
      </div>
      <FaultsList />
    </div>
  );
}
