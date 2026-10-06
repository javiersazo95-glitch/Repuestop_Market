import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Car, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Heart, Info,
  MessageCircle, Search, ShieldCheck, ShoppingCart, SlidersHorizontal, X,
} from 'lucide-react';
import VehicleBrandLogo from './VehicleBrandLogo';
import { productReferenceImage } from '../utils/productImage';
import ProductBrandModal from './ProductBrandModal';
import { localDeliveryCost, productShippingOptions } from '../utils/cartDelivery';
import {
  createProductQuestionApi, getProductQuestionsApi, searchVehicleByPatenteApi, answerProductQuestionApi,
  getInventoryVehicleCatalogsApi, getVehicleVersionsApi
} from '../services/api';
import { adaptVehicle, vehicleCatalogIds } from '../services/adapters';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useFavorites } from '../hooks/useFavorites';
import { qk } from '../services/queryKeys';
import MobileStickyBar from './MobileStickyBar';
import ProductDetailMobile from './ProductDetailMobile';
import ProductDetailDesktop from './ProductDetailDesktop';
import ProductQuestionsSection from './ProductQuestionsSection';
import ProductPhotoLightbox from './ProductPhotoLightbox';
import RelatedProductsCarousel from './RelatedProductsCarousel';
import { isProductTopActive } from '../utils/productTop';
import { isOwnStoreProduct } from '../utils/purchaseProfile';

function claveTexto(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Compara el vehículo resuelto por patente contra un registro de compatibilidad
// del repuesto o sus filas de catálogo enriquecidas.
function vehicleMatchesCompatibility(vehicle, item, catalogRowsForGroup = []) {
  if (!vehicle) return false;

  // 1. Coincidencia relacional por catalogo: la fila del auto y sus equivalentes (familia del
  // modelo y anio, MISMA version), igual que el listado por patente. Con solo la fila exacta,
  // la ficha decia "no le sirve" a un repuesto que el listado si traia.
  // Regla del 4-oct: con la version del auto identificada no se cae a marca/modelo/anio; eso
  // le decia a un Yaris GLI que le sirve lo registrado para el Yaris Sport.
  const vCatIds = vehicleCatalogIds(vehicle);
  if (vCatIds.length > 0) {
    const itemIds = Array.isArray(item?.vehiculoCatalogoIds) ? item.vehiculoCatalogoIds.map(String) : [];
    return itemIds.some((id) => vCatIds.includes(id));
  }

  // 2. Sin version identificada (la patente no calzo con el catalogo): por marca/modelo/anio
  // contra las filas enriquecidas del catálogo generadas para este grupo
  if (Array.isArray(catalogRowsForGroup) && catalogRowsForGroup.length > 0) {
    const matchRow = catalogRowsForGroup.some((row) => {
      const rowMarcaKey = claveTexto(row.marca);
      const vehMarcaKey = claveTexto(vehicle.marca);
      const marcaOk = !rowMarcaKey || !vehMarcaKey || rowMarcaKey === vehMarcaKey;
      if (!marcaOk) return false;

      const rowModelKey = claveTexto(row.modelo);
      const vehModelKey = claveTexto(vehicle.modelo);
      const modeloOk = Boolean(rowModelKey && vehModelKey) && (vehModelKey.includes(rowModelKey) || rowModelKey.includes(vehModelKey));
      if (!modeloOk) return false;

      const anio = Number(vehicle.anio) || null;
      const anioOk = !anio || ((!row.anioInicio || anio >= Number(row.anioInicio)) && (!row.anioFin || anio <= Number(row.anioFin)));
      if (!anioOk) return false;

      return true;
    });
    if (matchRow) return true;
  }

  // 3. Coincidencia contra el registro directo del producto (item)
  const itemMarcaKey = claveTexto(item?.marca);
  const vehMarcaKey = claveTexto(vehicle.marca);
  const marcaOk = !itemMarcaKey || !vehMarcaKey || itemMarcaKey === vehMarcaKey;

  const vehicleModelo = claveTexto(vehicle.modelo);
  const itemModelo = claveTexto(item?.modelo);
  const modeloOk = Boolean(itemModelo) && (vehicleModelo.includes(itemModelo) || itemModelo.includes(vehicleModelo));

  const anio = Number(vehicle.anio) || null;
  const anioOk = !anio || ((!item?.anioInicio || anio >= Number(item.anioInicio)) && (!item?.anioFin || anio <= Number(item.anioFin)));

  return marcaOk && modeloOk && anioOk;
}

function compatibilityYearLabel(anioInicio, anioFin) {
  if (!anioInicio && !anioFin) return '—';
  return `${anioInicio || '—'}${anioFin && anioFin !== anioInicio ? `–${anioFin}` : ''}`;
}

// La tabla de compatibilidades (escritorio) solo existe por sobre el ancho de celular.
const COMPAT_TABLE_QUERY = '(min-width: 769px)';
function useIsCompatTableLayout() {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(COMPAT_TABLE_QUERY).matches : true
  ));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia(COMPAT_TABLE_QUERY);
    const onChange = (event) => setMatches(event.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);
  return matches;
}

