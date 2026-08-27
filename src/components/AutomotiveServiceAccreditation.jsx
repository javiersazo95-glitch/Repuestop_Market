import React, { useEffect, useState } from 'react';
import { ShieldCheck, UploadCloud, Loader2, Check, AlertCircle } from 'lucide-react';
import {
  getPaisesApi, getRegionesApi, getComunasApi,
  getAutomotiveServiceAccreditationApi, submitAutomotiveServiceAccreditationApi,
} from '../services/api';
import { formatRut, isValidRut } from '../services/adapters';

const EMPTY_FORM = {
  nombreNegocio: '', rutNegocio: '', giro: '', responsable: '',
  regionId: '', comunaId: '', direccion: '', referido: '',
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

/**
 * Acreditación del servicio automotriz: expediente legal INDEPENDIENTE de los
 * documentos de la tienda. Aunque la cuenta ya sea vendedora y tenga su tienda
 * validada, para publicar servicios debe subir de nuevo estos tres documentos,
 * porque la revisión la hace otro equipo y sobre otro registro del backend
 * (`/automotive-services/me`).
 */
export default function AutomotiveServiceAccreditation({ user }) {
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, responsable: user?.userName || user?.nombre || '' });
  const [files, setFiles] = useState(EMPTY_FILES);
  const [regiones, setRegiones] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Sin expediente presentado el getter devuelve null, y el formulario se
    // abre en blanco.
    getAutomotiveServiceAccreditationApi()
      .then((data) => setRecord(data || null))
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

  const handleChange = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleRegionChange = (regionId) => setForm((current) => ({ ...current, regionId, comunaId: '' }));

  const handleFileChange = (key, file) => setFiles((current) => ({ ...current, [key]: file }));

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isValidRut(form.rutNegocio)) {
      setError('El RUT del negocio no es válido.');
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
        referido: form.referido.trim().toUpperCase(),
        rutNegocio: formatRut(form.rutNegocio),
        regionId: Number(form.regionId),
        comunaId: Number(form.comunaId),
      }, files);
      setRecord(saved || null);
      setFiles(EMPTY_FILES);
      setSuccess('Expediente enviado. Te avisaremos cuando sea revisado.');
    } catch (err) {
      setError(err.message || 'No se pudo enviar la acreditación.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
          <Loader2 size={18} className="spin-icon" /> Cargando acreditación...
        </div>
      </div>
    );
  }

  return (
    <div className="profile-panel">
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

      {estado === 'APROBADO' && (
        <p style={{ marginTop: '16px', fontSize: '13.5px', fontWeight: 700, color: '#166534' }}>
          Tu servicio está aprobado: ya puedes comprar monedas y publicar múltiples anuncios.
        </p>
      )}

      {editable && (
        <form onSubmit={handleSubmit} style={{ marginTop: '18px' }}>
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
            <input
              type="text"
              value={form.direccion}
              onChange={(e) => handleChange('direccion', e.target.value)}
              placeholder="Av. Italia 1234"
            />
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
    </div>
  );
}
