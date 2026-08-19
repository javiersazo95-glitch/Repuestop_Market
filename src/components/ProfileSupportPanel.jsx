import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ChevronRight, CircleAlert, Headphones, Inbox, Loader2, MessageSquare, Scale } from 'lucide-react';
import { getMyMediationsApi, getMyReportsApi, getMySupportTicketsApi } from '../services/api';
import { MEDIATION_STATUS_LABELS } from '../data/mediationStatus';
import MediationCaseView from './MediationCaseView';

const STATUS_LABELS = {
  ABIERTO: 'Abierto', EN_PROCESO: 'En proceso', PENDIENTE_VENDEDOR: 'Pendiente de tu respuesta',
  PENDIENTE_COMPRADOR: 'Pendiente de respuesta', SLA_VENCIDO: 'Atención vencida',
  RESUELTO: 'Resuelto', CERRADO: 'Cerrado', CANCELADO: 'Cancelado',
};

// Un caso deja de estar abierto al llegar a uno de estos estados (mismos valores
// que usa el sidebar del centro de ayuda).
const CLOSED_STATUSES = ['RESUELTO', 'CERRADO', 'CANCELADO', 'RESUELTA', 'CERRADA'];

const AREAS = [
  { id: 'todos', label: 'Todos', icon: Inbox },
  { id: 'reportes', label: 'Reportes', icon: AlertTriangle },
  { id: 'disputas', label: 'Disputas', icon: Scale },
  { id: 'soporte', label: 'Soporte técnico', icon: Headphones },
];
const AREA_LABELS = { reportes: 'Reporte', disputas: 'Disputa', soporte: 'Soporte' };
const STATE_FILTERS = [['abiertos', 'Abiertos'], ['cerrados', 'Resueltos'], ['todos', 'Todos']];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';
}
function toList(response) {
  return Array.isArray(response) ? response : response?.content || [];
}
function isClosed(status) {
  return CLOSED_STATUSES.includes(String(status || '').toUpperCase());
}

