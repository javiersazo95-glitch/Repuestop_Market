import { describe, expect, it } from 'vitest';
import { notificationTargetPath } from './notificationTargets';

describe('avisos de fallas automotrices', () => {
  it('un aviso con diagnóstico abre la falla en ese diagnóstico', () => {
    const path = notificationTargetPath({ targetRoute: '/fallas/10', targetParams: { id: '10', viewMode: 'buyer', diagnostico: '77' } });
    expect(path).toMatch(/\?diagnostico=77$/);
  });

  it('un aviso sin diagnóstico abre solo la falla', () => {
    const path = notificationTargetPath({ targetRoute: '/fallas/10', targetParams: { id: '10' } });
    expect(path).not.toContain('?');
  });

  it('ignora un diagnóstico que no es un número', () => {
    const path = notificationTargetPath({ targetRoute: '/fallas/10', targetParams: { id: '10', diagnostico: 'x' } });
    expect(path).not.toContain('?');
  });
});
