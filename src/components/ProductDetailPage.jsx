import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, BadgeCheck, CalendarDays, Car, CheckCircle2, ChevronLeft, ChevronRight, CreditCard,
  Heart, Landmark, MapPin, MessageCircle, Package, Search, Send, ShieldCheck,
  ShoppingCart, Star, Store, Truck, Wrench, X
} from 'lucide-react';
import { CATEGORY_IMAGE_BY_ID } from '../data/categories';
import { createProductQuestionApi, getProductQuestionsApi } from '../services/api';

export default function ProductDetailPage({ product, user, activeVehicle, onBack, onAddToCart, onOpenQuote }) {
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

  const changeImage = (direction) => {
    if (images.length < 2) return;
    setActiveImage((current) => (current + direction + images.length) % images.length);
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
          <article className="product-marketplace-gallery">
            <span className="product-marketplace-ranking">Más vendido</span>
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
            <div className="product-marketplace-thumbs">
              {images.map((image, index) => (
                <button key={`${image}-${index}`} type="button" className={index === activeImage ? 'active' : ''} onClick={() => setActiveImage(index)}>
                  <img src={image} alt={`Vista ${index + 1} de ${product.titulo}`} />
                </button>
              ))}
            </div>
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
            <p className="product-marketplace-description">{product.descripcion || 'Repuesto publicado por una tienda verificada en RepuesTop. Consulta la compatibilidad antes de completar tu compra.'}</p>

            <section className="product-marketplace-store">
              <span className="product-marketplace-store-icon"><Store size={23} /></span>
              <div><strong>Vendido por <b>{sellerName}</b> <BadgeCheck size={15} /></strong><small><MapPin size={13} /> Tienda verificada en {city}</small></div>
              <div className="product-marketplace-rating"><Star size={17} fill="currentColor" /><strong>4.8</strong><small>Calificación</small></div>
              <div className="product-marketplace-seniority"><BadgeCheck size={17} /><strong>+5 años</strong><small>en el mercado</small></div>
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
              <p><CreditCard /> Tarjeta de crédito</p>
              <p><CreditCard /> Tarjeta de débito</p>
              <div className="product-marketplace-card-brands" aria-label="Tarjetas aceptadas">
                <span className="payment-brand-logo payment-brand-visa" aria-label="Visa">VISA</span>
                <span className="payment-brand-logo payment-brand-mastercard" aria-label="Mastercard"><i /><i /><small>mastercard</small></span>
                <span className="payment-brand-logo payment-brand-redcompra" aria-label="Redcompra"><b>Red</b><b>compra</b></span>
              </div>
            </div>

            <div className="product-marketplace-assurances">
              <span><ShieldCheck /><p><b>Compra segura y protegida</b><small>Tu información está 100% protegida</small></p></span>
              <span><Truck /><p><b>Envío dentro de la comuna</b><small>Valor informado por la tienda</small></p></span>
              <span><Package /><p><b>Envío fuera de la comuna</b><small>Cálculo al ingresar tu dirección</small></p></span>
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
              <h2><Car /> Compatibilidad</h2>
              {compatibility.length
                ? <div className="product-marketplace-compatibility"><span>{compatibility[0].marca} {compatibility[0].modelo} {compatibility[0].anioInicio && `(${compatibility[0].anioInicio}${compatibility[0].anioFin ? `–${compatibility[0].anioFin}` : ''})`}</span></div>
                : <p>Consulta a la tienda con tu patente o código OEM para confirmar el calce.</p>}
              <button type="button" onClick={() => setCompatibilityOpen(true)}>Ver más compatibilidades {compatibility.length > 0 && `(${compatibility.length})`} <ChevronRight /></button>
            </article>
            <article>
              <h2><ShieldCheck /> Compra protegida</h2>
              <p>Tu compra queda protegida y puedes pagar con Flow o Khipu según la alternativa disponible.</p>
              <span className="product-marketplace-protected"><BadgeCheck /> Pago y despacho trazables</span>
            </article>
          </section>
        </section>

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
              <div><h2 id="compatibility-modal-title">Compatibilidades del producto</h2><p>Vehículos registrados por el vendedor para este repuesto.</p></div>
              <button type="button" aria-label="Cerrar compatibilidades" onClick={() => setCompatibilityOpen(false)}><X /></button>
            </header>
            <div className="product-compatibility-modal-toolbar">
              <label><Search /><input value={compatibilitySearch} onChange={(event) => setCompatibilitySearch(event.target.value)} placeholder="Buscar por marca, modelo, versión, motor o año" /></label>
              <span>{visibleCompatibilities.length} de {compatibility.length} compatibilidades</span>
            </div>
            <div className="product-compatibility-modal-list">
              {visibleCompatibilities.length > 0 ? visibleCompatibilities.map((item, index) => (
                <article key={`${item.marca}-${item.modelo}-${item.version}-${item.motor}-${index}`}>
                  <span className="product-compatibility-car-icon"><Car /></span>
                  <div className="product-compatibility-copy">
                    <h3>{[item.marca, item.modelo].filter(Boolean).join(' ') || 'Vehículo compatible'}</h3>
                    {item.version && <p><BadgeCheck /> Versión: <strong>{item.version}</strong></p>}
                    {item.motor && <p><Wrench /> Motor: <strong>{item.motor}</strong></p>}
                    {(item.anioInicio || item.anioFin) && <p><CalendarDays /> Años: <strong>{item.anioInicio || '—'}{item.anioFin && item.anioFin !== item.anioInicio ? ` a ${item.anioFin}` : ''}</strong></p>}
                  </div>
                  <span className="product-compatibility-seller-check"><CheckCircle2 /> Registrada por el vendedor</span>
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