export default function ProfileSupportPanel({ user }) {
  const userId = user?.userId ?? user?.id;
  const isSeller = Boolean(user?.sellerId);
  const [tickets, setTickets] = useState([]);
  const [reports, setReports] = useState([]);
  const [mediations, setMediations] = useState([]);
  const [activeArea, setActiveArea] = useState('todos');
  const [stateFilter, setStateFilter] = useState('abiertos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // El caso abierto vive en la URL (`/perfil/consultas?caso=<pedidoId>`) para que
  // el botón atrás del navegador cierre el expediente y el enlace sea compartible.
  const [searchParams, setSearchParams] = useSearchParams();
  const openCaseId = searchParams.get('caso');
  const openCase = (pedidoIdReal) => {
    const next = new URLSearchParams(searchParams);
    next.set('caso', String(pedidoIdReal));
    setSearchParams(next);
  };
  const closeCase = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('caso');
    setSearchParams(next);
  };

  const loadCases = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const [ticketsRes, reportsRes, mediationsRes] = await Promise.all([
        getMySupportTicketsApi(userId),
        getMyReportsApi(userId),
        getMyMediationsApi(userId),
      ]);
      setTickets(toList(ticketsRes));
      setReports(toList(reportsRes));
      setMediations(toList(mediationsRes));
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron cargar tus reportes y disputas.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadCases(); }, [loadCases]);

  // Los reportes de chat ya no se crean como ticket de soporte con un texto
  // mágico (ver QuoteDetailModal): se guardan directo en la tabla real de
  // reportes, que es lo que se lee arriba en `reports`. Este filtro solo
  // protege datos históricos creados con el flujo viejo, para que no
  // aparezcan duplicados también en "Soporte técnico".
  const supportTickets = useMemo(
    () => tickets.filter((ticket) => !String(ticket.reason || '').startsWith('Reporte de chat:')),
    [tickets]
  );

  // Los tres orígenes se normalizan a la misma forma para poder listarlos
  // juntos, ordenarlos por fecha y filtrarlos por estado con un solo criterio.
  const cases = useMemo(() => {
    const rows = [
      ...reports.map((report) => ({
        key: `r-${report.id}`,
        area: 'reportes',
        status: report.status || 'EN_PROCESO',
        estado: 'Reportado',
        titulo: `Reporte a ${report.reportadoName || 'un usuario'}`,
        detalle: report.descripcion || report.motivo || 'Sin detalle disponible.',
        numero: report.idExterno || report.id,
        fecha: report.fechaCreacion,
      })),
      ...mediations.map((mediation) => ({
        key: `m-${mediation.id}`,
        area: 'disputas',
        status: mediation.status || 'EN_MEDIACION',
        estado: MEDIATION_STATUS_LABELS[mediation.status] || mediation.displayStatus || mediation.status || 'En mediación',
        titulo: mediation.title || `Pedido ${mediation.orderId || ''}`,
        detalle: mediation.reason || mediation.nextAction || 'Caso de mediación registrado.',
        numero: mediation.orderId ? `Pedido ${mediation.orderId}` : null,
        fecha: mediation.createdAt,
        // Las apelaciones de cuenta bloqueada usan la misma tabla de mediaciones
        // pero no tienen un pedido real detrás (pedidoIdReal null): no hay chat
        // que abrir, así que la fila queda solo informativa.
        onOpen: mediation.pedidoIdReal ? () => openCase(mediation.pedidoIdReal) : null,
        accion: mediation.pedidoIdReal ? 'Ver chat' : null,
      })),
      ...supportTickets.map((ticket) => ({
        key: `t-${ticket.id}`,
        area: 'soporte',
        status: ticket.status || 'ABIERTO',
        estado: STATUS_LABELS[ticket.status] || ticket.status || 'Abierto',
        titulo: ticket.reason || ticket.subject || 'Caso registrado',
        detalle: ticket.lastMessage || ticket.message || ticket.supportResponse || 'Sin detalle disponible.',
        numero: `#${ticket.externalId || ticket.id}`,
        fecha: ticket.createdAt,
      })),
    ];
    return rows.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  }, [reports, mediations, supportTickets]);

  const byArea = activeArea === 'todos' ? cases : cases.filter((item) => item.area === activeArea);
  const visibles = byArea.filter((item) => (
    stateFilter === 'todos' || (stateFilter === 'cerrados' ? isClosed(item.status) : !isClosed(item.status))
  ));
  const counts = {
    todos: cases.length,
    reportes: reports.length,
    disputas: mediations.length,
    soporte: supportTickets.length,
  };
  const abiertos = cases.filter((item) => !isClosed(item.status)).length;

  // Con un caso abierto el panel pasa a maestro-detalle: riel de disputas a la
  // izquierda y expediente a la derecha, dentro del mismo espacio del perfil.
  // Antes esto montaba un chat a pantalla completa con su propia barra superior,
  // que duplicaba la navegación y dejaba media pantalla vacía.
  if (openCaseId) {
    const disputes = mediations.filter((mediation) => mediation.pedidoIdReal);
    return (
      <section className="profile-panel profile-cases-panel dispute-workspace">
        <nav className="dispute-rail" aria-label="Mis disputas">
          <header>
            <button type="button" onClick={closeCase}><ArrowLeft size={13} /> Todos mis casos</button>
            <h2>Disputas <b>{disputes.length}</b></h2>
          </header>
          <ul>
            {disputes.map((mediation) => {
              const active = String(mediation.pedidoIdReal) === String(openCaseId);
              return (
                <li key={mediation.id}>
                  <button
                    type="button"
                    className={active ? 'active' : ''}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => openCase(mediation.pedidoIdReal)}
                  >
                    <span>{MEDIATION_STATUS_LABELS[mediation.status] || mediation.status || 'En mediación'}</span>
                    <strong>{mediation.title || `Pedido ${mediation.orderId || mediation.pedidoIdReal}`}</strong>
                    <time>{formatDate(mediation.createdAt)}</time>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <MediationCaseView
          key={openCaseId}
          pedidoId={openCaseId}
          user={user}
          mode={isSeller ? 'seller' : 'buyer'}
          onClose={closeCase}
          onChanged={loadCases}
        />
      </section>
    );
  }

  return (
    <section className="profile-panel profile-cases-panel">
      <div className="profile-cases-header">
        <div>
          <h2 className="profile-panel-title">Reportes y Disputas</h2>
          <p>Consulta el seguimiento de tus casos separados por área de atención.</p>
        </div>
        <span>{abiertos} {abiertos === 1 ? 'caso abierto' : 'casos abiertos'} de {cases.length}</span>
      </div>

      <div className="profile-cases-toolbar">
        <nav className="profile-cases-pills" aria-label="Áreas de reportes y disputas">
          {AREAS.map((area) => {
            const Icon = area.icon;
            return (
              <button
                key={area.id}
                type="button"
                className={activeArea === area.id ? 'active' : ''}
                aria-pressed={activeArea === area.id}
                onClick={() => setActiveArea(area.id)}
              >
                <Icon size={14} />
                {area.label}
                <b>{counts[area.id]}</b>
              </button>
            );
          })}
        </nav>

        <div className="profile-cases-filter" role="group" aria-label="Filtrar por estado">
          {STATE_FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={stateFilter === id ? 'active' : ''}
              aria-pressed={stateFilter === id}
              onClick={() => setStateFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="auth-alert alert-error"><CircleAlert size={16} /><span>{error}</span></div>}

      {loading ? (
        <div className="profile-loading-state"><Loader2 size={18} className="spin-icon" /><span>Cargando casos...</span></div>
      ) : visibles.length === 0 ? (
        <div className="profile-empty-state profile-cases-empty">
          <Inbox />
          <span>
            {stateFilter === 'abiertos' && byArea.length > 0
              ? 'No tienes casos abiertos aquí. Cambia el filtro para ver los resueltos.'
              : 'No existen registros en esta área.'}
          </span>
        </div>
      ) : (
        <ul className="case-rows">
          {visibles.map((item) => (
            <li key={item.key}>
              <article
                className={`case-row ${item.onOpen ? 'clickable' : ''}`}
                onClick={item.onOpen || undefined}
                onKeyDown={item.onOpen ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.onOpen(); }
                } : undefined}
                role={item.onOpen ? 'button' : undefined}
                tabIndex={item.onOpen ? 0 : undefined}
              >
                <span className={`profile-ticket-status status-${String(item.status).toLowerCase()}`}>{item.estado}</span>

                <div className="case-row-main">
                  <strong>{item.titulo}</strong>
                  <p>{item.detalle}</p>
                </div>

                <div className="case-row-meta">
                  {activeArea === 'todos' && <span className={`case-row-area area-${item.area}`}>{AREA_LABELS[item.area]}</span>}
                  {item.numero && <span className="case-row-id">{item.numero}</span>}
                  <time>{formatDate(item.fecha)}</time>
                </div>

                <span className="case-row-action">
                  {item.accion && <><MessageSquare size={13} /> {item.accion}</>}
                  {item.onOpen && <ChevronRight size={16} />}
                </span>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

