import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, MessageCircleQuestion, X } from 'lucide-react';
import { getBuyerProductQuestionsApi, resolveMediaUrl } from '../services/api';
import { qk } from '../services/queryKeys';
import { productPath } from '../routes/paths';
import { EmptyState, LoadingRow } from './ProfileDashboard';

/**
 * Pestaña "Mis Preguntas en Productos" del panel de perfil. Extraida de
 * ProfileDashboard: es de solo lectura y su query (buyerProductQuestions) no
 * la usaba ningun otro tab, asi que se mueve entera -- incluida la propia
 * llamada a useQuery -- en vez de recibir los datos por props.
 */
export default function ProfileMyQuestionsPanel({ effectiveUserId }) {
  const buyerQuestionsQuery = useQuery({
    queryKey: qk.buyerProductQuestions(effectiveUserId),
    queryFn: ({ signal }) => getBuyerProductQuestionsApi({ signal }),
    // Tambien para el vendedor: son las preguntas que hizo EL en productos de otras tiendas
    // (el backend las resuelve por el JWT), distintas de las que recibe en sus propios productos.
    enabled: Boolean(effectiveUserId),
    staleTime: 60 * 1000,
  });

  const buyerQuestions = buyerQuestionsQuery.data || [];
  const buyerQuestionsLoading = buyerQuestionsQuery.isLoading;
  const buyerQuestionsError = buyerQuestionsQuery.error?.message || '';

  return (
    <div className="profile-panel">
      <div className="profile-panel-header-row">
        <div>
          <h2 className="profile-panel-title">
            <MessageCircleQuestion size={20} /> Mis Preguntas en Productos
          </h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13.5px' }}>
            Revisa las consultas que has realizado en las publicaciones de las tiendas y sus respuestas.
          </p>
        </div>
      </div>

      {buyerQuestionsError && (
        <div className="auth-alert alert-error" style={{ margin: '14px 0' }}>
          <X size={16} />
          <span>{buyerQuestionsError}</span>
        </div>
      )}

      {buyerQuestionsLoading ? (
        <LoadingRow />
      ) : buyerQuestions.length === 0 ? (
        <EmptyState label="Aún no has realizado preguntas en productos publicados." />
      ) : (
        <div className="seller-question-list" style={{ marginTop: '16px' }}>
          {buyerQuestions.map((q, idx) => {
            const hasAnswer = Boolean(q.respuesta || q.answer);
            return (
              <div className="seller-question-item" key={q.id || idx} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
                <div className="seller-question-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className={hasAnswer ? 'answered' : 'pending'} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', backgroundColor: hasAnswer ? '#dcfce7' : '#fef9c3', color: hasAnswer ? '#15803d' : '#a16207' }}>
                    {hasAnswer ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                    {hasAnswer ? 'Respondida por la tienda' : 'Esperando respuesta'}
                  </span>
                  <small style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {q.fechaPregunta || q.createdAt ? new Date(q.fechaPregunta || q.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                  </small>
                </div>
                {/* El producto con su foto y un enlace de vuelta: una pregunta
                    sirve para decidir la compra, asi que desde aca hay que
                    poder volver a la ficha. `ProductoPreguntaResponseDTO` ya
                    trae nombre, imagen e id; antes solo se usaba el nombre.
                    El SKU se omite a proposito: al comprador no le dice nada. */}
                <div className="buyer-question-product">
                  {q.productoImagenUrl && (
                    <img src={resolveMediaUrl(q.productoImagenUrl)} alt="" />
                  )}
                  <h4>
                    {q.productoId ? (
                      <Link to={productPath({ id: q.productoId, titulo: q.productoNombre })}>
                        {q.productoNombre || q.productName || q.producto?.nombrePublicado || 'Repuesto'}
                      </Link>
                    ) : (
                      q.productoNombre || q.productName || q.producto?.nombrePublicado || 'Repuesto'
                    )}
                  </h4>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '13.5px', color: '#334155' }}>
                  <strong>Tu pregunta:</strong> {q.pregunta || q.texto || q.question}
                </p>
                {hasAnswer ? (
                  <div style={{ backgroundColor: '#f8fafc', borderLeft: '3px solid #0066ff', padding: '10px 14px', borderRadius: '0 8px 8px 0' }}>
                    <strong style={{ display: 'block', fontSize: '12px', color: '#0066ff', marginBottom: '2px' }}>
                      Respuesta de {q.tiendaNombre || 'la tienda'}:
                    </strong>
                    <p style={{ margin: 0, fontSize: '13px', color: '#1e293b' }}>
                      {q.respuesta || q.answer}
                    </p>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                    La tienda aún no ha respondido tu consulta. Te notificaremos en cuanto haya una respuesta.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
