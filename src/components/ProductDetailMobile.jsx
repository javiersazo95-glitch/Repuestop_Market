import React, { useState } from 'react';
import {
  BadgeCheck, Car, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CreditCard,
  Globe, Heart, Info, MapPin, Package, ShieldCheck, Star, Store, Truck,
} from 'lucide-react';

import ProductBrandMark from './ProductBrandMark';
import ProductPhoto from './ProductPhoto';
import ProductTopBadge from './ProductTopBadge';
import ShareLinkButton from './ShareLinkButton';
import StoreLogoBadge from './StoreLogoBadge';
import ContextualReportButton from './ContextualReportButton';
import { parseShippingMethods, resolveShippingService, shippingMethodPrice } from '../data/shippingMethods';
import { productPath } from '../routes/paths';

/**
 * Ficha del repuesto en el celular (≤768px), clonada del detalle de la app
 * móvil (mobile/app/product-detail.tsx del mono-repo): hero con galería,
 * badges, título, panel de métricas de 4 columnas (precio | calificación |
 * marca | stock), panel del vendedor, opciones de entrega, información del
 * repuesto en grilla de 2 columnas y descripción. Es presentacional: el estado
 * y los datos viven en ProductDetailPage, que en escritorio sigue mostrando el
 * layout de 3 columnas intacto.
 */
