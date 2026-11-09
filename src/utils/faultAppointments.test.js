import { describe, expect, it } from 'vitest';
import { citasPorFalla, citasSinRespuestaPorFalla, citaTexts } from './faultAppointments';

const cita = (extra = {}) => ({
  id: '1', fallaId: '10', status: 'pending', date: '2099-11-09', time: '15:00 - 16:00', tallerName: 'Grúa don Elías', customerName: 'Camila',
  customerUserId: '9', ownerUserId: '12', homeService: true, ...extra,
});

describe('citas por falla', () => {
  it('el comprador ve la que pidió y el taller la que le hicieron', () => {
    const citas = [cita()];
    expect(Object.keys(citasPorFalla(citas, '9'))).toEqual(['10']);
    expect(citasPorFalla(citas, '12')).toEqual({});
    expect(Object.keys(citasPorFalla(citas, '12', true))).toEqual(['10']);
    expect(citasPorFalla(citas, '9', true)).toEqual({});
  });

  it('una solicitud que el taller no respondió a tiempo, o una cancelada, no cuenta como cita activa', () => {
    expect(citasPorFalla([cita({ date: '2020-01-02', time: '10:00 - 11:00' })], '9')).toEqual({});
    expect(citasPorFalla([cita({ status: 'cancelled' }), cita({ id: '2', status: 'rejected' })], '9')).toEqual({});
    expect(citasPorFalla([cita({ status: 'accepted' })], '9')['10'].status).toBe('accepted');
  });

  it('el taller ve «Por responder» y el cliente; el comprador ve «Cita pendiente» y el taller', () => {
    const delTaller = citaTexts(citasPorFalla([cita()], '12', true)['10']);
    expect(delTaller.status).toBe('Por responder');
    expect(delTaller.who).toBe('Camila · A domicilio');
    const delComprador = citaTexts(citasPorFalla([cita({ homeService: false })], '9')['10']);
    expect(delComprador.status).toBe('Cita pendiente');
    expect(delComprador.who).toBe('Grúa don Elías · En el taller');
    expect(citaTexts(citasPorFalla([cita({ status: 'accepted' })], '9')['10']).status).toBe('Cita confirmada');
  });

  it('la solicitud vencida sin respuesta se avisa solo si la falla no tiene una cita vigente', () => {
    const vencida = cita({ date: '2020-01-02', time: '10:00 - 11:00' });
    expect(citasSinRespuestaPorFalla([vencida], '9')['10'].id).toBe('1');
    expect(citasSinRespuestaPorFalla([vencida, cita({ id: '2' })], '9')).toEqual({});
    expect(citasSinRespuestaPorFalla([cita({ status: 'cancelled', date: '2020-01-02' }), cita({ id: '3', status: 'accepted', date: '2020-01-02' })], '9')).toEqual({});
    expect(citasSinRespuestaPorFalla([vencida], '12')).toEqual({});
  });
});
