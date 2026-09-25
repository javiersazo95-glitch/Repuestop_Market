import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, UploadCloud, Loader2, Check, AlertCircle, ImagePlus, Building2 } from 'lucide-react';
import {
  getPaisesApi, getRegionesApi, getComunasApi,
  getAutomotiveServiceAccreditationApi, submitAutomotiveServiceAccreditationApi,
  updateAutomotiveServiceLogoApi, resolveMediaUrl,
} from '../services/api';
import { uploadAdImages } from '../services/adsStorage';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import { normalizarNombreGeografico } from '../services/geoLookup';
import { formatRut, isValidRut } from '../services/adapters';
import { validateUpload, FILE_LIMITS } from '../utils/fileValidation';

const EMPTY_FORM = {
  nombreNegocio: '', rutNegocio: '', giro: '', responsable: '',
  regionId: '', comunaId: '', direccion: '', telefono: '', referido: '',
};

const EMPTY_FILES = { identidad: null, inicioActividades: null, patenteMunicipal: null };

// Los tres documentos que exige la acreditación, en el mismo orden en que se piden.
const REQUIRED_DOCS = [
  { key: 'identidad', label: 'Identidad o RUT del responsable' },
  { key: 'inicioActividades', label: 'Inicio de actividades SII' },
  { key: 'patenteMunicipal', label: 'Patente municipal vigente' },
];

// Estados en los que el expediente todavía se puede enviar o reenviar.
const EDITABLE_STATES = ['SIN_SOLICITUD', 'POR_CORREGIR', 'RECHAZADO'];

const ESTADO_LABEL = {
  SIN_SOLICITUD: 'Sin solicitud',
  PENDIENTE: 'En revisión',
  POR_CORREGIR: 'Por corregir',
  RECHAZADO: 'Rechazado',
  APROBADO: 'Aprobado',
};

// El backend recibe los nueve dígitos nacionales y normaliza el valor al
// formato `+56 123456789`. La interfaz deja el prefijo fijo para evitar que se
// duplique al pegar o escribir el número.
const normalizeChileanPhone = (value = '') => value
  .replace(/\D/g, '')
  .replace(/^56(?=\d{9}$)/, '')
  .slice(0, 9);

/**
 * Selector de logo de la empresa: círculo con la imagen actual (o un icono) y un
 * botón para reemplazarla. Sube el archivo por el mismo endpoint que las fotos de
 * anuncios y entrega la URL ya resuelta.
 */
function LogoPicker({ value, onPick, busy, error, caption }) {
  const inputRef = useRef(null);
  return (
    <div className="acc-logo-field">
      <span className="acc-logo-preview">
        {value
          ? <img src={value} alt="Logo de la empresa" />
          : <Building2 size={26} />}
        {busy && <span className="acc-logo-spinner"><Loader2 size={16} className="spin-icon" /></span>}
      </span>
      <div className="acc-logo-copy">
        <strong>Logo de tu empresa</strong>
        <span>{caption || 'Se muestra en la tarjeta del Mural y en la ficha de tus anuncios. PNG o JPG, cuadrado se ve mejor.'}</span>
        <button
          type="button"
          className="btn-auth-secondary acc-logo-btn"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus size={15} /> {value ? 'Cambiar logo' : 'Subir logo'}
        </button>
        {error && <span className="acc-logo-error"><AlertCircle size={13} /> {error}</span>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onPick(file);
        }}
      />
    </div>
  );
}

/**
 * Acreditación del servicio automotriz: expediente legal INDEPENDIENTE de los
 * documentos de la tienda. Aunque la cuenta ya sea vendedora y tenga su tienda
 * validada, para publicar servicios debe subir de nuevo estos tres documentos,
 * porque la revisión la hace otro equipo y sobre otro registro del backend
 * (`/automotive-services/me`).
 */
