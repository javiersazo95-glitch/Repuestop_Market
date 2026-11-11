import { describe, expect, it } from 'vitest';
import {
  countInquiryNews, inquiryBuyerState, inquiryEventLabel, inquirySellerState, inquiryStage, isQuotesMenuConversation,
} from './inquiry';

const inquiry = (extra = {}) => ({ id: 1, tipo: 'consulta_repuesto', consultaRepuesto: 'Farol', mensajesNoLeidos: 0, ...extra });

describe('pregunta de disponibilidad (Repuestín) en el Market', () => {
  it('la etapa sigue el flujo de la app: espera → no lo tiene / ofrecido → comprado', () => {
    expect(inquiryStage(inquiry())).toBe('waiting');
    expect(inquiryStage(inquiry({ consultaNoLoTiene: true }))).toBe('noStock');
    expect(inquiryStage(inquiry({ consultaNoLoTiene: true, productoId: 9 }))).toBe('offered');
    expect(inquiryStage(inquiry({ productoId: 9, consultaCompradaPedidoId: 77 }))).toBe('purchased');
  });

  it('entra al menú Cotizaciones junto a las cotizaciones, pero no las mediaciones', () => {
    expect(isQuotesMenuConversation(inquiry())).toBe(true);
    expect(isQuotesMenuConversation({ tipo: 'cotizacion' })).toBe(true);
    expect(isQuotesMenuConversation({})).toBe(true);
    expect(isQuotesMenuConversation({ tipo: 'mediacion' })).toBe(false);
  });

  it('el contador cuenta solo preguntas de Repuestín con novedades sin leer', () => {
    expect(countInquiryNews([
      inquiry({ mensajesNoLeidos: 2 }),
      inquiry({ id: 2 }),
      { id: 3, tipo: 'cotizacion', mensajesNoLeidos: 4 },
      inquiry({ id: 4, mensajesNoLeidos: 1 }),
    ])).toBe(2);
  });

  it('los filtros ubican la pregunta según su etapa', () => {
    expect(inquirySellerState(inquiry())).toBe('pending');
    expect(inquirySellerState(inquiry({ productoId: 9 }))).toBe('sent');
    expect(inquirySellerState(inquiry({ productoId: 9, consultaCompradaPedidoId: 1 }))).toBe('closed');
    expect(inquiryBuyerState(inquiry())).toBe('requests');
    expect(inquiryBuyerState(inquiry({ productoId: 9 }))).toBe('quotes');
  });

  it('los mensajes automáticos se leen como eventos', () => {
    expect(inquiryEventLabel('Te ofrezco este repuesto: Farol izquierdo. Revisa su detalle', 'buyer')).toBe('Te ofrecieron Farol izquierdo');
    expect(inquiryEventLabel('Por ahora no tengo este repuesto. ¡Gracias por consultarme!', 'seller')).toBe('Respondiste que no lo tienes');
    expect(inquiryEventLabel('Hola', 'seller')).toBeNull();
  });
});
