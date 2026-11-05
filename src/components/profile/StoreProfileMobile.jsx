import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Camera, ChevronRight, Clock, CreditCard, FileText, Eye, Mail, Map, MapPin, Navigation, Pencil, Phone, Settings2,
  Store, User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getComunasApi, resolveMediaUrl, updateStoreDataApi } from '../../services/api';
import { resolverUbicacionPorNombre } from '../../services/geoLookup';
import { qk } from '../../services/queryKeys';
import { isValidClPhone } from '../../services/adapters';
import { storePath } from '../../routes/paths';
import '../../styles/store-profile-mobile.css';

/** Fila del grupo: icono, titulo, resumen de lo registrado y lapiz si se puede editar. El editor se abre debajo. */
function Row({ icon: Icon, title, summary, placeholder = 'No registrado', onPress, children, attention = false }) {
  const body = (
    <>
      <span className={`spm-row-icon ${attention ? 'is-attention' : ''}`}><Icon size={17} aria-hidden="true" /></span>
      <span className="spm-row-copy">
        <strong>{title}</strong>
        <small>{summary?.toString().trim() ? summary : placeholder}</small>
      </span>
      {onPress && <Pencil size={16} className="spm-row-edit" aria-hidden="true" />}
    </>
  );
  return (
    <div className="spm-row">
      {onPress
        ? <button type="button" className="spm-row-main" onClick={onPress} aria-label={`Editar ${title}`}>{body}</button>
        : <div className="spm-row-main is-static">{body}</div>}
      {children}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="spm-group">
      <h3>{title}</h3>
      <div className="spm-card">{children}</div>
    </section>
  );
}

/** Editor en linea de un dato de texto: se abre justo bajo su fila, con Cancelar y Guardar. */
function TextEditor({ label, initial, maxLength, multiline = false, type = 'text', helper, sanitize, validate, onSave, onCancel }) {
  const [value, setValue] = useState(initial || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const trimmed = value.trim();
    const invalid = validate?.(trimmed);
    if (invalid) { setError(invalid); return; }
    setSaving(true);
    setError('');
    const failure = await onSave(trimmed);
    setSaving(false);
    if (failure) setError(failure);
  };
  const Field = multiline ? 'textarea' : 'input';
  return (
    <div className="spm-editor">
      <label>
        <span>{label}</span>
        <Field
          value={value}
          type={multiline ? undefined : type}
          rows={multiline ? 3 : undefined}
          maxLength={maxLength}
          inputMode={type === 'tel' ? 'tel' : undefined}
          autoFocus
          onChange={(event) => { setValue(sanitize ? sanitize(event.target.value) : event.target.value); setError(''); }}
        />
      </label>
      {helper && <small>{helper}</small>}
      {error && <p role="alert">{error}</p>}
      <div className="spm-editor-actions">
        <button type="button" className="is-outline" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button type="button" onClick={save} disabled={saving || !value.trim()}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  );
}

