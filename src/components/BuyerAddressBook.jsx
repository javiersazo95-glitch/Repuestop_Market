import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Pencil, X, Loader2, Check, Star, User, Store } from 'lucide-react';
import {
  getAddressesApi, createAddressApi, updateAddressApi, deleteAddressApi, setDefaultAddressApi,
  getPaisesApi, getRegionesApi, getComunasApi, saveAddressTypeMeta, updateProfileApi,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = { calleYNumero: '', codigoPostal: '', paisId: '', regionId: '', comunaId: '', tipoDireccion: 'PERSONAL' };

/**
 * Libreta de direcciones del usuario (Comprador o Tienda): agregar, editar, eliminar y elegir
 * cuál usar como principal. Clasifica cada dirección como 'PERSONAL' o 'DESPACHO'.
 *
 * Para una cuenta Proveedor, la dirección Comercial principal de esta libreta
 * ES la dirección oficial de la tienda (RT_tienda.direccion_id): cada vez que
 * cambia, se sincroniza vía PATCH /users/perfil (misma ruta que "Editar
 * Información") para que la ficha pública, el filtro de comuna del catálogo y
 * el bloque "Dirección Comercial de Tienda" del perfil siempre muestren el
 * mismo dato, en vez de dos direcciones desconectadas entre sí.
 */
export default function BuyerAddressBook({ usuarioId, onCommercialAddressSynced }) {
  const { role } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [principalSaving, setPrincipalSaving] = useState(false);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'PERSONAL', 'DESPACHO'

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

  const syncStoreAddress = (list) => {
    if (role !== 'SELLER') return;
    const despacho = list.filter((a) => (a.tipoDireccion || a.tipo) === 'DESPACHO');
    const despachoPrincipal = despacho.find((a) => a.esPrincipal) || despacho[0];
    if (!despachoPrincipal) return;
    updateProfileApi({ address: despachoPrincipal.calleYNumero, comunaId: despachoPrincipal.comunaId })
      .then(() => onCommercialAddressSynced?.())
      .catch(() => {
        // Si falla la sincronización no bloqueamos la libreta de direcciones
        // (que ya se guardó bien); "Dirección Comercial de Tienda" solo se
        // queda desactualizada hasta el próximo cambio exitoso.
      });
  };

  const loadAddresses = () => {
    if (!usuarioId) return;
    setLoading(true);
    setError('');
    getAddressesApi(usuarioId)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAddresses(list);
        syncStoreAddress(list);
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar tus direcciones.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadAddresses, [usuarioId]);

  const openAddForm = (defaultType = 'PERSONAL') => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, tipoDireccion: defaultType });
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
      tipoDireccion: address.tipoDireccion || address.tipo || 'PERSONAL',
    });
    setFormError('');
    setFormOpen(true);
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
    if (event && event.preventDefault) event.preventDefault();
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
      tipoDireccion: form.tipoDireccion || 'PERSONAL',
    };

    saveAddressTypeMeta(usuarioId, editingId, form.calleYNumero.trim(), form.tipoDireccion || 'PERSONAL');

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

  const despachoCount = addresses.filter((a) => (a.tipoDireccion || a.tipo) === 'DESPACHO').length;

  const handleToggleType = async (address) => {
    const currentType = (address.tipoDireccion || address.tipo) === 'DESPACHO' ? 'DESPACHO' : 'PERSONAL';
    const newType = currentType === 'DESPACHO' ? 'PERSONAL' : 'DESPACHO';

    if (currentType === 'DESPACHO' && despachoCount <= 1) {
      setError('Debes tener al menos una dirección comercial de despacho registrada. Agrega otra antes de cambiar esta.');
      return;
    }

    saveAddressTypeMeta(usuarioId, address.id, address.calleYNumero, newType);

    const payload = {
      comunaId: address.comunaId,
      comunaNombre: address.comunaNombre,
      regionNombre: address.regionNombre,
      calleYNumero: address.calleYNumero,
      codigoPostal: address.codigoPostal,
      tipoDireccion: newType,
    };

    try {
      await updateAddressApi(usuarioId, address.id, payload);
      loadAddresses();
    } catch {
      loadAddresses();
    }
  };

  const handleDelete = async (address) => {
    const tipo = (address.tipoDireccion || address.tipo) === 'DESPACHO' ? 'DESPACHO' : 'PERSONAL';
    if (tipo === 'DESPACHO' && despachoCount <= 1) {
      setError('Debes tener al menos una dirección comercial de despacho registrada. No puedes eliminar la última.');
      return;
    }

    setError('');
    setDeletingId(address.id);
    try {
      await deleteAddressApi(usuarioId, address.id);
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

  const [showAll, setShowAll] = useState(true);

  const filteredAddresses = addresses.filter((a) => {
    const t = a.tipoDireccion || a.tipo || 'PERSONAL';
    if (filterType === 'PERSONAL') return t === 'PERSONAL';
    if (filterType === 'DESPACHO') return t === 'DESPACHO';
    return true;
  });

  const principalAddress = addresses.find((address) => address.esPrincipal) || addresses[0];
  // El desplegable de "dirección principal" respeta la pestaña activa: en
  // Comercial solo lista comerciales, en Personales solo personales. Dentro de
  // ese subconjunto, se preselecciona la que ya es principal (si la hay) o la
  // primera disponible.
  const dropdownAddresses = filteredAddresses;
  const dropdownPrincipal = dropdownAddresses.find((address) => address.esPrincipal) || dropdownAddresses[0];
  // La comercial es la dirección "principal" del negocio (mínimo 1 obligatoria),
  // así que va primero en la lista cuando se ven "Todas" mezcladas.
  const sortedAddresses = [...filteredAddresses].sort((a, b) => {
    const tipoA = (a.tipoDireccion || a.tipo) === 'DESPACHO' ? 0 : 1;
    const tipoB = (b.tipoDireccion || b.tipo) === 'DESPACHO' ? 0 : 1;
    return tipoA - tipoB;
  });
  const displayAddresses = showAll ? sortedAddresses : (principalAddress ? [principalAddress] : []);

  const personalCount = addresses.filter((a) => (a.tipoDireccion || a.tipo || 'PERSONAL') === 'PERSONAL').length;

  return (
    <div className="buyer-address-book">
      <div className="buyer-address-book-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-color, #0f172a)' }}>Libreta de Direcciones</h4>
          <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Registra tus direcciones personales de compras o las direcciones comerciales de despacho.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn-add-address" onClick={() => openAddForm('DESPACHO')} style={{ background: '#2563eb', borderColor: '#2563eb', color: '#fff' }} title="Agregar dirección comercial de despacho">
            <Plus size={15} /> <Store size={13} /> Agregar Comercial
          </button>
          <button type="button" className="btn-add-address" onClick={() => openAddForm('PERSONAL')} title="Agregar dirección personal">
            <Plus size={15} /> <User size={13} /> Agregar Personal
          </button>
        </div>
      </div>

      {addresses.length > 0 && (
        <div className="address-filter-pills" style={{ display: 'flex', gap: '8px', margin: '14px 0 10px' }}>
          <button
            type="button"
            className={`filter-pill ${filterType === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterType('ALL')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: filterType === 'ALL' ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
              background: filterType === 'ALL' ? '#0f172a' : '#fff',
              color: filterType === 'ALL' ? '#fff' : '#475569',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Todas ({addresses.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${filterType === 'DESPACHO' ? 'active' : ''}`}
            onClick={() => setFilterType('DESPACHO')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: filterType === 'DESPACHO' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
              background: filterType === 'DESPACHO' ? '#eff6ff' : '#fff',
              color: filterType === 'DESPACHO' ? '#1d4ed8' : '#475569',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Store size={12} /> Comercial / Despacho ({despachoCount})
          </button>
          <button
            type="button"
            className={`filter-pill ${filterType === 'PERSONAL' ? 'active' : ''}`}
            onClick={() => setFilterType('PERSONAL')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: filterType === 'PERSONAL' ? '1.5px solid #059669' : '1px solid #cbd5e1',
              background: filterType === 'PERSONAL' ? '#ecfdf5' : '#fff',
              color: filterType === 'PERSONAL' ? '#047857' : '#475569',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <User size={12} /> Personales ({personalCount})
          </button>
        </div>
      )}

      {error && <div className="auth-alert alert-error" style={{ margin: '10px 0' }}><X size={16} /><span>{error}</span></div>}

      {loading ? (
        <div className="buyer-address-loading"><Loader2 size={18} className="spin-icon" /> Cargando direcciones...</div>
      ) : filteredAddresses.length === 0 ? (
        <div className="buyer-address-empty" style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', margin: '10px 0' }}>
          <MapPin size={24} style={{ color: '#94a3b8', marginBottom: '6px' }} />
          <span style={{ display: 'block', fontSize: '13px', color: '#64748b' }}>
            {addresses.length === 0
              ? 'Aún no tienes direcciones registradas. Agrega tu primera dirección personal o comercial.'
              : 'No hay direcciones registradas en esta categoría.'}
          </span>
        </div>
      ) : (
        <>
          {dropdownAddresses.length > 1 && (
            <div className="buyer-address-principal-picker" style={{ marginBottom: '12px' }}>
              <label htmlFor="buyer-principal-address"><Star size={14} /> Dirección principal por defecto</label>
              <select
                id="buyer-principal-address"
                value={dropdownPrincipal?.id || ''}
                onChange={handlePrincipalChange}
                disabled={principalSaving}
              >
                {!dropdownPrincipal && <option value="">Selecciona una dirección</option>}
                {dropdownAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {(address.tipoDireccion || address.tipo) === 'DESPACHO' ? '[Comercial] ' : '[Personal] '}
                    {address.calleYNumero} · {address.comunaNombre}
                  </option>
                ))}
              </select>
              <small>Se usará por defecto para cotizaciones y pedidos.</small>
            </div>
          )}

          <ul className="buyer-address-list">
            {displayAddresses.map((address) => {
              const isPrincipal = address.esPrincipal || String(address.id) === String(principalAddress?.id);
              const isDespacho = (address.tipoDireccion || address.tipo) === 'DESPACHO';
              const isLastDespacho = isDespacho && despachoCount <= 1;
              return (
                <li key={address.id} className={isPrincipal ? 'is-principal' : ''} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '12px', border: isPrincipal ? '1.5px solid #3b82f6' : '1px solid #e2e8f0', background: '#fff', marginBottom: '8px' }}>
                  <span className="buyer-address-icon" style={{ background: isDespacho ? '#eff6ff' : '#ecfdf5', color: isDespacho ? '#2563eb' : '#059669', padding: '8px', borderRadius: '10px', display: 'grid', placeItems: 'center' }}>
                    {isDespacho ? <Store size={18} /> : <User size={18} />}
                  </span>
                  <div className="buyer-address-copy" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{address.calleYNumero}</strong>
                      {isDespacho ? (
                        <button
                          type="button"
                          onClick={() => handleToggleType(address)}
                          disabled={isLastDespacho}
                          title={isLastDespacho
                            ? 'Debes tener al menos una dirección comercial de despacho. Agrega otra antes de cambiar esta.'
                            : 'Haz clic para cambiar a Dirección Personal'}
                          style={{
                            background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px',
                            cursor: isLastDespacho ? 'not-allowed' : 'pointer', opacity: isLastDespacho ? 0.7 : 1
                          }}
                        >
                          <Store size={10} /> Comercial / Despacho{isLastDespacho ? ' (mínima)' : ''}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleType(address)}
                          title="Haz clic para cambiar a Dirección Comercial"
                          style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}
                        >
                          <User size={10} /> Personal (Representante)
                        </button>
                      )}
                      {isPrincipal && (
                        <span className="buyer-address-principal-badge" style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Star size={10} fill="currentColor" /> Principal
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '12.5px', color: '#64748b' }}>{[address.comunaNombre, address.regionNombre].filter(Boolean).join(', ')}</span>
                    {address.codigoPostal && <span className="buyer-address-zip" style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Código postal: {address.codigoPostal}</span>}
                  </div>
                  <div className="buyer-address-actions" style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" onClick={() => openEditForm(address)} title="Editar dirección" style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', color: '#475569' }}>
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(address)}
                      disabled={deletingId === address.id || isLastDespacho}
                      title={isLastDespacho ? 'No puedes eliminar tu única dirección comercial de despacho' : 'Eliminar dirección'}
                      style={{
                        padding: '6px 8px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fff1f2', color: '#e11d48',
                        cursor: isLastDespacho ? 'not-allowed' : 'pointer', opacity: isLastDespacho ? 0.5 : 1
                      }}
                    >
                      {deletingId === address.id ? <Loader2 size={14} className="spin-icon" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {formOpen && (
        <div className="buyer-address-form-backdrop" onClick={closeForm}>
          <div className="buyer-address-form" onClick={(e) => e.stopPropagation()}>
            <div className="buyer-address-form-header">
              <h4>{editingId ? 'Editar dirección' : 'Nueva dirección'}</h4>
              <button type="button" onClick={closeForm} aria-label="Cerrar"><X size={18} /></button>
            </div>

            {formError && <div className="auth-alert alert-error" style={{ margin: '0 0 12px' }}><X size={16} /><span>{formError}</span></div>}

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Tipo de Dirección</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setForm((curr) => ({ ...curr, tipoDireccion: 'PERSONAL' }))}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: form.tipoDireccion === 'PERSONAL' ? '2px solid #059669' : '1px solid #cbd5e1',
                    background: form.tipoDireccion === 'PERSONAL' ? '#ecfdf5' : '#fff',
                    color: form.tipoDireccion === 'PERSONAL' ? '#047857' : '#475569',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <User size={14} /> Personal (Representante)
                </button>
                <button
                  type="button"
                  onClick={() => setForm((curr) => ({ ...curr, tipoDireccion: 'DESPACHO' }))}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: form.tipoDireccion === 'DESPACHO' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: form.tipoDireccion === 'DESPACHO' ? '#eff6ff' : '#fff',
                    color: form.tipoDireccion === 'DESPACHO' ? '#1d4ed8' : '#475569',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Store size={14} /> Comercial / Despacho
                </button>
              </div>
            </div>

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
              <button type="button" className="btn-auth-primary" onClick={handleSubmit} disabled={saving} style={{ width: 'auto' }}>
                {saving ? <Loader2 size={16} className="spin-icon" /> : <Check size={16} />}
                {saving ? 'Guardando...' : 'Guardar dirección'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
