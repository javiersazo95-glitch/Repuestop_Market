import React from 'react';
import { useFlag } from './hooks';

/**
 * Muestra `children` solo si el flag del mantenedor esta encendido. Sin bootstrap (o con el flag
 * ausente) usa `fallback`, que por convencion es `true`: apagar algo es una decision explicita
 * del dueno, nunca el efecto de que el backend no responda.
 *
 * `otherwise` es lo que se pinta con el flag apagado (por defecto, nada).
 */
export default function Feature({ flag, fallback = true, otherwise = null, children }) {
  return useFlag(flag, fallback) ? <>{children}</> : otherwise;
}
