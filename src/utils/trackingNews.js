/**
 * Novedades de los tabs de seguimiento (Mis búsquedas, Mis fallas): `mobile/utils/tracking-news.ts` de la app.
 *
 * El backend no guarda qué vio cada persona, así que una novedad es lo que exige una acción (una pregunta sin
 * responder) más lo que cambió desde la última vez que se abrió el detalle de ese registro (ver `useTrackingSeen`).
 */
const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`;
const joinParts = (parts) => parts.filter(Boolean).join(' · ');

/** Ofertas (o diagnósticos) que llegaron desde la última vez que se abrió el detalle. */
export function newOffersCount(total, seen) {
  const seenCount = Number(seen);
  return Math.max(0, (total || 0) - (Number.isFinite(seenCount) ? seenCount : 0));
}

/** Mis búsquedas: ofertas nuevas y preguntas de casas de repuestos sin responder. */
export function needNews(need, seen) {
  const total = need.totalCotizaciones ?? 0;
  const newOffers = newOffersCount(total, seen);
  const questions = need.preguntasPendientes ?? 0;
  return {
    hasNews: newOffers > 0 || questions > 0,
    summary: joinParts([
      newOffers > 0 && plural(newOffers, 'oferta nueva', 'ofertas nuevas'),
      questions > 0 && plural(questions, 'pregunta por responder', 'preguntas por responder'),
    ]),
    signature: String(total),
    hasRecords: total > 0 || questions > 0,
    history: plural(total, 'oferta recibida', 'ofertas recibidas'),
  };
}

/** Mis fallas: diagnósticos nuevos y preguntas de talleres sin responder. */
export function fallaNews(fault, seen) {
  const total = fault.diagnosticos ?? fault.cantidadDiagnosticos ?? 0;
  const newDiagnoses = newOffersCount(total, seen);
  const questions = fault.preguntasPendientes ?? 0;
  return {
    hasNews: newDiagnoses > 0 || questions > 0,
    summary: joinParts([
      newDiagnoses > 0 && plural(newDiagnoses, 'diagnóstico nuevo', 'diagnósticos nuevos'),
      questions > 0 && plural(questions, 'pregunta por responder', 'preguntas por responder'),
    ]),
    signature: String(total),
    hasRecords: total > 0 || questions > 0,
    history: plural(total, 'diagnóstico recibido', 'diagnósticos recibidos'),
  };
}

const OFFER_RESULT = {
  ACEPTADA: { title: 'El comprador aceptó tu oferta', tone: 'ok' },
  PAGO_PENDIENTE: { title: 'Pedido creado: esperando el pago del comprador', tone: 'warn' },
  PAGADA: { title: 'Pagada: ya es un pedido tuyo', tone: 'ok' },
  PARCIALMENTE_SUPERADA: { title: 'Parte de tus repuestos fue a otra oferta', tone: 'warn' },
  ADJUDICADA_A_OTRA: { title: 'El comprador eligió otra oferta', tone: 'lost' },
  RECHAZADA: { title: 'El comprador rechazó tu oferta', tone: 'lost' },
  EXPIRADA: { title: 'La búsqueda cerró sin adjudicarte', tone: 'lost' },
  CANCELADA: { title: 'El comprador canceló la búsqueda', tone: 'lost' },
};

/** Lo que le pasó a una oferta de la casa de repuestos, en orden: revisión y resultado. */
export function offerEvents(offer) {
  const events = [];
  if (offer.vistaEn) events.push({ key: 'vista', title: 'El comprador revisó tu oferta', at: offer.vistaEn, tone: 'info' });
  const result = OFFER_RESULT[offer.estado];
  if (result) events.push({ key: offer.estado, ...result, at: offer.aceptadaEn ?? null });
  return events;
}

/** Mis ofertas (casa de repuestos): la oferta cambió de etapa desde la última vez que se abrió. */
export function offerNews(offer, seen) {
  const events = offerEvents(offer);
  const signature = `${offer.estado}|${offer.vistaEn ? 1 : 0}`;
  const hasNews = events.length > 0 && signature !== seen;
  return {
    hasNews,
    summary: hasNews ? events[events.length - 1].title : '',
    signature,
    hasRecords: events.length > 0,
    history: events.length > 0 ? events[events.length - 1].title : '',
  };
}

/** Lo que el taller dejó en una falla y lo que el cliente respondió a cada cosa. */
export function workshopThreads(comments, myUserId) {
  if (myUserId == null) return [];
  const isMine = (comment) => Boolean(comment.taller && String(comment.taller.usuarioId) === String(myUserId));
  return comments
    .filter((comment) => comment.respondeAId == null && isMine(comment))
    .map((mine) => ({ mine, replies: comments.filter((comment) => comment.respondeAId === mine.id && comment.esCreador) }));
}