export default function ProductDetailMobile({
  product,
  images,
  activeImage,
  setActiveImage,
  onChangeImage,
  favorite,
  onToggleFavorite,
  isTopProduct,
  isBestSeller,
  condition,
  category,
  brandName,
  city,
  sellerName,
  stock,
  quoteOnly,
  isOwnProduct,
  compatible,
  activeVehicle,
  isUniversalPart,
  compatibilityCount,
  sellerRating,
  sellerReviews,
  descriptionText,
  descriptionIsLong,
  descriptionExpanded,
  onToggleDescription,
  onOpenCompatibility,
  onOpenBrandModal,
  onOpenStore,
}) {
  const shippingMethods = parseShippingMethods(product.metodosEnvio);
  const [selectedShipping, setSelectedShipping] = useState(0);
  const [specsOpen, setSpecsOpen] = useState(true);
  const [paymentsOpen, setPaymentsOpen] = useState(false);

  const precio = Number(product.precio || 0);
  const precioOriginal = Number(product.precioOriginal || 0);
  const descuento = Number(product.descuento || 0);
  const rating = Number(product.rating || 0);
  const reviewCount = Number(product.reviewCount || 0);
  const vendidos = Number(product.vendidos || 0);
  const code = product.oemCode || product.sku || '';
  const visibleThumbs = images.slice(0, 4);
  const extraThumbs = images.length - visibleThumbs.length;

  return (
    <section className="pdm-layout">
      {/* 1. Hero con galería, como la tarjeta hero de la app. */}
      <article className="pdm-hero">
        {isTopProduct && <ProductTopBadge className="pdm-top-badge" />}
        {isBestSeller && <span className="pdm-ranking">Más vendido</span>}
        <div className="pdm-hero-actions">
          <button
            type="button"
            className={`pdm-icon-btn ${favorite ? 'active' : ''}`}
            aria-label={favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            onClick={onToggleFavorite}
          >
            <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
          </button>
          <ShareLinkButton
            className="pdm-icon-btn pdm-share-btn"
            iconOnly
            iconSize={20}
            stopPropagation={false}
            url={productPath(product)}
            title={product.titulo}
            text={`${product.titulo} en RepuesTop`}
            label="Compartir repuesto"
          />
        </div>
        <div className="pdm-hero-photo">
          <ProductPhoto src={images[activeImage]} product={product} alt={product.titulo} iconSize={64} />
          {images.length > 1 && <>
            <button className="pdm-image-arrow previous" type="button" onClick={() => onChangeImage(-1)} aria-label="Imagen anterior"><ChevronLeft /></button>
            <button className="pdm-image-arrow next" type="button" onClick={() => onChangeImage(1)} aria-label="Imagen siguiente"><ChevronRight /></button>
          </>}
        </div>
        {isOwnProduct && (
          <div className="pdm-own-note"><Store size={14} /> Este repuesto es de tu tienda</div>
        )}
        {images.length > 1 && (
          <div className="pdm-thumbs">
            {visibleThumbs.map((image, index) => (
              <button key={`${image}-${index}`} type="button" className={index === activeImage ? 'active' : ''} onClick={() => setActiveImage(index)}>
                <ProductPhoto src={image} product={product} alt={`Vista ${index + 1} de ${product.titulo}`} />
              </button>
            ))}
            {extraThumbs > 0 && (
              <button type="button" className="pdm-thumb-more" onClick={() => setActiveImage(visibleThumbs.length)}>
                +{extraThumbs}
              </button>
            )}
          </div>
        )}
      </article>

      {/* 2. Resumen: badges, título y panel de métricas de 4 columnas. */}
      <article className="pdm-summary">
        <div className="pdm-badges">
          <span className={`pdm-badge pdm-badge-stock ${stock > 0 ? 'ok' : 'out'}`}>
            <i /> {stock > 0 ? 'Disponible' : 'Sin stock'}
          </span>
          <span className="pdm-badge">{condition}</span>
          {code && <span className="pdm-badge pdm-badge-code">Código {code}</span>}
        </div>

        <div className="pdm-title-row">
          <div className="pdm-title-copy">
            <h1>{product.titulo}</h1>
            <p className="pdm-title-meta">{[brandName, category].filter(Boolean).join(' · ')}</p>
          </div>
          {isUniversalPart ? (
            <span className="pdm-compat-btn is-universal"><Globe size={14} /> Universal</span>
          ) : (
            <button type="button" className="pdm-compat-btn" onClick={onOpenCompatibility}>
              <Car size={14} /> Ver compatibilidad{compatibilityCount > 0 ? ` (${compatibilityCount})` : ''}
            </button>
          )}
        </div>

        {compatible && (
          <div className="pdm-match"><CheckCircle2 size={16} /> Compatible con tu {activeVehicle.marca} {activeVehicle.modelo}</div>
        )}

        <div className="pdm-metrics">
          <div className="pdm-metric pdm-metric-price">
            {quoteOnly ? (
              <strong className="pdm-price">A cotizar</strong>
            ) : (
              <>
                <strong className="pdm-price">${precio.toLocaleString('es-CL')}</strong>
                {precioOriginal > precio && <span className="pdm-price-old">${precioOriginal.toLocaleString('es-CL')}</span>}
                {descuento > 0 && <span className="pdm-price-off">-{descuento}% OFF</span>}
              </>
            )}
            <small>{quoteOnly ? 'Precio' : 'IVA incluido'}</small>
          </div>
          <div className="pdm-metric">
            <span className="pdm-metric-rating"><Star size={14} fill="currentColor" /> {rating > 0 ? rating.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}</span>
            <small>
              {vendidos > 0
                ? `(${vendidos} ${vendidos === 1 ? 'vendido' : 'vendidos'})`
                : reviewCount > 0
                  ? `(${reviewCount} ${reviewCount === 1 ? 'reseña' : 'reseñas'})`
                  : 'Sin reseñas'}
            </small>
          </div>
          <div className="pdm-metric">
            <button type="button" className="pdm-metric-brand" onClick={onOpenBrandModal} aria-label={`Ver información de la marca ${brandName}`}>
              <ProductBrandMark brand={brandName} logoUrl={product.brandLogoUrl} size={22} />
              <Info size={12} />
            </button>
            <small className="pdm-metric-brand-name">{brandName}</small>
          </div>
          <div className="pdm-metric">
            <span className="pdm-metric-stock">{stock}</span>
            <small>Stock</small>
          </div>
        </div>

        {product.requiereChasis && (
          <div className="pdm-vin-note">
            <ShieldCheck size={16} />
            <span>Este repuesto requiere <strong>verificación de chasis (VIN)</strong> antes de confirmar la compra.</span>
          </div>
        )}
      </article>

      {/* 3. Panel del vendedor, presionable como en la app. */}
      <button
        type="button"
        className="pdm-seller"
        onClick={onOpenStore ? () => onOpenStore(product) : undefined}
        disabled={!onOpenStore}
      >
        <span className="pdm-seller-logo">
          {product.logoTienda
            ? <img src={product.logoTienda} alt={`Logo de ${sellerName}`} referrerPolicy="no-referrer" />
            : <StoreLogoBadge name={sellerName} seed={product.proveedorId || 0} size={46} />}
        </span>
        <span className="pdm-seller-copy">
          <strong>{sellerName} <BadgeCheck size={14} /></strong>
          <small>
            {sellerRating > 0 && (
              <span className="pdm-seller-rating">
                <Star size={12} fill="currentColor" /> {sellerRating.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ({sellerReviews})
              </span>
            )}
            <span className="pdm-seller-place"><MapPin size={12} /> {city}</span>
          </small>
          {product.horarioVendedor && <small className="pdm-seller-hours">{product.horarioVendedor}</small>}
        </span>
        {onOpenStore && <ChevronRight size={18} className="pdm-seller-chevron" />}
      </button>

      {/* 4. Opciones de entrega (informativo, como en la app). */}
      {!quoteOnly && !isOwnProduct && (
        <article className="pdm-section">
          <h2 className="pdm-section-title"><Truck size={16} /> Opciones de entrega</h2>
          <div className="pdm-shipping-options">
            {shippingMethods.length ? shippingMethods.map((method, index) => {
              const { icon: ShippingIcon, label } = resolveShippingService(method);
              const price = shippingMethodPrice(method);
              const selected = index === selectedShipping;
              return (
                <button
                  key={method}
                  type="button"
                  className={`pdm-shipping-option ${selected ? 'is-selected' : ''}`}
                  onClick={() => setSelectedShipping(index)}
                >
                  <span className={`pdm-radio ${selected ? 'on' : ''}`} />
                  <ShippingIcon size={16} />
                  <span className="pdm-shipping-copy">
                    <b>{label}</b>
                    <small>{price ? `Valor informado por la tienda: ${price}` : 'Coordinado con la tienda'}</small>
                  </span>
                </button>
              );
            }) : (
              <div className="pdm-shipping-option is-selected">
                <span className="pdm-radio on" />
                <Truck size={16} />
                <span className="pdm-shipping-copy">
                  <b>Despacho a coordinar</b>
                  <small>La tienda informa el valor al confirmar tu pedido</small>
                </span>
              </div>
            )}
          </div>
        </article>
      )}

      {/* 5. Información del repuesto: acordeón + grilla de specs de 2 columnas. */}
      <article className="pdm-section">
        <button type="button" className="pdm-section-toggle" onClick={() => setSpecsOpen((value) => !value)} aria-expanded={specsOpen}>
          <h2 className="pdm-section-title"><Package size={16} /> Información del repuesto</h2>
          {specsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {specsOpen && (
          <dl className="pdm-specs-grid">
            <div><dt>Marca</dt><dd>{brandName || 'No informada'}</dd></div>
            <div><dt>Categoría</dt><dd>{category}</dd></div>
            {product.subcategoria && <div><dt>Subcategoría</dt><dd>{product.subcategoria}</dd></div>}
            <div><dt>SKU</dt><dd>{product.skuProveedor || 'No informado'}</dd></div>
            <div><dt>OEM</dt><dd>{product.referenciaOem || 'No informado'}</dd></div>
            {product.brandQuality && <div><dt>Calidad</dt><dd>{product.brandQuality}</dd></div>}
            <div><dt>Condición</dt><dd>{condition}</dd></div>
            <div><dt>Stock</dt><dd>{stock}</dd></div>
          </dl>
        )}
      </article>

      {/* 6. Descripción. */}
      <article className="pdm-section">
        <h2 className="pdm-section-title"><Info size={16} /> Descripción</h2>
        <div className={`pdm-description ${descriptionIsLong && !descriptionExpanded ? 'clamped' : ''}`}>
          <p>{descriptionText}</p>
        </div>
        {descriptionIsLong && (
          <button type="button" className="pdm-link-btn" onClick={onToggleDescription}>
            {descriptionExpanded ? 'Ver menos' : 'Ver descripción completa'} <ChevronRight size={13} />
          </button>
        )}
      </article>

      {/* Pagos, garantías y reporte: no existen en la app pero no se pierden. */}
      {!isOwnProduct && (
        <article className="pdm-section">
          <button type="button" className="pdm-section-toggle" onClick={() => setPaymentsOpen((value) => !value)} aria-expanded={paymentsOpen}>
            <h2 className="pdm-section-title"><ShieldCheck size={16} /> Pagos y garantías</h2>
            {paymentsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {paymentsOpen && (
            <div className="pdm-payments">
              <div className="pdm-payments-row"><ShieldCheck size={16} /><p><b>Compra segura y protegida</b><small>Tu información está 100% protegida</small></p></div>
              <div className="pdm-payments-row"><CreditCard size={16} /><p><b>Paga con Flow</b><small>Débito, crédito y prepago{!quoteOnly && precio > 0 ? ` · 3x $${Math.ceil(precio / 3).toLocaleString('es-CL')} · 6x $${Math.ceil(precio / 6).toLocaleString('es-CL')} · 12x $${Math.ceil(precio / 12).toLocaleString('es-CL')} aprox.` : ''}</small></p></div>
              <div className="pdm-report">
                <ContextualReportButton
                  tipoObjeto="PRODUCTO"
                  objetoId={product.id}
                  objetoTitulo={product.titulo}
                  className="btn-product-report-link"
                  label="Reportar publicación"
                />
              </div>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
