import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Camera, ChevronRight, Info, Lock, MapPin, PencilLine, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getComunasApi, getPaisesApi, getRegionesApi, resolveMediaUrl } from '../../services/api';
import { resolverUbicacionPorNombre } from '../../services/geoLookup';
import { formatRut, isValidClPhone, isValidRut } from '../../services/adapters';
import ConfirmDialog from '../ConfirmDialog';
import '../../styles/store-profile-mobile.css';
import '../../styles/buyer-profile-mobile.css';

const initialsOf = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'R';

/** Regiones de Chile y comunas de la región elegida; parte de lo que la cuenta ya tiene. */
function useGeo(region, comuna) {
  const [regiones, setRegiones] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [initial, setInitial] = useState({ regionId: '', comunaId: '' });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = await resolverUbicacionPorNombre({ comuna, region }).catch(() => null);
      if (cancelled) return;
      if (found?.regiones?.length) {
        setRegiones(found.regiones);
        setComunas(found.comunas || []);
        setInitial({ regionId: found.regionId ? String(found.regionId) : '', comunaId: found.comunaId ? String(found.comunaId) : '' });
        return;
      }
      const paises = await getPaisesApi().catch(() => []);
      const chile = (Array.isArray(paises) ? paises : []).find((pais) => String(pais.nombre || '').toLowerCase().includes('chile'));
      if (!chile || cancelled) return;
      const list = await getRegionesApi(chile.id).catch(() => []);
      if (!cancelled) setRegiones(Array.isArray(list) ? list : []);
    })();
    return () => { cancelled = true; };
  }, [region, comuna]);
  const loadComunas = (regionId) => {
    setComunas([]);
    if (!regionId) return;
    getComunasApi(regionId).then((list) => setComunas(Array.isArray(list) ? list : [])).catch(() => setComunas([]));
  };
  return { regiones, comunas, initial, loadComunas };
}

function Field({ label, helper, error, children }) {
  return (
    <label className={`bpm-field ${error ? 'is-invalid' : ''}`}>
      <span>{label}</span>
      {children}
      {error ? <small className="bpm-error">{error}</small> : helper ? <small>{helper}</small> : null}
    </label>
  );
}

function MenuRow({ icon: Icon, label, onClick }) {
  return (
    <button type="button" className="bpm-menu-row" onClick={onClick}>
      <span className="bpm-menu-icon"><Icon size={18} /></span>
      <span>{label}</span>
      <ChevronRight size={18} />
    </button>
  );
}

/**
 * «Mis datos y perfil» del comprador y del taller en el celular: igual que `app/profile-edit.tsx`. Foto con su cámara,
 * «Datos personales», los datos en tarjetas que se bloquean hasta tocar «Editar datos», y el menú «Configuración».
 * El comprador además edita su ubicación, la dirección de envío y los datos para factura; el taller solo nombre y teléfono.
 */
