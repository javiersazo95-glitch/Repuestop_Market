import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronRight, CircleAlert, FileText, Headphones, Inbox, Loader2, MessageSquare, Scale } from 'lucide-react';
import { getMyMediationsApi, getMyReportsApi, getMySupportTicketsApi } from '../services/api';
import MediationChatModal from './MediationChatModal';

const STATUS_LABELS = {
  ABIERTO: 'Abierto', EN_PROCESO: 'En proceso', PENDIENTE_VENDEDOR: 'Pendiente de tu respuesta',
  PENDIENTE_COMPRADOR: 'Pendiente de respuesta', SLA_VENCIDO: 'Atención vencida',
  RESUELTO: 'Resuelto', CERRADO: 'Cerrado', CANCELADO: 'Cancelado',
};

// Mismos estados que ya usa el backoffice/backend para mediaciones (EstadoMediacion).
// Se exporta para que MediationChatModal use las mismas etiquetas.
export const MEDIATION_STATUS_LABELS = {
  ESPERANDO_VENDEDOR: 'Esperando al vendedor', ESCALADO: 'Escalado a mediador',
  EN_MEDIACION: 'En mediación', RESUELTA: 'Resuelta', CERRADA: 'Cerrada',
};

const CASE_TABS = [
  { id: 'reportes', label: 'Reportes realizados', icon: AlertTriangle, description: 'Incidentes o situaciones que has reportado.' },
  { id: 'disputas', label: 'Disputas', icon: Scale, description: 'Casos de mediación, reclamos o desacuerdos comerciales.' },
  { id: 'soporte', label: 'Soporte técnico', icon: Headphones, description: 'Consultas técnicas enviadas al equipo de RepuesTop.' },
];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';
}

export default function ProfileSupportPanel({ user }) {
  const userId = user?.userId ?? user?.id;
  const isSeller = Boolean(user?.sellerId);
  const [tickets, setTickets] = useState([]);
  const [reports, setReports] = useState([]);
  const [mediations, setMediations] = useState([]);
  const [activeArea, setActiveArea] = useState('reportes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openMediation, setOpenMediation] = useState(null);

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
      setTickets(Array.isArray(ticketsRes) ? ticketsRes : ticketsRes?.content || []);
      setReports(Array.isArray(reportsRes) ? reportsRes : reportsRes?.content || []);
      setMediations(Array.isArray(mediationsRes) ? mediationsRes : mediationsRes?.content || []);
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
  const counts = { reportes: reports.length, disputas: mediations.length, soporte: supportTickets.length };
  const activeConfig = CASE_TABS.find((tab) => tab.id === activeArea);
  const totalCasos = reports.length + mediations.length + supportTickets.length;

  return (
    <section className="profile-panel profile-cases-panel">
      <div className="profile-cases-header">
        <div><h2 className="profile-panel-title">Reportes y Disputas</h2><p>Consulta el seguimiento de tus casos separados por área de atención.</p></div>
        <span>{totalCasos} {totalCasos === 1 ? 'caso registrado' : 'casos registrados'}</span>
      </div>

      <nav className="profile-cases-tabs" aria-label="Áreas de reportes y disputas">
        {CASE_TABS.map((tab) => {
          const Icon = tab.icon;
          return <button key={tab.id} type="button" className={activeArea === tab.id ? 'active' : ''} onClick={() => setActiveArea(tab.id)}><Icon /><span><strong>{tab.label}</strong><small>{tab.description}</small></span><b>{counts[tab.id]}</b></button>;
        })}
      </nav>

      {error && <div className="auth-alert alert-error"><CircleAlert size={16} /><span>{error}</span></div>}
      {loading ? <div className="profile-loading-state"><Loader2 size={18} className="spin-icon" /><span>Cargando casos...</span></div> : activeArea === 'disputas' ? (mediations.length === 0 ? (
        <div className="profile-empty-state profile-cases-empty"><Inbox /><span>No tienes disputas o reclamos registrados.</span></div>
      ) : <div className="profile-support-ticket-list">{mediations.map((mediation) => {
        // Las apelaciones de cuenta bloqueada usan la misma tabla de mediaciones
        // pero no tienen un pedido real detrás (pedidoIdReal null) — no hay a
        // qué chat abrir en esos casos, así que la tarjeta queda solo informativa.
        const hasChat = Boolean(mediation.pedidoIdReal);
        return (
          <article
            className={`profile-support-ticket profile-dispute-ticket ${hasChat ? 'clickable' : ''}`}
            key={mediation.id}
            onClick={hasChat ? () => setOpenMediation(mediation) : undefined}
            onKeyDown={hasChat ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setOpenMediation(mediation);
              }
            } : undefined}
            role={hasChat ? 'button' : undefined}
            tabIndex={hasChat ? 0 : undefined}
          >
            <span className={`profile-ticket-status status-${String(mediation.status || 'EN_MEDIACION').toLowerCase()}`}>
              {MEDIATION_STATUS_LABELS[mediation.status] || mediation.displayStatus || mediation.status || 'En mediación'}
            </span>
            <div><strong>{mediation.title || `Pedido ${mediation.orderId || ''}`}</strong><p>{mediation.reason || mediation.nextAction || 'Caso de mediación registrado.'}</p></div>
            <small><Scale size={13} /> Caso de mediación · {formatDate(mediation.createdAt)}</small>
            {hasChat && <span className="profile-dispute-chat-link"><MessageSquare size={13} /> Ver chat <ChevronRight size={14} /></span>}
          </article>
        );
      })}</div>) : activeArea === 'reportes' ? (reports.length === 0 ? (
        <div className="profile-empty-state profile-cases-empty"><Inbox /><span>No existen registros en reportes realizados.</span></div>
      ) : <div className="profile-support-ticket-list">{reports.map((report) => (
        <article className="profile-support-ticket" key={report.id}>
          <span className="profile-ticket-status status-en_proceso">Reportado</span>
          <div><strong>Reporte a {report.reportadoName || 'un usuario'}</strong><p>{report.descripcion || report.motivo || 'Sin detalle disponible.'}</p></div>
          <small><FileText size={13} /> #{report.idExterno || report.id} · {formatDate(report.fechaCreacion)}</small>
        </article>
      ))}</div>) : supportTickets.length === 0 ? (
        <div className="profile-empty-state profile-cases-empty"><Inbox /><span>No existen registros en {activeConfig.label.toLocaleLowerCase('es')}.</span></div>
      ) : <div className="profile-support-ticket-list">{supportTickets.map((ticket) => (
        <article className="profile-support-ticket" key={ticket.id}>
          <span className={`profile-ticket-status status-${String(ticket.status || 'ABIERTO').toLowerCase()}`}>{STATUS_LABELS[ticket.status] || ticket.status || 'Abierto'}</span>
          <div><strong>{ticket.reason || ticket.subject || 'Caso registrado'}</strong><p>{ticket.lastMessage || ticket.message || ticket.supportResponse || 'Sin detalle disponible.'}</p></div>
          <small><FileText size={13} /> #{ticket.externalId || ticket.id} · {formatDate(ticket.createdAt)}</small>
        </article>
      ))}</div>}

      {openMediation && createPortal(
        <MediationChatModal
          pedidoId={openMediation.pedidoIdReal}
          user={user}
          mode={isSeller ? 'seller' : 'buyer'}
          onClose={() => {
            setOpenMediation(null);
            void loadCases();
          }}
        />,
        document.body
      )}
    </section>
  );
}
