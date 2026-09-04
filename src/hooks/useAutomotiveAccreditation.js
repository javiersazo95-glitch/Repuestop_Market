import { useCallback, useEffect, useState } from 'react';
import { getAutomotiveServiceAccreditationApi } from '../services/api';

/**
 * Estado del expediente de servicio automotriz de la cuenta en sesión, tal como
 * lo devuelve `GET /automotive-services/me` (`ServicioAutomotrizController.mio`,
 * DTO `ServicioAutomotrizDTOs.Respuesta`). Sin expediente presentado el getter
 * responde `null` (404) y eso equivale a `SIN_SOLICITUD`.
 *
 * Se usa como "gate" de la gestión de anuncios: publicar un aviso exige el
 * expediente `APROBADO` (`AnuncioService` valida contra `servicioAutomotrizRepository`).
 * La app móvil hace lo mismo en `mobile/hooks/use-automotive-accreditation.ts`.
 */

const KNOWN_STATUSES = ['SIN_SOLICITUD', 'PENDIENTE', 'POR_CORREGIR', 'RECHAZADO', 'APROBADO'];

export function useAutomotiveAccreditation(enabled = true) {
  const [record, setRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const load = useCallback(async ({ signal } = {}) => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getAutomotiveServiceAccreditationApi({ signal });
      setRecord(data || null);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      // Un fallo de red no debe bloquear la vista: se asume "sin solicitud" y el
      // backend seguirá siendo la autoridad al momento de publicar.
      setRecord(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal });
    return () => controller.abort();
  }, [load]);

  const rawStatus = String(record?.estado || 'SIN_SOLICITUD').toUpperCase();
  const status = KNOWN_STATUSES.includes(rawStatus) ? rawStatus : 'SIN_SOLICITUD';
  const isApproved = status === 'APROBADO';

  return {
    status,
    isApproved,
    isLoading,
    reviewNotes: String(record?.notasRevision || ''),
    businessName: String(record?.nombreNegocio || ''),
    logoUrl: String(record?.logoUrl || ''),
    captadorAlias: record?.captadorAlias || '',
    // Los datos del negocio validado solo se exponen con el expediente aprobado:
    // antes no hay nada verificado que precargar en el formulario del aviso.
    profile: isApproved
      ? {
          businessName: String(record?.nombreNegocio || ''),
          region: String(record?.region || ''),
          commune: String(record?.comuna || ''),
          address: String(record?.direccion || ''),
          phone: String(record?.telefono || ''),
          logoUrl: String(record?.logoUrl || ''),
        }
      : null,
    refresh: () => load(),
  };
}
