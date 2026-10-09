import React from 'react';
import {
  BadgeCheck, Car, CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard, FileText, Globe, Heart,
  Info, MapPin, Maximize2, MessageCircle, Package, ShieldCheck, ShoppingCart, Star, Store, Truck,
} from 'lucide-react';

import ProductPhoto from './ProductPhoto';
import ProductBrandMark from './ProductBrandMark';
import ProductTopBadge from './ProductTopBadge';
import ShareLinkButton from './ShareLinkButton';
import StoreLogoBadge from './StoreLogoBadge';
import ContextualReportButton from './ContextualReportButton';
import ProductShippingCard from './ProductShippingCard';
import { resolveShippingService, shippingMethodPrice } from '../data/shippingMethods';
import { productPath } from '../routes/paths';

const formatCLP = (value) => `$${Number(value || 0).toLocaleString('es-CL')}`;

function compatibilityYears(item) {
  if (!item.anioInicio && !item.anioFin) return '';
  if (!item.anioFin || item.anioFin === item.anioInicio) return String(item.anioInicio || item.anioFin);
  return `${item.anioInicio || '—'}–${item.anioFin}`;
}

/**
 * Ficha del repuesto en escritorio (≥769px). Es presentacional, igual que ProductDetailMobile:
 * el estado y los datos viven en ProductDetailPage. Dos columnas: a la izquierda la galería y
 * el contexto (ficha técnica, compatibilidad, descripción, preguntas); a la derecha un único
 * panel de compra fijo con la ruta de decisión de arriba a abajo: precio → cómo recibirlo →
 * comprar → quién vende.
 */
