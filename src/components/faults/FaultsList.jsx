import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, MessageSquare, Plus, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCommentedFaults, getMyFaults, getOpenFaults, timeSince } from '../../services/faultApi';
import { faultDetailPath } from '../../routes/paths';
import { resolveMediaUrl } from '../../services/api';
import CreateFaultModal from './CreateFaultModal';
import '../../styles/faults.css';

const PRIORITY = { ALTA: ['Prioridad alta', 'is-high'], MEDIA: ['Prioridad media', 'is-mid'], BAJA: ['Prioridad baja', 'is-low'] };

/** Vista previa en bloques (vehiculo, falla, contexto): lo que un taller necesita para distinguir una falla de otra sin abrirla. */
function FaultCard({ fault, showStatus, showClient, fromMural }) {
  const place = [fault.comuna, fault.region].filter(Boolean).join(', ');
  const vehicle = [fault.marca, fault.modelo].filter(Boolean).join(' ') || fault.vehiculo;
  const data = [fault.anio, fault.motor, fault.kilometraje ? `${fault.kilometraje.toLocaleString('es-CL')} km` : null].filter(Boolean).join(' • ');
  const [priorityLabel, priorityClass] = PRIORITY[fault.prioridad || (fault.seMueve === false ? 'ALTA' : 'MEDIA')];
  return (
    <Link to={faultDetailPath(fault)} state={{ fromMural }} className="ft-card" aria-label={`Falla: ${fault.titulo}, ${fault.vehiculo}`}>
      <div className="ft-card-top">
        {/* La primera imagen es la foto del vehiculo que se sube al registrar la falla. */}
        {fault.fotoUrl ? <img className="ft-card-thumb" src={resolveMediaUrl(fault.fotoUrl)} alt={fault.vehiculo} loading="lazy" /> : <span className="ft-card-thumb is-empty" aria-hidden="true"><Wrench size={20} /></span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ft-card-badges">
            {fault.propia && <span className="ft-badge is-mine">Mi falla</span>}
            {showStatus && <span className={`ft-badge ${fault.vigente ? '' : 'is-closed'}`}>{fault.vigente ? 'Abierta' : 'Cerrada'}</span>}
          </div>
          <h3>{vehicle}</h3>
          {data && <p className="ft-sub">{data}</p>}
        </div>
      </div>
      <div className="ft-card-block">
        <strong>{fault.titulo}</strong>
        <div className="ft-chips">
          <span className={`ft-chip ft-priority ${priorityClass}`}>{priorityLabel}</span>
          {fault.seMueve === false && <span className="ft-chip ft-priority is-high">No se mueve</span>}
          {fault.sintomas?.slice(0, 3).map((symptom) => <span key={symptom} className="ft-chip">{symptom}</span>)}
        </div>
      </div>
      <div className="ft-meta">
        {showClient && !fault.propia && <span>{fault.clienteNombre || 'Cliente'}</span>}
        <span>{timeSince(fault.createdAt)}</span>
        {place && <span>{place}</span>}
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
          <div className="ft-list">{items.map((fault) => <FaultCard key={fault.id} fault={fault} showStatus={!isWorkshop && view === 'MINE'} showClient={isWorkshop} fromMural={view === 'OPEN'} />)}</div>
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
