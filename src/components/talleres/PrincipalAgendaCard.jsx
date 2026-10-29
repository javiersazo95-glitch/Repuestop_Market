import React, { useEffect, useState } from 'react';
import { CalendarClock, Pencil, CalendarPlus, Loader2 } from 'lucide-react';
import { getAgendaSummaryText, getAgendaWeeklySlotsCount, createDefaultAgendaConfig, PRINCIPAL_AGENDA_ID, PRINCIPAL_AGENDA_NAME } from '../../data/agendaConfig';
import {
  getAgendaConfigs, getCachedAgendaConfigs, subscribeToAgendaConfigsUpdates,
} from '../../services/agendaConfigsStorage';
import AgendaConfigModal from './AgendaConfigModal';

/**
 * Horario con el que el taller recibe citas: su "Horario principal". Es el único que el backend
 * usa para calcular los bloques disponibles (antes cada anuncio elegía una agenda con nombre).
 * Contraparte de `mobile/components/talleres/PrincipalAgendaCard.tsx`.
 */
export default function PrincipalAgendaCard({ onSaved }) {
  const [configs, setConfigs] = useState(() => getCachedAgendaConfigs());
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getAgendaConfigs()
      .then((list) => { if (active) setConfigs(list); })
      .catch(() => { /* sin red se muestra la copia local */ })
      .finally(() => { if (active) setLoading(false); });
    const unsubscribe = subscribeToAgendaConfigsUpdates((list) => { if (active) setConfigs(list); });
    return () => { active = false; unsubscribe(); };
  }, []);

  const principal = configs.find((config) => config.id === PRINCIPAL_AGENDA_ID) || null;
  const configToEdit = principal || { ...createDefaultAgendaConfig(), id: PRINCIPAL_AGENDA_ID, name: PRINCIPAL_AGENDA_NAME };

  return (
    <div className="agenda-configs-section">
      <div className="agenda-cfg-head">
        <span className="agenda-cfg-head-ic"><CalendarClock size={20} /></span>
        <div className="agenda-cfg-head-txt">
          <strong>Horario para recibir citas</strong>
          <span>Los clientes reservan dentro de este horario. Se sincroniza con la app.</span>
        </div>
      </div>

      {loading && !principal ? (
        <div className="agenda-cfg-loading"><Loader2 size={18} className="spin-icon" /> Cargando horario…</div>
      ) : !principal ? (
        <button type="button" className="agenda-cfg-empty" onClick={() => setIsModalOpen(true)}>
          <CalendarPlus size={26} />
          <span>Todavía no registras tu horario. Hazlo para poder recibir citas en línea desde tu perfil.</span>
          <span className="agenda-cfg-empty-cta"><CalendarPlus size={15} /> Registrar horario</span>
        </button>
      ) : (
        <div className="agenda-cfg-list">
          <div className="agenda-cfg-row">
            <span className="agenda-cfg-row-ic"><CalendarClock size={19} /></span>
            <button type="button" className="agenda-cfg-row-main" onClick={() => setIsModalOpen(true)} title="Editar horario">
              <span className="agenda-cfg-row-title">{principal.name}</span>
              <span className="agenda-cfg-row-summary">{getAgendaSummaryText(principal)}</span>
              <span className="agenda-cfg-row-slots">{getAgendaWeeklySlotsCount(principal)} bloques por semana</span>
            </button>
            <button type="button" className="agenda-cfg-icon" onClick={() => setIsModalOpen(true)} aria-label="Editar horario">
              <Pencil size={15} />
            </button>
          </div>
        </div>
      )}

      <AgendaConfigModal
        isOpen={isModalOpen}
        title="Tu agenda de citas"
        configToEdit={configToEdit}
        allowDelete={false}
        onClose={() => setIsModalOpen(false)}
        onSaved={(list) => { setConfigs(list); onSaved?.(list); }}
      />
    </div>
  );
}
