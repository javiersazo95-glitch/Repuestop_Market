import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Car, CheckCircle2, ChevronLeft, ChevronRight, CreditCard,
  Heart, Landmark, MapPin, MessageCircle, Package, Search, Send, ShieldCheck,
  ShoppingCart, Star, Truck, Wrench, X
} from 'lucide-react';
import { CATEGORY_IMAGE_BY_ID } from '../data/categories';
import { parseShippingMethods, resolveShippingService, shippingMethodPrice } from '../data/shippingMethods';
import { createProductQuestionApi, getProductQuestionsApi, searchVehicleByPatenteApi } from '../services/api';
import { adaptVehicle } from '../services/adapters';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import StoreLogoBadge from './StoreLogoBadge';
import RelatedProductsCarousel from './RelatedProductsCarousel';

// Compara el vehículo resuelto por patente contra un registro de compatibilidad
// del repuesto. El modelo del vehículo puede traer la versión pegada (p.ej.
// "D-Max LTZ"), así que se usa coincidencia parcial en vez de igualdad estricta.
function vehicleMatchesCompatibility(vehicle, item) {
  const norm = (value) => String(value || '').toLocaleLowerCase('es').trim();
  const marcaOk = norm(vehicle.marca) === norm(item.marca);
  const vehicleModelo = norm(vehicle.modelo);
  const itemModelo = norm(item.modelo);
  const modeloOk = Boolean(itemModelo) && (vehicleModelo.includes(itemModelo) || itemModelo.includes(vehicleModelo));
  const anio = Number(vehicle.anio) || null;
  const anioOk = !anio || ((!item.anioInicio || anio >= item.anioInicio) && (!item.anioFin || anio <= item.anioFin));
  return marcaOk && modeloOk && anioOk;
}