/** Editor de ubicacion (region + comuna). Carga las listas a partir de lo que la tienda ya tiene. */
function LocationEditor({ region, comuna, onSave, onCancel }) {
  const [regiones, setRegiones] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [regionId, setRegionId] = useState('');
  const [comunaId, setComunaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    let cancelled = false;
    resolverUbicacionPorNombre({ comuna, region })
      .then((res) => {
        if (cancelled) return;
        setRegiones(res.regiones || []);
        setComunas(res.comunas || []);
        if (res.regionId) setRegionId(String(res.regionId));
        if (res.comunaId) setComunaId(String(res.comunaId));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [comuna, region]);

  const changeRegion = (id) => {
    setRegionId(id);
    setComunaId('');
    setComunas([]);
    if (!id) return;
    setLoading(true);
    getComunasApi(id)
      .then((data) => setComunas(Array.isArray(data) ? data : []))
      .catch(() => setComunas([]))
      .finally(() => setLoading(false));
  };

  const save = async () => {
    const regionName = regiones.find((item) => String(item.id) === regionId)?.nombre;
    const comunaName = comunas.find((item) => String(item.id) === comunaId)?.nombre;
    setSaving(true);
    setError('');
    const failure = await onSave({ comunaId: Number(comunaId), region: regionName, city: comunaName });
    setSaving(false);
    if (failure) setError(failure);
  };

  return (
    <div className="spm-editor">
      <label>
        <span>Región</span>
        <select value={regionId} onChange={(event) => changeRegion(event.target.value)} disabled={loading && !regiones.length}>
          <option value="">{loading && !regiones.length ? 'Cargando regiones…' : 'Selecciona una región'}</option>
          {regiones.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
        </select>
      </label>
      <label>
        <span>Comuna</span>
        <select value={comunaId} onChange={(event) => setComunaId(event.target.value)} disabled={!regionId || loading}>
          <option value="">{!regionId ? 'Primero selecciona una región' : loading ? 'Cargando comunas…' : 'Selecciona una comuna'}</option>
          {comunas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="spm-editor-actions">
        <button type="button" className="is-outline" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button type="button" onClick={save} disabled={saving || !comunaId}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  );
}

/**
 * "Mi tienda y datos" en el celular: igual que `app/(seller)/mi-tienda.tsx`. Portada y foto de perfil con sus camaras
 * arriba; debajo solo dos grupos (representante legal y datos de la tienda) que se editan en linea, fila por fila.
 * Lo demas (marcas, redes, envios, direcciones, clave, notificaciones) queda en "Más ajustes de la tienda".
 */
export default function StoreProfileMobile({
  user, storeInfo, effectiveSellerId, onOpenMediaModal, onOpenCoverTemplates, onOpenSettings, onOpenWithdrawals, settingsOpen,
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { updateProfile } = useAuth();
  const [editing, setEditing] = useState(null);
  const toggle = (field) => setEditing((current) => (current === field ? null : field));

  const storeName = storeInfo?.storeName || user?.storeName || '';
  const region = storeInfo?.region || user?.region || '';
  const city = storeInfo?.comuna || storeInfo?.city || user?.comuna || user?.city || '';
  const hours = storeInfo?.hours || user?.hours || '';
  const isOpen = typeof (storeInfo?.isOpen ?? storeInfo?.open) === 'boolean' ? (storeInfo.isOpen ?? storeInfo.open) : null;
  const cover = resolveMediaUrl(user?.coverUrl || storeInfo?.coverUrl || '');
  const logo = resolveMediaUrl(user?.userProfileUrl || storeInfo?.logoUrl || '');
  const sellerId = effectiveSellerId || user?.sellerId;

  const refreshStore = () => { if (sellerId) queryClient.invalidateQueries({ queryKey: qk.sellerStore(sellerId) }); };

  /** Guarda un dato del perfil (`PATCH /users/perfil`). Devuelve el error o `null`. */
  const savePersonal = async (payload) => {
    const result = await updateProfile(payload);
    if (!result.success) return result.error || 'No pudimos guardar el cambio. Intenta nuevamente.';
    refreshStore();
    setEditing(null);
    return null;
  };

  const saveStore = async (body) => {
    try {
      await updateStoreDataApi(sellerId, body);
      refreshStore();
      setEditing(null);
      return null;
    } catch (error) {
      return error?.message || 'No pudimos guardar el cambio. Intenta nuevamente.';
    }
  };

  const locationEditor = (
    <LocationEditor region={region} comuna={city} onCancel={() => setEditing(null)} onSave={savePersonal} />
  );

  return (
    <div className="spm">
      <div className="spm-hero">
        <div className="spm-cover">
          {cover ? <img src={cover} alt="Portada de la tienda" /> : <span className="spm-cover-empty" aria-hidden="true" />}
          {sellerId && (
            <button type="button" className="spm-icon-btn is-top" aria-label="Ver mi tienda pública" onClick={() => navigate(storePath({ id: sellerId, nombre: storeName }))}>
              <Eye size={16} />
            </button>
          )}
          <button type="button" className="spm-icon-btn is-bottom" aria-label="Cambiar portada" onClick={onOpenCoverTemplates}>
            <Camera size={16} />
          </button>
        </div>
        <div className="spm-logo-wrap">
          <span className="spm-logo">
            {logo ? <img src={logo} alt={`Foto de ${storeName || 'tu tienda'}`} /> : <Store size={32} aria-hidden="true" />}
          </span>
          <button type="button" className="spm-icon-btn is-logo" aria-label="Cambiar foto de perfil" onClick={onOpenMediaModal}>
            <Camera size={16} />
          </button>
        </div>
      </div>

      <div className="spm-identity">
        <h2>{storeName || 'Tu tienda'}</h2>
        <p>
          <span className={`spm-dot ${isOpen === null ? '' : isOpen ? 'is-open' : 'is-closed'}`} aria-hidden="true" />
          {isOpen === null ? 'Apertura no registrada' : isOpen ? 'Tienda abierta' : 'Tienda cerrada'}
          {city ? ` · ${city}` : ''}
        </p>
      </div>

      <Group title="Representante legal">
        <Row icon={User} title="Nombre" summary={user?.userName || user?.nombre} onPress={() => toggle('userName')}>
          {editing === 'userName' && (
            <TextEditor
              label="Nombre" initial={user?.userName || user?.nombre} maxLength={80}
              validate={(value) => (value.length < 2 ? 'Ingresa un nombre válido.' : '')}
              onCancel={() => setEditing(null)} onSave={(value) => savePersonal({ userName: value })}
            />
          )}
        </Row>
        <Row icon={Mail} title="Correo" summary={user?.email} />
        <Row icon={Phone} title="Teléfono" summary={user?.phone || user?.telefono} onPress={() => toggle('phone')}>
          {editing === 'phone' && (
            <TextEditor
              label="Teléfono" type="tel" initial={user?.phone || user?.telefono} maxLength={16}
              sanitize={(value) => value.replace(/[^0-9+]/g, '')}
              validate={(value) => (!isValidClPhone(value) ? 'Ingresa un celular chileno válido, ej: +56 9 1234 5678.' : '')}
              onCancel={() => setEditing(null)} onSave={(value) => savePersonal({ phone: value })}
            />
          )}
        </Row>
      </Group>

      <Group title="Datos de la tienda">
        <Row icon={Store} title="Nombre de la tienda" summary={storeName} onPress={() => toggle('storeName')}>
          {editing === 'storeName' && (
            <TextEditor
              label="Nombre de la tienda" initial={storeName} maxLength={180}
              onCancel={() => setEditing(null)} onSave={(value) => saveStore({ storeName: value })}
            />
          )}
        </Row>
        <Row icon={FileText} title="RUT de la tienda" summary={storeInfo?.taxId || user?.taxId} />
        <Row icon={Map} title="Región" summary={region} placeholder="No registrada" onPress={() => toggle('region')}>
          {editing === 'region' && locationEditor}
        </Row>
        <Row icon={MapPin} title="Ciudad" summary={city} placeholder="No registrada" onPress={() => toggle('city')}>
          {editing === 'city' && locationEditor}
        </Row>
        <Row icon={Navigation} title="Dirección comercial" summary={storeInfo?.address || user?.address} placeholder="No registrada" />
        <Row icon={Clock} title="Horario" summary={hours} onPress={() => toggle('hours')}>
          {editing === 'hours' && (
            <TextEditor
              label="Horario de atención" initial={hours} maxLength={255} multiline
              helper="Por ejemplo: Lunes a viernes de 9:00 a 18:00."
              onCancel={() => setEditing(null)} onSave={(value) => saveStore({ hours: value })}
            />
          )}
        </Row>
      </Group>

      <Group title="Configuración">
        <button type="button" className="spm-link" onClick={onOpenSettings} aria-expanded={settingsOpen}>
          <span className="spm-row-icon"><Settings2 size={17} aria-hidden="true" /></span>
          <span className="spm-row-copy">
            <strong>Más ajustes de la tienda</strong>
            <small>Direcciones de entrega, notificaciones y datos de facturación</small>
          </span>
          <ChevronRight size={18} className={`spm-chevron ${settingsOpen ? 'is-open' : ''}`} aria-hidden="true" />
        </button>
        <button type="button" className="spm-link" onClick={onOpenWithdrawals}>
          <span className="spm-row-icon"><CreditCard size={17} aria-hidden="true" /></span>
          <span className="spm-row-copy">
            <strong>Datos bancarios</strong>
            <small>La cuenta donde recibes el dinero de tus ventas</small>
          </span>
          <ChevronRight size={18} className="spm-chevron" aria-hidden="true" />
        </button>
      </Group>
    </div>
  );
}
