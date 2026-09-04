import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, Plus, PlusCircle, CalendarPlus, Pencil, Trash2, Loader2, AlertTriangle,
} from 'lucide-react';
import { getAgendaSummaryText, getAgendaWeeklySlotsCount } from '../../data/agendaConfig';
import {
  getAgendaConfigs, getCachedAgendaConfigs, subscribeToAgendaConfigsUpdates, deleteAgendaConfig,
} from '../../services/agendaConfigsStorage';
import { adErrorMessage } from '../../services/adsStorage';
import AgendaConfigModal from './AgendaConfigModal';

/**
 * Sección "Configuración de Agenda": el proveedor arma sus horarios con nombre y
 * los reutiliza en los avisos empresariales. Port de
 * `mobile/components/ads/AgendaConfigsSection.tsx`. Sin al menos una agenda
 * guardada no se puede activar la agenda de citas en un aviso.
 */
export default function AgendaConfigsSection({ configIdsInUse = [] }) {
  const [configs, setConfigs] = useState(() => getCachedAgendaConfigs());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [configToEdit, setConfigToEdit] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const inUse = useMemo(() => new Set(configIdsInUse.filter(Boolean)), [configIdsInUse]);

  useEffect(() => {
    let active = true;
    getAgendaConfigs()
      .then((list) => { if (active) setConfigs(list); })
      .catch((err) => { if (active) setError(adErrorMessage(err, 'No se pudieron cargar tus agendas.')); })
      .finally(() => { if (active) setLoading(false); });
    const unsubscribe = subscribeToAgendaConfigsUpdates((list) => { if (active) setConfigs(list); });
    return () => { active = false; unsubscribe(); };
  }, []);

  const openCreate = () => { setConfigToEdit(null); setIsModalOpen(true); };
  const openEdit = (config) => { setConfigToEdit(config); setIsModalOpen(true); };

  const handleDelete = async (config) => {
    const warn = inUse.has(config.id)
      ? '\n\nOJO: hay avisos usando esta agenda; quedarán sin horario hasta que elijas otra.'
      : '';
    if (!window.confirm(`¿Eliminar "${config.name}"?${warn}`)) return;
    setDeletingId(config.id);
    setError('');
    try {
      setConfigs(await deleteAgendaConfig(config.id));
    } catch (err) {
      setError(adErrorMessage(err, 'No se pudo eliminar la agenda.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="agenda-configs-section">
      <div className="agenda-cfg-head">
        <span className="agenda-cfg-head-ic"><CalendarClock size={20} /></span>
        <div className="agenda-cfg-head-txt">
          <strong>Configuración de Agenda</strong>
          <span>Arma tus horarios una vez y reutilízalos en tus avisos. Se sincronizan con la app.</span>
        </div>
        <button type="button" className="agenda-cfg-add" onClick={openCreate} aria-label="Nueva agenda">
          <Plus size={18} />
        </button>
      </div>

      {error && (
        <div className="ad-form-error">
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {loading && configs.length === 0 ? (
        <div className="agenda-cfg-loading"><Loader2 size={18} className="spin-icon" /> Cargando agendas…</div>
      ) : configs.length === 0 ? (
        <button type="button" className="agenda-cfg-empty" onClick={openCreate}>
          <CalendarPlus size={26} />
          <span>
            Todavía no tienes horarios guardados. Crea uno para poder activar la agenda de
            citas en tus avisos empresariales.
          </span>
          <span className="agenda-cfg-empty-cta"><PlusCircle size={15} /> Crear configuración</span>
        </button>
      ) : (
        <div className="agenda-cfg-list">
          {configs.map((config) => (
            <div key={config.id} className="agenda-cfg-row">
              <span className="agenda-cfg-row-ic"><CalendarClock size={19} /></span>
              <button
                type="button"
                className="agenda-cfg-row-main"
                onClick={() => openEdit(config)}
                title={`Editar ${config.name}`}
              >
                <span className="agenda-cfg-row-title">
                  {config.name}
                  {inUse.has(config.id) && <em className="agenda-cfg-inuse">En uso</em>}
                </span>
                <span className="agenda-cfg-row-summary">{getAgendaSummaryText(config)}</span>
                <span className="agenda-cfg-row-slots">{getAgendaWeeklySlotsCount(config)} bloques por semana</span>
              </button>
              <button type="button" className="agenda-cfg-icon" onClick={() => openEdit(config)} aria-label={`Editar ${config.name}`}>
                <Pencil size={15} />
              </button>
              <button
                type="button"
                className="agenda-cfg-icon is-danger"
                onClick={() => handleDelete(config)}
                disabled={deletingId === config.id}
                aria-label={`Eliminar ${config.name}`}
              >
                {deletingId === config.id ? <Loader2 size={15} className="spin-icon" /> : <Trash2 size={15} />}
              </button>
            </div>
          ))}
        </div>
      )}

      <AgendaConfigModal
        isOpen={isModalOpen}
        configToEdit={configToEdit}
        onClose={() => { setIsModalOpen(false); setConfigToEdit(null); }}
        onSaved={(list) => setConfigs(list)}
      />
    </div>
  );
}
