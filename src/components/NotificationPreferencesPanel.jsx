import React, { useState } from 'react';
import { Bell, BellOff, Loader2, ShoppingBag, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateNotificationPreferencesApi } from '../services/api';
import { LEVEL_OPTIONS, preferencesFromUser } from '../utils/notificationPreferences';

const SECTION = {
  VENDEDOR: { title: 'Como vendedor', Icon: Store },
  COMPRADOR: { title: 'Como comprador', Icon: ShoppingBag },
};

/**
 * Moderacion de notificaciones por perfil (Todas / Solo importantes / Silenciadas). Una tienda ve
 * dos secciones (vendedor y comprador); un comprador, una. Se guarda al tocar, en la cuenta, y vale
 * igual en la app. Se usa dentro del popover de la campana y en "Mis datos".
 *
 * `compact`: version del popover (sin descripciones largas).
 */
export default function NotificationPreferencesPanel({ compact = false }) {
  const { user, setNotificationPreferences } = useAuth();
  const userId = user?.userId ?? user?.id;
  const isSeller = user?.role === 'SELLER';
  const preferences = preferencesFromUser(user);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  const profiles = isSeller ? ['VENDEDOR', 'COMPRADOR'] : ['COMPRADOR'];

  const select = async (profile, level) => {
    if (!userId || preferences[profile] === level || saving) return;
    setSaving(profile);
    setError('');
    try {
      const saved = await updateNotificationPreferencesApi(userId, profile === 'VENDEDOR' ? { vendedor: level } : { comprador: level });
      setNotificationPreferences(saved);
    } catch {
      setError('No pudimos guardar la preferencia. Intenta de nuevo.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className={`notif-prefs ${compact ? 'notif-prefs--compact' : ''}`}>
      {profiles.map((profile) => {
        const { title, Icon } = SECTION[profile];
        const current = preferences[profile];
        return (
          <section key={profile} className="notif-prefs-section" aria-labelledby={`notif-prefs-${profile}`}>
            {isSeller && (
              <h4 id={`notif-prefs-${profile}`} className="notif-prefs-title"><Icon size={14} /> {title}</h4>
            )}
            <div className="notif-prefs-options" role="radiogroup" aria-label={isSeller ? `Notificaciones ${title.toLowerCase()}` : 'Notificaciones'}>
              {LEVEL_OPTIONS[profile].map((option) => {
                const selected = option.value === current;
                const OptionIcon = option.value === 'NINGUNA' ? BellOff : Bell;
                return (
                  <button
                    type="button"
                    key={option.value}
                    role="radio"
                    aria-checked={selected}
                    disabled={saving === profile}
                    className={`notif-pref-option ${selected ? 'selected' : ''}`}
                    onClick={() => select(profile, option.value)}
                  >
                    <span className="notif-pref-option-icon">
                      {saving === profile && selected ? <Loader2 size={15} className="spin-icon" /> : <OptionIcon size={15} />}
                    </span>
                    <span className="notif-pref-option-copy">
                      <strong>{option.title}</strong>
                      {!compact && <small>{option.description}</small>}
                    </span>
                    <i className={`notif-pref-radio ${selected ? 'on' : ''}`} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {error && <p className="notif-prefs-error" role="alert">{error}</p>}
      <p className="notif-prefs-note">Los correos sobre tus pedidos, pagos, citas, reclamos y tu cuenta se envían siempre.</p>
    </div>
  );
}
