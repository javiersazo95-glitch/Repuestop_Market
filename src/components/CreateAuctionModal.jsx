import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Upload, Trash2, AlertCircle, CheckCircle2, Clock, Plus, ShieldCheck, Car, Package,
} from 'lucide-react';
import { normalizePlate } from '../utils/vehicleLookup';
import usePlateLookup, { maskPlate } from '../utils/usePlateLookup';
import { createAuction, updateAuction, uploadAuctionPhoto } from '../services/auctionApi';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../data/categories';
import '../styles/auctions.css';
import '../styles/auction-vehicle.css';

const MAX_ITEMS = 20;
let itemSeq = 0;
const newItem = () => ({ key: `item-${++itemSeq}`, nombre: '', categoria: '', cantidad: 1, descripcion: '', otroVehiculo: false, patente: '' });

/** Tarjeta del vehículo identificado por patente (marca, modelo, año y chasis). */
function VehicleSummary({ vehicle, note }) {
  return (
    <div className="acv-vehicle">
      <div className="acv-vehicle-head"><CheckCircle2 size={16} /> Vehículo identificado</div>
      <dl>
        {[['Marca', vehicle.marca], ['Modelo', vehicle.modelo], ['Año', vehicle.anio || ''], ['Versión', vehicle.version]]
          .filter(([, value]) => value).map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        <div className="is-chasis"><dt>Chasis / VIN</dt><dd>{vehicle.chasis}</dd></div>
      </dl>
      {note && <small>{note}</small>}
    </div>
  );
}

/** Un repuesto del pedido: nombre, cantidad, categoría y, si va para otro auto, su propia patente. */
function ItemEditor({ item, index, canRemove, categories, onChange, onRemove, onVehicle }) {
  const { vehicle, error, looking } = usePlateLookup(item.otroVehiculo ? item.patente : '', { subject: 'el pedido' });

  useEffect(() => { onVehicle(item.key, vehicle); }, [vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <fieldset className="acv-item">
      <legend><Package size={15} /> Repuesto {index + 1}</legend>
      {canRemove && (
        <button type="button" className="acv-item-remove" onClick={() => onRemove(item.key)} aria-label={`Quitar el repuesto ${index + 1}`}>
          <Trash2 size={14} /> Quitar
        </button>
      )}

      <div className="acv-item-grid">
        <label className="acv-field acv-field-wide">
          <span>Repuesto *</span>
          <input
            type="text"
            value={item.nombre}
            maxLength={180}
            onChange={(e) => onChange(item.key, { nombre: e.target.value })}
            placeholder="Ej: Bomba de agua con empaquetadura"
            required
          />
        </label>
        <label className="acv-field">
          <span>Cantidad *</span>
          <input type="number" min="1" max="999" value={item.cantidad} onChange={(e) => onChange(item.key, { cantidad: e.target.value })} required />
        </label>
        <label className="acv-field">
          <span>Categoría *</span>
          <select value={item.categoria} onChange={(e) => onChange(item.key, { categoria: e.target.value })} required>
            <option value="">Selecciona…</option>
            {categories.map((cat) => <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>)}
          </select>
        </label>
        <label className="acv-field acv-field-wide">
          <span>Detalle o falla <small>Opcional</small></span>
          <textarea
            rows={2}
            value={item.descripcion}
            maxLength={1000}
            onChange={(e) => onChange(item.key, { descripcion: e.target.value })}
            placeholder="Lado (izq/der), síntoma, medidas, referencia…"
          />
        </label>
      </div>

      <label className="acv-other-vehicle">
        <input
          type="checkbox"
          checked={item.otroVehiculo}
          onChange={(e) => onChange(item.key, { otroVehiculo: e.target.checked, patente: e.target.checked ? item.patente : '' })}
        />
        <span><strong>Este repuesto es para otro vehículo</strong><small>Si no, se usa el vehículo del pedido.</small></span>
      </label>

      {item.otroVehiculo && (
        <div className="acv-item-vehicle">
          {vehicle ? (
            <>
              <div className="acv-plate is-confirmed">
                <span className="acv-plate-label">Patente</span>
                <strong className="acv-plate-value">{maskPlate(item.patente)}</strong>
                <button type="button" className="acv-plate-change" onClick={() => onChange(item.key, { patente: '' })}>Cambiar patente</button>
              </div>
              <VehicleSummary vehicle={vehicle} />
            </>
          ) : (
            <div className="acv-plate">
              <label className="acv-plate-label" htmlFor={`plate-${item.key}`}>Patente de ese vehículo *</label>
              <input
                id={`plate-${item.key}`}
                type="text"
                value={item.patente}
                maxLength={8}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => onChange(item.key, { patente: e.target.value.toUpperCase().replace(/[^A-Z0-9-\s]/g, '') })}
                placeholder="ABCD12"
                className="acv-plate-input is-compact"
              />
              <small className="acv-plate-hint">{looking ? 'Consultando patente…' : 'Obtenemos su marca, modelo, año y chasis.'}</small>
            </div>
          )}
          {error && <p className="acv-error" role="alert"><AlertCircle size={15} /> {error}</p>}
        </div>
      )}
    </fieldset>
  );
}

/** Un pedido ya publicado vuelve a ser el formulario: cada repuesto conserva su nombre, categoría, mensaje y patente. */
function itemsFromAuction(auction) {
  const list = (auction?.items || []).map((item) => ({
    ...newItem(),
    nombre: item.repuesto || '',
    categoria: item.categoria || '',
    cantidad: item.cantidad || 1,
    descripcion: item.descripcion || '',
    otroVehiculo: Boolean(item.vehiculoPropio),
    patente: item.patente || '',
  }));
  return list.length ? list : [newItem()];
}

function CreateAuctionModalContent({ onClose, onSuccess, auction = null }) {
  const isEditing = Boolean(auction);
  const { user } = useAuth();
  const { HEADER_CATEGORIES } = useCategories();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [patente, setPatente] = useState(() => auction?.patente || '');
  const { vehicle, error: plateError, looking: lookingUpPlate } = usePlateLookup(patente);

  const [items, setItems] = useState(() => (auction ? itemsFromAuction(auction) : [newItem()]));
  const [itemVehicles, setItemVehicles] = useState({});

  const [tiempoVigenciaHoras, setTiempoVigenciaHoras] = useState(() => auction?.tiempoVigenciaHoras || 48);
  const [tiempoMaximoEnvio, setTiempoMaximoEnvio] = useState(() => auction?.tiempoMaximoEnvio || '24 horas');
  const [tipoEnvio, setTipoEnvio] = useState(() => auction?.tipoEnvio || 'Cualquiera (Retiro o Despacho)');
  const [presupuestoMaximo, setPresupuestoMaximo] = useState(() => (auction?.presupuestoMaximo ? String(Math.round(auction.presupuestoMaximo)) : ''));

  const [fotos, setFotos] = useState(() => auction?.fotos || []);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const changeItem = (key, patch) => setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const removeItem = (key) => setItems((current) => current.filter((item) => item.key !== key));
  const registerVehicle = (key, found) => setItemVehicles((current) => (current[key] === found ? current : { ...current, [key]: found }));
  const addItem = () => setItems((current) => (current.length >= MAX_ITEMS ? current : [...current, newItem()]));

  const totalUnits = useMemo(() => items.reduce((sum, item) => sum + (parseInt(item.cantidad, 10) || 0), 0), [items]);
  const itemsMissingVehicle = items.filter((item) => item.otroVehiculo && !itemVehicles[item.key]);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (fotos.length + files.length > 5) {
      setError('Puedes subir un máximo de 5 fotografías.');
      return;
    }
    setUploadingFoto(true);
    setError(null);
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          setError('Cada fotografía no puede pesar más de 5 MB.');
          continue;
        }
        const res = await uploadAuctionPhoto(file);
        if (res && res.url) setFotos((prev) => [...prev, res.url]);
      }
    } catch (err) {
      setError('Error al subir una o más imágenes. Inténtalo de nuevo.');
    } finally {
      setUploadingFoto(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicle?.chasis) {
      setError('Ingresa la patente de tu vehículo: la usamos para obtener sus datos y su chasis.');
      return;
    }
    const blank = items.findIndex((item) => !item.nombre.trim());
    if (blank >= 0) {
      setError(`Indica el nombre del repuesto ${blank + 1}.`);
      return;
    }
    const noCategory = items.findIndex((item) => !item.categoria);
    if (noCategory >= 0) {
      setError(`Selecciona la categoría del repuesto ${noCategory + 1}.`);
      return;
    }
    if (itemsMissingVehicle.length > 0) {
      setError('Hay repuestos para otro vehículo sin patente identificada. Ingresa su patente o desmarca la opción.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      patente: normalizePlate(patente),
      marca: vehicle.marca || undefined,
      modelo: vehicle.modelo || undefined,
      anio: vehicle.anio || undefined,
      version: vehicle.version || undefined,
      chasis: vehicle.chasis,
      // El servidor arma el título del pedido a partir de los repuestos; estos campos son el respaldo.
      repuestoSolicitado: items[0].nombre.trim(),
      categoria: items[0].categoria,
      cantidad: totalUnits || 1,
      items: items.map((item) => ({
        repuestoSolicitado: item.nombre.trim(),
        categoria: item.categoria,
        descripcion: item.descripcion.trim() || undefined,
        cantidad: parseInt(item.cantidad, 10) || 1,
        patente: item.otroVehiculo ? normalizePlate(item.patente) : undefined,
      })),
      tiempoVigenciaHoras: parseInt(tiempoVigenciaHoras, 10) || 48,
      tiempoMaximoEnvio,
      tipoEnvio,
      presupuestoMaximo: presupuestoMaximo ? parseFloat(presupuestoMaximo) : undefined,
      region: user?.region || undefined,
      comuna: user?.comuna || undefined,
      fotos,
    };

    try {
      const creada = isEditing ? await updateAuction(auction.id, payload) : await createAuction(payload);
      if (onSuccess) onSuccess(creada);
      onClose();
    } catch (err) {
      setError(err?.message || (isEditing ? 'No pudimos guardar los cambios de tu pedido.' : 'Hubo un error al publicar la necesidad de compra.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auction-modal-overlay">
      <div className="auction-modal-card">
        <div className="auction-modal-header" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#38bdf8', fontWeight: 800 }}>
              Necesidades de compra RepuesTop
            </div>
            <h2 className="auction-modal-title" style={{ color: '#ffffff', marginTop: '2px' }}>{isEditing ? 'Editar pedido de repuestos' : 'Publicar pedido de repuestos'}</h2>
          </div>
          <button type="button" onClick={onClose} className="auction-modal-close-btn" style={{ color: '#cbd5e1' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auction-modal-body">
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '10px', color: '#b91c1c', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Sección 1: Vehículo del pedido — la patente es el único dato */}
          <div className="acv-section">
            <div className="acv-title"><Car size={18} /><span>Vehículo del pedido</span></div>

            {vehicle ? (
              <div className="acv-plate is-confirmed">
                <span className="acv-plate-label">Patente</span>
                <strong className="acv-plate-value" aria-label="Patente parcialmente oculta">{maskPlate(patente)}</strong>
                <button type="button" className="acv-plate-change" onClick={() => setPatente('')}>Cambiar patente</button>
              </div>
            ) : (
              <div className="acv-plate">
                <label className="acv-plate-label" htmlFor="auction-plate">Patente del vehículo *</label>
                <input
                  id="auction-plate"
                  type="text"
                  value={patente}
                  maxLength={8}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  onChange={(e) => setPatente(e.target.value.toUpperCase().replace(/[^A-Z0-9-\s]/g, ''))}
                  placeholder="ABCD12"
                  className="acv-plate-input"
                  required
                />
                <small className="acv-plate-hint">
                  {lookingUpPlate ? 'Consultando patente…' : 'Con tu patente obtenemos la marca, el modelo, el año y el chasis.'}
                </small>
              </div>
            )}
            {plateError && <p className="acv-error" role="alert"><AlertCircle size={15} /> {plateError}</p>}
            {vehicle && (
              <VehicleSummary
                vehicle={vehicle}
                note="El chasis lo ven las tiendas para cotizar la pieza exacta; tu patente se muestra siempre parcialmente oculta."
              />
            )}
          </div>

          {/* Sección 2: Repuestos del pedido */}
          <div className="acv-section">
            <div className="acv-title">
              <ShieldCheck size={18} /><span>¿Qué repuestos necesitas?</span>
              <em className="acv-count">{items.length} {items.length === 1 ? 'repuesto' : 'repuestos'} · {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}</em>
            </div>
            <p className="acv-lead">Agrega todo lo que necesitas en un solo pedido. Cada tienda podrá ofrecer los repuestos que tenga y tú eliges qué aceptar de cada oferta.</p>

            <div className="acv-items">
              {items.map((item, index) => (
                <ItemEditor
                  key={item.key}
                  item={item}
                  index={index}
                  canRemove={items.length > 1}
                  categories={HEADER_CATEGORIES}
                  onChange={changeItem}
                  onRemove={removeItem}
                  onVehicle={registerVehicle}
                />
              ))}
            </div>

            <button type="button" className="acv-add-item" onClick={addItem} disabled={items.length >= MAX_ITEMS}>
              <Plus size={16} /> Agregar otro repuesto
            </button>

            {(user?.comuna || user?.region) && (
              <span className="acv-location">Ubicación del pedido: {[user.comuna, user.region].filter(Boolean).join(', ')}</span>
            )}

            <div className="auction-form-group" style={{ marginTop: '16px' }}>
              <label className="auction-form-label">
                <span>Fotografías de muestra o falla <em className="auction-optional">(Opcional · hasta 5 fotos)</em></span>
                <span className="auction-form-charcount">{fotos.length}/5</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                {fotos.map((url, idx) => (
                  <div key={idx} className="auction-photo-thumb-wrap">
                    <img src={url} alt={`Foto ${idx + 1}`} />
                    <button type="button" onClick={() => setFotos((prev) => prev.filter((_, i) => i !== idx))} className="auction-photo-remove-btn">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {fotos.length < 5 && (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px', border: '2px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', background: '#f8fafc' }}>
                    <Upload size={18} style={{ color: '#64748b' }} />
                    <span style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Subir</span>
                    <input type="file" accept="image/*" multiple onChange={handleFileChange} disabled={uploadingFoto} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
              {uploadingFoto && <span style={{ fontSize: '12px', color: 'var(--auc-primary)', marginTop: '4px' }}>Subiendo imagen...</span>}
            </div>
          </div>

          {/* Sección 3: Condiciones */}
          <div>
            <div className="acv-title"><Clock size={18} /><span>Condiciones de la necesidad de compra</span></div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div className="auction-form-group">
                <label className="auction-form-label"><span>Vigencia para ofertas</span></label>
                <select value={tiempoVigenciaHoras} onChange={(e) => setTiempoVigenciaHoras(e.target.value)} className="auction-form-select">
                  <option value={24}>24 horas (Urgente)</option>
                  <option value={48}>48 horas (Recomendado)</option>
                  <option value={72}>72 horas (3 días)</option>
                  <option value={120}>5 días</option>
                  <option value={168}>7 días</option>
                </select>
              </div>
              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Presupuesto máximo del pedido (opcional)</span>
                </label>
                <input
                  type="number"
                  value={presupuestoMaximo}
                  onChange={(e) => setPresupuestoMaximo(e.target.value)}
                  placeholder="Ej: 150000"
                  className="auction-form-input"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div className="auction-form-group">
                <label className="auction-form-label"><span>Plazo máx. de envío *</span></label>
                <select value={tiempoMaximoEnvio} onChange={(e) => setTiempoMaximoEnvio(e.target.value)} className="auction-form-select">
                  <option value="Mismo día / Inmediato">Mismo día / Inmediato</option>
                  <option value="24 horas">24 horas</option>
                  <option value="48 horas">48 horas</option>
                  <option value="3 a 5 días hábiles">3 a 5 días hábiles</option>
                  <option value="A convenir">A convenir</option>
                </select>
              </div>
              <div className="auction-form-group">
                <label className="auction-form-label"><span>Tipo de envío *</span></label>
                <select value={tipoEnvio} onChange={(e) => setTipoEnvio(e.target.value)} className="auction-form-select">
                  <option value="Cualquiera (Retiro o Despacho)">Cualquiera (Retiro o Despacho)</option>
                  <option value="Retiro en Tienda">Retiro en Tienda</option>
                  <option value="Despacho a Domicilio">Despacho a Domicilio</option>
                  <option value="Envío a Regiones (Courier)">Envío a Regiones (Courier)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="auction-modal-footer">
            <button type="button" onClick={onClose} disabled={loading} className="auction-btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading || !vehicle} className="auction-btn-primary">
              {loading ? (isEditing ? 'Guardando...' : 'Publicando...') : `${isEditing ? 'Guardar cambios' : 'Publicar pedido'} (${items.length} ${items.length === 1 ? 'repuesto' : 'repuestos'})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* El contenido tiene hooks: se monta solo con el modal abierto. */
export default function CreateAuctionModal(props) {
  if (!props.isOpen) return null;
  return <CreateAuctionModalContent {...props} />;
}
