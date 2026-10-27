import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, MessageSquare, Plus, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCommentedFaults, getMyFaults, getOpenFaults, timeSince } from '../../services/faultApi';
import { faultDetailPath } from '../../routes/paths';
import CreateFaultModal from './CreateFaultModal';
import '../../styles/faults.css';

function FaultCard({ fault, showStatus }) {
  const place = [fault.comuna, fault.region].filter(Boolean).join(', ');
  return (
    <Link to={faultDetailPath(fault)} className="ft-card" aria-label={`Falla: ${fault.titulo}, ${fault.vehiculo}`}>
      <div className="ft-card-top">
        <h3>{fault.titulo}</h3>
        {fault.propia && <span className="ft-badge is-mine">Mi falla</span>}
        {showStatus && <span className={`ft-badge ${fault.vigente ? '' : 'is-closed'}`}>{fault.vigente ? 'Abierta' : 'Cerrada'}</span>}
      </div>
      <p className="ft-sub">{fault.vehiculo}{place ? ` · ${place}` : ''}</p>
      {fault.sintomas?.length > 0 && (
        <div className="ft-chips">{fault.sintomas.slice(0, 4).map((symptom) => <span key={symptom} className="ft-chip">{symptom}</span>)}</div>
      )}
      <div className="ft-meta">
        <span>{timeSince(fault.createdAt)}</span>
        <span><MessageSquare size={13} /> {fault.diagnosticos} {fault.diagnosticos === 1 ? 'diagnóstico' : 'diagnósticos'}</span>
      </div>
    </Link>
  );
}

/**
 * Lista de fallas automotrices. El comprador ve las suyas y registra una nueva; el taller ve las fallas abiertas
 * de los clientes y aquellas donde ya dejó su diagnóstico. La usa la página `/fallas` y el panel del perfil.
 */
export default function FaultsList({ heading = true }) {
  const { role } = useAuth();
  const navigate = useNavigate();
  const isWorkshop = role === 'WORKSHOP';
  const [view, setView] = useState('OPEN');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (current) => {
    setLoading(true);
    setError('');
    try {
      const fetcher = current === 'OPEN' ? getOpenFaults : current === 'COMMENTED' ? getCommentedFaults : getMyFaults;
      const data = await fetcher();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'No pudimos cargar las fallas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(view); }, [load, view]);

  const empty = view === 'OPEN'
    ? ['No hay fallas abiertas', 'Cuando alguien registre una falla, la verás aquí.']
    : view === 'COMMENTED'
      ? ['Aún no dejas diagnósticos', 'Comenta una falla abierta para que el cliente conozca tu taller.']
      : ['No has registrado fallas', 'Cuéntanos qué le pasó a tu vehículo y los talleres te enviarán su diagnóstico.'];

  return (
    <div className="ft-page" style={{ background: 'transparent', minHeight: 0, paddingBottom: 0 }}>
      <div className="ft-shell" style={{ padding: heading ? undefined : 0 }}>
        <div className="ft-head">
          <div>
            {heading && <h1>Fallas automotrices</h1>}
            <p>{isWorkshop
              ? 'Revisa las fallas de los clientes y deja tu diagnóstico para darte a conocer.'
              : 'Registra lo que le pasó a tu vehículo y recibe el diagnóstico de talleres acreditados.'}</p>
          </div>
          {!isWorkshop && (
            <button type="button" className="ft-btn ft-btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Registrar una falla</button>
          )}
        </div>

        <div className="ft-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'OPEN'} className={`ft-tab ${view === 'OPEN' ? 'is-active' : ''}`} onClick={() => setView('OPEN')}>Mural público</button>
          {isWorkshop ? (
            <button type="button" role="tab" aria-selected={view === 'COMMENTED'} className={`ft-tab ${view === 'COMMENTED' ? 'is-active' : ''}`} onClick={() => setView('COMMENTED')}>Mis diagnósticos</button>
          ) : (
            <button type="button" role="tab" aria-selected={view === 'MINE'} className={`ft-tab ${view === 'MINE' ? 'is-active' : ''}`} onClick={() => setView('MINE')}>Mis fallas</button>
          )}
        </div>

        {loading ? (
          <div className="ft-empty"><Loader2 size={20} className="spin-icon" /> Cargando fallas…</div>
        ) : error ? (
          <div className="ft-empty" role="alert"><AlertCircle size={20} /><strong>No pudimos cargar las fallas</strong>{error}<br />
            <button type="button" className="ft-btn ft-btn-outline" style={{ marginTop: 10 }} onClick={() => load(view)}>Reintentar</button></div>
        ) : items.length === 0 ? (
          <div className="ft-empty"><Wrench size={22} /><strong>{empty[0]}</strong>{empty[1]}</div>
        ) : (
          <div className="ft-list">{items.map((fault) => <FaultCard key={fault.id} fault={fault} showStatus={!isWorkshop && view === 'MINE'} />)}</div>
        )}
      </div>

      <CreateFaultModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onCreated={(fault) => { setCreating(false); navigate(faultDetailPath(fault)); }}
      />
    </div>
  );
}
