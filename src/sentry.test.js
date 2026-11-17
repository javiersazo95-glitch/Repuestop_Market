import { describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/react', () => ({ init: vi.fn() }));

const { scrubUrl } = await import('./sentry');

describe('scrubUrl (MARKET-1)', () => {
  it('quita el token del enlace de consentimiento de la página y de la API', () => {
    expect(scrubUrl('https://repuestop.cl/acceso-soporte/abc.DEF-123_xyz'))
      .toBe('https://repuestop.cl/acceso-soporte/{token}');
    expect(scrubUrl('https://api.repuestop.cl/api/v1/acceso-asistido/consentimiento/abc.DEF-123/autorizar'))
      .toBe('https://api.repuestop.cl/api/v1/acceso-asistido/consentimiento/{token}/autorizar');
    expect(scrubUrl('/acceso-soporte/tok123')).toBe('/acceso-soporte/{token}');
  });

  it('sigue reemplazando ids numéricos', () => {
    expect(scrubUrl('/perfil/pedidos/25')).toBe('/perfil/pedidos/{id}');
  });
});
