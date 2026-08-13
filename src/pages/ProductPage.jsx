import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import ProductDetailPage from '../components/ProductDetailPage';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import { parseIdSlug } from '../routes/paths';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import { getPublicProductApi, getPublicProductsApi } from '../services/api';
import { adaptPage, adaptProduct } from '../services/adapters';
import { qk } from '../services/queryKeys';

// Respaldo cuando el backend no expone la ficha unitaria: se busca el producto
// dentro del listado público paginado.
const FALLBACK_FETCH_SIZE = 100;

async function fetchProductById(productId, signal) {
  try {
    const dto = await getPublicProductApi(productId, { signal });
    if (dto && (dto.id ?? dto.productoId)) return adaptProduct(dto);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    // sigue al respaldo
  }

  const page = await getPublicProductsApi({ page: 0, size: FALLBACK_FETCH_SIZE, sort: 'createdAt,desc', signal });
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
  const initialData = preloaded && String(preloaded.id) === String(productId) ? preloaded : undefined;

  const { data: product, isLoading, error } = useQuery({
    queryKey: qk.product(productId),
    queryFn: ({ signal }) => fetchProductById(productId, signal),
    initialData,
    enabled: Boolean(productId),
    staleTime: 5 * 60 * 1000,
  });

  useDocumentTitle(product?.titulo || 'Repuesto');

  if (error) {
    return (
      <div className="route-status-panel">
        <AlertCircle size={38} aria-hidden="true" />
        <h2>No encontramos este repuesto</h2>
        <p>{error?.message || 'No se pudo cargar la información del repuesto.'}</p>
        <button type="button" className="route-status-action" onClick={() => nav.goCatalog()}>
          <ArrowLeft size={16} /> Volver al catálogo
        </button>
      </div>
    );
  }

  if (isLoading || !product) {
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
      onSelectProduct={nav.goProduct}
      onOpenStore={product.proveedorId
        ? () => nav.goStore({ id: product.proveedorId, nombre: product.vendedor })
        : null}
    />
  );
}
