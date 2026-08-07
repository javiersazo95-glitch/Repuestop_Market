import React from 'react';
import { Heart, MapPin, PackageCheck, ShieldCheck, Sparkles, Star, Store, Tag } from 'lucide-react';
import CategoryIconTile from './CategoryIconTile';
import { CATEGORY_COLOR_BY_ID, CATEGORY_ICON_BY_ID, CATEGORY_IMAGE_BY_ID } from '../data/categories';

const CATEGORY_LABELS = {
  frenos: 'Frenos',
  motor: 'Motor',
  suspension: 'Suspensión',
  iluminacion: 'Iluminación',
  aceites: 'Filtros',
  electrico: 'Eléctrico',
  carroceria: 'Carrocería',
  neumaticos: 'Neumáticos',
};

function getCompatibility(product) {
  const summary = String(product.compatibilidadSummary || '').trim();
  if (summary) return summary;
  const first = product.compatibilidad?.[0];
  if (first) {
    const vehicle = [first.marca, first.modelo, first.anio].filter(Boolean).join(' ').trim();
    if (vehicle) return vehicle;
  }
  return 'Compatibilidad multimarca';
}

function getPartBrand(product) {
  const explicitBrand = String(product.marcaRepuesto || product.marca || product.productBrand || product.brand || product.fabricante || '').trim();
  if (explicitBrand) return explicitBrand;

  const knownBrands = ['Brembo', 'Bosch', 'Gates', 'KYB', 'Mann-Filter', 'Mann', 'NGK', 'Denso', 'SKF', 'Valeo', 'Monroe'];
  return knownBrands.find((brand) => String(product.titulo || '').toLowerCase().includes(brand.toLowerCase())) || 'Genérico';
}

function getPartType(product) {
  const condition = String(product.condicion || product.tipoRepuesto || '').toLowerCase();
  if (condition.includes('altern')) return { label: 'Alternativo', icon: Sparkles, kind: 'alternative' };
  if (condition.includes('original') || condition.includes('oem')) return { label: 'Original', icon: ShieldCheck, kind: 'original' };
  return product.oemCode
    ? { label: 'Original', icon: ShieldCheck, kind: 'original' }
    : { label: 'Alternativo', icon: Sparkles, kind: 'alternative' };
}

export default function MarketplaceProductCard({ product, onView, fallbackCity }) {
  const category = product.categoria || 'motor';
  const price = Number(product.precio || 0);
  const oldPrice = Number(product.precioOriginal || 0);
  const isOffer = Number(product.descuento || 0) > 0;
  const isNew = String(product.condicion || '').toLowerCase().includes('nuevo');
  const isTop = Boolean(product.isTop || product.destacado);
  const badgeLabel = isOffer ? '🔥 Oferta' : isTop ? '★ Top' : isNew ? '✦ Nuevo' : null;
  const badgeKind = isOffer ? 'offer' : isTop ? 'top' : 'new';
  const city = product.ciudad || product.ciudadVendedor || fallbackCity || 'Santiago, RM';
  const partBrand = getPartBrand(product);
  const partType = getPartType(product);
  const PartTypeIcon = partType.icon;
  const storeName = product.vendedor || product.tienda || 'Tienda RepuesTop';
  const storeLogo = product.logoTienda || product.storeIconUrl || product.tiendaLogo || null;
  const stock = Number(product.stock ?? product.stockAvailable ?? 0);
  const rating = Number(product.rating || product.calificacion || 4.8);
  // La foto registrada por la tienda siempre tiene prioridad. La imagen de la
  // categoría solo es el respaldo para publicaciones que aún no tienen foto.
  const productImage = product.imagen
    || product.imagenes?.[0]
    || product.imageUrls?.[0]
    || CATEGORY_IMAGE_BY_ID[category];

  return (
    <article className="market-product-card">
      <div className="market-product-media" onClick={() => onView?.(product)}>
        <CategoryIconTile
          iconName={CATEGORY_ICON_BY_ID[category]}
          color={CATEGORY_COLOR_BY_ID[category]}
          image={productImage}
          size={34}
        />
        {badgeLabel && <span className={`market-product-badge ${badgeKind}`}>{badgeLabel}</span>}
        <button className="market-product-favorite" type="button" aria-label="Agregar a favoritos">
          <Heart size={21} />
        </button>
      </div>

      <div className="market-product-content">
        <h3 onClick={() => onView?.(product)}>{product.titulo}</h3>
        <p className="market-product-compatibility">{getCompatibility(product)}</p>
        <div className="market-product-tags">
          <span className="market-product-category" data-category={category}>
            <CategoryIconTile iconName={CATEGORY_ICON_BY_ID[category]} color={CATEGORY_COLOR_BY_ID[category]} size={11} className="market-product-tag-icon" />
            {product.categoriaNombre || CATEGORY_LABELS[category] || 'Repuesto'}
          </span>
          <span className={`market-product-origin ${partType.kind}`}><PartTypeIcon size={11} /> {partType.label}</span>
          <span className="market-product-brand"><Tag size={11} /> {partBrand}</span>
        </div>

        <div className="market-product-store">
          {storeLogo ? (
            <img className="market-product-store-logo" src={storeLogo} alt={storeName} />
          ) : (
            <Store size={13} />
          )}
          <span className="market-product-store-name">{storeName}</span>
          <span className="market-product-store-city"><MapPin size={11} /> {city}</span>
        </div>

        <div className="market-product-meta">
          <span className="market-product-rating"><Star size={12} /> {rating.toFixed(1)}</span>
          <span className={`market-product-stock ${stock <= 0 ? 'out' : stock <= 5 ? 'low' : ''}`}>
            <PackageCheck size={12} /> {stock > 0 ? `${stock} en stock` : 'Sin stock'}
          </span>
        </div>

        <div className="market-product-price">
          <strong>{product.soloCotizacion || !price ? 'A cotizar' : `$${price.toLocaleString('es-CL')} CLP`}</strong>
          {oldPrice > price && price > 0 && <del>${oldPrice.toLocaleString('es-CL')}</del>}
        </div>

        <button className="market-product-detail" type="button" onClick={() => onView?.(product)}>Ver detalle</button>
      </div>
    </article>
  );
}
