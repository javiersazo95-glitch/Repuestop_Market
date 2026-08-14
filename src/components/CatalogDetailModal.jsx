import React, { useState, useEffect } from 'react';
import {
  X, Package, Save, Tag, Layers, CheckCircle2, DollarSign, ShieldCheck
} from 'lucide-react';
import { StockBadge } from './CatalogCard';
import { resolveMediaUrl } from '../services/api';

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

export default function CatalogDetailModal({
  product,
  onClose,
  onSaveProduct,
}) {
  const [priceDraft, setPriceDraft] = useState(product?.precio || 0);
  const [stockDraft, setStockDraft] = useState(product?.stock || 0);
  const [descriptionDraft, setDescriptionDraft] = useState(product?.descripcion || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    if (!product) return;
    setPriceDraft(product.precio || 0);
    setStockDraft(product.stock || 0);
    setDescriptionDraft(product.descripcion || '');
  }, [product]);

  if (!product) return null;

  const title = product.nombrePublicado || product.repuestoNombre || product.nombre || 'Repuesto sin título';
  const sku = product.sku || product.codigoSKU || 'SKU-000';
  const brand = product.marca || product.productBrand || 'Genérico';
  const category = product.categoriaNombre || product.category || 'Repuestos';
  const photos = product.imageUrls && product.imageUrls.length > 0
    ? product.imageUrls
    : [product.imagenUrl || product.photoUri || product.imagenes?.[0]?.url];
  const activePhoto = resolveMediaUrl(photos[0]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      if (onSaveProduct) {
        await onSaveProduct(product.id, {
          precio: Number(priceDraft),
          stock: Number(stockDraft),
          descripcion: descriptionDraft,
        });
      }
      setSaveMessage({ type: 'success', text: 'Producto actualizado con éxito.' });
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.message || 'No se pudo guardar la actualización.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="order-modal-backdrop" onClick={onClose}>
      <div className="order-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="order-modal-header">
          <div className="order-modal-title-group">
            <div className="order-modal-icon-badge">
              <Package size={22} />
            </div>
            <div>
              <h2>{title}</h2>
              <span className="order-modal-subtitle">
                SKU: {sku} · Categoría: {category}
              </span>
            </div>
          </div>
          <div className="order-modal-header-actions">
            <StockBadge stock={stockDraft} />
            <button type="button" className="btn-close-modal" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="order-modal-body">
          {saveMessage && (
            <div className={`auth-alert ${saveMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              <span>{saveMessage.text}</span>
            </div>
          )}

          <div className="order-details-grid">
            {/* Left Column: Product Media & Tech Specs */}
            <div className="details-card-block">
              <h3 className="section-subtitle">
                <Tag size={16} />
                <span>Vista del Producto</span>
              </h3>

              {activePhoto ? (
                <div className="catalog-modal-media">
                  <img src={activePhoto} alt={title} className="catalog-modal-img" />
                </div>
              ) : (
                <div className="catalog-modal-media-fallback">
                  <Package size={48} />
                  <span>Sin imagen cargada</span>
                </div>
              )}

              <div className="details-info-list" style={{ marginTop: '12px' }}>
                <div className="details-info-row">
                  <span className="info-label">Marca</span>
                  <strong className="info-value">{brand}</strong>
                </div>
                <div className="details-info-row">
                  <span className="info-label">Código SKU</span>
                  <strong className="info-value">{sku}</strong>
                </div>
                <div className="details-info-row">
                  <span className="info-label">Condición</span>
                  <strong className="info-value">{product.condicion || 'Nuevo en caja original'}</strong>
                </div>
              </div>
            </div>

            {/* Right Column: Manage Price & Stock */}
            <div className="details-card-block status-update-block">
              <h3 className="section-subtitle">
                <DollarSign size={16} />
                <span>Gestión de Precio y Inventario</span>
              </h3>

              <form onSubmit={handleSubmit} className="status-update-form">
                <div className="form-group">
                  <label className="form-label">Precio de Venta ($ CLP)</label>
                  <input
                    type="number"
                    className="status-select-input"
                    value={priceDraft}
                    onChange={(e) => setPriceDraft(e.target.value)}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Stock Disponible (Unidades)</label>
                  <input
                    type="number"
                    className="status-select-input"
                    value={stockDraft}
                    onChange={(e) => setStockDraft(e.target.value)}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción del Repuesto</label>
                  <textarea
                    className="status-select-input"
                    rows="3"
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    placeholder="Detalles sobre compatibilidad, años y observaciones..."
                  />
                </div>

                <button
                  type="submit"
                  className="btn-auth-primary btn-save-status"
                  disabled={isSaving}
                >
                  <Save size={15} />
                  <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="order-modal-footer">
          <button type="button" className="btn-auth-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
