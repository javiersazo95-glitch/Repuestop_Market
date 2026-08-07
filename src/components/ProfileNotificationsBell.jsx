import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { getNotificationsApi, getUnreadNotificationsCountApi, markAllNotificationsReadApi, markNotificationReadApi } from '../services/api';

function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function ProfileNotificationsBell({ user }) {
  const userId = user?.userId ?? user?.id;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

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

  const toggle = () => { setOpen((current) => !current); if (!open) loadItems(); };
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

  return <div className="profile-notifications">
    <button type="button" className="profile-bell-button" aria-label="Notificaciones" aria-expanded={open} onClick={toggle}>
      <Bell size={18} />{unread > 0 && <span className="profile-bell-count">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div className="profile-notifications-popover">
      <div className="profile-notifications-head"><strong>Notificaciones</strong><button type="button" onClick={markAll} disabled={unread === 0}><CheckCheck size={15} /> Marcar leídas</button></div>
      {loading ? <div className="profile-notifications-loading"><Loader2 size={16} className="spin-icon" /> Cargando...</div> : items.length === 0 ? <p className="profile-notifications-empty">No tienes notificaciones por ahora.</p> : <div className="profile-notifications-list">{items.map((item) => <button type="button" key={item.id} className={`profile-notification-item ${item.leida ? 'read' : 'unread'}`} onClick={() => markRead(item)}><span><strong>{item.titulo || 'Nueva notificación'}</strong><small>{item.mensaje}</small><time>{formatTime(item.createdAt)}</time></span>{!item.leida && <i />}</button>)}</div>}
    </div>}
  </div>;
}
