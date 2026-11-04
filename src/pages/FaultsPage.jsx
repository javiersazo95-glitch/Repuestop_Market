import React, { useEffect, useState } from 'react';
import { ClipboardList, Plus, Stethoscope, Wrench } from 'lucide-react';
import { getFaultMetrics } from '../services/faultApi';
import FaultsHero from '../components/faults/FaultsHero';
import { useIsMobile } from '../hooks/useIsMobile';
import { Link, useNavigate } from 'react-router-dom';
import FaultsList from '../components/faults/FaultsList';
import CreateFaultModal from '../components/faults/CreateFaultModal';
import { faultDetailPath, ROUTES } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import { useAuth } from '../context/AuthContext';
import '../styles/faults.css';

/** `/fallas`: fallas automotrices (el comprador registra las suyas; el taller diagnostica las de los clientes). */
export default function FaultsPage() {
  useDocumentTitle('Fallas automotrices');
  const { isLoggedIn, role } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isWorkshop = role === 'WORKSHOP';
  const [creating, setCreating] = useState(false);
  const [metrics, setMetrics] = useState({ loading: true, failed: false, faults: 0, withoutDiagnosis: 0, immobilized: 0 });
  // Cifras del día (igual que la app); si el servidor aún no las entrega, las abiertas salen de la lista.
  const [daily, setDaily] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => getFaultMetrics().then((data) => { if (!cancelled) setDaily(data); }).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  const formatMetric = (value) => new Intl.NumberFormat('es-CL').format(value);
  const metricValue = (value) => metrics.loading || metrics.failed ? '—' : formatMetric(value);

  return (
    <div className="ft-page">
      {isMobile && (
        <div className="ft-m-hero">
          <FaultsHero isWorkshop={isWorkshop} />
        </div>
      )}
      {isMobile && isLoggedIn && role === 'BUYER' && (
        <button type="button" className="ft-m-fab" onClick={() => setCreating(true)} aria-label="Registrar una falla automotriz"><Plus size={26} /></button>
      )}
      <div className="ft-wide-shell ft-index-shell">
        <nav className="ft-index-breadcrumb" aria-label="Ruta de navegación">
          <Link to={ROUTES.home}>Inicio</Link><span>/</span><span aria-current="page">Fallas automotrices</span>
        </nav>
        <header className="ft-index-head">
          <div>
            <h1>Fallas automotrices</h1>
            <p>Registra lo que le ocurre a tu vehículo y conecta con talleres que pueden ayudarte.</p>
          </div>
          {isLoggedIn && role === 'BUYER' && (
            <button type="button" className="ft-btn ft-btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Registrar falla</button>
          )}
        </header>
        <section className="ft-index-value-row" aria-label="Cómo funciona Fallas automotrices">
          <article>
            <span className="ft-index-value-icon"><ClipboardList size={19} /></span>
            <span><strong>{daily ? formatMetric(daily.fallasAbiertas) : metricValue(metrics.faults)}</strong><small>fallas abiertas</small></span>
          </article>
          <article>
            <span className="ft-index-value-icon"><Stethoscope size={19} /></span>
            <span><strong>{daily ? formatMetric(daily.registradasHoy) : '—'}</strong><small>nuevas hoy</small></span>
          </article>
          <article>
            <span className="ft-index-value-icon"><Wrench size={19} /></span>
            <span><strong>{daily ? formatMetric(daily.diagnosticosHoy) : '—'}</strong><small>diagnósticos hoy</small></span>
          </article>
        </section>
      </div>
      <FaultsList onMetricsChange={setMetrics} />
      {isLoggedIn && role === 'BUYER' && (
        <CreateFaultModal isOpen={creating} onClose={() => setCreating(false)} onCreated={(fault) => { setCreating(false); navigate(faultDetailPath(fault)); }} />
      )}
    </div>
  );
}
