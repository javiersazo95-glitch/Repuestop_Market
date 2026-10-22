import React, { useState, useEffect } from 'react';
import { X, Package, PlusCircle, Search, AlertCircle, DollarSign, Upload } from 'lucide-react';
import { submitAuctionQuote, uploadAuctionPhoto } from '../services/auctionApi';
import { fetchApi } from '../services/api';
import '../styles/auctions.css';

export default function AuctionQuoteModal({ isOpen, onClose, auction, myQuote, sellerId, onSuccess }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('existing'); // 'existing' | 'new'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Inventario existente
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Nuevo producto al vuelo
  const [nuevoNombre, setNuevoNombre] = useState(auction?.repuestoSolicitado || '');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [nuevoStock, setNuevoStock] = useState(1);
  const [nuevaMarca, setNuevaMarca] = useState('');
  const [nuevoOem, setNuevoOem] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
  const [nuevaFotoUrl, setNuevaFotoUrl] = useState('');
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Condiciones de la cotización
  const [precio, setPrecio] = useState(myQuote?.precio ? String(myQuote.precio) : '');
  const [cantidad, setCantidad] = useState(auction?.cantidad || 1);
  const [tiempoEntrega, setTiempoEntrega] = useState(myQuote?.tiempoEntrega || '24 horas');
  const [tipoEntrega, setTipoEntrega] = useState(myQuote?.tipoEntrega || 'Despacho a Domicilio');
  const [garantia, setGarantia] = useState(myQuote?.garantia || '6 meses (garantía legal)');
  const [vigencia, setVigencia] = useState(myQuote?.vigencia || '48 horas');
  const [notas, setNotas] = useState(myQuote?.notas || '');

  // Cargar inventario del vendedor (endpoint sin prefijo duplicado)
  useEffect(() => {
    if (sellerId && activeTab === 'existing') {
      setLoadingInventory(true);
      fetchApi(`/proveedores/${sellerId}/inventario`)
        .then((data) => {
          const list = Array.isArray(data) ? data : (data?.content || []);
          setInventory(list);
        })
        .catch((err) => {
          console.warn('Error cargando inventario:', err);
        })
        .finally(() => setLoadingInventory(false));
    }
  }, [sellerId, activeTab]);

  const filteredInventory = inventory.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const title = (item.nombrePublicado || item.repuesto?.nombre || '').toLowerCase();
    const oem = (item.referenciaOem || '').toLowerCase();
    return title.includes(q) || oem.includes(q);
  });

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    if (product.precio && !precio) {
      setPrecio(String(product.precio));
    }
    if (product.garantia && !garantia) {
      setGarantia(product.garantia);
    }
  };

  const handleUploadFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const res = await uploadAuctionPhoto(file);
      if (res && res.url) {
        setNuevaFotoUrl(res.url);
      }
    } catch (err) {
      setError('Error al subir la fotografía del producto.');
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!precio || parseFloat(precio) <= 0) {
      setError('Ingresa un precio cotizado válido.');
      return;
    }
    if (!tiempoEntrega) {
      setError('Indica el tiempo estimado de entrega.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      precio: parseFloat(precio),
      precioFinal: parseFloat(precio),
      cantidad: parseInt(cantidad, 10) || 1,
      tiempoEntrega,
      tipoEntrega,
      garantia,
      vigencia,
      notas: notas.trim() || undefined,
    };

    if (activeTab === 'existing') {
      if (selectedProduct) {
        payload.proveedorProductoId = selectedProduct.id;
      }
    } else {
      payload.nuevoProductoNombre = nuevoNombre.trim();
      payload.nuevoProductoPrecio = nuevoPrecio ? parseFloat(nuevoPrecio) : parseFloat(precio);
      payload.nuevoProductoStock = parseInt(nuevoStock, 10) || 1;
      payload.nuevoProductoMarca = nuevaMarca.trim() || undefined;
      payload.nuevoProductoOem = nuevoOem.trim() || undefined;
      payload.nuevoProductoDescripcion = nuevaDescripcion.trim() || undefined;
      payload.nuevoProductoFotoUrl = nuevaFotoUrl || undefined;
    }

    try {
      const res = await submitAuctionQuote(auction.id, payload);
      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      setError(err?.message || 'Error al enviar la cotización.');
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
              Emitir Cotización a Subasta
            </div>
            <h2 className="auction-modal-title" style={{ color: '#ffffff', marginTop: '2px' }}>
              {auction?.repuestoSolicitado}
            </h2>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Para {auction?.marca} {auction?.modelo} {auction?.anio ? `(${auction.anio})` : ''} · {auction?.patenteAnonimizada || 'Vehículo'}
            </div>
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

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 24px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('existing')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '14px 16px',
              borderBottom: activeTab === 'existing' ? '3px solid var(--auc-primary)' : '3px solid transparent',
              color: activeTab === 'existing' ? 'var(--auc-primary)' : '#64748b',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
            }}
          >
            <Package size={16} />
            <span>Vincular de mi catálogo existente</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('new')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '14px 16px',
              borderBottom: activeTab === 'new' ? '3px solid var(--auc-primary)' : '3px solid transparent',
              color: activeTab === 'new' ? 'var(--auc-primary)' : '#64748b',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
            }}
          >
            <PlusCircle size={16} />
            <span>Publicar nuevo repuesto en catálogo</span>
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

          {/* Tab 1: Existente */}
          {activeTab === 'existing' && (
            <div className="auction-form-group">
              <label className="auction-form-label">
                <span>Buscar producto en tu inventario</span>
              </label>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o código OEM..."
                  className="auction-form-input"
                  style={{ paddingLeft: '38px' }}
                />
              </div>

              {loadingInventory ? (
                <div style={{ textAlign: 'center', padding: '24px', fontSize: '13px', color: '#64748b' }}>
                  Cargando productos de tu inventario...
                </div>
              ) : filteredInventory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', fontSize: '13px', color: '#64748b', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  No se encontraron productos coincidentes. Puedes usar la pestaña "Publicar nuevo repuesto" para darlo de alta en tu tienda.
                </div>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {filteredInventory.slice(0, 10).map((prod) => {
                    const isSelected = selectedProduct?.id === prod.id;
                    return (
                      <div
                        key={prod.id}
                        onClick={() => handleSelectProduct(prod)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid var(--auc-primary)' : '1px solid #f1f5f9',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '12px' }}>
                          <strong style={{ display: 'block', fontSize: '13px', color: 'var(--auc-navy)' }}>
                            {prod.nombrePublicado || prod.repuesto?.nombre}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            Stock: {prod.stock || 0} un. · OEM: {prod.referenciaOem || 'N/A'}
                          </span>
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--auc-primary)', fontSize: '14px', flexShrink: 0 }}>
                          ${new Intl.NumberFormat('es-CL').format(prod.precio || 0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Nuevo Producto */}
          {activeTab === 'new' && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--auc-primary)', fontWeight: 600 }}>
                💡 Este producto se publicará en tu catálogo de RepuesTop para la venta general y se vinculará a esta cotización.
              </div>

              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Nombre del Repuesto *</span>
                  <span className="auction-form-charcount">{nuevoNombre.length}/180</span>
                </label>
                <input
                  type="text"
                  value={nuevoNombre}
                  maxLength={180}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Bomba de agua Toyota Yaris 2018"
                  className="auction-form-input"
                  required={activeTab === 'new'}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="auction-form-group">
                  <label className="auction-form-label">
                    <span>Marca del Repuesto</span>
                    <span className="auction-form-charcount">{nuevaMarca.length}/100</span>
                  </label>
                  <input
                    type="text"
                    value={nuevaMarca}
                    maxLength={100}
                    onChange={(e) => setNuevaMarca(e.target.value)}
                    placeholder="Ej: Aisin / Original"
                    className="auction-form-input"
                  />
                </div>

                <div className="auction-form-group">
                  <label className="auction-form-label">
                    <span>Código OEM / Referencia</span>
                    <span className="auction-form-charcount">{nuevoOem.length}/100</span>
                  </label>
                  <input
                    type="text"
                    value={nuevoOem}
                    maxLength={100}
                    onChange={(e) => setNuevoOem(e.target.value)}
                    placeholder="Ej: 16100-29155"
                    className="auction-form-input"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="auction-form-group">
                  <label className="auction-form-label">
                    <span>Stock Disponible</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={nuevoStock}
                    onChange={(e) => setNuevoStock(e.target.value)}
                    className="auction-form-input"
                  />
                </div>

                <div className="auction-form-group">
                  <label className="auction-form-label">
                    <span>Foto del Producto</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {nuevaFotoUrl && (
                      <img src={nuevaFotoUrl} alt="Preview" style={{ width: '38px', height: '38px', borderRadius: '6px', objectFit: 'cover' }} />
                    )}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', background: '#ffffff' }}>
                      <Upload size={14} />
                      <span>{uploadingFoto ? 'Subiendo...' : 'Subir imagen'}</span>
                      <input type="file" accept="image/*" onChange={handleUploadFoto} disabled={uploadingFoto} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Condiciones de la Cotización */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: 'var(--auc-navy)', marginBottom: '12px' }}>
              <DollarSign size={18} style={{ color: '#059669' }} />
              <span>Condiciones de tu Oferta</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Precio Cotizado Final (CLP) *</span>
                  <span className="auction-form-charcount">{precio.length}/12</span>
                </label>
                <input
                  type="number"
                  value={precio}
                  maxLength={12}
                  onChange={(e) => setPrecio(e.target.value)}
                  placeholder="Ej: 45000"
                  className="auction-form-input"
                  style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}
                  required
                />
              </div>

              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Plazo de Entrega *</span>
                </label>
                <select
                  value={tiempoEntrega}
                  onChange={(e) => setTiempoEntrega(e.target.value)}
                  className="auction-form-select"
                >
                  <option value="Mismo día / Retiro inmediato">Mismo día / Retiro inmediato</option>
                  <option value="24 horas">24 horas</option>
                  <option value="48 horas">48 horas</option>
                  <option value="3 a 5 días hábiles">3 a 5 días hábiles</option>
                  <option value="A coordinar con cliente">A coordinar con cliente</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Tipo de Entrega</span>
                </label>
                <select
                  value={tipoEntrega}
                  onChange={(e) => setTipoEntrega(e.target.value)}
                  className="auction-form-select"
                >
                  <option value="Despacho a Domicilio">Despacho a Domicilio</option>
                  <option value="Retiro en Tienda">Retiro en Tienda</option>
                  <option value="Envío por Starken / Chilexpress">Envío por Starken / Chilexpress</option>
                  <option value="Cualquiera (A coordinar)">Cualquiera (A coordinar)</option>
                </select>
              </div>

              <div className="auction-form-group">
                <label className="auction-form-label">
                  <span>Garantía Ofrecida</span>
                  <span className="auction-form-charcount">{garantia.length}/100</span>
                </label>
                <input
                  type="text"
                  value={garantia}
                  maxLength={100}
                  onChange={(e) => setGarantia(e.target.value)}
                  placeholder="Ej: 6 meses (garantía legal)"
                  className="auction-form-input"
                />
              </div>
            </div>

            <div className="auction-form-group">
              <label className="auction-form-label">
                <span>Mensaje / Observaciones para el Comprador</span>
                <span className="auction-form-charcount">{notas.length}/500</span>
              </label>
              <textarea
                value={notas}
                maxLength={500}
                rows={2}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Especifica si el repuesto es alternativo u original, si incluye empaquetaduras, condiciones particulares..."
                className="auction-form-textarea"
              />
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
              {loading ? 'Enviando...' : myQuote ? 'Actualizar Cotización' : 'Enviar Cotización'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
