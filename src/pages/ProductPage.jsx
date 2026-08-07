import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import ProductDetailPage from '../components/ProductDetailPage';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import { parseIdSlug } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import { getPublicProductApi, getPublicProductsApi } from '../services/api';
import { adaptPage, adaptProduct } from '../services/adapters';

// Respaldo cuando el backend no expone la ficha unitaria: se busca el producto
// dentro del listado público paginado.
const FALLBACK_FETCH_SIZE = 100;

async function fetchProductById(productId) {
  try {
    const dto = await getPublicProductApi(productId);
    if (dto && (dto.id ?? dto.productoId)) return adaptProduct(dto);
  } catch {
    // sigue al respaldo
  }

  const page = await getPublicProductsApi({ page: 0, size: FALLBACK_FETCH_SIZE, sort: 'createdAt,desc' });
  const found = adaptPage(page, adaptProduct).items
    .find((item) => String(item.id) === String(productId));
  if (!found) throw new Error('Este repuesto ya no está publicado.');
  return found;
}

export default function ProductPage() {
  const { productId: productParam } = useParams();
  const location = useLocation();
  const nav = useAppNavigation();
  const { user } = useAuth();
  const { activeVehicle, addToCart, openQuote } = useMarketplace();

  const productId = parseIdSlug(productParam);
  // Al llegar navegando desde el catálogo el producto ya viaja en el state; la
  // petición solo ocurre cuando se entra por URL directa o tras un refresco.
  const preloaded = location.state?.product;
  const [product, setProduct] = useState(
    preloaded && String(preloaded.id) === String(productId) ? preloaded : null
  );
  const [error, setError] = useState(null);

  useDocumentTitle(product?.titulo || 'Repuesto');

  useEffect(() => {
    if (product && String(product.id) === String(productId)) return undefined;

    let cancelled = false;
    setError(null);
    fetchProductById(productId)
      .then((found) => { if (!cancelled) setProduct(found); })
      .catch((err) => { if (!cancelled) setError(err.message || 'No se pudo cargar el repuesto.'); });

    return () => { cancelled = true; };
  }, [productId, product]);

  if (error) {
    return (
      <div className="route-status-panel">
        <AlertCircle size={38} aria-hidden="true" />
        <h2>No encontramos este repuesto</h2>
        <p>{error}</p>
        <button type="button" className="route-status-action" onClick={() => nav.goCatalog()}>
          <ArrowLeft size={16} /> Volver al catálogo
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="route-status-panel">
        <Loader2 size={34} className="route-status-spinner" aria-hidden="true" />
        <p>Cargando la ficha del repuesto…</p>
      </div>
    );
  }

  return (
    <ProductDetailPage
      product={product}
      user={user}
      activeVehicle={activeVehicle}
      onBack={() => nav.goCatalog()}
      onAddToCart={addToCart}
      onOpenQuote={openQuote}
      // Desde la ficha se podía ver quién vende, pero no llegar a su tienda.
      // La vitrina de relacionados navega a la ficha del producto elegido.
      onSelectProduct={nav.goProduct}
      onOpenStore={product.proveedorId
        ? () => nav.goStore({ id: product.proveedorId, nombre: product.vendedor })
        : null}
    />
  );
}
