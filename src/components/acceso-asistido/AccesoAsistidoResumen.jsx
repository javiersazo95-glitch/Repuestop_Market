import React, { useState } from 'react';
import { ChevronRight, Headset } from 'lucide-react';
import { autorizarAccesoAsistidoApi, revocarAccesoAsistidoApi } from '../../services/api';
import { DURACIONES, etiquetaDuracion, tituloNivel } from './accesoAsistido';
import { useAccesoAsistido, useRestante } from './useAccesoAsistido';
import './AccesoAsistido.css';

/**
 * Tarjeta del Resumen del vendedor: si soporte pide entrar a su panel, lo dice arriba con el contador de cuánto
 * queda para responder y deja autorizar en un clic (eligiendo la duración); si soporte ya está dentro, muestra
 * cuánto le queda y deja cortarlo. El detalle (nivel, rechazar con comentario, historial) sigue en
 * "Ayuda con la carga". Sin solicitud viva no ocupa espacio.
 */
export default function AccesoAsistidoResumen({ sellerId, onVerDetalle }) {
  const { actual, offsetMs, refrescar } = useAccesoAsistido(sellerId);
  const pide = actual?.estado === 'PENDIENTE_VENDEDOR';
  const activo = actual?.estado === 'ACTIVO';
  const propia = actual?.estado === 'PENDIENTE_SOPORTE';
  const restante = useRestante(activo ? actual?.expiraEn : (pide || propia) ? actual?.solicitudExpiraEn : null, offsetMs);
  const [horas, setHoras] = useState(8);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');

  // Al cortar el acceso la solicitud deja de estar viva: queda solo la confirmación.
  if (!actual || (!pide && !activo && !propia)) {
    return mensaje ? <p className="acceso-asistido-resumen-mensaje suelto" role="status">{mensaje}</p> : null;
  }

  const ejecutar = async (tarea, exito) => {
    setOcupado(true);
    setMensaje('');
    try {
      await tarea();
      await refrescar();
      setMensaje(exito);
    } catch (err) {
      setMensaje(err?.message || 'No se pudo completar la acción.');
    } finally {
      setOcupado(false);
    }
  };

  const titulo = pide ? 'Soporte pide acceso a tu panel' : activo ? 'Soporte tiene acceso a tu panel' : 'Tu solicitud de ayuda espera a soporte';
  const nivel = tituloNivel(actual.nivel ?? actual.nivelSolicitado);

  // Compacta (18-nov, v2): una franja. Escritorio: icono, titulo y tiempo a la izquierda; botones y "Ver detalle"
  // a la derecha. Celular: icono, titulo y una flecha en la misma fila; los botones (si los hay) debajo.
  const rotuloCorto = pide ? 'responde en' : 'vence en';
  const nota = activo ? 'Solo crea repuestos: no edita ni elimina.' : propia ? 'Te avisamos cuando la acepte.' : null;
  const motivo = pide && actual.justificacion ? `Motivo: ${actual.justificacion}` : null;
  const etiquetaEnlace = pide ? 'Ver detalle o rechazar' : 'Ver detalle';

  return (
    <section className={`acceso-asistido-resumen ${pide ? 'pide' : activo ? 'activo' : 'propia'}`} aria-label="Ayuda con la carga">
      <span className="acceso-asistido-resumen-icono"><Headset size={16} aria-hidden="true" /></span>
      <div className="acceso-asistido-resumen-copia">
        <strong>{titulo}</strong>
        <small className="acceso-asistido-resumen-meta">
          {nivel}{activo && actual.duracionHoras ? ` · ${etiquetaDuracion(actual.duracionHoras)}` : ''}
          {' · '}
          <span className={`acceso-asistido-resumen-tiempo tono-${restante.tono}`} role="timer" aria-live="off">{rotuloCorto} {restante.texto}</span>
          {nota && <span className="acceso-asistido-resumen-nota"> · {nota}</span>}
        </small>
        {motivo && <small className="acceso-asistido-resumen-motivo" title={actual.justificacion}>{motivo}</small>}
      </div>

      {(pide || activo) && (
        <div className="acceso-asistido-resumen-acciones">
          {pide && (
            <>
              <label className="acceso-asistido-resumen-duracion">
                <span>Por</span>
                <select value={horas} onChange={(e) => setHoras(Number(e.target.value))} disabled={ocupado} aria-label="Duración del acceso">
                  {DURACIONES.map((d) => <option key={d.horas} value={d.horas}>{d.etiqueta}</option>)}
                </select>
              </label>
              <button
                type="button"
                className="aa-btn aa-btn-primary"
                disabled={ocupado}
                onClick={() => ejecutar(() => autorizarAccesoAsistidoApi(sellerId, actual.id, { duracionHoras: horas }), 'Autorizaste el acceso. Soporte ya puede cargar tus repuestos.')}
              >
                Autorizar
              </button>
            </>
          )}
          {activo && (
            <button
              type="button"
              className="aa-btn aa-btn-secondary"
              disabled={ocupado}
              onClick={() => ejecutar(() => revocarAccesoAsistidoApi(sellerId, actual.id), 'Cortaste el acceso de soporte.')}
            >
              Cortar el acceso
            </button>
          )}
        </div>
      )}

      <button type="button" className="acceso-asistido-resumen-enlace" onClick={onVerDetalle} aria-label={etiquetaEnlace}>
        <span className="acceso-asistido-resumen-enlace-texto">{etiquetaEnlace}</span> <ChevronRight size={16} aria-hidden="true" />
      </button>
      {mensaje && <p className="acceso-asistido-resumen-mensaje" role="status">{mensaje}</p>}
    </section>
  );
}
