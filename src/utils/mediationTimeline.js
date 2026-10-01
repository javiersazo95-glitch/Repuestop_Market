/**
 * Línea de tiempo del caso (detalle de la mediación). Misma lógica que la app
 * (mobile/utils/mediation-timeline.ts): solo aparecen las etapas que ocurrieron, con su fecha
 * real si el backend la conoce; mientras la mediación sigue abierta se agrega la etapa en curso
 * y la resolución pendiente para que la persona sepa qué viene.
 *
 * Cada paso: { key, title, detail, date, status: 'done' | 'current' | 'pending', tone }.
 */

export function refundStatusLabel(estado) {
  switch (String(estado || '').toUpperCase()) {
    case 'REEMBOLSADO': return 'Reembolso acreditado';
    case 'REEMBOLSO_SOLICITADO': return 'Solicitado a la pasarela (Flow)';
    case 'REEMBOLSO_ACEPTADO': return 'Devolución aceptada, en curso en Flow';
    case 'REEMBOLSO_RECHAZADO':
    case 'REEMBOLSO_ERROR': return 'En revisión con nuestro equipo';
    default: return 'En proceso';
  }
}

/** A favor de quién se resolvió, contado desde el punto de vista de quien mira. */
export function resolutionFavorLabel(favor, isBuyer) {
  if (favor === 'COMPRADOR') return isBuyer ? 'A tu favor' : 'A favor del comprador';
  if (favor === 'VENDEDOR') return isBuyer ? 'A favor de la tienda' : 'A tu favor';
  return null;
}

const formatMoney = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;

function latestDate(dates) {
  const valid = dates.filter((d) => d && !Number.isNaN(new Date(d).getTime()));
  if (!valid.length) return null;
  return valid.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));
}

export function buildMediationTimeline(chat, isBuyer, formatReason = (reason) => reason) {
  if (!chat) return [];
  const steps = [];

  if (chat.pagadoAt) {
    steps.push({ key: 'pago', title: 'Compra pagada', date: chat.pagadoAt, status: 'done', tone: 'neutral' });
  }
  if (chat.recibidoAt) {
    steps.push({
      key: 'recepcion',
      title: isBuyer ? 'Recibiste el pedido' : 'El comprador recibió el pedido',
      date: chat.recibidoAt,
      status: 'done',
      tone: 'neutral',
    });
  }
  if (chat.reclamoAt || chat.motivo) {
    steps.push({
      key: 'reclamo',
      title: isBuyer ? 'Abriste un reclamo con la tienda' : 'El comprador abrió un reclamo',
      detail: chat.motivo ? `Motivo: ${formatReason(chat.motivo)}` : null,
      date: chat.reclamoAt || null,
      status: 'done',
      tone: 'claim',
    });
  }

  if (!chat.estadoMediacion) {
    if (chat.reclamoResuelto) {
      steps.push({
        key: 'reclamo-resuelto',
        title: isBuyer ? 'Diste por resuelto el reclamo' : 'El comprador dio por resuelto el reclamo',
        detail: chat.reclamoResueltoMotivo ? `Motivo: ${chat.reclamoResueltoMotivo}` : null,
        date: chat.reclamoResueltoAt || null,
        status: 'done',
        tone: 'success',
      });
    }
    return steps;
  }

  const requestedDetail = [
    chat.escaladoPor ? `Solicitado por ${chat.escaladoPor}` : null,
    chat.motivoEscalacion ? `Motivo: ${chat.motivoEscalacion}` : null,
  ].filter(Boolean).join(' · ');
  steps.push({
    key: 'mediador',
    title: 'Se solicitó un mediador de RepuesTop',
    detail: requestedDetail || null,
    date: chat.mediacionSolicitadaAt || null,
    status: 'done',
    tone: 'mediation',
  });

  const buyerEvidences = chat.evidenciasComprador || [];
  const sellerEvidences = chat.evidenciasVendedor || [];
  if (buyerEvidences.length || sellerEvidences.length) {
    const parts = [
      buyerEvidences.length ? `${isBuyer ? 'Tú' : 'Comprador'}: ${buyerEvidences.length}` : null,
      sellerEvidences.length ? `${isBuyer ? 'Tienda' : 'Tú'}: ${sellerEvidences.length}` : null,
    ].filter(Boolean);
    steps.push({
      key: 'evidencias',
      title: 'Evidencias aportadas al caso',
      detail: parts.join(' · '),
      date: latestDate([...buyerEvidences, ...sellerEvidences].map((e) => e?.uploadedAt)),
      status: 'done',
      tone: 'mediation',
    });
  }

  if (chat.estadoMediacion === 'EN_MEDIACION') {
    steps.push({
      key: 'revision',
      title: 'En revisión del mediador',
      detail: 'El mediador revisa el reclamo, las evidencias y la conversación de ambas partes.',
      status: 'current',
      tone: 'mediation',
    });
    steps.push({
      key: 'resolucion',
      title: 'Resolución del caso',
      detail: 'Te avisaremos por notificación y correo cuando el mediador resuelva.',
      status: 'pending',
      tone: 'neutral',
    });
    return steps;
  }

  const closed = chat.estadoMediacion === 'CERRADA';
  const favor = resolutionFavorLabel(chat.resolucionFavor, isBuyer);
  steps.push({
    key: 'resolucion',
    title: closed ? 'Mediación cerrada' : 'Mediación resuelta',
    detail: [favor, chat.resolucionOpcionLabel].filter(Boolean).join(' · ') || null,
    date: chat.mediacionResueltaAt || null,
    status: 'done',
    tone: 'success',
  });

  const monto = Number(chat.montoReembolso || 0);
  if (monto > 0) {
    const pct = Number(chat.porcentajeReembolso) || 100;
    const credited = String(chat.estadoReembolso || '').toUpperCase() === 'REEMBOLSADO';
    steps.push({
      key: 'reembolso',
      title: `${isBuyer ? 'Reembolso' : 'Reembolso al comprador'} del ${pct}% (${formatMoney(monto)})`,
      detail: refundStatusLabel(chat.estadoReembolso),
      status: credited ? 'done' : 'current',
      tone: 'refund',
    });
  }

  return steps;
}