export default function AutomotiveServiceAccreditation({ user, embedded = false, onSaved }) {
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    responsable: user?.userName || user?.nombre || '',
    telefono: normalizeChileanPhone(user?.phone || user?.telefono),
  });
  const [files, setFiles] = useState(EMPTY_FILES);
  const [regiones, setRegiones] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Logo de la empresa. Se puede cargar antes de enviar el expediente y también
  // cambiar cuando ya está APROBADO (ahí el formulario queda en modo consulta).
  const [logoUrl, setLogoUrl] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState('');

  useEffect(() => {
    // Sin expediente presentado el getter devuelve null, y el formulario se
    // abre en blanco.
    getAutomotiveServiceAccreditationApi()
      .then((data) => {
        setRecord(data || null);
        if (data?.logoUrl) setLogoUrl(resolveMediaUrl(data.logoUrl) || data.logoUrl);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar tu acreditación.'))
      .finally(() => setLoading(false));

    getPaisesApi()
      .then((data) => {
        const lista = Array.isArray(data) ? data : [];
        const chile = lista.find((pais) => /chile/i.test(pais.nombre)) || lista[0];
        return chile ? getRegionesApi(chile.id) : [];
      })
      .then((data) => setRegiones(Array.isArray(data) ? data : []))
      .catch(() => setRegiones([]));
  }, []);

  useEffect(() => {
    if (!form.regionId) { setComunas([]); return; }
    getComunasApi(form.regionId)
      .then((data) => setComunas(Array.isArray(data) ? data : []))
      .catch(() => setComunas([]));
  }, [form.regionId]);

  const estado = record?.estado || 'SIN_SOLICITUD';
  const editable = EDITABLE_STATES.includes(estado);
  const isApproved = estado === 'APROBADO';

  const handleChange = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleRegionChange = (regionId) => setForm((current) => ({ ...current, regionId, comunaId: '' }));

  // Al elegir una dirección sugerida se completan región y comuna. La comuna queda
  // pendiente hasta que cargue la lista de la región elegida.
  const pendingComunaRef = useRef('');
  const handleAddressLocation = ({ comuna, region }) => {
    const objetivo = normalizarNombreGeografico(region);
    const regionMatch = region
      ? regiones.find((r) => {
        const nombre = normalizarNombreGeografico(r.nombre);
        return nombre === objetivo || nombre.includes(objetivo) || objetivo.includes(nombre);
      })
      : null;
    if (comuna) pendingComunaRef.current = comuna;
    if (regionMatch && String(regionMatch.id) !== String(form.regionId)) handleRegionChange(String(regionMatch.id));
  };
  useEffect(() => {
    const pendiente = pendingComunaRef.current;
    if (!pendiente || comunas.length === 0) return;
    const objetivo = normalizarNombreGeografico(pendiente);
    const comunaMatch = comunas.find((c) => normalizarNombreGeografico(c.nombre) === objetivo)
      || comunas.find((c) => normalizarNombreGeografico(c.nombre).includes(objetivo));
    if (!comunaMatch) return;
    pendingComunaRef.current = '';
    setForm((current) => ({ ...current, comunaId: String(comunaMatch.id) }));
  }, [comunas]);

  const regionNombre = regiones.find((r) => String(r.id) === String(form.regionId))?.nombre;
  const comunaNombre = comunas.find((c) => String(c.id) === String(form.comunaId))?.nombre;

  // Acepta PDF o imagen, con tope de 10 MB. Antes no comprobaba nada y el archivo se
  // adjuntaba tal cual, de modo que el fallo por tamano aparecia recien al enviar todo
  // el expediente, con los demas documentos ya subidos.
  const handleFileChange = (key, file) => {
    const problema = validateUpload(file, {
      maxBytes: FILE_LIMITS.DOCUMENT, accept: 'image-or-pdf', label: 'El documento',
    });
    if (problema) {
      setError(problema);
      return;
    }
    setError('');
    setFiles((current) => ({ ...current, [key]: file }));
  };

  // Sube la imagen y deja la URL en estado. Cuando el expediente ya está
  // aprobado, además persiste el cambio de inmediato con el PATCH dedicado.
  const handleLogoPick = async (file) => {
    const problemaLogo = validateUpload(file, { maxBytes: FILE_LIMITS.IMAGE, accept: 'image', label: 'El logo' });
    if (problemaLogo) {
      setLogoError(problemaLogo);
      return;
    }
    setLogoBusy(true);
    setLogoError('');
    try {
      const [url] = await uploadAdImages([file]);
      if (!url) throw new Error('No se pudo procesar la imagen.');
      setLogoUrl(url);
      if (!editable) {
        const saved = await updateAutomotiveServiceLogoApi(url);
        setRecord(saved || record);
        onSaved?.(saved || record);
      }
    } catch (err) {
      setLogoError(err.message || 'No se pudo subir el logo.');
    } finally {
      setLogoBusy(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isValidRut(form.rutNegocio)) {
      setError('El RUT del negocio no es válido.');
      return;
    }
    if (form.telefono.length !== 9) {
      setError('Ingresa un teléfono chileno de 9 dígitos.');
      return;
    }
    // Los tres documentos se piden en cada envío, incluso al corregir: el
    // backend guarda un expediente completo por revisión, no un parche sobre
    // el anterior.
    const faltante = REQUIRED_DOCS.find((doc) => !files[doc.key]);
    if (faltante) {
      setError(`Adjunta el documento "${faltante.label}" antes de enviar.`);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const saved = await submitAutomotiveServiceAccreditationApi({
        ...form,
        logoUrl: logoUrl || null,
        referido: form.referido.trim().toUpperCase(),
        rutNegocio: formatRut(form.rutNegocio),
        regionId: Number(form.regionId),
        comunaId: Number(form.comunaId),
      }, files);
      setRecord(saved || null);
      setFiles(EMPTY_FILES);
      setSuccess('Expediente enviado. Te avisaremos cuando sea revisado.');
      onSaved?.(saved || null);
    } catch (err) {
      setError(err.message || 'No se pudo enviar la acreditación.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    const spinner = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
        <Loader2 size={18} className="spin-icon" /> Cargando acreditación...
      </div>
    );
    return embedded ? spinner : <div className="profile-panel">{spinner}</div>;
  }

  const Wrapper = embedded ? React.Fragment : 'div';
  const wrapperProps = embedded ? {} : { className: 'profile-panel' };

  return (
    <Wrapper {...wrapperProps}>
      {!embedded && (
        <div className="profile-panel-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldCheck size={26} style={{ color: '#2563eb' }} />
            <div>
              <h3 className="profile-panel-title" style={{ margin: 0 }}>Acreditar servicio automotriz</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Este expediente es independiente de los documentos de tu tienda.
              </p>
            </div>
          </div>
        </div>
      )}

      {record && (
        <div style={{ margin: '18px 0', padding: '14px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #cfe0fb' }}>
          <strong style={{ color: '#1d4ed8' }}>Estado: {ESTADO_LABEL[estado] || estado}</strong>
          {record.notasRevision && (
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#334155' }}>{record.notasRevision}</p>
          )}
          {record.captadorAlias && (
            <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: '#64748b' }}>Referido por @{record.captadorAlias}</p>
          )}
        </div>
      )}

      {error && <div className="auth-alert alert-error" style={{ margin: '12px 0' }}><AlertCircle size={16} /><span>{error}</span></div>}
      {success && <div className="auth-alert alert-success" style={{ margin: '12px 0' }}><Check size={16} /><span>{success}</span></div>}

      {isApproved && (
        <>
          <p style={{ marginTop: '16px', fontSize: '13.5px', fontWeight: 700, color: '#166534' }}>
            Tu servicio está aprobado: ya puedes comprar monedas y publicar múltiples anuncios.
          </p>
          {/* El logo se puede cambiar aunque el expediente esté cerrado. */}
          <LogoPicker
            value={logoUrl}
            onPick={handleLogoPick}
            busy={logoBusy}
            error={logoError}
            caption="Este logo aparece en tus anuncios del Mural. Puedes cambiarlo cuando quieras."
          />
        </>
      )}

      {editable && (
        <form onSubmit={handleSubmit} style={{ marginTop: '18px' }}>
          {/* El logo va al inicio: es lo primero que verá el cliente en el Mural. */}
          <LogoPicker
            value={logoUrl}
            onPick={handleLogoPick}
            busy={logoBusy}
            error={logoError}
          />

          <div className="form-grid-2">
            <div className="form-group">
              <label>Nombre del negocio</label>
              <input
                type="text"
                value={form.nombreNegocio}
                onChange={(e) => handleChange('nombreNegocio', e.target.value)}
                placeholder="Taller Los Robles"
                required
              />
            </div>
            <div className="form-group">
              <label>RUT del negocio</label>
              <input
                type="text"
                value={form.rutNegocio}
                onChange={(e) => handleChange('rutNegocio', formatRut(e.target.value))}
                placeholder="76.123.456-7"
                required
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Giro (opcional)</label>
              <input
                type="text"
                value={form.giro}
                onChange={(e) => handleChange('giro', e.target.value)}
                placeholder="Servicio técnico automotriz"
              />
            </div>
            <div className="form-group">
              <label>Responsable</label>
              <input
                type="text"
                value={form.responsable}
                onChange={(e) => handleChange('responsable', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Región</label>
              <select value={form.regionId} onChange={(e) => handleRegionChange(e.target.value)} required>
                <option value="">Selecciona una región</option>
                {regiones.map((region) => <option key={region.id} value={region.id}>{region.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Comuna</label>
              <select
                value={form.comunaId}
                onChange={(e) => handleChange('comunaId', e.target.value)}
                disabled={!form.regionId}
                required
              >
                <option value="">Selecciona una comuna</option>
                {comunas.map((comuna) => <option key={comuna.id} value={comuna.id}>{comuna.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Dirección (opcional)</label>
            <AddressAutocompleteInput
              value={form.direccion}
              onChange={(valor) => handleChange('direccion', valor)}
              onSelectLocation={handleAddressLocation}
              comuna={comunaNombre}
              region={regionNombre}
              placeholder="Av. Italia 1234"
            />
          </div>

          <div className="form-group">
            <label htmlFor="automotive-service-phone">Teléfono de contacto</label>
            <div className="phone-field">
              <span className="phone-prefix" aria-label="Chile">🇨🇱 +56</span>
              <input
                id="automotive-service-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={form.telefono}
                onChange={(e) => handleChange('telefono', normalizeChileanPhone(e.target.value))}
                placeholder="9 1234 5678"
                maxLength={9}
                required
              />
            </div>
            <small>Ingresa los 9 dígitos, sin el prefijo +56.</small>
          </div>

          <div className="form-group">
            <label>Código de referido (opcional)</label>
            <input
              type="text"
              value={form.referido}
              onChange={(e) => handleChange('referido', e.target.value.toUpperCase())}
              placeholder="Ej: RT-CAPTADOR-00001"
              maxLength={40}
              autoComplete="off"
            />
          </div>

          {REQUIRED_DOCS.map((doc) => (
            <div className="form-group" key={doc.key}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <UploadCloud size={15} /> {doc.label}
              </label>
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => handleFileChange(doc.key, e.target.files?.[0] || null)}
                required
              />
            </div>
          ))}

          <div className="profile-data-form-actions" style={{ marginTop: '10px' }}>
            <button type="submit" className="btn-auth-primary" disabled={saving} style={{ width: 'auto' }}>
              {saving ? <Loader2 size={16} className="spin-icon" /> : <ShieldCheck size={16} />}
              {saving ? 'Enviando...' : 'Enviar expediente a validación'}
            </button>
          </div>
        </form>
      )}
    </Wrapper>
  );
}
