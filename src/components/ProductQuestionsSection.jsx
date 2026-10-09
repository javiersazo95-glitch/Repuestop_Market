import React, { forwardRef } from 'react';
import { MessageCircle, Search, Send } from 'lucide-react';

/**
 * "Preguntas públicas" de la ficha, compartida por la ficha móvil y la de escritorio. El estado
 * y las mutaciones viven en ProductDetailPage; aquí solo se pinta. Conserva las clases
 * `product-marketplace-questions*` porque el CSS móvil (public-mobile.css) las ajusta; en
 * escritorio las sobreescribe product-detail-desktop.css dentro de `.pdd-main`.
 */
const ProductQuestionsSection = forwardRef(function ProductQuestionsSection({
  isOwnProduct,
  question,
  onQuestionChange,
  onSubmitQuestion,
  questionPending,
  questionError,
  answerError,
  questions,
  answerDrafts,
  onAnswerDraftChange,
  onSubmitAnswer,
  answerPending,
}, ref) {
  return (
    <section className="product-marketplace-questions" ref={ref}>
      <div className="product-marketplace-questions-head">
        <div>
          <h2><MessageCircle /> Preguntas públicas</h2>
          <p>{isOwnProduct ? 'Este repuesto es de tu tienda: responde aquí las preguntas de los compradores.' : 'Haz preguntas públicas y ayuda a otros compradores.'}</p>
        </div>
        {!isOwnProduct && (
          <form onSubmit={onSubmitQuestion}>
            <label>
              <Search />
              <input value={question} onChange={(event) => onQuestionChange(event.target.value)} placeholder="Haz tu pregunta sobre este producto..." />
            </label>
            <button type="submit" disabled={questionPending}><Send /> {questionPending ? 'Enviando...' : 'Enviar pregunta'}</button>
          </form>
        )}
      </div>
      {questionError && <div className="product-marketplace-question-error">{questionError}</div>}
      {answerError && <div className="product-marketplace-question-error">{answerError}</div>}
      {questions.length > 0 ? (
        <div className="product-marketplace-question-list">
          {questions.map((item, index) => {
            const text = item.pregunta || item.texto || item.question || item.message || 'Pregunta sin detalle';
            const answer = item.respuesta || item.answer || item.sellerResponse || '';
            const canAnswer = isOwnProduct && !answer && item.id;
            return (
              <article key={item.id || index}>
                <span>Pregunta pública</span>
                <strong>{text}</strong>
                {canAnswer ? (
                  <form className="product-marketplace-answer-form" onSubmit={(event) => onSubmitAnswer(event, item.id)}>
                    <input
                      value={answerDrafts[item.id] || ''}
                      onChange={(event) => onAnswerDraftChange(item.id, event.target.value)}
                      placeholder="Escribe tu respuesta..."
                      maxLength={500}
                      aria-label={`Responder: ${text}`}
                    />
                    <button type="submit" disabled={answerPending || !(answerDrafts[item.id] || '').trim()}>
                      <Send /> Responder
                    </button>
                  </form>
                ) : (
                  <p>{answer ? <><b>Respuesta de la tienda:</b> {answer}</> : 'La tienda todavía no ha respondido.'}</p>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="product-marketplace-no-questions">
          <MessageCircle />
          <span><strong>Aún no hay preguntas sobre este producto</strong><small>Sé la primera persona en consultar a la tienda.</small></span>
        </div>
      )}
    </section>
  );
});

export default ProductQuestionsSection;