export default function BuyerProfileMobile({ user, isWorkshop, onOpenMediaModal, onOpenTab, onCloseAccount }) {
  const { updateProfile } = useAuth();
  const isBuyer = !isWorkshop;
  const base = useMemo(() => ({
    userName: user?.userName || user?.nombre || '',
    phone: user?.phone || user?.telefono || '',
    address: user?.address || '',
    facturaRut: user?.facturaRut || user?.taxId || '',
    facturaRazonSocial: user?.facturaRazonSocial || '',
    facturaGiro: user?.facturaGiro || '',
  }), [user]);
  const geo = useGeo(user?.region, user?.comuna || user?.city);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(base);
  const [regionId, setRegionId] = useState('');
  const [comunaId, setComunaId] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => { if (!editing) setDraft(base); }, [base, editing]);
  useEffect(() => {
    if (editing) return;
    setRegionId(geo.initial.regionId);
    setComunaId(geo.initial.comunaId);
  }, [geo.initial, editing]);

  const update = (key, value) => { setDraft((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); };
  const dirty = editing && (Object.keys(base).some((key) => draft[key] !== base[key])
    || regionId !== geo.initial.regionId || comunaId !== geo.initial.comunaId);

  const startEditing = () => { setNotice(null); setErrors({}); setEditing(true); };
  const discard = () => { setEditing(false); setDraft(base); setRegionId(geo.initial.regionId); setComunaId(geo.initial.comunaId); setErrors({}); };
  const cancel = () => (dirty ? setConfirmDiscard(true) : discard());

  const save = async () => {
    const next = {};
    if (!draft.userName.trim()) next.userName = 'Ingresa tu nombre.';
    if (draft.phone.trim() && !isValidClPhone(draft.phone.trim())) next.phone = 'Ingresa un teléfono válido, por ejemplo +56912345678.';
    if (isBuyer && draft.facturaRut.trim() && !isValidRut(draft.facturaRut)) next.facturaRut = 'El RUT no es válido. Revisa el dígito verificador.';
    setErrors(next);
    if (Object.keys(next).length) { setNotice({ type: 'error', message: 'Corrige los campos marcados en rojo antes de guardar.' }); return; }
    const payload = { userName: draft.userName.trim(), phone: draft.phone.trim() };
    if (isBuyer) {
      const regionName = geo.regiones.find((item) => String(item.id) === regionId)?.nombre;
      const comunaName = geo.comunas.find((item) => String(item.id) === comunaId)?.nombre;
      if (comunaId) Object.assign(payload, { comunaId: Number(comunaId), region: regionName, city: comunaName });
      if (draft.address.trim()) payload.address = draft.address.trim();
      Object.assign(payload, {
        facturaRut: draft.facturaRut.trim(), taxId: draft.facturaRut.trim(),
        facturaRazonSocial: draft.facturaRazonSocial.trim(), facturaGiro: draft.facturaGiro.trim(),
      });
    }
    setSaving(true);
    setNotice(null);
    const result = await updateProfile(payload);
    setSaving(false);
    if (!result?.success) { setNotice({ type: 'error', message: result?.error || 'No se pudo guardar la información en el servidor.' }); return; }
    setEditing(false);
    setNotice({ type: 'success', message: 'Tus datos se guardaron correctamente.' });
  };

  const avatar = resolveMediaUrl(user?.userProfileUrl || '');
  const locked = !editing;

  return (
    <div className="bpm">
      <header className="bpm-header">
        <button type="button" className="bpm-avatar" onClick={onOpenMediaModal} aria-label="Cambiar foto de perfil">
          {avatar ? <img src={avatar} alt="Tu foto de perfil" referrerPolicy="no-referrer" /> : <span>{initialsOf(user?.userName)}</span>}
          <i><Camera size={15} /></i>
        </button>
        <h2>Datos personales</h2>
        <p>{editing ? 'Modifica los campos que necesites y guarda los cambios.' : 'Estos son los datos registrados en tu cuenta.'}</p>
      </header>

      <section className="bpm-panel">
        <h3>Datos principales</h3>
        <Field label="Nombre" error={errors.userName}>
          <input value={draft.userName} maxLength={80} readOnly={locked} onChange={(event) => update('userName', event.target.value)} />
        </Field>
        <Field label="Correo" helper="Tu correo identifica tu cuenta y no se puede cambiar.">
          <input value={user?.email || ''} readOnly className="is-locked" />
        </Field>
        <Field label="Teléfono" error={errors.phone}>
          <input value={draft.phone} type="tel" inputMode="tel" maxLength={16} readOnly={locked} onChange={(event) => update('phone', event.target.value.replace(/[^0-9+]/g, ''))} />
        </Field>
        {isBuyer && (
          <>
            <Field label="Región">
              <select value={regionId} disabled={locked} onChange={(event) => { setRegionId(event.target.value); setComunaId(''); geo.loadComunas(event.target.value); }}>
                <option value="">Selecciona una región</option>
                {geo.regiones.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </Field>
            <Field label="Comuna / Ciudad">
              <select value={comunaId} disabled={locked || !regionId} onChange={(event) => setComunaId(event.target.value)}>
                <option value="">{!regionId ? 'Primero selecciona una región' : 'Selecciona una comuna'}</option>
                {geo.comunas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </Field>
            <Field label="Dirección de envío" helper={editing ? 'Usa la dirección donde normalmente recibes tus repuestos.' : undefined}>
              <input value={draft.address} maxLength={160} readOnly={locked} placeholder="Ej. Av. Providencia 1234" onChange={(event) => update('address', event.target.value)} />
            </Field>
          </>
        )}
        {isWorkshop && user?.address && (
          <Field label="Dirección del taller" helper="Es la dirección que registraste al acreditar tu taller. Es fija y solo informativa.">
            <input value={[user.address, user.comuna || user.city, user.region].filter(Boolean).join(', ')} readOnly className="is-locked" />
          </Field>
        )}
      </section>

      {isBuyer && (
        <section className="bpm-panel">
          <h3>Datos para factura</h3>
          <p className="bpm-muted">Guarda estos datos para no tener que escribirlos cada vez que elijas “Factura” al pagar.</p>
          <Field label="RUT" error={errors.facturaRut}>
            <input value={draft.facturaRut} maxLength={12} readOnly={locked} onChange={(event) => update('facturaRut', formatRut(event.target.value))} />
          </Field>
          <Field label="Razón social (opcional)">
            <input value={draft.facturaRazonSocial} maxLength={120} readOnly={locked} onChange={(event) => update('facturaRazonSocial', event.target.value)} />
          </Field>
          <Field label="Giro (opcional)">
            <input value={draft.facturaGiro} maxLength={120} readOnly={locked} onChange={(event) => update('facturaGiro', event.target.value)} />
          </Field>
        </section>
      )}

      {notice && <p className={`bpm-notice is-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}><Info size={16} /> {notice.message}</p>}

      <div className="bpm-actions">
        {editing ? (
          <>
            <button type="button" className="bpm-btn is-primary" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
            <button type="button" className="bpm-btn is-outline" disabled={saving} onClick={cancel}>Cancelar</button>
          </>
        ) : (
          <>
            <button type="button" className="bpm-btn is-primary" onClick={startEditing}><PencilLine size={18} /> Editar datos</button>
            {isBuyer && <button type="button" className="bpm-btn is-danger" onClick={onCloseAccount}><Trash2 size={18} /> Cerrar cuenta</button>}
          </>
        )}
      </div>

      {!editing && (
        <section className="spm-group">
          <h3>Configuración</h3>
          <div className="spm-card">
            {isWorkshop && <MenuRow icon={ShieldCheck} label="Acreditación del taller" onClick={() => onOpenTab('mi_taller')} />}
            {!isWorkshop && <MenuRow icon={MapPin} label="Mis direcciones" onClick={() => onOpenTab('mis_direcciones')} />}
            {isWorkshop && <MenuRow icon={Bell} label="Notificaciones" onClick={() => onOpenTab('notificaciones')} />}
            <MenuRow icon={Lock} label="Cambiar contraseña" onClick={() => onOpenTab('cambiar_clave')} />
          </div>
        </section>
      )}

      <ConfirmDialog
        isOpen={confirmDiscard}
        title="Descartar cambios"
        message="Tienes cambios sin guardar. ¿Quieres salir igualmente?"
        confirmLabel="Descartar"
        cancelLabel="Seguir editando"
        onConfirm={() => { setConfirmDiscard(false); discard(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
