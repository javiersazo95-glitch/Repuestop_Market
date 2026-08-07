import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CircleAlert, FileText, Headphones, Inbox, Loader2, Scale } from 'lucide-react';
import { getMySupportTicketsApi } from '../services/api';

const STATUS_LABELS = {
  ABIERTO: 'Abierto', EN_PROCESO: 'En proceso', PENDIENTE_VENDEDOR: 'Pendiente de tu respuesta',
  PENDIENTE_COMPRADOR: 'Pendiente de respuesta', SLA_VENCIDO: 'Atención vencida',
  RESUELTO: 'Resuelto', CERRADO: 'Cerrado', CANCELADO: 'Cancelado',
};

const CASE_TABS = [
  { id: 'reportes', label: 'Reportes realizados', icon: AlertTriangle, description: 'Incidentes o situaciones que has reportado.' },
  { id: 'disputas', label: 'Disputas', icon: Scale, description: 'Casos de mediación, reclamos o desacuerdos comerciales.' },
  { id: 'soporte', label: 'Soporte técnico', icon: Headphones, description: 'Consultas técnicas enviadas al equipo de RepuesTop.' },
];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';
}

export default function ProfileSupportPanel({ user, orders = [], isSeller }) {
  const userId = user?.userId ?? user?.id;
  const [tickets, setTickets] = useState([]);
  const [activeArea, setActiveArea] = useState('reportes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTickets = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const response = await getMySupportTicketsApi(userId);
      setTickets(Array.isArray(response) ? response : response?.content || []);
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron cargar tus reportes y disputas.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const reportTickets = useMemo(() => tickets.filter((ticket) => String(ticket.reason || '').startsWith('Reporte de chat:')), [tickets]);
  const supportTickets = useMemo(() => tickets.filter((ticket) => !String(ticket.reason || '').startsWith('Reporte de chat:')), [tickets]);
  const disputes = useMemo(() => orders.filter((order) => {
    const status = String(order.status || order.estado || '').toUpperCase();
    return status === 'EN_MEDIACION' || status === 'MEDIATION' || Boolean(order.claimReason || order.claimDescription || order.motivoReclamo || order.descripcionReclamo);
  }), [orders]);
  const counts = { reportes: reportTickets.length, disputas: disputes.length, soporte: supportTickets.length };
  const visibleTickets = activeArea === 'reportes' ? reportTickets : supportTickets;
  const activeConfig = CASE_TABS.find((tab) => tab.id === activeArea);
  const ActiveIcon = activeConfig.icon;

  return (
    <section className="profile-panel profile-cases-panel">
      <div className="profile-cases-header">
        <div><h2 className="profile-panel-title">Reportes y Disputas</h2><p>Consulta el seguimiento de tus casos separados por área de atención.</p></div>
        <span>{tickets.length} casos registrados</span>
      </div>

      <nav className="profile-cases-tabs" aria-label="Áreas de reportes y disputas">
        {CASE_TABS.map((tab) => {
          const Icon = tab.icon;
          return <button key={tab.id} type="button" className={activeArea === tab.id ? 'active' : ''} onClick={() => setActiveArea(tab.id)}><Icon /><span><strong>{tab.label}</strong><small>{tab.description}</small></span><b>{counts[tab.id]}</b></button>;
        })}
      </nav>

      {error && <div className="auth-alert alert-error"><CircleAlert size={16} /><span>{error}</span></div>}
      <div className="profile-cases-section-heading"><ActiveIcon /><div><strong>{activeConfig.label}</strong><span>{activeConfig.description}</span></div></div>
      {loading ? <div className="profile-loading-state"><Loader2 size={18} className="spin-icon" /><span>Cargando casos...</span></div> : activeArea === 'disputas' ? (disputes.length === 0 ? (
        <div className="profile-empty-state profile-cases-empty"><Inbox /><span>No tienes disputas o reclamos registrados.</span></div>
      ) : <div className="profile-support-ticket-list">{disputes.map((order) => (
        <article className="profile-support-ticket profile-dispute-ticket" key={order.id}>
          <span className="profile-ticket-status status-en_proceso">En mediación</span>
          <div><strong>Pedido #{order.id}</strong><p>{order.claimDescription || order.descripcionReclamo || order.claimReason || order.motivoReclamo || (isSeller ? 'Reclamo asociado a una venta.' : 'Reclamo asociado a una compra.')}</p></div>
          <small><Scale size={13} /> Caso de mediación · {formatDate(order.updatedAt || order.createdAt)}</small>
        </article>
      ))}</div>) : visibleTickets.length === 0 ? (
        <div className="profile-empty-state profile-cases-empty"><Inbox /><span>No existen registros en {activeConfig.label.toLocaleLowerCase('es')}.</span></div>
      ) : <div className="profile-support-ticket-list">{visibleTickets.map((ticket) => (
        <article className="profile-support-ticket" key={ticket.id}>
          <span className={`profile-ticket-status status-${String(ticket.status || 'ABIERTO').toLowerCase()}`}>{STATUS_LABELS[ticket.status] || ticket.status || 'Abierto'}</span>
          <div><strong>{ticket.reason || ticket.subject || 'Caso registrado'}</strong><p>{ticket.lastMessage || ticket.message || ticket.supportResponse || 'Sin detalle disponible.'}</p></div>
          <small><FileText size={13} /> #{ticket.externalId || ticket.id} · {formatDate(ticket.createdAt)}</small>
        </article>
      ))}</div>}
    </section>
  );
}
