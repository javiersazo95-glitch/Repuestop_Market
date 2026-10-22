import React, { useState } from 'react';
import { X, Upload, Trash2, AlertCircle, Clock, ShieldCheck, Car } from 'lucide-react';
import { lookupVehicleByPlate } from '../utils/vehicleLookup';
import { searchVehicleByPatenteApi } from '../services/api';
import { createAuction, uploadAuctionPhoto } from '../services/auctionApi';
import '../styles/auctions.css';

export default function CreateAuctionModal({ isOpen, onClose, onSuccess }) {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [lookingUpPlate, setLookingUpPlate] = useState(false);
  const [error, setError] = useState(null);

  // Campos del formulario con límites de negocio
  const [patente, setPatente] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [version, setVersion] = useState('');
  const [motor, setMotor] = useState('');
  const [chasis, setChasis] = useState('');

  const [repuestoSolicitado, setRepuestoSolicitado] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [tiempoVigenciaHoras, setTiempoVigenciaHoras] = useState(48);
  const [tiempoMaximoEnvio, setTiempoMaximoEnvio] = useState('24 horas');
  const [tipoEnvio, setTipoEnvio] = useState('Cualquiera (Retiro o Despacho)');
  const [presupuestoMaximo, setPresupuestoMaximo] = useState('');
  const [region, setRegion] = useState('');
  const [comuna, setComuna] = useState('');

  const [fotos, setFotos] = useState([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Consulta automática por patente chilena
  const handleLookupPlate = async (plateValue) => {
    const clean = (plateValue || patente).trim().toUpperCase();
    if (!clean || clean.length < 5) return;
    setLookingUpPlate(true);
    setError(null);
    try {
      const data = await lookupVehicleByPlate(clean, { searchVehicleByPatenteApi });
      if (data) {
        if (data.marca) setMarca(data.marca);
        if (data.modelo) setModelo(data.modelo);
        if (data.anio) setAnio(String(data.anio));
        if (data.version) setVersion(data.version);
        if (data.motor) setMotor(data.motor);
        if (data.chasis) setChasis(data.chasis);
      }
    } catch (err) {
      console.warn('Error en consulta de patente:', err);
    } finally {
      setLookingUpPlate(false);
    }
  };

  // Manejo de fotos
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
        if (res && res.url) {
          setFotos((prev) => [...prev, res.url]);
        }
      }
    } catch (err) {
      setError('Error al subir una o más imágenes. Inténtalo de nuevo.');
    } finally {
      setUploadingFoto(false);
      e.target.value = '';
    }
  };

  const removeFoto = (index) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Enviar formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patente.trim()) {
      setError('La patente de tu vehículo es obligatoria.');
      return;
    }
    if (!repuestoSolicitado.trim()) {
      setError('Indica qué repuesto estás buscando.');
      return;
    }
    if (!tiempoMaximoEnvio) {
      setError('Selecciona el tiempo máximo de envío.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      patente: patente.trim().toUpperCase(),
      marca: marca.trim() || undefined,
      modelo: modelo.trim() || undefined,
      anio: anio ? parseInt(anio, 10) : undefined,
      version: version.trim() || undefined,
      motor: motor.trim() || undefined,
      chasis: chasis.trim() || undefined,
      repuestoSolicitado: repuestoSolicitado.trim(),
      descripcion: descripcion.trim() || undefined,
      cantidad: parseInt(cantidad, 10) || 1,
      tiempoVigenciaHoras: parseInt(tiempoVigenciaHoras, 10) || 48,
      tiempoMaximoEnvio,
      tipoEnvio,
      presupuestoMaximo: presupuestoMaximo ? parseFloat(presupuestoMaximo) : undefined,
      region: region.trim() || undefined,
      comuna: comuna.trim() || undefined,
      fotos,
    };

    try {
      const creada = await createAuction(payload);
      if (onSuccess) onSuccess(creada);
      onClose();
    } catch (err) {
      setError(err?.message || 'Hubo un error al publicar la necesidad de compra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auction-modal-overlay">
      <div className="auction-modal-card">
        {/* Cabecera */}
        <div className="auction-modal-header" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#38bdf8', fontWeight: 800 }}>
              Bolsa de Subastas RepuesTop
            </div>
            <h2 className="auction-modal-title" style={{ color: '#ffffff', marginTop: '2px' }}>
              Publicar Necesidad de Compra
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="auction-modal-close-btn"
            style={{ color: '#cbd5e1' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="auction-modal-body">
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '10px', color: '#b91c1c', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Sección 1: Vehículo */}
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: 'var(--auc-navy)', marginBottom: '12px' }}>
              <Car size={18} style={{ color: 'var(--auc-primary)' }} />
              <span>Datos del Vehículo</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Patente Chilena *</span>
                  <span className="auction-form-charcount">{patente.length}/12</span>
                </label>
                <input
                  type="text"
                  value={patente}
                  maxLength={12}
                  onChange={(e) => setPatente(e.target.value.toUpperCase())}
                  onBlur={() => handleLookupPlate()}
                  placeholder="Ej: ABCD12"
                  className="auction-form-input"
                  style={{ fontFamily: 'monospace', fontWeight: 700 }}
                  required
                />
                {lookingUpPlate && (
                  <span style={{ fontSize: '11px', color: 'var(--auc-primary)', marginTop: '2px' }}>
                    Consultando patente...
                  </span>
                )}
              </div>

              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Marca</span>
                  <span className="auction-form-charcount">{marca.length}/100</span>
                </label>
                <input
                  type="text"
                  value={marca}
                  maxLength={100}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Ej: Toyota"
                  className="auction-form-input"
                />
              </div>

              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Modelo</span>
                  <span className="auction-form-charcount">{modelo.length}/100</span>
                </label>
                <input
                  type="text"
                  value={modelo}
                  maxLength={100}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ej: Yaris"
                  className="auction-form-input"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Año</span>
                  <span className="auction-form-charcount">4 dígitos</span>
                </label>
                <input
                  type="number"
                  value={anio}
                  maxLength={4}
                  onChange={(e) => setAnio(e.target.value)}
                  placeholder="Ej: 2018"
                  className="auction-form-input"
                />
              </div>

              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Motor / Cilindrada</span>
                  <span className="auction-form-charcount">{motor.length}/100</span>
                </label>
                <input
                  type="text"
                  value={motor}
                  maxLength={100}
                  onChange={(e) => setMotor(e.target.value)}
                  placeholder="Ej: 1.5 Dual VVT-i"
                  className="auction-form-input"
                />
              </div>

              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Chasis / VIN</span>
                  <span className="auction-form-charcount">{chasis.length}/40</span>
                </label>
                <input
                  type="text"
                  value={chasis}
                  maxLength={40}
                  onChange={(e) => setChasis(e.target.value.toUpperCase())}
                  placeholder="Opcional"
                  className="auction-form-input"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Repuesto Requerido */}
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: 'var(--auc-navy)', marginBottom: '12px' }}>
              <ShieldCheck size={18} style={{ color: 'var(--auc-primary)' }} />
              <span>¿Qué repuesto necesitas?</span>
            </div>

            <div className="auction-form-group" style={{ marginBottom: '12px' }}>
              <label className="auction-form-label">
                <span>Repuesto Solicitado *</span>
                <span className="auction-form-charcount">{repuestoSolicitado.length}/180</span>
              </label>
              <input
                type="text"
                value={repuestoSolicitado}
                maxLength={180}
                onChange={(e) => setRepuestoSolicitado(e.target.value)}
                placeholder="Ej: Bomba de agua con empaquetadura"
                className="auction-form-input"
                required
              />
            </div>

            <div className="auction-form-group" style={{ marginBottom: '14px' }}>
              <label className="auction-form-label">
                <span>Descripción de la necesidad o falla</span>
                <span className="auction-form-charcount">{descripcion.length}/1000</span>
              </label>
              <textarea
                value={descripcion}
                maxLength={1000}
                rows={3}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe el síntoma de la falla, lado (izq/der), detalles específicos..."
                className="auction-form-textarea"
              />
            </div>

            {/* Fotografías */}
            <div className="auction-form-group">
              <label className="auction-form-label">
                <span>Fotografías de muestra o falla (Hasta 5 fotos)</span>
                <span className="auction-form-charcount">{fotos.length}/5</span>
              </label>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                {fotos.map((url, idx) => (
                  <div key={idx} className="auction-photo-thumb-wrap">
                    <img src={url} alt={`Foto ${idx + 1}`} />
                    <button
                      type="button"
                      onClick={() => removeFoto(idx)}
                      className="auction-photo-remove-btn"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {fotos.length < 5 && (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px', border: '2px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', background: '#f8fafc' }}>
                    <Upload size={18} style={{ color: '#64748b' }} />
                    <span style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Subir</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      disabled={uploadingFoto}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
              {uploadingFoto && <span style={{ fontSize: '12px', color: 'var(--auc-primary)', marginTop: '4px' }}>Subiendo imagen...</span>}
            </div>
          </div>

          {/* Sección 3: Condiciones y Tiempos */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: 'var(--auc-navy)', marginBottom: '12px' }}>
              <Clock size={18} style={{ color: 'var(--auc-primary)' }} />
              <span>Condiciones de Compra y Subasta</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Cantidad *</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="auction-form-input"
                  required
                />
              </div>

              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Vigencia para Ofertas</span>
                </label>
                <select
                  value={tiempoVigenciaHoras}
                  onChange={(e) => setTiempoVigenciaHoras(e.target.value)}
                  className="auction-form-select"
                >
                  <option value={24}>24 horas (Urgente)</option>
                  <option value={48}>48 horas (Recomendado)</option>
                  <option value={72}>72 horas (3 días)</option>
                  <option value={120}>5 días</option>
                  <option value={168}>7 días</option>
                </select>
              </div>

              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Presupuesto Máximo (Opcional)</span>
                  <span className="auction-form-charcount">{presupuestoMaximo.length}/12</span>
                </label>
                <input
                  type="number"
                  value={presupuestoMaximo}
                  maxLength={12}
                  onChange={(e) => setPresupuestoMaximo(e.target.value)}
                  placeholder="Ej: 50000"
                  className="auction-form-input"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Plazo Máx. Envío *</span>
                </label>
                <select
                  value={tiempoMaximoEnvio}
                  onChange={(e) => setTiempoMaximoEnvio(e.target.value)}
                  className="auction-form-select"
                >
                  <option value="Mismo día / Inmediato">Mismo día / Inmediato</option>
                  <option value="24 horas">24 horas</option>
                  <option value="48 horas">48 horas</option>
                  <option value="3 a 5 días hábiles">3 a 5 días hábiles</option>
                  <option value="A convenir">A convenir</option>
                </select>
              </div>

              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Tipo de Envío *</span>
                </label>
                <select
                  value={tipoEnvio}
                  onChange={(e) => setTipoEnvio(e.target.value)}
                  className="auction-form-select"
                >
                  <option value="Cualquiera (Retiro o Despacho)">Cualquiera (Retiro o Despacho)</option>
                  <option value="Retiro en Tienda">Retiro en Tienda</option>
                  <option value="Despacho a Domicilio">Despacho a Domicilio</option>
                  <option value="Envío a Regiones (Courier)">Envío a Regiones (Courier)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Footer de Acciones */}
          <div className="auction-modal-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="auction-btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="auction-btn-primary"
            >
              {loading ? 'Publicando...' : 'Publicar Necesidad de Compra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