export default function ProductDetailPage({ product, user, activeVehicle, onBack, onAddToCart, onOpenQuote, onOpenStore, onSelectProduct }) {
  const queryClient = useQueryClient();
  // El vendedor llega a su propia ficha desde el catalogo como comprador, asi que
  // esto NO depende del modo de la pantalla.
  const isOwnProduct = isOwnStoreProduct(user?.sellerId, product.proveedorId);
  // Mismo respaldo que la tarjeta del catalogo: la foto de la pieza que nombra el titulo
  // antes que la de su categoria, para no abrir la ficha de un espejo con la foto de un auto.
  // Si una foto no carga, `ProductPhoto` cae a esta misma referencial (como la tarjeta).
  const images = (product.imagenes?.length
    ? product.imagenes
    : [product.imagen || productReferenceImage(product)]).filter(Boolean);
  const [activeImage, setActiveImage] = useState(0);
  // Fotos a pantalla completa (solo escritorio); comparte `activeImage` con la galería.
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // El estado del corazon sale del mismo hook que usa el catalogo. Antes esta pantalla
  // llevaba su propio `useState` + `checkIsFavoriteApi`, y para BORRAR le pasaba el id
  // del producto a `removeFavoriteApi`, que espera el id DEL FAVORITO: el DELETE moria,
  // el catch revertia el corazon y no se podia quitar nada desde aca.
  const { isFavorite, toggleFavorite } = useFavorites(user?.userId ?? user?.id);
  const favorite = isFavorite(product?.id);

  const handleToggleFavorite = () => toggleFavorite(product);
  const [question, setQuestion] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [compatibilityOpen, setCompatibilityOpen] = useState(false);
  const [compatibilitySearch, setCompatibilitySearch] = useState('');
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [plateInput, setPlateInput] = useState('');
  const [plateSearching, setPlateSearching] = useState(false);
  const [plateError, setPlateError] = useState('');
  const [plateVehicle, setPlateVehicle] = useState(null);
  const [plateMatchIndex, setPlateMatchIndex] = useState(null);
  const compatibilityItemRefs = useRef([]);
  // Hoja de compatibilidades en el celular (mismo diseño que la app): filtro por marca,
  // orden, y tarjetas plegables por grupo.
  const [compatFiltersOpen, setCompatFiltersOpen] = useState(false);
  const [compatBrandFilter, setCompatBrandFilter] = useState(null);
  const [compatSortAscending, setCompatSortAscending] = useState(true);
  const [expandedCompatGroups, setExpandedCompatGroups] = useState(() => new Set());
  const questionsSectionRef = useRef(null);
  const { setActiveVehicle } = useMarketplace();
  const nav = useAppNavigation();
  const stock = Number(product.stock || 0);
  const pricingMode = String(product.pricingMode || '').toUpperCase();
  const quoteOnly = pricingMode === 'QUOTE_ONLY' || pricingMode === 'COTIZACION' || product.soloCotizacion || !product.precio;
  const rawSeller = product.vendedor;
  const seller = typeof rawSeller === 'object' ? (rawSeller?.nombre || rawSeller?.razonSocial) : rawSeller;
  const sellerName = seller || 'Tienda verificada';
  const compatibility = useMemo(() => product.compatibilidad || [], [product.compatibilidad]);
  const isUniversalPart = Boolean(product.esUniversal);
  const category = product.categoriaNombre || product.categoria || 'Repuestos';
  const condition = product.condicion || 'Original';
  const city = product.ciudadVendedor || 'Chile';

  const explicitBrand = String(
    product.marca ||
    product.marcaRepuesto ||
    product.productBrand ||
    product.brand ||
    product.fabricante ||
    ''
  ).trim();

  const brandName = useMemo(() => {
    if (explicitBrand && explicitBrand.toLowerCase() !== 'genérico' && explicitBrand.toLowerCase() !== 'generico') {
      return explicitBrand;
    }
    const title = String(product.titulo || product.nombrePublicado || product.nombre || '').toLowerCase();
    const knownBrands = [
      'Brembo', 'Bosch', 'Valeo', 'Hella', 'Mann-Filter', 'Mann', 'Continental', 'Philips',
      'Osram', 'Denso', 'NGK', 'Castrol', 'Mobil', 'Monroe', 'SKF', 'Mahle', 'Delphi',
      'Depo', 'TYC', 'Febi', 'Bilstein', 'Gates', 'KYB', 'Aisin', 'ATE', 'Dayco', 'TRW',
      'Toyota', 'Chevrolet', 'Nissan', 'Hyundai', 'Ford', 'BMW', 'Audi', 'Volkswagen',
      'Kia', 'Peugeot', 'Renault', 'Fiat', 'Suzuki', 'Subaru', 'Mazda', 'Honda', 'Jeep', 'Volvo'
    ];
    return knownBrands.find((b) => title.includes(b.toLowerCase())) || explicitBrand || 'Original';
  }, [explicitBrand, product.titulo, product.nombrePublicado, product.nombre]);
  // Reputación real de la tienda. Antes la ficha mostraba "4.8" y "+5 años"
  // fijos en el código para cualquier vendedor.
  const sellerRating = Number(product.vendedorRating ?? 0);
  const sellerReviews = Number(product.vendedorReviewCount ?? 0);
  const hasSellerRating = sellerRating > 0;
  // Como en la app: con la comuna del comprador se ofrece solo lo que le sirve (dentro de la
  // comuna si es la de la tienda, fuera si no) y lo que elija acá es lo que el carro confirma.
  const shippingMethods = useMemo(
    () => productShippingOptions(product.metodosEnvio, user?.comuna, product.ciudadVendedor),
    [product.metodosEnvio, user?.comuna, product.ciudadVendedor],
  );
  // Lo que se elige antes de comprar. Si la tienda no publicó métodos queda "a coordinar", como en la app.
  const shippingChoices = useMemo(
    () => (shippingMethods.length ? shippingMethods : ['A coordinar con el vendedor']),
    [shippingMethods],
  );
  const [selectedShippingMethod, setSelectedShippingMethod] = useState('');
  useEffect(() => { setSelectedShippingMethod(''); }, [product.id]);
  useEffect(() => {
    if (selectedShippingMethod && !shippingChoices.includes(selectedShippingMethod)) setSelectedShippingMethod('');
  }, [shippingChoices, selectedShippingMethod]);
  const canChooseShipping = !isOwnProduct && !quoteOnly;
  // Intento de compra sin método: se lleva al comprador a la card y se resalta un momento.
  const shippingCardRef = useRef(null);
  const [shippingFocused, setShippingFocused] = useState(false);
  const shippingFocusTimer = useRef(null);
  useEffect(() => () => clearTimeout(shippingFocusTimer.current), []);
  const selectShippingMethod = (method) => {
    setSelectedShippingMethod(method);
    setShippingFocused(false);
  };
  // El distintivo "Más vendido" solo aparece cuando el producto registra ventas.
  const isBestSeller = Number(product.vendidos || 0) > 0;
  const isTopProduct = isProductTopActive(product);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const descriptionText = product.descripcion
    || 'Repuesto publicado por una tienda verificada en RepuesTop. Consulta la compatibilidad antes de completar tu compra.';
  const descriptionIsLong = descriptionText.length > 320;

  const allVehicleCatalogIds = useMemo(() => {
    const ids = new Set();
    (compatibility || []).forEach((c) => {
      (c.vehiculoCatalogoIds || []).forEach((id) => ids.add(Number(id)));
    });
    if (product.vehiculoCatalogoIds && Array.isArray(product.vehiculoCatalogoIds)) {
      product.vehiculoCatalogoIds.forEach((id) => ids.add(Number(id)));
    }
    return Array.from(ids).filter((id) => Number.isFinite(id) && id > 0);
  }, [compatibility, product.vehiculoCatalogoIds]);

  const vehicleCatalogDetailsQuery = useQuery({
    queryKey: ['vehicleCatalogDetails', allVehicleCatalogIds],
    queryFn: ({ signal }) => getInventoryVehicleCatalogsApi(allVehicleCatalogIds, { signal }),
    enabled: allVehicleCatalogIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  const vehicleCatalogDetails = Array.isArray(vehicleCatalogDetailsQuery.data) ? vehicleCatalogDetailsQuery.data : [];

  const versionsQueries = useQuery({
    queryKey: ['compatVersionsForProduct', product.id, compatibility],
    queryFn: async () => {
      const results = {};
      await Promise.all((compatibility || []).map(async (c) => {
        if (!c.marca || !c.modelo) return;
        const key = `${c.marca}|${c.modelo}|${c.anioInicio || ''}|${c.anioFin || ''}`;
        try {
          const list = await getVehicleVersionsApi({
            marca: c.marca,
            modelo: c.modelo,
            anioDesde: c.anioInicio,
            anioHasta: c.anioFin,
          });
          results[key] = Array.isArray(list) ? list : [];
        } catch {
          results[key] = [];
        }
      }));
      return results;
    },
    enabled: Boolean(compatibility && compatibility.length > 0),
    staleTime: 1000 * 60 * 10,
  });

  const versionsMap = versionsQueries.data || {};

  // Tabla de compatibilidades (escritorio): una fila por vehiculo. Cuando el grupo trae
  // versiones del catalogo (`vehiculoCatalogoIds`) cada una es su propia fila con marca,
  // modelo, años, version, motor y transmision del catalogo; si no, el grupo es una fila con
  // lo que declaro el vendedor. Ordenada por marca, modelo, año y version.
  const isCompatTableLayout = useIsCompatTableLayout();
  const compatibilityRows = useMemo(() => {
    const rows = [];
    compatibility.forEach((item, groupIndex) => {
      const oem = item.referenciaOem || product.oemCode || '';
      const ids = (item.vehiculoCatalogoIds || []).map(String);
      const versionKey = `${item.marca}|${item.modelo}|${item.anioInicio || ''}|${item.anioFin || ''}`;
      const catalogVersions = versionsMap[versionKey] || [];
      const fromCatalog = ids.map((id, idx) => {
        const detail = vehicleCatalogDetails.find((d) => String(d.id) === id);
        const version = catalogVersions.find((v) => String(v.id) === id);
        const label = Array.isArray(item.versionLabels) ? item.versionLabels[idx] : null;
        if (!detail && !version && !label) return null;
        return {
          key: `${groupIndex}-${id}`,
          groupIndex,
          marca: detail?.marca || item.marca,
          modelo: detail?.modelo || item.modelo,
          anioInicio: detail?.anioDesde ?? item.anioInicio,
          anioFin: detail?.anioHasta ?? item.anioFin,
          version: detail?.version || version?.nombre || version?.version || label || '',
          motor: detail?.motor || item.motor || '',
          transmision: detail?.transmision || '',
          oem,
        };
      }).filter(Boolean);
      if (fromCatalog.length > 0) {
        rows.push(...fromCatalog);
        return;
      }
      rows.push({
        key: `${groupIndex}-group`,
        groupIndex,
        marca: item.marca,
        modelo: item.modelo,
        anioInicio: item.anioInicio,
        anioFin: item.anioFin,
        version: ids.length > 0
          ? `${ids.length} ${ids.length === 1 ? 'versión' : 'versiones'} seleccionada${ids.length === 1 ? '' : 's'}`
          : (item.version || 'Todas las versiones'),
        motor: item.motor || '',
        transmision: '',
        oem,
      });
    });
    const text = (value) => String(value || '').toLocaleLowerCase('es');
    return rows.sort((a, b) => (
      text(a.marca).localeCompare(text(b.marca), 'es')
      || text(a.modelo).localeCompare(text(b.modelo), 'es')
      || (Number(a.anioInicio) || 0) - (Number(b.anioInicio) || 0)
      || text(a.version).localeCompare(text(b.version), 'es', { numeric: true })
    ));
  }, [compatibility, vehicleCatalogDetails, versionsMap, product.oemCode]);

  const compatible = useMemo(() => Boolean(activeVehicle && (isUniversalPart || compatibility.some((item, groupIndex) => {
    const groupRows = compatibilityRows.filter((r) => r.groupIndex === groupIndex);
    return vehicleMatchesCompatibility(activeVehicle, item, groupRows);
  }))), [activeVehicle, isUniversalPart, compatibility, compatibilityRows]);
  // Celular: las mismas filas agrupadas por compatibilidad registrada, como la app.
  const compatibilityGroupCards = useMemo(() => {
    const byGroup = new Map();
    compatibilityRows.forEach((row) => {
      if (!byGroup.has(row.groupIndex)) byGroup.set(row.groupIndex, []);
      byGroup.get(row.groupIndex).push(row);
    });
    return Array.from(byGroup.entries()).map(([groupIndex, rows]) => {
      const unique = (values) => Array.from(new Set(values.filter(Boolean)));
      const starts = rows.map((r) => Number(r.anioInicio)).filter(Number.isFinite);
      const ends = rows.map((r) => Number(r.anioFin)).filter(Number.isFinite);
      return {
        groupIndex,
        rows,
        brands: unique(rows.map((r) => r.marca)),
        models: unique(rows.map((r) => r.modelo)),
        versions: unique(rows.map((r) => r.version)),
        years: compatibilityYearLabel(starts.length ? Math.min(...starts) : null, ends.length ? Math.max(...ends) : null),
        oem: rows[0]?.oem || '',
      };
    });
  }, [compatibilityRows]);
  const compatibilityBrandOptions = useMemo(() => Array.from(new Set(compatibilityRows.map((r) => r.marca).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es')), [compatibilityRows]);
  const visibleCompatibilityGroupCards = useMemo(() => {
    const query = compatibilitySearch.trim().toLocaleLowerCase('es');
    const matches = compatibilityGroupCards.filter((group) => {
      if (compatBrandFilter && !group.brands.includes(compatBrandFilter)) return false;
      if (!query) return true;
      return group.rows.flatMap((r) => [r.marca, r.modelo, r.version, r.motor, r.transmision, r.anioInicio, r.anioFin, r.oem])
        .filter(Boolean).join(' ').toLocaleLowerCase('es').includes(query);
    });
    const label = (group) => `${group.brands[0] || ''} ${group.models[0] || ''}`.trim();
    return [...matches].sort((a, b) => label(a).localeCompare(label(b), 'es') * (compatSortAscending ? 1 : -1));
  }, [compatibilityGroupCards, compatibilitySearch, compatBrandFilter, compatSortAscending]);
  const visibleCompatibilityVehicleCount = visibleCompatibilityGroupCards.reduce((total, group) => total + group.rows.length, 0);
  const toggleCompatGroup = (groupIndex) => {
    setExpandedCompatGroups((current) => {
      const next = new Set(current);
      if (next.has(groupIndex)) next.delete(groupIndex);
      else next.add(groupIndex);
      return next;
    });
  };
  const askSellerFromCompatibility = () => {
    setCompatibilityOpen(false);
    window.setTimeout(() => {
      questionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      questionsSectionRef.current?.querySelector('input')?.focus({ preventScroll: true });
    }, 60);
  };

  // Desde el carrito o el checkout, cuando un repuesto no figura como compatible con el vehículo
  // del comprador: `?abrir=compatibilidad` abre la lista de compatibilidades y `?abrir=preguntas`
  // lleva al formulario para preguntarle a la tienda (el mismo de "Preguntar al vendedor").
  const [searchParams] = useSearchParams();
  const openOnArrival = searchParams.get('abrir');
  useEffect(() => {
    if (openOnArrival === 'compatibilidad') setCompatibilityOpen(true);
    if (openOnArrival !== 'preguntas') return undefined;
    // Con margen para que la ficha termine de pintarse (y el scroll al inicio de la ruta).
    const timer = window.setTimeout(() => {
      questionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      questionsSectionRef.current?.querySelector('input')?.focus({ preventScroll: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [openOnArrival, product.id]);

  const visibleCompatibilityRows = compatibilityRows.filter((row) => {
    const query = compatibilitySearch.trim().toLocaleLowerCase('es');
    if (!query) return true;
    return [row.marca, row.modelo, row.version, row.motor, row.transmision, row.anioInicio, row.anioFin, row.oem]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('es')
      .includes(query);
  });

  const { data: publicQuestions = [] } = useQuery({
    queryKey: qk.productQuestions(product.id),
    queryFn: async ({ signal }) => {
      const response = await getProductQuestionsApi(product.id, { signal });
      return Array.isArray(response) ? response : response?.content || [];
    },
    enabled: Boolean(product.id),
  });

  const questionMutation = useMutation({
    mutationFn: (text) => createProductQuestionApi(product.id, {
      productoId: product.id,
      proveedorId: product.proveedorId ?? null,
      usuarioId: user?.userId ?? user?.id ?? null,
      pregunta: text,
      texto: text,
    }),
    onSuccess: (created) => {
      queryClient.setQueryData(qk.productQuestions(product.id), (old = []) => [created, ...old]);
      // Tambien la bandeja del comprador: se leia con staleTime de 60s, asi que la
      // pregunta recien hecha no aparecia en el perfil hasta recargar la pagina.
      queryClient.invalidateQueries({ queryKey: ['buyerProductQuestions'] });
      setQuestion('');
      setQuestionError('');
    },
    onError: (error) => {
      setQuestionError(error?.message || 'No se pudo publicar la pregunta.');
    },
  });

  // Cuando la patente encuentra coincidencia dentro de la lista, se despeja el
  // buscador de texto (para que el registro no quede oculto por otro filtro) y
  // se hace scroll hasta la tarjeta correspondiente.
  useEffect(() => {
    if (plateMatchIndex === null || plateMatchIndex < 0) return;
    const node = compatibilityItemRefs.current[plateMatchIndex];
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [plateMatchIndex]);

  const changeImage = (direction) => {
    if (images.length < 2) return;
    setActiveImage((current) => (current + direction + images.length) % images.length);
  };

  const searchVehicleByPlate = async (event) => {
    event.preventDefault();
    const plate = plateInput.trim();
    if (!plate) {
      setPlateError('Ingresa tu patente (ej. BBCL12).');
      return;
    }
    setPlateSearching(true);
    setPlateError('');
    setPlateVehicle(null);
    setPlateMatchIndex(null);
    try {
      const resolved = adaptVehicle(await searchVehicleByPatenteApi(plate));
      if (!resolved || resolved.requiereIngresoManual || !resolved.marca) {
        setPlateError(resolved?.mensaje || 'No pudimos identificar un vehículo con esa patente.');
        return;
      }
      setCompatibilitySearch('');
      setPlateVehicle(resolved);
      if (isUniversalPart) {
        setPlateMatchIndex(0);
      } else {
        const matchIndex = compatibility.findIndex((item, groupIndex) => {
          const groupRows = compatibilityRows.filter((r) => r.groupIndex === groupIndex);
          return vehicleMatchesCompatibility(resolved, item, groupRows);
        });
        setPlateMatchIndex(matchIndex);
      }
    } catch (error) {
      setPlateError(error.message || 'No se pudo consultar la patente.');
    } finally {
      setPlateSearching(false);
    }
  };

  // Filtro del catálogo para la categoría (y subcategoría) de este producto. El id puede venir
  // nulo según el endpoint; entonces se filtra por nombre.
  const catalogFilterFor = (withSubcategory) => ({
    categoryId: product.categoriaId || undefined,
    category: product.categoriaId ? undefined : (product.categoriaNombre || undefined),
    subcategoryId: withSubcategory ? (product.subcategoriaId || undefined) : undefined,
    subcategory: withSubcategory && !product.subcategoriaId ? (product.subcategoria || undefined) : undefined,
  });

  const viewCompatibleProducts = () => {
    if (!plateVehicle) return;
    setActiveVehicle(plateVehicle);
    setCompatibilityOpen(false);
    nav.goCatalog(catalogFilterFor(true));
  };

  // Pruebas de lanzamiento 10G (2026-09-24): el dueno veia el formulario para preguntarse a si mismo y,
  // al llegar desde la notificacion "Nueva pregunta", no tenia donde responder. Ahora responde aqui.
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [answerError, setAnswerError] = useState('');
  const answerMutation = useMutation({
    mutationFn: ({ questionId, text }) => answerProductQuestionApi(product.id, questionId, { respuesta: text }),
    onSuccess: (_updated, { questionId, text }) => {
      queryClient.setQueryData(qk.productQuestions(product.id), (old = []) =>
        old.map((item) => (item.id === questionId ? { ...item, respuesta: text } : item)));
      queryClient.invalidateQueries({ queryKey: qk.productQuestions(product.id) });
      setAnswerDrafts((drafts) => ({ ...drafts, [questionId]: '' }));
      setAnswerError('');
    },
    onError: (error) => setAnswerError(error?.message || 'No se pudo publicar la respuesta.'),
  });
  const submitAnswer = (event, questionId) => {
    event.preventDefault();
    const text = (answerDrafts[questionId] || '').trim();
    if (!text || answerMutation.isPending) return;
    answerMutation.mutate({ questionId, text });
  };

  const submitQuestion = (event) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || questionMutation.isPending) return;
    setQuestionError('');
    questionMutation.mutate(text);
  };

  // El método de entrega ya no se pide acá: se elige por tienda en el checkout, donde
  // además se puede pedir la dirección si hace falta. `addToCart` aplica el cambio
  // optimista de forma sincrónica (antes de su primer await), así que "Comprar ahora"
  // salta al carrito de inmediato en vez de esperar el viaje al backend. Ningún
  // marketplace exige dirección para agregar al carro -eso se resuelve en el checkout-,
  // así que se sacó el guard que bloqueaba con un modal cuando `user.comuna` venía vacío.
  // Como en la app, primero se elige cómo recibirlo: viaja con el producto y el carro solo lo
  // confirma. Sin elegir, no se compra ni se agrega: se lleva a "Opciones de entrega".
  const requireShippingMethod = () => {
    if (selectedShippingMethod) return true;
    shippingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setShippingFocused(true);
    clearTimeout(shippingFocusTimer.current);
    shippingFocusTimer.current = setTimeout(() => setShippingFocused(false), 4000);
    return false;
  };
  const cartOptions = () => ({
    shippingMethod: selectedShippingMethod,
    shippingFee: localDeliveryCost(selectedShippingMethod),
  });

  const buyNow = () => {
    if (!requireShippingMethod()) return;
    onAddToCart(product, cartOptions());
    nav.goCart();
  };

  const addToCartNow = async () => {
    if (!requireShippingMethod()) return;
    await onAddToCart(product, cartOptions());
  };

  // Ficha móvil clonada de la app (≤768px) o ficha de escritorio (ProductDetailDesktop): el
  // mismo breakpoint de la tabla de compatibilidades separa ambos layouts.
  const isMobileLayout = !isCompatTableLayout;

  // En escritorio las migas navegan (Inicio, categoría, subcategoría); en el móvil siguen siendo texto.
  const crumbs = [
    { label: 'Inicio', go: nav.goHome },
    { label: category, go: () => nav.goCatalog(catalogFilterFor(false)) },
    ...(product.subcategoria ? [{ label: product.subcategoria, go: () => nav.goCatalog(catalogFilterFor(true)) }] : []),
  ];

  // Una sola instancia para ambos layouts: el móvil la pinta al final; el escritorio, en su
  // columna izquierda bajo la descripción.
  const questionsSection = (
    <ProductQuestionsSection
      ref={questionsSectionRef}
      isOwnProduct={isOwnProduct}
      question={question}
      onQuestionChange={setQuestion}
      onSubmitQuestion={submitQuestion}
      questionPending={questionMutation.isPending}
      questionError={questionError}
      answerError={answerError}
      questions={publicQuestions}
      answerDrafts={answerDrafts}
      onAnswerDraftChange={(questionId, value) => setAnswerDrafts((drafts) => ({ ...drafts, [questionId]: value }))}
      onSubmitAnswer={submitAnswer}
      answerPending={answerMutation.isPending}
    />
  );

  return (
    <main className="product-marketplace-page">
      <div className="product-marketplace-container">
        <div className="product-marketplace-toolbar">
          <button className="product-marketplace-back" type="button" onClick={onBack}>
            <ArrowLeft size={17} /> Volver al catálogo
          </button>
          <nav className="product-marketplace-crumb" aria-label="Ruta del producto">
            {crumbs.map((crumb, index) => (
              <React.Fragment key={crumb.label}>
                {index > 0 && <ChevronRight size={13} />}
                {isMobileLayout
                  ? <span>{crumb.label}</span>
                  : <button type="button" className="product-marketplace-crumb-link" onClick={crumb.go}>{crumb.label}</button>}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {isMobileLayout ? (<>
          <ProductDetailMobile
            product={product}
            images={images}
            activeImage={activeImage}
            setActiveImage={setActiveImage}
            onChangeImage={changeImage}
            favorite={favorite}
            onToggleFavorite={handleToggleFavorite}
            isTopProduct={isTopProduct}
            isBestSeller={isBestSeller}
            condition={condition}
            category={category}
            brandName={brandName}
            city={city}
            sellerName={sellerName}
            stock={stock}
            quoteOnly={quoteOnly}
            isOwnProduct={isOwnProduct}
            compatible={compatible}
            activeVehicle={activeVehicle}
            isUniversalPart={isUniversalPart}
            compatibilityCount={compatibility.length}
            sellerRating={sellerRating}
            sellerReviews={sellerReviews}
            descriptionText={descriptionText}
            descriptionIsLong={descriptionIsLong}
            descriptionExpanded={descriptionExpanded}
            onToggleDescription={() => setDescriptionExpanded((value) => !value)}
            onOpenCompatibility={() => setCompatibilityOpen(true)}
            onOpenBrandModal={() => setBrandModalOpen(true)}
            onOpenStore={onOpenStore}
            shippingMethods={shippingChoices}
            selectedShippingMethod={selectedShippingMethod}
            onSelectShippingMethod={canChooseShipping ? selectShippingMethod : null}
            shippingSectionRef={shippingCardRef}
            shippingFocused={shippingFocused}
          />

          {/* Barra fija de acción como la de la app: favorito + acción principal,
              siempre visible (sin watchSelector: el layout móvil no tiene buybox). */}
          {!isOwnProduct && (quoteOnly ? (
            <MobileStickyBar label="Precio" value="A cotizar" ariaLabel="Cotizar este repuesto">
              <button
                type="button"
                className={`mobile-sticky-bar__btn is-secondary ${favorite ? 'is-favorite' : ''}`}
                onClick={handleToggleFavorite}
                aria-label={favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              >
                <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
              </button>
              <button type="button" className="mobile-sticky-bar__btn" onClick={() => onOpenQuote(product)}><MessageCircle size={18} /> Cotizar</button>
            </MobileStickyBar>
          ) : (
            <MobileStickyBar
              label={stock > 0 ? 'Precio · IVA incluido' : 'Sin stock'}
              value={'$' + Number(product.precio).toLocaleString('es-CL')}
              ariaLabel="Comprar este repuesto"
            >
              <button
                type="button"
                className={`mobile-sticky-bar__btn is-secondary ${favorite ? 'is-favorite' : ''}`}
                onClick={handleToggleFavorite}
                aria-label={favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              >
                <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
              </button>
              <button type="button" className="mobile-sticky-bar__btn is-secondary" disabled={!stock} onClick={addToCartNow} aria-label="Añadir al carro"><ShoppingCart size={20} /></button>
              <button type="button" className="mobile-sticky-bar__btn" disabled={!stock} onClick={buyNow}>Comprar</button>
            </MobileStickyBar>
          ))}

          <RelatedProductsCarousel product={product} onSelectProduct={onSelectProduct} />
          {questionsSection}
        </>) : (
        <>
          <ProductDetailDesktop
            product={product}
            images={images}
            activeImage={activeImage}
            setActiveImage={setActiveImage}
            onChangeImage={changeImage}
            onOpenLightbox={() => setLightboxOpen(true)}
            favorite={favorite}
            onToggleFavorite={handleToggleFavorite}
            isTopProduct={isTopProduct}
            isBestSeller={isBestSeller}
            condition={condition}
            category={category}
            brandName={brandName}
            city={city}
            sellerName={sellerName}
            stock={stock}
            quoteOnly={quoteOnly}
            isOwnProduct={isOwnProduct}
            compatible={compatible}
            activeVehicle={activeVehicle}
            isUniversalPart={isUniversalPart}
            compatibility={compatibility}
            sellerRating={sellerRating}
            sellerReviews={sellerReviews}
            hasSellerRating={hasSellerRating}
            descriptionText={descriptionText}
            descriptionIsLong={descriptionIsLong}
            descriptionExpanded={descriptionExpanded}
            onToggleDescription={() => setDescriptionExpanded((value) => !value)}
            onOpenCompatibility={() => setCompatibilityOpen(true)}
            onOpenBrandModal={() => setBrandModalOpen(true)}
            onOpenStore={onOpenStore}
            onOpenQuote={onOpenQuote}
            onBuyNow={buyNow}
            onAddToCart={addToCartNow}
            canChooseShipping={canChooseShipping}
            shippingChoices={shippingChoices}
            shippingMethods={shippingMethods}
            selectedShippingMethod={selectedShippingMethod}
            onSelectShippingMethod={selectShippingMethod}
            shippingCardRef={shippingCardRef}
            shippingFocused={shippingFocused}
            questions={questionsSection}
          />
          <RelatedProductsCarousel product={product} onSelectProduct={onSelectProduct} />
        </>
        )}
      </div>

      {compatibilityOpen && (
        <div className="product-compatibility-modal-backdrop" role="presentation" onMouseDown={() => setCompatibilityOpen(false)}>
          <section className={`product-compatibility-modal ${isCompatTableLayout ? 'has-table' : ''}`} role="dialog" aria-modal="true" aria-labelledby="compatibility-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            {isCompatTableLayout ? (
            <header>
              <span><Car /></span>
              <div><h2 id="compatibility-modal-title">Compatibilidades del producto</h2><p>Estos son vehículos de <strong>otros compradores</strong> registrados por el vendedor. Ingresa tu patente para confirmar si tu vehículo calza con este repuesto.</p></div>
              <button type="button" aria-label="Cerrar compatibilidades" onClick={() => setCompatibilityOpen(false)}><X /></button>
            </header>
            ) : (
              /* Celular: hoja inferior con el mismo diseño que la app (manija, icono, titulo,
                 cerrar; buscador + Filtrar; chips de marca; contador y orden). */
              <header className="compat-sheet-header">
                <i className="compat-sheet-handle" aria-hidden="true" />
                <span className="compat-sheet-badge"><Car /></span>
                <div className="compat-sheet-title">
                  <h2 id="compatibility-modal-title">Compatibilidades</h2>
                  <p>Vehículos compatibles con este repuesto.</p>
                </div>
                <button type="button" className="compat-sheet-close" aria-label="Cerrar compatibilidades" onClick={() => setCompatibilityOpen(false)}><X /></button>
                <div className="compat-sheet-tools">
                  <label className="compat-sheet-search">
                    <Search />
                    <input value={compatibilitySearch} onChange={(event) => setCompatibilitySearch(event.target.value)} placeholder="Buscar por marca o modelo..." />
                  </label>
                  <button
                    type="button"
                    className={`compat-sheet-filter ${compatFiltersOpen ? 'is-active' : ''}`}
                    aria-expanded={compatFiltersOpen}
                    onClick={() => setCompatFiltersOpen((value) => !value)}
                  >
                    <SlidersHorizontal /> Filtrar
                  </button>
                </div>
                {compatFiltersOpen && (
                  <div className="compat-sheet-brands" role="group" aria-label="Filtrar por marca">
                    <button type="button" className={compatBrandFilter === null ? 'is-active' : ''} onClick={() => setCompatBrandFilter(null)}>Todas</button>
                    {compatibilityBrandOptions.map((brand) => (
                      <button key={brand} type="button" className={compatBrandFilter === brand ? 'is-active' : ''} onClick={() => setCompatBrandFilter(brand)}>{brand}</button>
                    ))}
                  </div>
                )}
                <div className="compat-sheet-results">
                  <strong>{visibleCompatibilityVehicleCount} {visibleCompatibilityVehicleCount === 1 ? 'vehículo compatible' : 'vehículos compatibles'}</strong>
                  <button type="button" onClick={() => setCompatSortAscending((value) => !value)}>
                    {compatSortAscending ? 'Más recientes' : 'Marca A–Z'} <ChevronDown />
                  </button>
                </div>
              </header>
            )}

            <div className={`product-compatibility-modal-controls ${isCompatTableLayout ? '' : 'is-sheet'}`}>
              <form className="product-compatibility-plate-check" onSubmit={searchVehicleByPlate}>
                <label>
                  <Car />
                  <input
                    value={plateInput}
                    maxLength={8}
                    onChange={(event) => { setPlateInput(event.target.value.toUpperCase()); }}
                    placeholder="Ingresa tu patente (ej. BBCL12)"
                  />
                </label>
                <button type="submit" disabled={plateSearching}>{plateSearching ? 'Buscando...' : 'Buscar'}</button>
              </form>
              {plateError && <div className="product-compatibility-plate-error"><AlertTriangle /> {plateError}</div>}

              {plateVehicle && plateMatchIndex !== null && plateMatchIndex >= 0 && (
                <div className="product-compatibility-plate-banner is-match">
                  <CheckCircle2 />
                  <div>
                    <strong>Tu {plateVehicle.marca} {plateVehicle.modelo}{plateVehicle.anio ? ` (${plateVehicle.anio})` : ''} es compatible con este repuesto.</strong>
                    <span>{isUniversalPart ? 'Este repuesto es universal: es compatible con cualquier vehículo.' : 'Lo destacamos en la lista de abajo.'}</span>
                  </div>
                </div>
              )}
              {plateVehicle && plateMatchIndex === -1 && (
                <div className="product-compatibility-plate-banner is-nomatch">
                  <AlertTriangle />
                  <div>
                    <strong>Tu {plateVehicle.marca} {plateVehicle.modelo}{plateVehicle.anio ? ` (${plateVehicle.anio})` : ''} no figura entre las compatibilidades que registró el vendedor para este repuesto.</strong>
                    <span>Evita compras incompatibles: revisa los repuestos que sí son compatibles con tu vehículo.</span>
                    <button type="button" onClick={viewCompatibleProducts}>
                      Ver repuestos compatibles con mi vehículo <ChevronRight />
                    </button>
                  </div>
                </div>
              )}

              {isCompatTableLayout && (
                <div className="product-compatibility-modal-toolbar">
                  <label><Search /><input value={compatibilitySearch} onChange={(event) => setCompatibilitySearch(event.target.value)} placeholder="Buscar por marca, modelo, versión, motor o año" /></label>
                  <span>{`${visibleCompatibilityRows.length} de ${compatibilityRows.length} ${compatibilityRows.length === 1 ? 'vehículo compatible' : 'vehículos compatibles'}`}</span>
                </div>
              )}
            </div>
            <div className={`product-compatibility-modal-list ${isCompatTableLayout ? 'is-table' : ''}`}>
              {isCompatTableLayout ? (
                visibleCompatibilityRows.length > 0 ? (
                  <div className="product-compatibility-table-wrap">
                    <table className="product-compatibility-table">
                      <thead>
                        <tr>
                          <th scope="col">Marca</th>
                          <th scope="col">Modelo</th>
                          <th scope="col">Año</th>
                          <th scope="col">Versión</th>
                          <th scope="col">Motor</th>
                          <th scope="col">Transmisión</th>
                          <th scope="col">Ref. OEM</th>
                          <th scope="col">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // El scroll a la coincidencia por patente apunta a la primera fila del grupo.
                          const groupsWithRef = new Set();
                          return visibleCompatibilityRows.map((row) => {
                            const isMatch = row.groupIndex === plateMatchIndex;
                            const takesRef = !groupsWithRef.has(row.groupIndex);
                            if (takesRef) groupsWithRef.add(row.groupIndex);
                            return (
                              <tr
                                key={row.key}
                                ref={takesRef ? (node) => { compatibilityItemRefs.current[row.groupIndex] = node; } : undefined}
                                className={isMatch ? 'is-plate-match' : ''}
                              >
                                <td className="is-strong">{row.marca || '—'}</td>
                                <td className="is-strong">{row.modelo || '—'}</td>
                                <td className="is-nowrap">{compatibilityYearLabel(row.anioInicio, row.anioFin)}</td>
                                <td><span className="product-compatibility-table-version">{row.version || '—'}</span></td>
                                <td>{row.motor || 'No especificado'}</td>
                                <td>{row.transmision || '—'}</td>
                                <td className="is-mono">{row.oem || 'No informada'}</td>
                                <td>
                                  {isMatch
                                    ? <span className="product-compatibility-seller-check is-plate-match"><CheckCircle2 /> Es tu vehículo</span>
                                    : <span className="product-compatibility-seller-check"><CheckCircle2 /> Registrada</span>}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="product-compatibility-empty"><Search /><strong>No encontramos compatibilidades</strong><span>Prueba con otro término de búsqueda.</span></div>
                )
              ) : (
                <>
                  {visibleCompatibilityGroupCards.map((group) => {
                    const brand = group.brands[0] || 'Vehículo';
                    const model = group.models.join(', ') || 'Modelo no informado';
                    const summary = group.versions[0] || group.rows[0]?.motor || 'Versión por confirmar';
                    const expanded = expandedCompatGroups.has(group.groupIndex);
                    const isMatch = group.groupIndex === plateMatchIndex;
                    return (
                      <article
                        key={group.groupIndex}
                        ref={(node) => { compatibilityItemRefs.current[group.groupIndex] = node; }}
                        className={`compat-sheet-card ${expanded ? 'is-expanded' : ''} ${isMatch ? 'is-plate-match' : ''}`}
                      >
                        <button
                          type="button"
                          className="compat-sheet-card-summary"
                          aria-expanded={expanded}
                          aria-label={`${expanded ? 'Ocultar' : 'Mostrar'} detalles de ${brand} ${model}`}
                          onClick={() => toggleCompatGroup(group.groupIndex)}
                        >
                          <span className="compat-sheet-logo"><VehicleBrandLogo brand={brand} /></span>
                          <span className="compat-sheet-card-copy">
                            <strong>{brand} {model}</strong>
                            <em>{summary}</em>
                            <span className="compat-sheet-badges">
                              <b className="is-year">Años {group.years}</b>
                              {isMatch
                                ? <b className="is-mine"><CheckCircle2 /> Es tu vehículo</b>
                                : <b className="is-ok"><CheckCircle2 /> Compatible</b>}
                            </span>
                          </span>
                          {expanded ? <ChevronUp className="compat-sheet-chevron" /> : <ChevronRight className="compat-sheet-chevron" />}
                        </button>
                        {expanded && (
                          <div className="compat-sheet-card-body">
                            <div className="compat-sheet-details">
                              <div><span>Marca</span><strong>{group.brands.join(', ') || 'No informada'}</strong></div>
                              <div><span>Modelo</span><strong>{model}</strong></div>
                              <div><span>Años</span><strong>{group.years}</strong></div>
                              <div><span>Ref. OEM</span><strong>{group.oem || 'No informada'}</strong></div>
                            </div>
                            {group.rows.map((row, rowIndex) => (
                              <div key={row.key} className="compat-sheet-version">
                                <Car />
                                <span>
                                  <strong>{row.version || `Configuración ${rowIndex + 1}`}</strong>
                                  <em>{[row.motor, row.transmision].filter(Boolean).join(' · ') || 'Motor y transmisión por confirmar'}</em>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {visibleCompatibilityGroupCards.length === 0 && (
                    <div className="compat-sheet-empty"><Car /><strong>No encontramos coincidencias</strong><span>Prueba con otra marca o modelo.</span></div>
                  )}
                  <div className="compat-sheet-help">
                    <Info />
                    <span>
                      <strong>¿No encuentras tu vehículo?</strong>
                      <em>Revisa el número OEM o consulta con el vendedor.</em>
                    </span>
                    <button type="button" onClick={askSellerFromCompatibility}>Preguntar al vendedor</button>
                  </div>
                  <p className="compat-sheet-disclaimer"><ShieldCheck /> La compatibilidad es referencial. Confirma con el vendedor antes de comprar.</p>
                </>
              )}
            </div>
            {isCompatTableLayout && <footer><ShieldCheck /><span>Confirma siempre la compatibilidad con tu patente o código OEM antes de comprar.</span><button type="button" onClick={() => setCompatibilityOpen(false)}>Entendido</button></footer>}
          </section>
        </div>
      )}

      <ProductBrandModal
        isOpen={brandModalOpen}
        onClose={() => setBrandModalOpen(false)}
        brand={brandName}
        product={product}
      />

      {lightboxOpen && !isMobileLayout && (
        <ProductPhotoLightbox
          images={images}
          index={activeImage}
          product={product}
          title={product.titulo}
          onClose={() => setLightboxOpen(false)}
          onChange={changeImage}
          onSelect={setActiveImage}
        />
      )}
    </main>
  );
}
