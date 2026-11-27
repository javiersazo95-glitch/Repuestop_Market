import { describe, expect, it } from 'vitest';
import { getPartImage } from './categoriesFallback';

const archivo = (...args) => (getPartImage(...args) || '').split('/').pop();

describe('imagen referencial de un repuesto sin foto', () => {
  it('manda la pieza con la que empieza el titulo, no la que viene despues', () => {
    expect(archivo('Correa 4PK820 alternador Tercel', 'Correas de Alternador', 'Correas')).not.toBe('alternador.png');
    expect(archivo('Empaquetadura culata LUV 1600', 'Empaquetadura de Culata', 'Empaquetaduras y Retenes'))
      .not.toBe('culata.png');
  });

  it('exterior e interior dicen el lado, no la pieza', () => {
    expect(archivo('Farol trasero derecho exterior MG ZS', 'Focos Traseros', 'Carrocería')).toBe('focos-traseros.png');
    expect(archivo('Manilla interior derecha LUV', 'Manillas', 'Carrocería')).toBe('manillas.png');
  });

  it('una palabra sola de otra categoria no gana', () => {
    expect(getPartImage('Condensador distribuidor Sunny', null, 'Encendido')).toBeNull();
  });

  it('el titulo sigue mandando cuando la subcategoria viene mal cargada', () => {
    expect(archivo('Filtro de aceite Yaris', 'Espejos', 'Carrocería')).toBe('filtro-de-aceite.png');
    expect(archivo('Filtro aceite Yaris', 'Espejos', 'Carrocería')).toBe('filtro-de-aceite.png');
  });

  it('calza singular y plural', () => {
    expect(archivo('Buje bandeja superior LUV', 'Bujes', 'Suspensión')).toBe('bujes.png');
    expect(archivo('Pastilla freno delantera D21', 'Pastillas de Freno', 'Frenos')).toBe('pastillas-freno.png');
  });

  it('las fotos del mantenedor ganan a las locales', () => {
    expect(getPartImage('Bujes Hilux', null, 'Suspensión', [['bujes', 'https://cdn/bujes.png']]))
      .toBe('https://cdn/bujes.png');
  });
});