export default function ProductDetailPage({ product, user, activeVehicle, onBack, onAddToCart, onOpenQuote, onOpenStore, onSelectProduct }) {
  const images = (product.imagenes?.length
    ? product.imagenes
    : [product.imagen || CATEGORY_IMAGE_BY_ID[product.categoria]]).filter(Boolean);
  const [activeImage, setActiveImage] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [question, setQuestion] = useState('');
  const [publicQuestions, setPublicQuestions] = useState([]);
  const [questionSending, setQuestionSending] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [compatibilityOpen, setCompatibilityOpen] = useState(false);
  const [compatibilitySearch, setCompatibilitySearch] = useState('');
  const [plateInput, setPlateInput] = useState('');
  const [plateSearching, setPlateSearching] = useState(false);
  const [plateError, setPlateError] = useState('');
  const [plateVehicle, setPlateVehicle] = useState(null);
  const [plateMatchIndex, setPlateMatchIndex] = useState(null);
  const compatibilityItemRefs = useRef([]);
  const { setActiveVehicle } = useMarketplace();
  const nav = useAppNavigation();
  const stock = Number(product.stock || 0);
  const pricingMode = String(product.pricingMode || '').toUpperCase();
  const quoteOnly = pricingMode === 'QUOTE_ONLY' || pricingMode === 'COTIZACION' || product.soloCotizacion || !product.precio;
  const rawSeller = product.vendedor;
  const seller = typeof rawSeller === 'object' ? (rawSeller?.nombre || rawSeller?.razonSocial) : rawSeller;
  const sellerName = seller || 'Tienda verificada';
  const compatibility = product.compatibilidad || [];
  const compatible = activeVehicle && compatibility.some((item) =>
    item.marca?.toLowerCase() === activeVehicle.marca?.toLowerCase()
    && item.modelo?.toLowerCase() === activeVehicle.modelo?.toLowerCase());
  const category = product.categoriaNombre || product.categoria || 'Repuestos';
  const condition = product.condicion || 'Original';
  const city = product.ciudadVendedor || 'Chile';
  // Reputación real de la tienda. Antes la ficha mostraba "4.8" y "+5 años"
  // fijos en el código para cualquier vendedor.
  const sellerRating = Number(product.vendedorRating ?? 0);
  const sellerReviews = Number(product.vendedorReviewCount ?? 0);
  const hasSellerRating = sellerRating > 0;
  const shippingMethods = parseShippingMethods(product.metodosEnvio);
  // El distintivo "Más vendido" solo aparece cuando el producto registra ventas.
  const isBestSeller = Number(product.vendidos || 0) > 0;
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const descriptionText = product.descripcion
    || 'Repuesto publicado por una tienda verificada en RepuesTop. Consulta la compatibilidad antes de completar tu compra.';
  const descriptionIsLong = descriptionText.length > 320;
  const visibleCompatibilities = compatibility.filter((item) => {
    const query = compatibilitySearch.trim().toLocaleLowerCase('es');
    if (!query) return true;
    return [item.marca, item.modelo, item.version, item.motor, item.anioInicio, item.anioFin]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('es')
      .includes(query);
  });

  useEffect(() => {
    let cancelled = false;
    getProductQuestionsApi(product.id)
      .then((response) => {
        if (!cancelled) setPublicQuestions(Array.isArray(response) ? response : response?.content || []);
      })
      .catch(() => { if (!cancelled) setPublicQuestions([]); });
    return () => { cancelled = true; };
  }, [product.id]);

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
    // Patente de prueba para validar el flujo sin depender del endpoint real
    // (que exige sesión iniciada): ABCD11 resuelve directo a un Toyota Yaris 2018.
    const normalizedPlate = plate.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (normalizedPlate === 'ABCD11') {
      const testVehicle = { marca: 'Toyota', modelo: 'Yaris', anio: 2018, patente: normalizedPlate };
      setCompatibilitySearch('');
      setPlateVehicle(testVehicle);
      setPlateMatchIndex(compatibility.findIndex((item) => vehicleMatchesCompatibility(testVehicle, item)));
      setPlateSearching(false);
      return;
    }
    try {
      const resolved = adaptVehicle(await searchVehicleByPatenteApi(plate));
      if (!resolved || resolved.requiereIngresoManual || !resolved.marca) {
        setPlateError(resolved?.mensaje || 'No pudimos identificar un vehículo con esa patente.');
        return;
      }
      setCompatibilitySearch('');
      setPlateVehicle(resolved);
      const matchIndex = compatibility.findIndex((item) => vehicleMatchesCompatibility(resolved, item));
      setPlateMatchIndex(matchIndex);
    } catch (error) {
      setPlateError(error.message || 'No se pudo consultar la patente.');
    } finally {
      setPlateSearching(false);
    }
  };

  const viewCompatibleProducts = () => {
    if (!plateVehicle) return;
    setActiveVehicle(plateVehicle);
    setCompatibilityOpen(false);
    nav.goCatalog({
      categoryId: product.categoriaId || undefined,
      category: product.categoriaId ? undefined : (product.categoriaNombre || undefined),
      subcategoryId: product.subcategoriaId || undefined,
      subcategory: product.subcategoriaId ? undefined : (product.subcategoria || undefined),
    });
  };

  const submitQuestion = async (event) => {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    setQuestionSending(true);
    setQuestionError('');
    try {
      const created = await createProductQuestionApi(product.id, {
        productoId: product.id,
        proveedorId: product.proveedorId ?? null,
        usuarioId: user?.userId ?? user?.id ?? null,
        pregunta: text,
        texto: text,
      });
      setPublicQuestions((current) => [created, ...current]);
      setQuestion('');
    } catch (error) {
      setQuestionError(error.message || 'No se pudo publicar la pregunta.');
    } finally {
      setQuestionSending(false);
    }
  };

  return (
    <main className="product-marketplace-page">
      <div className="product-marketplace-container">
        <div className="product-marketplace-toolbar">
          <button className="product-marketplace-back" type="button" onClick={onBack}>
            <ArrowLeft size={17} /> Volver al catálogo
          </button>
          <nav className="product-marketplace-crumb" aria-label="Ruta del producto">
            <span>Inicio</span><ChevronRight size={13} /><span>{category}</span>
            {product.subcategoria && <><ChevronRight size={13} /><span>{product.subcategoria}</span></>}
          </nav>
        </div>

        <section className="product-marketplace-layout">
          <article className={`product-marketplace-gallery ${images.length > 1 ? '' : 'single-image'}`}>
            {isBestSeller && <span className="product-marketplace-ranking">Más vendido</span>}
            <button
              className={`product-marketplace-favorite ${favorite ? 'active' : ''}`}
              type="button"
              aria-label="Agregar a favoritos"
              onClick={() => setFavorite((value) => !value)}
            >
              <Heart size={22} fill={favorite ? 'currentColor' : 'none'} />
            </button>
            <div className="product-marketplace-photo">
              {images[activeImage]
                ? <img src={images[activeImage]} alt={product.titulo} />
                : <Package size={76} />}
            </div>
            {images.length > 1 && <>
              <button className="product-marketplace-image-arrow previous" type="button" onClick={() => changeImage(-1)} aria-label="Imagen anterior"><ChevronLeft /></button>
              <button className="product-marketplace-image-arrow next" type="button" onClick={() => changeImage(1)} aria-label="Imagen siguiente"><ChevronRight /></button>
            </>}
            {/* Con una sola foto la tira de miniaturas es una barra vacía: se omite
                y la imagen ocupa todo el alto de la galería. */}
            {images.length > 1 && <div className="product-marketplace-thumbs">
              {images.map((image, index) => (
                <button key={`${image}-${index}`} type="button" className={index === activeImage ? 'active' : ''} onClick={() => setActiveImage(index)}>
                  <img src={image} alt={`Vista ${index + 1} de ${product.titulo}`} />
                </button>
              ))}
            </div>}
          </article>

          <article className="product-marketplace-summary">
            <div className="product-marketplace-condition"><i /> {condition.toUpperCase()} <span>·</span> {stock} disponibles</div>
            <div className="product-marketplace-title-row">
              <h1>{product.titulo}</h1>
              <span className="product-marketplace-verified"><BadgeCheck size={18} /> Producto verificado</span>
            </div>
            <div className="product-marketplace-brand">
              <span>{category}</span>
              {product.marca && <span>Marca: <b>{product.marca}</b></span>}
            </div>
            {compatible && <div className="product-marketplace-match"><CheckCircle2 size={18} /> Compatible con tu {activeVehicle.marca} {activeVehicle.modelo}</div>}
            <div className="product-marketplace-code">Código OEM / SKU: <strong>{product.oemCode || product.sku || 'No informado'}</strong></div>
            <div className={`product-marketplace-description ${descriptionIsLong ? 'clamped' : ''} ${descriptionExpanded ? 'expanded' : ''}`}>
              <p>{descriptionText}</p>
            </div>
            {descriptionIsLong && (
              <button type="button" className="product-marketplace-description-toggle" onClick={() => setDescriptionExpanded((value) => !value)}>
                {descriptionExpanded ? 'Ver menos' : 'Ver descripción completa'}
                <ChevronRight size={13} />
              </button>
            )}

            <section className="product-marketplace-store">
              <span className="product-marketplace-store-logo">
                {product.logoTienda
                  ? <img src={product.logoTienda} alt={`Logo de ${sellerName}`} referrerPolicy="no-referrer" />
                  : <StoreLogoBadge name={sellerName} seed={product.proveedorId || 0} size={46} />}
              </span>

              <div className="product-marketplace-store-copy">
                <small>Vendido por</small>
                <strong title={sellerName}>{sellerName} <BadgeCheck size={15} /></strong>
                <small className="product-marketplace-store-place"><MapPin size={12} /> Tienda verificada en {city}</small>
              </div>

              {hasSellerRating && (
                <div className="product-marketplace-rating">
                  <Star size={15} fill="currentColor" />
                  <strong>{sellerRating.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
                  <small>{sellerReviews === 1 ? '1 evaluación' : `${sellerReviews} evaluaciones`}</small>
                </div>
              )}

              {onOpenStore && (
                <button type="button" className="product-marketplace-store-link" onClick={() => onOpenStore(product)}>
                  Ver tienda <ChevronRight size={14} />
                </button>
              )}
            </section>

            <div className="product-marketplace-benefits">
              <span><Truck /><b>Despacho rápido</b><small>Envíos a todo Chile</small></span>
              <span><CheckCircle2 /><b>Devoluciones fáciles</b><small>Hasta 30 días</small></span>
              <span><ShieldCheck /><b>Calidad garantizada</b><small>Productos verificados</small></span>
            </div>
          </article>

          <aside className="product-marketplace-buybox">
            <div className="product-marketplace-buy-status"><span><i /> {stock > 0 ? 'Disponible' : 'Sin stock'}</span><small>{stock} disponibles</small></div>
            {quoteOnly ? (
              <>
                <h2>Precio a cotizar</h2>
                <p>Solicita el precio final y las alternativas de despacho directamente a la tienda.</p>
                <button className="product-marketplace-primary quote" type="button" onClick={() => onOpenQuote(product)}><MessageCircle /> Cotizar con la tienda</button>
              </>
            ) : (
              <>
                <div className="product-marketplace-price">${Number(product.precio).toLocaleString('es-CL')} <small>CLP</small></div>
                <p>IVA incluido</p>
                <button className="product-marketplace-primary" type="button" disabled={!stock} onClick={() => onAddToCart(product)}><ShoppingCart /> Comprar producto</button>
              </>
            )}

            <div className="product-marketplace-flow">
              <div><small>Paga con</small><strong>flow</strong><span>Procesamos tu pago con Flow</span></div>
              {!quoteOnly && Number(product.precio) > 0 && (
                <div className="product-marketplace-installments">
                  <p className="product-marketplace-installments-hint"><CreditCard /> Simula tus cuotas con Flow</p>
                  <div className="product-marketplace-installments-grid">
                    {[3, 6, 12].map((cuotas) => (
                      <div key={cuotas}>
                        <strong>{cuotas}x</strong>
                        <span>${Math.ceil(Number(product.precio) / cuotas).toLocaleString('es-CL')}</span>
                      </div>
                    ))}
                  </div>
                  <small>Valor aproximado por cuota, sin interés. Confirma las condiciones finales al pagar con Flow.</small>
                </div>
              )}
              <div className="product-marketplace-card-brands" aria-label="Tarjetas aceptadas">
                <span className="payment-brand-logo payment-brand-visa" aria-label="Visa">VISA</span>
                <span className="payment-brand-logo payment-brand-mastercard" aria-label="Mastercard"><i /><i /><small>mastercard</small></span>
                <span className="payment-brand-logo payment-brand-redcompra" aria-label="Redcompra"><b>Red</b><b>compra</b></span>
              </div>
            </div>

            <div className="product-marketplace-assurances">
              <span><ShieldCheck /><p><b>Compra segura y protegida</b><small>Tu información está 100% protegida</small></p></span>

              {/* Métodos de entrega reales publicados por la tienda; si todavía no
                  declaró ninguno se muestra el respaldo genérico. */}
              {shippingMethods.length ? shippingMethods.map((method) => {
                const { icon: ShippingIcon, label } = resolveShippingService(method);
                const price = shippingMethodPrice(method);
                return (
                  <span key={method}>
                    <ShippingIcon />
                    <p><b>{label}</b><small>{price ? `Valor informado por la tienda: ${price}` : 'Coordinado con la tienda'}</small></p>
                  </span>
                );
              }) : (
                <span><Truck /><p><b>Despacho a coordinar</b><small>La tienda informa el valor al confirmar tu pedido</small></p></span>
              )}

              <span><Landmark /><p><b>Transferencia vía Khipu</b><small>Disponible como alternativa de pago</small></p></span>
            </div>
          </aside>

          <section className="product-marketplace-info-grid">
            <article>
              <h2><Package /> Detalles del producto</h2>
              <dl>
                <div><dt>Categoría</dt><dd>{category}</dd></div>
                <div><dt>Subcategoría</dt><dd>{product.subcategoria || 'No especificada'}</dd></div>
                <div><dt>OEM / SKU</dt><dd>{product.oemCode || product.sku || 'No informado'}</dd></div>
                <div><dt>Condición</dt><dd><span>{condition}</span></dd></div>
              </dl>
            </article>
            <article>
              <h2><Car /> Otras compatibilidades</h2>
              {compatibility.length ? (
                <ul className="product-marketplace-compat-list">
                  {compatibility.slice(0, 2).map((item, index) => (
                    <li key={`${item.marca}-${item.modelo}-${index}`}>
                      <span className="product-marketplace-compat-vehicle">
                        {[item.marca, item.modelo].filter(Boolean).join(' ') || 'Vehículo compatible'}
                      </span>
                      <span className="product-marketplace-compat-tags">
                        {(item.anioInicio || item.anioFin) && (
                          <b>{item.anioInicio || '—'}{item.anioFin && item.anioFin !== item.anioInicio ? `–${item.anioFin}` : ''}</b>
                        )}
                        {item.version && <b>{item.version}</b>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p>Consulta a la tienda con tu patente o código OEM para confirmar el calce.</p>}
              <button type="button" onClick={() => setCompatibilityOpen(true)}>
                {compatibility.length > 2 ? `Ver todas las compatibilidades (${compatibility.length})` : compatibility.length > 0 ? 'Ver detalle de compatibilidad' : 'Ver compatibilidades'}
                <ChevronRight />
              </button>
            </article>
            <article>
              <h2><ShieldCheck /> Compra protegida</h2>
              <p>Tu compra queda protegida y puedes pagar con Flow o Khipu según la alternativa disponible.</p>
              <span className="product-marketplace-protected"><BadgeCheck /> Pago y despacho trazables</span>
            </article>
          </section>
        </section>

        <RelatedProductsCarousel product={product} onSelectProduct={onSelectProduct} />

        <section className="product-marketplace-questions">
          <div className="product-marketplace-questions-head">
            <div><h2><MessageCircle /> Preguntas públicas</h2><p>Haz preguntas públicas y ayuda a otros compradores.</p></div>
            <form onSubmit={submitQuestion}><label><Search /><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Haz tu pregunta sobre este producto..." /></label><button type="submit" disabled={questionSending}><Send /> {questionSending ? 'Enviando...' : 'Enviar pregunta'}</button></form>
          </div>
          {questionError && <div className="product-marketplace-question-error">{questionError}</div>}
          {publicQuestions.length > 0 ? <div className="product-marketplace-question-list">
            {publicQuestions.map((item, index) => {
              const text = item.pregunta || item.texto || item.question || item.message || 'Pregunta sin detalle';
              const answer = item.respuesta || item.answer || item.sellerResponse || '';
              return <article key={item.id || index}><span>Pregunta pública</span><strong>{text}</strong><p>{answer ? <><b>Respuesta de la tienda:</b> {answer}</> : 'La tienda todavía no ha respondido.'}</p></article>;
            })}
          </div> : <div className="product-marketplace-no-questions"><MessageCircle /><span><strong>Aún no hay preguntas sobre este producto</strong><small>Sé la primera persona en consultar a la tienda.</small></span></div>}
        </section>
      </div>

      {compatibilityOpen && (
        <div className="product-compatibility-modal-backdrop" role="presentation" onMouseDown={() => setCompatibilityOpen(false)}>
          <section className="product-compatibility-modal" role="dialog" aria-modal="true" aria-labelledby="compatibility-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <span><Car /></span>
              <div><h2 id="compatibility-modal-title">Compatibilidades del producto</h2><p>Estos son vehículos de <strong>otros compradores</strong> registrados por el vendedor. Ingresa tu patente para confirmar si tu vehículo calza con este repuesto.</p></div>
              <button type="button" aria-label="Cerrar compatibilidades" onClick={() => setCompatibilityOpen(false)}><X /></button>
            </header>

            <div className="product-compatibility-modal-controls">
              <form className="product-compatibility-plate-check" onSubmit={searchVehicleByPlate}>
                <label>
                  <Car />
                  <input
                    value={plateInput}
                    onChange={(event) => { setPlateInput(event.target.value); }}
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
                    <span>Lo destacamos en la lista de abajo.</span>
                  </div>
                </div>
              )}
              {plateVehicle && plateMatchIndex === -1 && (
                <div className="product-compatibility-plate-banner is-nomatch">
                  <AlertTriangle />
                  <div>
                    <strong>Tu {plateVehicle.marca} {plateVehicle.modelo}{plateVehicle.anio ? ` (${plateVehicle.anio})` : ''} no figura entre las compatibilidades que registró el vendedor para este repuesto.</strong>
                    <span>Evita comprar algo que no calce: revisa los repuestos que sí son compatibles con tu vehículo.</span>
                    <button type="button" onClick={viewCompatibleProducts}>
                      Ver repuestos compatibles con mi vehículo <ChevronRight />
                    </button>
                  </div>
                </div>
              )}

              <div className="product-compatibility-modal-toolbar">
                <label><Search /><input value={compatibilitySearch} onChange={(event) => setCompatibilitySearch(event.target.value)} placeholder="Buscar por marca, modelo, versión, motor o año" /></label>
                <span>{visibleCompatibilities.length} de {compatibility.length} compatibilidades</span>
              </div>
            </div>
            <div className="product-compatibility-modal-list">
              {visibleCompatibilities.length > 0 ? visibleCompatibilities.map((item, index) => (
                <article
                  key={`${item.marca}-${item.modelo}-${item.version}-${item.motor}-${index}`}
                  ref={(node) => { compatibilityItemRefs.current[index] = node; }}
                  className={index === plateMatchIndex ? 'is-plate-match' : ''}
                >
                  <span className="product-compatibility-car-icon"><Car /></span>
                  <div className="product-compatibility-copy">
                    <h3>{[item.marca, item.modelo].filter(Boolean).join(' ') || 'Vehículo compatible'}</h3>
                    <div className="product-compatibility-fields">
                      <div><span>Marca</span><strong>{item.marca || '—'}</strong></div>
                      <div><span>Modelo</span><strong>{item.modelo || '—'}</strong></div>
                      <div><span>Año</span><strong>{(item.anioInicio || item.anioFin) ? `${item.anioInicio || '—'}${item.anioFin && item.anioFin !== item.anioInicio ? `–${item.anioFin}` : ''}` : '—'}</strong></div>
                      <div><span>Versión</span><strong>{item.version || '—'}</strong></div>
                    </div>
                    {item.motor && <p><Wrench /> Motor: <strong>{item.motor}</strong></p>}
                  </div>
                  {index === plateMatchIndex
                    ? <span className="product-compatibility-seller-check is-plate-match"><CheckCircle2 /> Es tu vehículo</span>
                    : <span className="product-compatibility-seller-check"><CheckCircle2 /> Registrada por el vendedor</span>}
                </article>
              )) : (
                <div className="product-compatibility-empty"><Search /><strong>No encontramos compatibilidades</strong><span>Prueba con otro término de búsqueda.</span></div>
              )}
            </div>
            <footer><ShieldCheck /><span>Confirma siempre el calce con tu patente, VIN o código OEM antes de comprar.</span><button type="button" onClick={() => setCompatibilityOpen(false)}>Entendido</button></footer>
          </section>
        </div>
      )}
    </main>
  );
}
