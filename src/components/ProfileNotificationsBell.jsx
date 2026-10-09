import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Bell, BellOff, CalendarClock, CheckCheck, CircleX, HelpCircle, Loader2, MessageCircle,
  Settings, Trash2, Wallet,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getNotificationsApi, getUnreadNotificationsCountApi, markAllNotificationsReadApi,
  markNotificationReadApi, deleteReadNotificationsApi, deleteNotificationApi
} from '../services/api';
import { notificationTargetPath } from '../data/notificationTargets';
import { notifyAppointmentsChanged } from '../services/adsStorage';
import { classifyForInbox, preferencesFromUser } from '../utils/notificationPreferences';
import NotificationPreferencesPanel from './NotificationPreferencesPanel';

function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const KIND_ICON = {
  AGENDAMIENTO_CITA: CalendarClock,
  PEDIDO_CANCELADO: CircleX,
  FINANZAS: Wallet,
  NUEVA_PREGUNTA: HelpCircle,
  RESPUESTA_PREGUNTA: HelpCircle,
  NUEVO_MENSAJE: MessageCircle,
  NUEVO_MENSAJE_MEDIACION: MessageCircle,
};

export default function ProfileNotificationsBell({ user }) {
  const userId = user?.userId ?? user?.id;
  const isSeller = user?.role === 'SELLER';
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('inbox');
  const containerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const lastUnreadRef = useRef(Number.MAX_SAFE_INTEGER);

  // El contador ya viene moderado por el backend (preferencia de cada perfil). Aqui se replica la
  // misma regla para la lista: IMPORTANTES oculta lo de rutina y NINGUNA atenua el historial.
  const preferences = useMemo(() => preferencesFromUser(user), [user]);
  const visibleItems = useMemo(() => classifyForInbox(items, preferences, isSeller), [items, preferences, isSeller]);
  const anyMuted = visibleItems.some((item) => item.muted);
  const allMuted = isSeller ? preferences.VENDEDOR === 'NINGUNA' && preferences.COMPRADOR === 'NINGUNA' : preferences.COMPRADOR === 'NINGUNA';

  const loadUnread = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await getUnreadNotificationsCountApi(userId);
      const count = Number(response?.count || 0);
      // Llegó algo nuevo: las listas y contadores de citas abiertos se recargan (puede ser una
      // reserva o una respuesta), en vez de esperar a que alguien pulse Actualizar.
      if (count > lastUnreadRef.current) notifyAppointmentsChanged();
      lastUnreadRef.current = count;
      setUnread(count);
    } catch { /* la campana no debe bloquear el perfil */ }
  }, [userId]);

  const loadItems = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try { setItems(await getNotificationsApi(userId)); } catch { setItems([]); } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    loadUnread();
    const interval = window.setInterval(loadUnread, 60000);
    return () => window.clearInterval(interval);
  }, [loadUnread]);

  // Al cambiar una preferencia el contador moderado cambia: se vuelve a pedir.
  useEffect(() => { loadUnread(); }, [loadUnread, preferences]);

  // Cierra el popover si el usuario cambia de pestaña o ruta dentro del perfil
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  // Cierra el popover al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setView('inbox');
  }, [open]);

  const toggle = () => { setOpen((current) => !current); if (!open) loadItems(); };
  /**
   * Un clic lleva a donde ocurrio el hecho, que es para lo que existe, y ELIMINA el aviso (7-oct):
   * la campana solo muestra lo que aun no se abre y no se acumulan avisos entre los dos perfiles.
   * Sin destino reconocido, al menos queda leido.
   *
   * El destino se traduce porque el backend guarda las rutas de la APP MOVIL
   * (`/order-detail`, `/quote-chat`...), que en la web no existen.
   */
  const openNotification = (item) => {
    const target = notificationTargetPath(item, { isSeller });
    if (!target) {
      markRead(item);
      return;
    }
    removeOpened(item);
    setOpen(false);
    navigate(target);
  };

  const removeOpened = async (item) => {
    if (!userId) return;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    if (!item.leida && !item.muted) setUnread((count) => Math.max(0, count - 1));
    try {
      await deleteNotificationApi(userId, item.id);
    } catch { /* si falla, volvera a aparecer en la proxima carga */ }
  };

  const markRead = async (item) => {
    if (item.leida || !userId) return;
    try {
      await markNotificationReadApi(userId, item.id);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, leida: true } : entry));
      if (!item.muted) setUnread((count) => Math.max(0, count - 1));
    } catch { /* conserva el inbox incluso si falla el marcado */ }
  };
  const markAll = async () => {
    if (!userId) return;
    // Solo lo visible y no silenciado: lo oculto por "Solo importantes" sigue pendiente.
    const ids = visibleItems.filter((item) => !item.leida && !item.muted).map((item) => item.id);
    if (ids.length === 0) return;
    try {
      await markAllNotificationsReadApi(userId, ids);
      const marked = new Set(ids);
      setItems((current) => current.map((item) => (marked.has(item.id) ? { ...item, leida: true } : item)));
      setUnread(0);
    } catch { /* noop */ }
  };

  const deleteRead = async () => {
    if (!userId || deleting) return;
    setDeleting(true);
    try {
      await deleteReadNotificationsApi(userId);
      setItems((current) => current.filter((item) => !item.leida));
    } catch {
      /* conserva estado actual en caso de error */
    } finally {
      setDeleting(false);
    }
  };

  const hasReadItems = visibleItems.some((item) => item.leida);
  const hasPendingVisible = visibleItems.some((item) => !item.leida && !item.muted);

  return <div className="profile-notifications" ref={containerRef}>
    <button type="button" className="profile-bell-button" aria-label={allMuted ? 'Notificaciones silenciadas' : 'Notificaciones'} aria-expanded={open} onClick={toggle}>
      {allMuted ? <BellOff size={18} /> : <Bell size={18} />}{unread > 0 && <span className="profile-bell-count">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div className="profile-notifications-popover">
      {view === 'settings' ? (
        <>
          <div className="profile-notifications-head">
            <button type="button" className="profile-notifications-back" onClick={() => setView('inbox')} aria-label="Volver a las notificaciones">
              <ArrowLeft size={14} /> Notificaciones
            </button>
            <strong>Ajustes</strong>
          </div>
          <div className="profile-notifications-settings">
            <NotificationPreferencesPanel compact />
          </div>
        </>
      ) : (
        <>
          <div className="profile-notifications-head">
            <strong>Notificaciones</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button type="button" onClick={markAll} disabled={!hasPendingVisible} title="Marcar todas como leídas">
                <CheckCheck size={14} /> Marcar leídas
              </button>
              {hasReadItems && (
                <button type="button" onClick={deleteRead} disabled={deleting} title="Eliminar notificaciones leídas" style={{ color: '#ef4444' }}>
                  <Trash2 size={14} /> {deleting ? 'Borrando...' : 'Limpiar leídas'}
                </button>
              )}
              <button type="button" className="profile-notifications-gear" onClick={() => setView('settings')} aria-label="Ajustes de notificaciones" title="Ajustes de notificaciones">
                <Settings size={15} />
              </button>
            </div>
          </div>
          {anyMuted && (
            <div className="profile-notifications-muted-note">
              <BellOff size={13} />
              <span>{allMuted ? 'Notificaciones silenciadas: sin push ni contador.' : 'Parte de tus avisos están silenciados.'}</span>
              <button type="button" onClick={() => setView('settings')}>Cambiar</button>
            </div>
          )}
          {loading ? <div className="profile-notifications-loading"><Loader2 size={16} className="spin-icon" /> Cargando...</div> : visibleItems.length === 0 ? <p className="profile-notifications-empty">No tienes notificaciones por ahora.</p> : <div className="profile-notifications-list">{visibleItems.map((item) => {
            const KindIcon = KIND_ICON[item.tipo];
            return <button type="button" key={item.id} className={`profile-notification-item ${item.leida ? 'read' : 'unread'} ${item.muted ? 'muted' : ''}`} onClick={() => openNotification(item)}>{KindIcon && <em className="profile-notification-kind" aria-hidden="true"><KindIcon size={15} /></em>}<span><strong>{item.titulo || 'Nueva notificación'}</strong><small>{item.mensaje}</small><time>{formatTime(item.createdAt)}</time></span>{!item.leida && !item.muted && <i />}</button>;
          })}</div>}
        </>
      )}
    </div>}
  </div>;
}
