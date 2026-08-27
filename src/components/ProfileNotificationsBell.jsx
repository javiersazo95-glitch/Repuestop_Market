import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Loader2, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getNotificationsApi, getUnreadNotificationsCountApi, markAllNotificationsReadApi,
  markNotificationReadApi, deleteReadNotificationsApi
} from '../services/api';
import { notificationTargetPath } from '../data/notificationTargets';

function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function ProfileNotificationsBell({ user }) {
  const userId = user?.userId ?? user?.id;
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadUnread = useCallback(async () => {
    if (!userId) return;
    try { const response = await getUnreadNotificationsCountApi(userId); setUnread(Number(response?.count || 0)); } catch { /* la campana no debe bloquear el perfil */ }
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

  const toggle = () => { setOpen((current) => !current); if (!open) loadItems(); };
  /**
   * Un clic marca la notificacion como leida Y lleva a donde ocurrio el hecho, que es
   * para lo que existe. Antes solo marcaba: el usuario quedaba en la campana sin forma
   * de llegar al pedido, la pregunta o el ticket.
   *
   * El destino se traduce porque el backend guarda las rutas de la APP MOVIL
   * (`/order-detail`, `/quote-chat`...), que en la web no existen.
   */
  const openNotification = (item) => {
    markRead(item);
    const target = notificationTargetPath(item);
    if (!target) return;
    setOpen(false);
    navigate(target);
  };

  const markRead = async (item) => {
    if (item.leida || !userId) return;
    try {
      await markNotificationReadApi(userId, item.id);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, leida: true } : entry));
      setUnread((count) => Math.max(0, count - 1));
    } catch { /* conserva el inbox incluso si falla el marcado */ }
  };
  const markAll = async () => {
    if (!userId || unread === 0) return;
    try { await markAllNotificationsReadApi(userId); setItems((current) => current.map((item) => ({ ...item, leida: true }))); setUnread(0); } catch { /* noop */ }
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

  const hasReadItems = items.some((item) => item.leida);

  return <div className="profile-notifications" ref={containerRef}>
    <button type="button" className="profile-bell-button" aria-label="Notificaciones" aria-expanded={open} onClick={toggle}>
      <Bell size={18} />{unread > 0 && <span className="profile-bell-count">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div className="profile-notifications-popover">
      <div className="profile-notifications-head">
        <strong>Notificaciones</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button type="button" onClick={markAll} disabled={unread === 0} title="Marcar todas como leídas">
            <CheckCheck size={14} /> Marcar leídas
          </button>
          {hasReadItems && (
            <button type="button" onClick={deleteRead} disabled={deleting} title="Eliminar notificaciones leídas" style={{ color: '#ef4444' }}>
              <Trash2 size={14} /> {deleting ? 'Borrando...' : 'Limpiar leídas'}
            </button>
          )}
        </div>
      </div>
      {loading ? <div className="profile-notifications-loading"><Loader2 size={16} className="spin-icon" /> Cargando...</div> : items.length === 0 ? <p className="profile-notifications-empty">No tienes notificaciones por ahora.</p> : <div className="profile-notifications-list">{items.map((item) => <button type="button" key={item.id} className={`profile-notification-item ${item.leida ? 'read' : 'unread'}`} onClick={() => openNotification(item)}><span><strong>{item.titulo || 'Nueva notificación'}</strong><small>{item.mensaje}</small><time>{formatTime(item.createdAt)}</time></span>{!item.leida && <i />}</button>)}</div>}
    </div>}
  </div>;
}

