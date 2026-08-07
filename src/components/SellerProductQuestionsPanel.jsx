import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Inbox, MessageCircleQuestion, Package, Search, X } from 'lucide-react';
import { resolveMediaUrl } from '../services/api';

function questionProductId(question) {
  return String(question.productoId ?? question.productId ?? question.product?.id ?? question.producto?.id ?? '');
}

function questionText(question) {
  return question.pregunta || question.texto || question.question || question.message || 'Pregunta sin detalle';
}

function questionAnswer(question) {
  return question.respuesta || question.answer || question.sellerResponse || '';
}

function formatDate(value) {
  if (!value) return 'Fecha no informada';
  return new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SellerProductQuestionsPanel({ questions = [], products = [], loading, error, initialProductId, onClearProduct }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const selectedProductId = initialProductId ? String(initialProductId) : '';

  const productsById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products]);
  const normalized = useMemo(() => questions.map((question) => {
    const productId = questionProductId(question);
    const embeddedProduct = question.product || question.producto || {};
    const product = productsById.get(productId) || embeddedProduct;
    return {
      ...question,
      productId,
      product,
      text: questionText(question),
      answer: questionAnswer(question),
    };
  }), [questions, productsById]);

  const filtered = normalized.filter((question) => {
    if (selectedProductId && question.productId !== selectedProductId) return false;
    if (status === 'pending' && question.answer) return false;
    if (status === 'answered' && !question.answer) return false;
    const query = search.trim().toLocaleLowerCase('es');
    if (!query) return true;
    const productName = question.product?.nombrePublicado || question.product?.repuestoNombre || question.product?.nombre || question.productName || question.productoNombre || '';
    return `${productName} ${question.text} ${question.answer}`.toLocaleLowerCase('es').includes(query);
  });

  const groups = useMemo(() => {
    const result = new Map();
    filtered.forEach((question) => {
      const key = question.productId || `unknown-${question.id}`;
      if (!result.has(key)) result.set(key, { product: question.product, questions: [] });
      result.get(key).questions.push(question);
    });
    return [...result.entries()];
  }, [filtered]);

  const pendingCount = normalized.filter((question) => !question.answer).length;
  const answeredCount = normalized.length - pendingCount;
  const selectedProduct = selectedProductId ? productsById.get(selectedProductId) : null;

  return (
    <section className="profile-panel seller-product-questions-panel">
      <div className="profile-panel-header-row seller-questions-heading">
        <div><h2 className="profile-panel-title"><MessageCircleQuestion /> Preguntas de productos</h2><p>Revisa las consultas públicas recibidas en cada repuesto publicado.</p></div>
        <div className="seller-question-summary"><span><strong>{normalized.length}</strong>Total</span><span className="pending"><strong>{pendingCount}</strong>Pendientes</span><span className="answered"><strong>{answeredCount}</strong>Respondidas</span></div>
      </div>

      {selectedProductId && <div className="seller-question-product-filter"><MessageCircleQuestion /><span>Mostrando preguntas de <strong>{selectedProduct?.nombrePublicado || selectedProduct?.repuestoNombre || selectedProduct?.nombre || 'este producto'}</strong></span><button type="button" onClick={onClearProduct}><X /> Quitar filtro</button></div>}

      <div className="seller-questions-toolbar">
        <label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto o contenido de la pregunta..." /></label>
        <div><button type="button" className={status === 'all' ? 'active' : ''} onClick={() => setStatus('all')}>Todas</button><button type="button" className={status === 'pending' ? 'active' : ''} onClick={() => setStatus('pending')}>Pendientes</button><button type="button" className={status === 'answered' ? 'active' : ''} onClick={() => setStatus('answered')}>Respondidas</button></div>
      </div>

      {error && <div className="auth-alert alert-error"><X size={16} /><span>{error}</span></div>}
      {loading ? <div className="profile-loading-state"><span>Cargando preguntas de los productos...</span></div> : groups.length === 0 ? (
        <div className="seller-questions-empty"><Inbox /><strong>No hay preguntas para mostrar</strong><span>{selectedProductId ? 'Este producto todavía no tiene consultas públicas.' : 'Las preguntas realizadas en tus productos aparecerán en esta sección.'}</span></div>
      ) : <div className="seller-question-product-groups">{groups.map(([productId, group]) => {
        const product = group.product || productsById.get(productId) || {};
        const name = product.nombrePublicado || product.repuestoNombre || product.nombre || group.questions[0]?.productName || group.questions[0]?.productoNombre || 'Producto publicado';
        const rawPhoto = product.imageUrls?.[0] || product.imagenUrl || product.photoUri;
        return <article className="seller-question-product-group" key={productId}>
          <header>{rawPhoto ? <img src={resolveMediaUrl(rawPhoto)} alt="" /> : <span><Package /></span>}<div><h3>{name}</h3><small>SKU: {product.skuProveedor || product.sku || 'No informado'}</small></div><b><MessageCircleQuestion /> {group.questions.length} {group.questions.length === 1 ? 'pregunta' : 'preguntas'}</b></header>
          <div className="seller-question-list">{group.questions.map((question, index) => <div className="seller-question-item" key={question.id || index}>
            <div className="seller-question-meta"><span className={question.answer ? 'answered' : 'pending'}>{question.answer ? <CheckCircle2 /> : <Clock3 />}{question.answer ? 'Respondida' : 'Pendiente'}</span><small>{question.userName || question.usuarioNombre || question.authorName || 'Comprador'} · {formatDate(question.createdAt || question.fechaCreacion)}</small></div>
            <strong>{question.text}</strong>
            {question.answer ? <p><b>Respuesta de la tienda:</b> {question.answer}</p> : <p className="waiting-answer">Esta pregunta todavía espera una respuesta de la tienda.</p>}
          </div>)}</div>
        </article>;
      })}</div>}
    </section>
  );
}