export default function ProductDetailDesktop({
  product,
  images,
  activeImage,
  setActiveImage,
  onChangeImage,
  onOpenLightbox,
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
  compatibility,
  sellerRating,
  sellerReviews,
  hasSellerRating,
  descriptionText,
  descriptionIsLong,
  descriptionExpanded,
  onToggleDescription,
  onOpenCompatibility,
  onOpenBrandModal,
  onOpenStore,
  onOpenQuote,
  onBuyNow,
  onAddToCart,
  canChooseShipping,
  shippingChoices,
  shippingMethods,
  selectedShippingMethod,
  onSelectShippingMethod,
  shippingCardRef,
  shippingFocused,
  questions,
}) {
  const hasThumbs = images.length > 1;
  const precioOriginal = Number(product.precioOriginal || 0);
  const descuento = Number(product.descuento || 0);
  const code = product.oemCode || product.sku || '';
  const compatCount = compatibility.length;
  const compatLabel = compatCount > 4
    ? `Ver todas las compatibilidades (${compatCount})`
    : compatCount > 0 ? 'Ver detalle y verificar con mi patente' : 'Verificar con mi patente';

  const stockChip = stock <= 0
    ? { className: 'is-out', label: 'Sin stock' }
    : stock <= 5
      ? { className: 'is-low', label: `Últimas ${stock} unidades` }
      : { className: 'is-ok', label: `Disponible · ${stock} u.` };

  const SellerTag = onOpenStore ? 'button' : 'div';

  return (
    <section className="pdd-layout pdd-root">
      {/* ------------------------------------------------------------------ Columna izquierda */}
      <div className="pdd-main">
        <article className={`pdd-card pdd-gallery${hasThumbs ? ' has-thumbs' : ''}`}>
          {hasThumbs && (
            <div className="pdd-thumbs" role="list" aria-label="Miniaturas del repuesto">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  role="listitem"
                  className={index === activeImage ? 'is-active' : ''}
                  onClick={() => setActiveImage(index)}
                  aria-label={`Ver foto ${index + 1}`}
                  aria-current={index === activeImage}
                >
                  <ProductPhoto src={image} product={product} alt="" />
                </button>
              ))}
            </div>
          )}

          <div className="pdd-stage">
            <div className="pdd-badges">
              {isTopProduct && <ProductTopBadge className="pdd-top-badge" />}
              {isBestSeller && <span className="pdd-ranking">Más vendido</span>}
            </div>
            <div className="pdd-gallery-actions">
              <button
                type="button"
                className={`pdd-icon-btn${favorite ? ' is-favorite' : ''}`}
                aria-label={favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                aria-pressed={favorite}
                onClick={onToggleFavorite}
              >
                <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
              </button>
              <ShareLinkButton
                className="pdd-icon-btn"
                iconOnly
                iconSize={19}
                stopPropagation={false}
                url={productPath(product)}
                title={product.titulo}
                text={`${product.titulo} en RepuesTop`}
                label="Compartir repuesto"
              />
            </div>

            <button type="button" className="pdd-photo" onClick={() => onOpenLightbox()} aria-label="Ampliar la foto">
              <ProductPhoto src={images[activeImage]} product={product} alt={product.titulo} iconSize={76} />
              <span className="pdd-photo-zoom"><Maximize2 size={14} /> Ampliar</span>
            </button>

            {hasThumbs && (
              <>
                <button type="button" className="pdd-arrow is-prev" onClick={() => onChangeImage(-1)} aria-label="Foto anterior"><ChevronLeft size={22} /></button>
                <button type="button" className="pdd-arrow is-next" onClick={() => onChangeImage(1)} aria-label="Foto siguiente"><ChevronRight size={22} /></button>
              </>
            )}
          </div>
        </article>

        <section className="pdd-card pdd-section" aria-labelledby="pdd-specs-title">
          <h2 id="pdd-specs-title"><Package size={18} /> Ficha técnica</h2>
          <dl className="pdd-specs">
            <div>
              <dt>Marca</dt>
              <dd>
                <button type="button" className="pdd-brand-link" onClick={onOpenBrandModal} title={`Ver información y procedencia de la marca ${brandName}`}>
                  <ProductBrandMark brand={brandName} logoUrl={product.brandLogoUrl} size={20} />
                  <span>{brandName}</span>
                  <Info size={13} />
                </button>
              </dd>
            </div>
            <div><dt>Categoría</dt><dd>{category}</dd></div>
            <div><dt>Subcategoría</dt><dd>{product.subcategoria || 'No especificada'}</dd></div>
            <div><dt>SKU</dt><dd>{product.skuProveedor || product.sku || 'No informado'}</dd></div>
            <div><dt>Ref. OEM</dt><dd>{product.referenciaOem || 'No informado'}</dd></div>
            <div><dt>Condición</dt><dd>{condition}</dd></div>
            <div><dt>Stock</dt><dd>{stock} {stock === 1 ? 'unidad' : 'unidades'}</dd></div>
          </dl>
        </section>

        <section className="pdd-card pdd-section" aria-labelledby="pdd-compat-title">
          <h2 id="pdd-compat-title"><Car size={18} /> Compatibilidad</h2>
          {compatible && (
            <p className="pdd-match"><CheckCircle2 size={16} /> Compatible con tu {activeVehicle.marca} {activeVehicle.modelo}</p>
          )}
          {isUniversalPart ? (
            <p className="pdd-note">
              <Globe size={16} />
              <span>Este repuesto es <strong>universal</strong>: el vendedor lo publicó como compatible con cualquier vehículo, así que no depende de la marca ni del modelo de tu auto.</span>
            </p>
          ) : compatCount > 0 ? (
            <ul className="pdd-compat-chips">
              {compatibility.slice(0, 4).map((item, index) => {
                const years = compatibilityYears(item);
                return (
                  <li key={`${item.marca}-${item.modelo}-${index}`}>
                    <strong>{[item.marca, item.modelo].filter(Boolean).join(' ') || 'Vehículo compatible'}</strong>
                    {years && <span>{years}</span>}
                    {item.version && <span>{item.version}</span>}
                  </li>
                );
              })}
              {compatCount > 4 && <li className="is-more">+{compatCount - 4} más</li>}
            </ul>
          ) : (
            <p className="pdd-muted">Consulta a la tienda con tu patente o código OEM para confirmar la compatibilidad.</p>
          )}
          {!isUniversalPart && (
            <button type="button" className="pdd-link-btn" onClick={onOpenCompatibility}>
              {compatLabel} <ChevronRight size={15} />
            </button>
          )}
        </section>

        <section className="pdd-card pdd-section" aria-labelledby="pdd-description-title">
          <h2 id="pdd-description-title"><FileText size={18} /> Descripción</h2>
          <div className={`pdd-description${descriptionIsLong && !descriptionExpanded ? ' is-clamped' : ''}`}>
            <p>{descriptionText}</p>
          </div>
          {descriptionIsLong && (
            <button type="button" className="pdd-link-btn" onClick={onToggleDescription}>
              {descriptionExpanded ? 'Ver menos' : 'Ver descripción completa'} <ChevronRight size={15} />
            </button>
          )}
        </section>

        {questions}
      </div>

      {/* ------------------------------------------------------------------ Panel de compra */}
      <aside className="pdd-card pdd-panel" aria-label="Comprar este repuesto">
        <div className="pdd-chips">
          {isOwnProduct
            ? <span className="pdd-chip is-own"><Store size={13} /> Tu tienda</span>
            : <span className={`pdd-chip ${stockChip.className}`}>{stockChip.label}</span>}
          <span className="pdd-chip">{condition}</span>
          <span className="pdd-chip is-verified"><BadgeCheck size={13} /> Verificado</span>
        </div>

        <h1 className="pdd-title">{product.titulo}</h1>

        <div className="pdd-meta">
          <button type="button" className="pdd-brand-pill" onClick={onOpenBrandModal} title={`Ver información y procedencia de la marca ${brandName}`}>
            <ProductBrandMark brand={brandName} logoUrl={product.brandLogoUrl} size={22} />
            <span>{brandName}</span>
            <Info size={13} />
          </button>
          <span className="pdd-meta-text">{category}{product.subcategoria ? ` · ${product.subcategoria}` : ''}</span>
          {code && <code className="pdd-code" title="Código OEM / SKU">{code}</code>}
        </div>

        {isUniversalPart ? (
          <span className="pdd-compat-pill is-universal"><Globe size={15} /> Compatibilidad universal</span>
        ) : compatible ? (
          <button type="button" className="pdd-compat-pill is-match" onClick={onOpenCompatibility}>
            <CheckCircle2 size={15} /> Compatible con tu {activeVehicle.marca} {activeVehicle.modelo} <ChevronRight size={14} />
          </button>
        ) : (
          <button type="button" className="pdd-compat-pill" onClick={onOpenCompatibility}>
            <Car size={15} /> Ver compatibilidad{compatCount > 0 ? ` (${compatCount})` : ''} <ChevronRight size={14} />
          </button>
        )}

        <div className="pdd-price-block">
          {isOwnProduct ? (
            /* SEC-BACKEND-022 rechaza la auto-compra en el checkout; se corta aquí. */
            <div className="pdd-own-notice">
              <Store size={18} />
              <div>
                <strong>Este repuesto es de tu tienda</strong>
                <p>No puedes comprarlo ni cotizarlo. Para editarlo entra a "Productos" en tu panel.</p>
              </div>
            </div>
          ) : quoteOnly ? (
            <>
              <span className="pdd-price-label">Precio a cotizar</span>
              <p className="pdd-muted">Solicita el precio final y las alternativas de despacho directamente a la tienda.</p>
            </>
          ) : (
            <>
              {precioOriginal > 0 && precioOriginal > Number(product.precio) && (
                <span className="pdd-price-old">
                  <s>{formatCLP(precioOriginal)}</s>
                  {descuento > 0 && <em>-{descuento}% OFF</em>}
                </span>
              )}
              <span className="pdd-price">{formatCLP(product.precio)} <small>CLP</small></span>
              <span className="pdd-price-note">IVA incluido</span>
            </>
          )}
        </div>

        {canChooseShipping && (
          <div className="pdd-shipping">
            <ProductShippingCard
              ref={shippingCardRef}
              methods={shippingChoices}
              selected={selectedShippingMethod}
              onSelect={onSelectShippingMethod}
              hours={product.horarioVendedor}
              focused={shippingFocused}
            />
          </div>
        )}

        {!isOwnProduct && (
          <div className="pdd-ctas">
            {quoteOnly ? (
              <button type="button" className="pdd-btn is-primary" onClick={() => onOpenQuote(product)}>
                <MessageCircle size={18} /> Cotizar con la tienda
              </button>
            ) : (
              <>
                <button type="button" className="pdd-btn is-primary" disabled={!stock} onClick={onBuyNow}>
                  <ShoppingCart size={18} /> Comprar ahora
                </button>
                <button type="button" className="pdd-btn is-secondary" disabled={!stock} onClick={onAddToCart}>
                  <Package size={18} /> Añadir al carro
                </button>
              </>
            )}
          </div>
        )}

        {/* Sin card elegible (cotización o producto propio) la entrega se informa igual. */}
        {!canChooseShipping && (
          <p className="pdd-delivery-info">
            <Truck size={15} />
            <span>
              <strong>Entrega:</strong>{' '}
              {shippingMethods.length
                ? shippingMethods.map((method) => {
                  const price = shippingMethodPrice(method);
                  return `${resolveShippingService(method).label}${price ? ` (${price})` : ''}`;
                }).join(' · ')
                : 'Despacho a coordinar con la tienda'}
            </span>
          </p>
        )}

        {!isOwnProduct && (
          <ul className="pdd-trust" aria-label="Garantías de la compra">
            <li><CreditCard size={15} /> Pago con Flow</li>
            <li><ShieldCheck size={15} /> Compra protegida</li>
            <li><BadgeCheck size={15} /> Garantía legal 6 meses</li>
          </ul>
        )}

        <SellerTag
          className="pdd-seller"
          {...(onOpenStore ? { type: 'button', onClick: () => onOpenStore(product), 'aria-label': `Ver la tienda ${sellerName}` } : {})}
        >
          <span className="pdd-seller-logo">
            {product.logoTienda
              ? <img src={product.logoTienda} alt="" referrerPolicy="no-referrer" />
              : <StoreLogoBadge name={sellerName} seed={product.proveedorId || 0} size={44} />}
          </span>
          <span className="pdd-seller-copy">
            <small>Vendido por</small>
            <strong title={sellerName}>{sellerName} <BadgeCheck size={14} /></strong>
            {hasSellerRating && (
              <span className="pdd-seller-rating">
                <Star size={13} fill="currentColor" />
                {sellerRating.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                <em>· {sellerReviews === 1 ? '1 evaluación' : `${sellerReviews} evaluaciones`}</em>
              </span>
            )}
            <span className="pdd-seller-place">
              <MapPin size={12} /> {city}
              {product.horarioVendedor && <><Clock size={12} /> {product.horarioVendedor}</>}
            </span>
          </span>
          {onOpenStore && <span className="pdd-seller-link">Ver tienda <ChevronRight size={15} /></span>}
        </SellerTag>

        {!isOwnProduct && (
          <div className="pdd-panel-foot">
            <ContextualReportButton
              tipoObjeto="PRODUCTO"
              objetoId={product.id}
              objetoTitulo={product.titulo}
              className="btn-product-report-link"
              label="Reportar publicación"
            />
          </div>
        )}
      </aside>
    </section>
  );
}
