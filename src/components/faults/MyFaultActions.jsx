import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, Loader2, Lock, MessageCircle, Pencil } from 'lucide-react';
import { faultDetailPath } from '../../routes/paths';
import { getFault } from '../../services/faultApi';
import { FaultCommentsModal, FaultDiagnosesModal } from './FaultOwnerModals';
import CreateFaultModal from './CreateFaultModal';
import '../../styles/profile-auctions.css';

/**
 * Acciones de una falla propia del comprador en Mis fallas (solo web; el celular tiene su propio seguimiento), las mismas de Mis
 * búsquedas en Encargar repuesto: ver el detalle de la falla, abrir por separado los diagnósticos y los comentarios de los talleres
 * (con el aviso de cuántos esperan respuesta) y editarla, con el lápiz de la esquina, mientras siga abierta.
 */
export default function MyFaultActions({ fault, diagnosisCount = 0, onChanged }) {
  const [panel, setPanel] = useState(null); // 'diagnoses' | 'comments'
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const open = fault.vigente !== false;
  const pending = Number(fault.preguntasPendientes) || 0;
  const vehicle = [fault.marca, fault.modelo].filter(Boolean).join(' ') || fault.vehiculo || 'tu vehículo';

  const startEdit = async () => {
    if (!open) { setNotice((value) => (value ? '' : 'Esta falla está cerrada y ya no se puede editar.')); return; }
    setBusy(true);
    setNotice('');
    try {
      // La lista trae un resumen: el formulario necesita la falla completa.
      setEditing(await getFault(fault.id));
    } catch (err) {
      setNotice(err?.message || 'No pudimos abrir la falla para editarla.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mfa">
      {/* Editar va como icono en la esquina superior derecha de la card, para no agrandarla. */}
      <button
        type="button"
        className={`mfa-edit ${open ? '' : 'is-locked'}`}
        aria-label={open ? 'Editar la falla' : 'La falla está cerrada y no se puede editar'}
        title={open ? 'Editar falla' : 'Falla cerrada: ya no se puede editar'}
        aria-disabled={!open}
        onClick={() => void startEdit()}
        disabled={busy}
      >
        {busy ? <Loader2 size={16} className="spin-icon" /> : open ? <Pencil size={16} /> : <Lock size={16} />}
      </button>
      <div className="pa-card-actions mfa-actions">
        <Link className="pa-btn-link" to={faultDetailPath(fault)} aria-label={`Ver el detalle de la falla de ${vehicle}`}>
          Ver detalle <ArrowRight size={14} />
        </Link>
        <button type="button" className="pa-btn-secondary" onClick={() => setPanel('diagnoses')} aria-label={`Ver diagnósticos (${diagnosisCount})`}>
          <ClipboardList size={15} /> Diagnósticos ({diagnosisCount})
        </button>
        <button
          type="button"
          className="pa-btn-secondary"
          onClick={() => setPanel('comments')}
          aria-label={pending > 0 ? `Comentarios de los talleres (${pending} sin responder)` : 'Comentarios de los talleres'}
        >
          <MessageCircle size={15} /> Comentarios
          {pending > 0 && <span className="mfa-badge">{pending > 99 ? '99+' : pending}</span>}
        </button>
      </div>
      {notice && <p className="pa-edit-notice" role="alert"><Lock size={14} /> {notice}</p>}

      {panel === 'diagnoses' && (
        <FaultDiagnosesModal fault={fault} vehicle={vehicle} canAct={open} onChanged={onChanged} onClose={() => setPanel(null)} />
      )}
      {panel === 'comments' && (
        <FaultCommentsModal fault={fault} vehicle={vehicle} canReply={open} onChanged={onChanged} onClose={() => setPanel(null)} />
      )}

      {editing && (
        <CreateFaultModal
          isOpen
          fault={editing}
          onClose={() => setEditing(null)}
          onUpdated={() => { setEditing(null); onChanged?.(); }}
        />
      )}
    </div>
  );
}
