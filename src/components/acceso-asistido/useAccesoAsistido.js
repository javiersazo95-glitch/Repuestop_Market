import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAccesoAsistidoApi } from '../../services/api';
import { qk } from '../../services/queryKeys';
import { offsetDe, restanteHasta } from './accesoAsistido';

/**
 * Acceso asistido de la tienda: solicitud viva e historial. Se consulta cada 30 s (cada 10 s si hay algo
 * pendiente) para que el vendedor vea al instante cuando soporte pide entrar o acepta su solicitud.
 */
export function useAccesoAsistido(sellerId, habilitado = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: qk.accesoAsistido(sellerId),
    queryFn: () => getAccesoAsistidoApi(sellerId),
    enabled: Boolean(sellerId) && habilitado,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: (consulta) => (consulta.state.data?.actual?.estado?.startsWith('PENDIENTE') ? 10_000 : 30_000),
  });
  const offsetMs = useMemo(() => offsetDe(query.data?.serverTime, query.dataUpdatedAt || Date.now()), [query.data?.serverTime, query.dataUpdatedAt]);
  const refrescar = () => queryClient.invalidateQueries({ queryKey: qk.accesoAsistido(sellerId) });
  return { ...query, actual: query.data?.actual ?? null, historial: query.data?.historial ?? [], offsetMs, refrescar };
}

/** Contador que baja cada segundo hasta `finIso`, con el reloj del servidor. */
export function useRestante(finIso, offsetMs) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!finIso) return undefined;
    setAhora(Date.now());
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [finIso]);
  return restanteHasta(finIso, offsetMs, ahora);
}
