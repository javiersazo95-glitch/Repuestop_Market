import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, Inbox, MessageCircleQuestion, Package, Search, Send, Loader2, X } from 'lucide-react';
import { resolveMediaUrl, answerProductQuestionApi } from '../services/api';
import { productPath } from '../routes/paths';

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

export default function SellerProductQuestionsPanel({
  questions = [],
  products = [],
  loading,
  error,
  initialProductId,
  onClearProduct,
  onQuestionAnswered,
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [draftAnswers, setDraftAnswers] = useState({});
  const [submittingIds, setSubmittingIds] = useState({});
  const [actionError, setActionError] = useState(null);
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

  const handleSendAnswer = async (productId, questionId) => {
    const text = (draftAnswers[questionId] || '').trim();
    if (!text) return;
    setSubmittingIds((prev) => ({ ...prev, [questionId]: true }));
    setActionError(null);
    try {
      await answerProductQuestionApi(productId, questionId, { respuesta: text });
      setDraftAnswers((prev) => ({ ...prev, [questionId]: '' }));
      if (onQuestionAnswered) onQuestionAnswered();
    } catch (err) {
      setActionError(err.message || 'No se pudo enviar la respuesta.');
    } finally {
      setSubmittingIds((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  return (
    <section className="profile-panel seller-product-questions-panel">
      <div className="profile-panel-header-row seller-questions-heading">
        <div><h2 className="profile-panel-title"><MessageCircleQuestion /> Preguntas de productos</h2><p>Revisa las consultas públicas recibidas en cada repuesto publicado y responde a tus clientes.</p></div>
        <div className="seller-question-summary"><span><strong>{normalized.length}</strong>Total</span><span className="pending"><strong>{pendingCount}</strong>Pendientes</span><span className="answered"><strong>{answeredCount}</strong>Respondidas</span></div>
      </div>

      {selectedProductId && <div className="seller-question-product-filter"><MessageCircleQuestion /><span>Mostrando preguntas de <strong>{selectedProduct?.nombrePublicado || selectedProduct?.repuestoNombre || selectedProduct?.nombre || 'este producto'}</strong></span><button type="button" onClick={onClearProduct}><X /> Quitar filtro</button></div>}

      <div className="seller-questions-toolbar">
        <label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto o contenido de la pregunta..." /></label>
        <div><button type="button" className={status === 'all' ? 'active' : ''} onClick={() => setStatus('all')}>Todas</button><button type="button" className={status === 'pending' ? 'active' : ''} onClick={() => setStatus('pending')}>Pendientes</button><button type="button" className={status === 'answered' ? 'active' : ''} onClick={() => setStatus('answered')}>Respondidas</button></div>
      </div>

      {(error || actionError) && <div className="auth-alert alert-error"><X size={16} /><span>{error || actionError}</span></div>}
      {loading ? <div className="profile-loading-state"><span>Cargando preguntas de los productos...</span></div> : groups.length === 0 ? (
        <div className="seller-questions-empty"><Inbox /><strong>No hay preguntas para mostrar</strong><span>{selectedProductId ? 'Este producto todavía no tiene consultas públicas.' : 'Las preguntas realizadas en tus productos aparecerán en esta sección.'}</span></div>
      ) : <div className="seller-question-product-groups">{groups.map(([productId, group]) => {
        const product = group.product || productsById.get(productId) || {};
        // La PREGUNTA ya trae nombre, sku e imagen del producto (`ProductoPreguntaResponseDTO`).
        // Antes solo se miraba el catalogo cargado en memoria, asi que un producto que no
        // estuviera en esa pagina salia sin foto y con "SKU: No informado" aunque el
        // backend los hubiera mandado.
        const firstQuestion = group.questions[0] || {};
        const name = product.nombrePublicado || product.repuestoNombre || product.nombre
          || firstQuestion.productName || firstQuestion.productoNombre || 'Producto publicado';
        const rawPhoto = product.imageUrls?.[0] || product.imagenUrl || product.photoUri || firstQuestion.productoImagenUrl;
        const sku = product.skuProveedor || product.sku || firstQuestion.productoSku;
        const href = productId && !String(productId).startsWith('unknown-')
          ? productPath({ id: productId, titulo: name })
          : null;
        return <article className={`seller-question-product-group ${group.questions.some((question) => !question.answer) ? 'has-pending-questions' : ''}`} key={productId}>
          <header>
            {rawPhoto ? <img src={resolveMediaUrl(rawPhoto)} alt="" /> : <span><Package /></span>}
            <div>
              {/* El vendedor necesita abrir la ficha para responder con datos a la vista
                  (stock, precio, compatibilidades), asi que el nombre lleva al producto. */}
              <h3>{href ? <Link to={href} title="Ver el producto publicado">{name}</Link> : name}</h3>
              <small>SKU: {sku || 'No informado'}</small>
            </div>
            <b><MessageCircleQuestion /> {group.questions.length} {group.questions.length === 1 ? 'pregunta' : 'preguntas'}</b>
          </header>
          <div className="seller-question-list">{group.questions.map((question, index) => {
            const qId = question.id || index;
            const isSubmitting = submittingIds[qId];
            return (
              <div className="seller-question-item" key={qId}>
                <div className="seller-question-meta">
                  <span className={question.answer ? 'answered' : 'pending'}>
                    {question.answer ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
                    {question.answer ? 'Respondida' : 'Pendiente'}
                  </span>
                  <small>{question.compradorNombre || question.userName || question.usuarioNombre || question.authorName || 'Comprador'} · {formatDate(question.fechaPregunta || question.createdAt || question.fechaCreacion)}</small>
                </div>
                <strong>{question.text}</strong>
                {question.answer ? (
                  <p><b>Respuesta de la tienda:</b> {question.answer}</p>
                ) : (
                  <div style={{ marginTop: '10px' }}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendAnswer(question.productId, question.id);
                      }}
                      style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                    >
                      <input
                        type="text"
                        value={draftAnswers[qId] || ''}
                        onChange={(e) => setDraftAnswers((prev) => ({ ...prev, [qId]: e.target.value }))}
                        placeholder="Escribe la respuesta pública para el comprador..."
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                        }}
                        disabled={isSubmitting}
                      />
                      <button
                        type="submit"
                        disabled={!draftAnswers[qId]?.trim() || isSubmitting}
                        style={{
                          backgroundColor: '#0066ff',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 14px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: !draftAnswers[qId]?.trim() || isSubmitting ? 0.6 : 1,
                        }}
                      >
                        {isSubmitting ? <Loader2 size={15} className="spin-icon" /> : <Send size={15} />}
                        <span>Responder</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}</div>
        </article>;
      })}</div>}
    </section>
  );
}
