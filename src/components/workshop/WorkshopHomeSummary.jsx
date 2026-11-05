import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarDays, ChevronRight, MessageCircle, PackageCheck, PencilLine, SearchCheck, Store, Wrench } from 'lucide-react';
import { fetchMiTaller } from '../../services/talleresStorage';
import { daysLeft, getDiagnosticStatus } from '../../services/workshopApi';
import EngineIcon from '../EngineIcon';
import { useAuth } from '../../context/AuthContext';
import { getAppointmentsSummaryApi, getBuyerOrdersApi, getNotificationsApi, resolveMediaUrl } from '../../services/api';
import { getCommentedFaults, getOpenFaults, timeSince } from '../../services/faultApi';
import { getMyAuctionRequests } from '../../services/auctionApi';
import { auctionDetailPath } from '../../routes/paths';
import { notificationTargetPath } from '../../data/notificationTargets';
import '../../styles/workshop-home.css';

const ACTIVE_ORDER_STATES = ['PENDIENTE', 'PAGADO', 'EN_PREPARACION', 'ENVIADO'];

const isToday = (iso) => {
  const date = new Date(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
};

const todayLabel = () => new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');

/** "2 d", "5 h", "Pronto": lo que falta para que la búsqueda deje de recibir ofertas. */
function closesIn(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'Pronto';
  const hours = Math.floor(ms / 3600000);
  if (hours >= 24) return `${Math.floor(hours / 24)} d`;
  return hours >= 1 ? `${hours} h` : 'Pronto';
}

const settled = (result) => (result.status === 'fulfilled' ? result.value : null);
const asList = (value) => (Array.isArray(value) ? value : Array.isArray(value?.content) ? value.content : null);

function StatCard({ icon: Icon, value, label, hint, tone = 'blue', hintTone, onClick }) {
  return (
    <button type="button" className={`wh-stat is-${tone}`} onClick={onClick}>
      <span className="wh-stat-icon"><Icon size={18} /></span>
      <strong>{value == null ? '—' : Number(value).toLocaleString('es-CL')}</strong>
      <span className="wh-stat-label">{label}</span>
      <span className={`wh-stat-hint ${hintTone ? `is-${hintTone}` : ''}`}>{hint}<ChevronRight size={14} /></span>
    </button>
  );
}

function ActivityRow({ icon: Icon, title, detail, tone, onClick }) {
  return (
    <button type="button" className="wh-activity-row" onClick={onClick}>
      <span className={`wh-activity-icon is-${tone}`}><Icon size={18} /></span>
      <span className="wh-activity-copy"><strong>{title}</strong><small>{detail}</small></span>
      <ChevronRight size={16} />
    </button>
  );
}

function NeedTrackingRow({ need, onClick }) {
  const photo = resolveMediaUrl(need.fotoPrincipalUrl);
  const vehicle = [need.marca, need.modelo, need.anio].filter(Boolean).join(' ');
  const offers = need.totalCotizaciones ?? 0;
  const questions = need.preguntasPendientes ?? 0;
  const awarded = need.itemsAdjudicados ?? 0;
  const totalItems = need.totalItems ?? 0;
  const progress = totalItems > 1 ? `${awarded}/${totalItems}` : need.adjudicada ? 'Sí' : 'No';
  const metrics = [
    { label: 'Ofertas', value: String(offers), tone: offers > 0 ? 'ok' : 'idle' },
    { label: 'Preguntas', value: String(questions), tone: questions > 0 ? 'warn' : 'idle' },
    { label: 'Cierra en', value: closesIn(need.fechaLimite), tone: 'idle' },
    { label: 'Adjudicada', value: progress, tone: awarded > 0 || need.adjudicada ? 'ok' : 'idle' },
  ];
  return (
    <button type="button" className="wh-track" onClick={onClick} aria-label={`Seguir el encargo ${need.repuestoSolicitado}`}>
      <span className="wh-track-head">
        <span className="wh-track-thumb">{photo ? <img src={photo} alt="" /> : <SearchCheck size={20} />}</span>
        <span className="wh-track-copy">
          <strong>{need.repuestoSolicitado}</strong>
          <small>{[vehicle, need.comuna].filter(Boolean).join(' · ') || `${need.cantidad} ${need.cantidad === 1 ? 'unidad' : 'unidades'}`}</small>
          <small>{need.presupuestoMaximo ? `Presupuesto máx. $${Number(need.presupuestoMaximo).toLocaleString('es-CL')}` : 'Sin presupuesto máximo'}</small>
        </span>
        <ChevronRight size={16} />
      </span>
      <span className="wh-track-metrics">
        {metrics.map((metric) => (
          <span key={metric.label} className={`is-${metric.tone}`}><strong>{metric.value}</strong><small>{metric.label}</small></span>
        ))}
      </span>
    </button>
  );
}

/**
 * Resumen del taller en la versión móvil: el mismo inicio de la app (`mobile/app/(workshop)/index.tsx`) con el
 * resumen de actividad, lo que requiere atención, el seguimiento de las búsquedas publicadas y los accesos rápidos.
 */
export default function WorkshopHomeSummary({ onOpenAppointments, onOpenFaults, onOpenOrders, onNewNeed, onOpenNeeds, onOpenWorkshop, onOpenService }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.userId ?? user?.id ?? null;
  const [data, setData] = useState({ appointments: null, commented: null, open: null, orders: null, notifications: null, needs: null });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      getAppointmentsSummaryApi(),
      getCommentedFaults(),
      getOpenFaults(),
      userId ? getBuyerOrdersApi(userId) : Promise.reject(new Error('sin sesión')),
      userId ? getNotificationsApi(userId) : Promise.reject(new Error('sin sesión')),
      getMyAuctionRequests(),
    ]);
    setData({
      appointments: settled(results[0]),
      commented: asList(settled(results[1])),
      open: asList(settled(results[2])),
      orders: asList(settled(results[3])),
      notifications: asList(settled(results[4])),
      needs: asList(settled(results[5])),
    });
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Tarjeta de identidad (como la app): «Recibir citas en línea» de Mi taller manda; los días son lo que queda del servicio.
  const [booking, setBooking] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.all([fetchMiTaller(), getDiagnosticStatus()])
      .then(([taller, status]) => { if (active) setBooking({ enabled: taller?.hasOnlineBooking === true, days: daysLeft(status) }); })
      .catch(() => { if (active) setBooking({ enabled: false, days: 0, unknown: true }); });
    return () => { active = false; };
  }, []);
  const workshopName = user?.workshopName || user?.businessName || user?.userName || 'Taller automotriz';
  const logo = resolveMediaUrl(user?.userProfileUrl || user?.buyerProfileUrl || '');
  const bookingDaysText = booking?.days === 1 ? '1 día' : `${booking?.days ?? 0} días`;
  const bookingIdle = booking && !booking.enabled && booking.days > 0;
  const bookingTitle = !booking ? 'Agendamiento…' : booking.enabled ? 'Agendamiento encendido' : bookingIdle ? 'No se puede agendar contigo' : 'Agendamiento apagado';
  const bookingDetail = !booking || booking.unknown ? '' : booking.enabled
    ? (booking.days > 0 ? `${booking.days === 1 ? 'Te queda' : 'Te quedan'} ${bookingDaysText} de citas activas` : 'Sin días activos: renueva en Monedas')
    : bookingIdle ? `Tienes ${bookingDaysText} activos, pero el agendamiento está apagado. Enciéndelo en Mi taller.` : 'Actívalo en Monedas para recibir citas';

  const appointments = data.appointments?.taller;
  const appointmentCount = appointments ? (appointments.porResponder ?? 0) + (appointments.aceptadas ?? 0) : null;
  const replies = useMemo(
    () => (data.notifications ?? [])
      .filter((item) => item.tipo === 'FALLA_RESPUESTA_COMPRADOR')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data.notifications],
  );
  const todaysFaults = (data.open ?? []).filter((item) => isToday(item.createdAt));
  const activeOrders = useMemo(
    () => (data.orders ?? []).filter((order) => ACTIVE_ORDER_STATES.includes(order.estado)),
    [data.orders],
  );
  const inTransit = activeOrders.filter((order) => order.estado === 'ENVIADO').length;
  const activeNeeds = useMemo(
    () => (data.needs ?? []).filter((need) => need.estado === 'ACTIVA').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data.needs],
  );
  const trackedNeeds = useMemo(() => [...activeNeeds].sort((a, b) => (b.totalCotizaciones ?? 0) - (a.totalCotizaciones ?? 0)).slice(0, 3), [activeNeeds]);
  const needsWithOffers = activeNeeds.filter((need) => (need.totalCotizaciones ?? 0) > 0);

  const replyNotification = replies[0];
  const offerNeed = needsWithOffers[0];
  const pendingAppointments = appointments?.porResponder ?? 0;
  const hasAlerts = Boolean(replyNotification || offerNeed || pendingAppointments > 0);
  const attentionCount = replies.length + needsWithOffers.length + pendingAppointments;

  const openReply = (notification) => {
    const path = notificationTargetPath(notification, { role: 'WORKSHOP' });
    if (path) navigate(path);
  };

  return (
    <div className="wh">
      <button type="button" className={`wh-identity ${bookingIdle ? 'is-alert' : ''}`} onClick={booking && !booking.enabled && !bookingIdle ? onOpenService : onOpenWorkshop} aria-label={`${workshopName}. ${bookingTitle}. Editar mi taller`}>
        <span className="wh-identity-logo">{logo ? <img src={logo} alt="" /> : <Store size={24} />}</span>
        <span className="wh-identity-copy">
          <strong>{workshopName}</strong>
          <span className={`wh-booking ${booking?.enabled ? 'is-on' : bookingIdle ? 'is-warn' : ''}`}>
            {bookingIdle ? <AlertCircle size={14} /> : <i />}
            <span><b>{bookingTitle}</b>{bookingDetail && <small>{bookingDetail}</small>}</span>
          </span>
        </span>
        <span className="wh-identity-edit"><PencilLine size={17} /></span>
      </button>

      <div className="wh-heading">
        <h2>Resumen de actividad</h2>
        <small>Hoy · {todayLabel()}</small>
      </div>

      <div className="wh-grid">
        <StatCard
          icon={CalendarDays}
          value={appointmentCount}
          label="Citas agendadas"
          hint={appointments ? `${appointments.porResponder ?? 0} por confirmar` : 'Agenda del taller'}
          hintTone={appointments?.porResponder ? 'warning' : undefined}
          onClick={onOpenAppointments}
        />
        <StatCard
          icon={MessageCircle}
          value={data.commented?.length ?? null}
          label="Mis diagnósticos"
          hint={data.notifications ? `${replies.length} respuestas nuevas` : 'Comentarios en fallas'}
          hintTone={replies.length ? 'error' : undefined}
          tone="purple"
          onClick={onOpenFaults}
        />
        <StatCard
          icon={Wrench}
          value={data.open?.length ?? null}
          label="Fallas abiertas"
          hint={data.open ? `${todaysFaults.length} publicadas hoy` : 'Fallas de clientes'}
          tone="green"
          onClick={onOpenFaults}
        />
        <StatCard
          icon={PackageCheck}
          value={data.orders ? activeOrders.length : null}
          label="Pedidos activos"
          hint={data.orders ? `${inTransit} ${inTransit === 1 ? 'envío por recibir' : 'envíos por recibir'}` : 'Compras de repuestos'}
          onClick={onOpenOrders}
        />
      </div>

      <section className="wh-section">
        <div className="wh-heading">
          <h2>Requiere tu atención</h2>
          {attentionCount > 0 && <span className="wh-badge">{attentionCount} nuevas</span>}
        </div>
        <div className="wh-card">
          {replyNotification && (
            <ActivityRow
              icon={MessageCircle}
              title="Respuesta a tu diagnóstico"
              detail={`${replyNotification.mensaje} · ${timeSince(replyNotification.createdAt)}`}
              tone="purple"
              onClick={() => openReply(replyNotification)}
            />
          )}
          {offerNeed && (
            <ActivityRow
              icon={SearchCheck}
              title="Nueva oferta para tu encargo"
              detail={`${offerNeed.repuestoSolicitado} · ${offerNeed.totalCotizaciones} ${offerNeed.totalCotizaciones === 1 ? 'oferta' : 'ofertas'}`}
              tone="amber"
              onClick={() => navigate(auctionDetailPath(offerNeed.id))}
            />
          )}
          {pendingAppointments > 0 && (
            <ActivityRow
              icon={CalendarDays}
              title={pendingAppointments === 1 ? 'Confirma una cita' : `Confirma ${pendingAppointments} citas`}
              detail="Revisa las solicitudes de tu agenda"
              tone="blue"
              onClick={onOpenAppointments}
            />
          )}
          {loading && !hasAlerts && <p className="wh-empty">Cargando actividad…</p>}
          {!loading && !hasAlerts && (
            <p className="wh-empty">
              {data.notifications === null || data.appointments === null || data.needs === null
                ? 'No pudimos cargar toda la actividad. Actualiza para reintentar.'
                : 'No tienes acciones pendientes.'}
            </p>
          )}
          {hasAlerts && <button type="button" className="wh-footer" onClick={() => navigate('/perfil/resumen')}>Ver toda la actividad</button>}
        </div>
      </section>

      {trackedNeeds.length > 0 && (
        <section className="wh-section">
          <div className="wh-heading">
            <h2>Seguimiento de tu encargo</h2>
            <button type="button" className="wh-link" onClick={onOpenNeeds}>Ver todo ›</button>
          </div>
          <div className="wh-card">
            {trackedNeeds.map((need) => <NeedTrackingRow key={need.id} need={need} onClick={() => navigate(auctionDetailPath(need.id))} />)}
          </div>
        </section>
      )}

      <section className="wh-section">
        <div className="wh-heading"><h2>Accesos rápidos</h2></div>
        <div className="wh-quick">
          <button type="button" onClick={onOpenFaults}><EngineIcon size={24} /><span>Ver fallas</span></button>
          <button type="button" onClick={onNewNeed}><SearchCheck size={24} /><span>Pedir repuestos</span></button>
          <button type="button" onClick={onOpenAppointments}><CalendarDays size={24} /><span>Abrir agenda</span></button>
        </div>
      </section>
    </div>
  );
}
