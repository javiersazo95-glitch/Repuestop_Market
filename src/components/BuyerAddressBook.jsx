import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Pencil, X, Loader2, Check, Star } from 'lucide-react';
import {
  getAddressesApi, createAddressApi, updateAddressApi, deleteAddressApi, setDefaultAddressApi,
  getPaisesApi, getRegionesApi, getComunasApi,
} from '../services/api';

const EMPTY_FORM = { calleYNumero: '', codigoPostal: '', paisId: '', regionId: '', comunaId: '' };

/**
 * Libreta de direcciones del comprador: agregar, editar, eliminar y elegir
 * cuál usar como principal. El backend exige un `comunaId` real, así que el
 * formulario resuelve país -> región -> comuna en cascada contra
 * /geografia/... en vez de aceptar comuna/región como texto libre.
 */
export default function BuyerAddressBook({ usuarioId }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [principalSaving, setPrincipalSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [paises, setPaises] = useState([]);
  const [regiones, setRegiones] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [geoLoading, setGeoLoading] = useState(false);

  const loadAddresses = () => {
    if (!usuarioId) return;
    setLoading(true);
    setError('');
    getAddressesApi(usuarioId)
      .then((data) => setAddresses(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || 'No se pudieron cargar tus direcciones.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadAddresses, [usuarioId]);

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
    if (!paises.length) {
      setGeoLoading(true);
      getPaisesApi()
        .then((data) => setPaises(Array.isArray(data) ? data : []))
        .catch(() => setPaises([]))
        .finally(() => setGeoLoading(false));
    }
  };

  const openEditForm = (address) => {
    setEditingId(address.id);
    setForm({
      calleYNumero: address.calleYNumero || '',
      codigoPostal: address.codigoPostal || '',
      paisId: '',
      regionId: address.regionId ? String(address.regionId) : '',
      comunaId: address.comunaId ? String(address.comunaId) : '',
    });
    setFormError('');
    setFormOpen(true);
    // Solo se necesita recargar las comunas de la misma región para poder
    // cambiarla; no se obliga a repetir la selección de país.
    if (address.regionId) {
      setGeoLoading(true);
      getComunasApi(address.regionId)
        .then((data) => setComunas(Array.isArray(data) ? data : []))
        .catch(() => setComunas([]))
        .finally(() => setGeoLoading(false));
    }
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setRegiones([]);
    setComunas([]);
  };

  const handlePaisChange = (paisId) => {
    setForm((current) => ({ ...current, paisId, regionId: '', comunaId: '' }));
    setComunas([]);
    if (!paisId) { setRegiones([]); return; }
    setGeoLoading(true);
    getRegionesApi(paisId)
      .then((data) => setRegiones(Array.isArray(data) ? data : []))
      .catch(() => setRegiones([]))
      .finally(() => setGeoLoading(false));
  };

  const handleRegionChange = (regionId) => {
    setForm((current) => ({ ...current, regionId, comunaId: '' }));
    if (!regionId) { setComunas([]); return; }
    setGeoLoading(true);
    getComunasApi(regionId)
      .then((data) => setComunas(Array.isArray(data) ? data : []))
      .catch(() => setComunas([]))
      .finally(() => setGeoLoading(false));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.calleYNumero.trim()) {
      setFormError('Ingresa la calle y el número.');
      return;
    }
    if (!form.comunaId) {
      setFormError('Selecciona la comuna de esta dirección.');
      return;
    }
    setSaving(true);
    setFormError('');

    const selectedComuna = comunas.find((c) => String(c.id) === String(form.comunaId));
    const selectedRegion = regiones.find((r) => String(r.id) === String(form.regionId));

    const payload = {
      comunaId: Number(form.comunaId),
      comunaNombre: selectedComuna?.nombre || '',
      regionNombre: selectedRegion?.nombre || '',
      calleYNumero: form.calleYNumero.trim(),
      codigoPostal: form.codigoPostal?.trim() || null,
    };
    try {
      if (editingId) {
        await updateAddressApi(usuarioId, editingId, payload);
      } else {
        await createAddressApi(usuarioId, payload);
      }
      closeForm();
      loadAddresses();
    } catch (err) {
      setFormError(err.message || 'No se pudo guardar la dirección.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (addressId) => {
    setDeletingId(addressId);
    try {
      await deleteAddressApi(usuarioId, addressId);
      loadAddresses();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la dirección.');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePrincipalChange = async (event) => {
    const addressId = event.target.value;
    if (!addressId) return;
    setPrincipalSaving(true);
    setError('');
    try {
      await setDefaultAddressApi(usuarioId, addressId);
      loadAddresses();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar tu dirección principal.');
    } finally {
      setPrincipalSaving(false);
    }
  };

  const [showAll, setShowAll] = useState(false);
  const principalAddress = addresses.find((address) => address.esPrincipal) || addresses[0];
  const displayAddresses = showAll ? addresses : (principalAddress ? [principalAddress] : []);

  return (
    <div className="buyer-address-book">
      <div className="buyer-address-book-header">
        <div>
          <h4>Mis direcciones</h4>
          <p>Guarda todas las direcciones donde te gustaría recibir tus repuestos.</p>
        </div>
        <button type="button" className="btn-add-address" onClick={openAddForm} title="Agregar nueva dirección">
          <Plus size={16} /> Agregar dirección
        </button>
      </div>

      {error && <div className="auth-alert alert-error" style={{ margin: '10px 0' }}><X size={16} /><span>{error}</span></div>}

      {loading ? (
        <div className="buyer-address-loading"><Loader2 size={18} className="spin-icon" /> Cargando direcciones...</div>
      ) : addresses.length === 0 ? (
        <div className="buyer-address-empty">
          <MapPin size={22} />
          <span>Aún no tienes direcciones guardadas. Agrega la primera para recibir tus pedidos.</span>
        </div>
      ) : (
        <>
          {addresses.length > 1 && (
            <div className="buyer-address-principal-picker">
              <label htmlFor="buyer-principal-address"><Star size={14} /> Dirección principal</label>
              <select
                id="buyer-principal-address"
                value={principalAddress?.id || ''}
                onChange={handlePrincipalChange}
                disabled={principalSaving}
              >
                {!principalAddress && <option value="">Selecciona una dirección</option>}
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.calleYNumero} · {address.comunaNombre}
                  </option>
                ))}
              </select>
              <small>Se usará por defecto para elegir el envío al momento de comprar.</small>
            </div>
          )}

          <ul className="buyer-address-list">
            {displayAddresses.map((address) => (
              <li key={address.id} className={address.esPrincipal || address.id === principalAddress?.id ? 'is-principal' : ''}>
                <span className="buyer-address-icon"><MapPin size={16} /></span>
                <div className="buyer-address-copy">
                  <strong>{address.calleYNumero}</strong>
                  <span>{[address.comunaNombre, address.regionNombre].filter(Boolean).join(', ')}</span>
                  {address.codigoPostal && <span className="buyer-address-zip">Código postal: {address.codigoPostal}</span>}
                </div>
                {(address.esPrincipal || address.id === principalAddress?.id) && <span className="buyer-address-principal-badge"><Star size={11} fill="currentColor" /> Principal</span>}
                <div className="buyer-address-actions">
                  <button type="button" onClick={() => openEditForm(address)} title="Editar dirección"><Pencil size={14} /></button>
                  <button
                    type="button"
                    onClick={() => handleDelete(address.id)}
                    disabled={deletingId === address.id}
                    title="Eliminar dirección"
                  >
                    {deletingId === address.id ? <Loader2 size={14} className="spin-icon" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {addresses.length > 1 && (
            <button
              type="button"
              className="btn-toggle-show-all-addresses"
              onClick={() => setShowAll(!showAll)}
              style={{
                marginTop: '10px',
                background: 'none',
                border: 'none',
                color: '#1268f3',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {showAll ? 'Mostrar solo la dirección principal' : `Ver todas mis direcciones registradas (${addresses.length})`}
            </button>
          )}
        </>
      )}

      {formOpen && (
        <div className="buyer-address-form-backdrop" onClick={closeForm}>
          <form className="buyer-address-form" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <div className="buyer-address-form-header">
              <h4>{editingId ? 'Editar dirección' : 'Nueva dirección'}</h4>
              <button type="button" onClick={closeForm} aria-label="Cerrar"><X size={18} /></button>
            </div>

            {formError && <div className="auth-alert alert-error" style={{ margin: '0 0 12px' }}><X size={16} /><span>{formError}</span></div>}

            {!editingId && (
              <div className="form-grid-2">
                <div className="form-group">
                  <label>País</label>
                  <select value={form.paisId} onChange={(e) => handlePaisChange(e.target.value)}>
                    <option value="">Selecciona un país</option>
                    {paises.map((pais) => <option key={pais.id} value={pais.id}>{pais.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Región</label>
                  <select value={form.regionId} onChange={(e) => handleRegionChange(e.target.value)} disabled={!form.paisId}>
                    <option value="">Selecciona una región</option>
                    {regiones.map((region) => <option key={region.id} value={region.id}>{region.nombre}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Comuna {geoLoading && <Loader2 size={12} className="spin-icon" />}</label>
              <select
                value={form.comunaId}
                onChange={(e) => setForm((current) => ({ ...current, comunaId: e.target.value }))}
                disabled={!editingId && !form.regionId}
              >
                <option value="">Selecciona una comuna</option>
                {comunas.map((comuna) => <option key={comuna.id} value={comuna.id}>{comuna.nombre}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Calle y número</label>
              <input
                type="text"
                value={form.calleYNumero}
                onChange={(e) => setForm((current) => ({ ...current, calleYNumero: e.target.value }))}
                placeholder="Av. Italia 1234, depto 5"
                required
              />
            </div>

            <div className="form-group">
              <label>Código postal (opcional)</label>
              <input
                type="text"
                value={form.codigoPostal}
                onChange={(e) => setForm((current) => ({ ...current, codigoPostal: e.target.value }))}
                placeholder="7500000"
              />
            </div>

            <div className="profile-data-form-actions" style={{ marginTop: '10px' }}>
              <button type="button" className="btn-auth-secondary" onClick={closeForm}>Cancelar</button>
              <button type="submit" className="btn-auth-primary" disabled={saving} style={{ width: 'auto' }}>
                {saving ? <Loader2 size={16} className="spin-icon" /> : <Check size={16} />}
                {saving ? 'Guardando...' : 'Guardar dirección'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
