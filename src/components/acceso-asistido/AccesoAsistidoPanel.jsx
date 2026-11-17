import React, { useRef, useState } from 'react';
import {
  CheckCircle2, ChevronDown, Clock, FileSpreadsheet, Headset, History, Loader2, PackagePlus, Paperclip,
  ShieldCheck, Tag, UserRound, X, XCircle,
} from 'lucide-react';
import {
  autorizarAccesoAsistidoApi,
  rechazarAccesoAsistidoApi,
  revocarAccesoAsistidoApi,
  solicitarAyudaCargaApi,
} from '../../services/api';
import { DURACIONES, NIVELES, TEXTO_ESTADO, etiquetaDuracion, fechaHora, nivelesHasta, tituloNivel } from './accesoAsistido';
import { useAccesoAsistido, useRestante } from './useAccesoAsistido';
import CambiosAcceso, { CifrasAcceso } from './CambiosAcceso';
import './AccesoAsistido.css';

/** Adjunto de la solicitud: los tipos que acepta el backend (que ademas revisa el contenido real). */
const ADJUNTO_ACCEPT = '.xlsx,.pdf,image/jpeg,image/png,image/webp'; // SEC-BACKEND-218: sin .xls
const ADJUNTO_MAX_BYTES = 10 * 1024 * 1024;

/** Tope de la justificacion y del comentario de rechazo: mismas columnas que la base (500 y 300). */
export const JUSTIFICACION_MIN = 10;
export const JUSTIFICACION_MAX = 500;
export const COMENTARIO_MAX = 300;

/** Icono y color de cada nivel (mismos en el formulario, la autorización y el historial). */
const ESTILO_NIVEL = {
  BASICO: { Icono: PackagePlus, color: 'azul' },
  MEDIO: { Icono: Tag, color: 'violeta' },
  COMPLETO: { Icono: FileSpreadsheet, color: 'verde' },
};

/** Color del estado de un acceso en el historial. */
const COLOR_ESTADO = {
  PENDIENTE_VENDEDOR: 'ambar', PENDIENTE_SOPORTE: 'azul', ACTIVO: 'verde',
  FINALIZADO: 'verde', EXPIRADO: 'gris', REVOCADO: 'rojo', RECHAZADO: 'rojo', CANCELADO: 'gris',
};

/** Pestaña "Ayuda con la carga" del perfil del vendedor: ver, pedir, autorizar o cortar el acceso de soporte y su historial. */
export default function AccesoAsistidoPanel({ sellerId }) {
  const { actual, historial, offsetMs, isLoading, isError, refrescar } = useAccesoAsistido(sellerId);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const ejecutar = async (tarea, exito) => {
    setOcupado(true);
    setMensaje(null);
    try {
      await tarea();
      await refrescar();
      setMensaje({ tono: 'ok', texto: exito });
      return true;
    } catch (err) {
      setMensaje({ tono: 'error', texto: err?.message || 'No se pudo completar la acción.' });
      return false;
    } finally {
      setOcupado(false);
    }
  };

  if (isLoading) return <div className="profile-panel acceso-asistido"><p className="aa-cargando"><Loader2 className="spin" size={20} /> Cargando…</p></div>;
  if (isError) return <div className="profile-panel acceso-asistido" role="alert">No pudimos cargar la ayuda con la carga. Intenta de nuevo.</div>;

  const cerrados = historial.filter((a) => a.id !== actual?.id);

  return (
    <div className="profile-panel acceso-asistido">
      <header className="aa-hero">
        <span className="aa-hero-icono"><Headset size={26} aria-hidden="true" /></span>
        <div className="aa-hero-copia">
          <h2>Ayuda con la carga</h2>
          <p>¿Sin tiempo para cargar tus repuestos? El equipo de RepuesTop los carga por ti, solo con tu permiso y por el tiempo que elijas.</p>
        </div>
        <ol className="aa-pasos" aria-label="Cómo funciona">
          <li><span>1</span>Pides ayuda o soporte te la ofrece</li>
          <li><span>2</span>Tú autorizas y eliges cuánto tiempo</li>
          <li><span>3</span>Soporte carga y tú ves cada cambio</li>
        </ol>
      </header>

      {mensaje && (
        <p className={`aa-aviso ${mensaje.tono}`} role="status">
          {mensaje.tono === 'ok' ? <CheckCircle2 size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />} {mensaje.texto}
        </p>
      )}

      {actual ? (
        <AccesoVigente
          acceso={actual}
          offsetMs={offsetMs}
          ocupado={ocupado}
          onAutorizar={(body) => ejecutar(() => autorizarAccesoAsistidoApi(sellerId, actual.id, body), 'Autorizaste el acceso. Soporte ya puede cargar tus repuestos.')}
          onRechazar={(comentario) => ejecutar(() => rechazarAccesoAsistidoApi(sellerId, actual.id, comentario), 'Rechazaste la solicitud.')}
          onRevocar={() => ejecutar(() => revocarAccesoAsistidoApi(sellerId, actual.id), actual.estado === 'ACTIVO' ? 'Cortaste el acceso de soporte.' : 'Retiraste tu solicitud.')}
        />
      ) : (
        <FormularioSolicitud
          ocupado={ocupado}
          onEnviar={(body, adjunto) => ejecutar(() => solicitarAyudaCargaApi(sellerId, body, adjunto), 'Enviamos tu solicitud a soporte. Te avisamos cuando la acepten.')}
        />
      )}

      <Garantias />
      <Historial accesos={cerrados} />
    </div>
  );
}

function Chips({ opciones, valor, onCambio, deshabilitado, etiqueta }) {
  return (
    <div className="aa-chips" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          className={`aa-chip ${valor === o.valor ? 'activo' : ''}`}
          disabled={deshabilitado}
          onClick={() => onCambio(o.valor)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

function AccesoVigente({ acceso, offsetMs, ocupado, onAutorizar, onRechazar, onRevocar }) {
  const activo = acceso.estado === 'ACTIVO';
  const pideSoporte = acceso.estado === 'PENDIENTE_VENDEDOR';
  const restante = useRestante(activo ? acceso.expiraEn : acceso.solicitudExpiraEn, offsetMs);
  const [horas, setHoras] = useState(8);
  const [nivel, setNivel] = useState(acceso.nivelSolicitado);
  const [rechazando, setRechazando] = useState(false);
  const [comentario, setComentario] = useState('');
  const tono = pideSoporte ? 'ambar' : activo ? 'verde' : 'azul';
  const nivelMostrado = acceso.nivel || acceso.nivelSolicitado;
  const { Icono: IconoNivel, color: colorNivel } = ESTILO_NIVEL[nivelMostrado] || ESTILO_NIVEL.BASICO;

  return (
    <section className={`aa-estado ${tono}`} aria-label="Estado del acceso">
      <div className="aa-estado-cabecera">
        <div className="aa-estado-copia">
          <span className="aa-estado-pildora">{pideSoporte ? 'Necesita tu respuesta' : activo ? 'En curso' : 'En espera'}</span>
          <h3>{TEXTO_ESTADO[acceso.estado]}</h3>
          <div className="aa-estado-datos">
            <span className={`aa-etiqueta ${colorNivel}`}><IconoNivel size={14} aria-hidden="true" /> {tituloNivel(nivelMostrado)}</span>
            {acceso.duracionHoras ? <span className="aa-etiqueta gris"><Clock size={14} aria-hidden="true" /> {etiquetaDuracion(acceso.duracionHoras)}</span> : null}
            {acceso.operadorNombre ? <span className="aa-etiqueta gris"><UserRound size={14} aria-hidden="true" /> {acceso.operadorNombre}</span> : null}
          </div>
          {acceso.justificacion && (
            <p className="aa-motivo"><strong>{acceso.origen === 'SOPORTE' ? 'Motivo de soporte:' : 'Tu justificación:'}</strong> {acceso.justificacion}</p>
          )}
        </div>
        <div className={`aa-reloj tono-${restante.tono}`} role="timer" aria-live="off">
          <Clock size={18} aria-hidden="true" />
          <small>{activo ? 'El acceso vence en' : pideSoporte ? 'Responde antes de' : 'Tu solicitud vence en'}</small>
          <strong>{restante.texto}</strong>
        </div>
      </div>

      {pideSoporte && (
        <div className="aa-decision">
          <p className="aa-decision-titulo">¿Aceptas la solicitud del equipo de soporte?</p>
          <div className="aa-campo">
            <span>¿Por cuánto tiempo?</span>
            <Chips etiqueta="Duración del acceso" valor={horas} onCambio={setHoras} deshabilitado={ocupado}
              opciones={DURACIONES.map((d) => ({ valor: d.horas, etiqueta: d.etiqueta }))} />
          </div>
          {nivelesHasta(acceso.nivelSolicitado).length > 1 && (
            <div className="aa-campo">
              <span>¿Qué les permites? (puedes dar menos de lo pedido)</span>
              <Chips etiqueta="Permiso" valor={nivel} onCambio={setNivel} deshabilitado={ocupado}
                opciones={nivelesHasta(acceso.nivelSolicitado).map((n) => ({ valor: n.valor, etiqueta: n.titulo }))} />
            </div>
          )}
          {rechazando ? (
            <div className="aa-campo">
              <span>Comentario para soporte (opcional)</span>
              <input type="text" value={comentario} maxLength={COMENTARIO_MAX} onChange={(e) => setComentario(e.target.value)} disabled={ocupado}
                placeholder="Ej: lo cargo yo esta semana" />
              <div className="aa-acciones">
                <button type="button" className="aa-btn aa-btn-peligro" disabled={ocupado} onClick={() => onRechazar(comentario.trim())}>Confirmar rechazo</button>
                <button type="button" className="aa-btn aa-btn-secondary" disabled={ocupado} onClick={() => setRechazando(false)}>Volver</button>
              </div>
            </div>
          ) : (
            <div className="aa-acciones">
              <button type="button" className="aa-btn aa-btn-primary aa-btn-grande" disabled={ocupado} onClick={() => onAutorizar({ duracionHoras: horas, nivel })}>
                <CheckCircle2 size={18} aria-hidden="true" /> Autorizar por {etiquetaDuracion(horas)}
              </button>
              <button type="button" className="aa-btn aa-btn-secondary" disabled={ocupado} onClick={() => setRechazando(true)}>Rechazar</button>
            </div>
          )}
        </div>
      )}

      {activo && (
        <div className="aa-en-vivo">
          <p className="aa-seccion-titulo"><span className="aa-punto-vivo" aria-hidden="true" /> Lo que soporte está haciendo en tu panel</p>
          <CifrasAcceso acceso={acceso} />
          <CambiosAcceso acceso={acceso} />
        </div>
      )}

      {(activo || acceso.estado === 'PENDIENTE_SOPORTE') && (
        <div className="aa-acciones">
          <button type="button" className={`aa-btn ${activo ? 'aa-btn-peligro' : 'aa-btn-secondary'}`} disabled={ocupado} onClick={onRevocar}>
            {activo ? 'Cortar el acceso ahora' : 'Retirar mi solicitud'}
          </button>
        </div>
      )}
    </section>
  );
}

function FormularioSolicitud({ ocupado, onEnviar }) {
  const [nivel, setNivel] = useState('BASICO');
  const [horas, setHoras] = useState(24);
  const [justificacion, setJustificacion] = useState('');
  const [adjunto, setAdjunto] = useState(null);
  const [errorAdjunto, setErrorAdjunto] = useState('');
  const archivoRef = useRef(null);
  const largo = justificacion.trim().length;
  const valido = largo >= JUSTIFICACION_MIN;

  const elegirAdjunto = (e) => {
    const archivo = e.target.files?.[0] ?? null;
    setErrorAdjunto('');
    if (archivo && archivo.size > ADJUNTO_MAX_BYTES) {
      setErrorAdjunto('El adjunto no puede pesar más de 10 MB.');
      e.target.value = '';
      setAdjunto(null);
      return;
    }
    setAdjunto(archivo);
  };

  const quitarAdjunto = () => {
    setAdjunto(null);
    if (archivoRef.current) archivoRef.current.value = '';
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!valido || ocupado) return;
    const ok = await onEnviar({ nivel, duracionHoras: horas, justificacion: justificacion.trim() }, adjunto);
    if (ok) {
      setJustificacion('');
      quitarAdjunto();
    }
  };

  return (
    <form className="aa-formulario" onSubmit={enviar}>
      <h3>Pedir ayuda con la carga</h3>

      <fieldset className="aa-campo">
        <legend>1 · ¿Qué necesitas que haga soporte?</legend>
        <div className="aa-niveles">
          {NIVELES.map((n) => {
            const { Icono, color } = ESTILO_NIVEL[n.valor];
            return (
              <label key={n.valor} className={`aa-nivel ${color} ${nivel === n.valor ? 'activo' : ''}`}>
                <input type="radio" name="nivel" checked={nivel === n.valor} onChange={() => setNivel(n.valor)} disabled={ocupado} />
                <span className="aa-nivel-icono"><Icono size={20} aria-hidden="true" /></span>
                <strong>{n.titulo}</strong>
                <small>{n.detalle}</small>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="aa-campo">
        <span>2 · ¿Por cuánto tiempo?</span>
        <Chips etiqueta="Duración" valor={horas} onCambio={setHoras} deshabilitado={ocupado}
          opciones={DURACIONES.map((d) => ({ valor: d.horas, etiqueta: d.etiqueta }))} />
      </div>

      <label className="aa-campo">
        <span>3 · Cuéntanos por qué necesitas ayuda *</span>
        <textarea
          value={justificacion}
          maxLength={JUSTIFICACION_MAX}
          rows={4}
          placeholder="Ej: Tengo 400 repuestos nuevos en un Excel y no alcanzo a subirlos esta semana."
          onChange={(e) => setJustificacion(e.target.value)}
          disabled={ocupado}
        />
        <small className={largo > 0 && !valido ? 'aa-falta' : ''}>
          {largo}/{JUSTIFICACION_MAX}{largo > 0 && !valido ? ` · faltan ${JUSTIFICACION_MIN - largo} caracteres` : ` · mínimo ${JUSTIFICACION_MIN}`}
        </small>
      </label>

      <div className="aa-campo">
        <span>4 · Tu lista de repuestos (opcional)</span>
        {adjunto ? (
          <div className="aa-adjunto">
            <Paperclip size={18} aria-hidden="true" />
            <span>{adjunto.name}</span>
            <button type="button" onClick={quitarAdjunto} aria-label="Quitar adjunto" disabled={ocupado}><X size={16} /></button>
          </div>
        ) : (
          <label className="aa-soltar">
            <input ref={archivoRef} type="file" accept={ADJUNTO_ACCEPT} onChange={elegirAdjunto} disabled={ocupado} />
            <Paperclip size={20} aria-hidden="true" />
            <span><strong>Adjunta tu Excel, PDF o una foto</strong><small>Hasta 10 MB. Así soporte sabe qué cargar.</small></span>
          </label>
        )}
        {errorAdjunto && <small className="aa-falta">{errorAdjunto}</small>}
      </div>

      <button type="submit" className="aa-btn aa-btn-primary aa-btn-grande" disabled={!valido || ocupado}>
        {ocupado ? <Loader2 className="spin" size={18} /> : <Headset size={18} aria-hidden="true" />} Enviar solicitud
      </button>
    </form>
  );
}

function Garantias() {
  return (
    <section className="aa-garantias" aria-label="Qué puede y qué no puede hacer soporte">
      <div className="aa-garantia si">
        <h4><CheckCircle2 size={18} aria-hidden="true" /> Soporte puede</h4>
        <ul>
          <li>Ver tu inventario, solo para consultar</li>
          <li>Crear repuestos nuevos (uno a uno o con Excel, según lo que autorices)</li>
          <li>Ajustar el precio de lo que cargó, si lo autorizas (no toca el stock ni lo que ya tenías)</li>
        </ul>
      </div>
      <div className="aa-garantia no">
        <h4><XCircle size={18} aria-hidden="true" /> Soporte nunca puede</h4>
        <ul>
          <li>Editar, eliminar ni pausar tus repuestos</li>
          <li>Ver tus pedidos, monedero, retiros o datos bancarios</li>
          <li>Cambiar tu contraseña, contrato o datos de cuenta</li>
        </ul>
      </div>
      <p className="aa-nota"><ShieldCheck size={16} aria-hidden="true" /> Entran como invitados, sin tu contraseña. Cada cambio queda registrado aquí y puedes cortar el acceso cuando quieras.</p>
    </section>
  );
}

function Historial({ accesos }) {
  const [abierto, setAbierto] = useState(null);
  return (
    <section className="aa-historial" aria-label="Historial de accesos">
      <h3><History size={18} aria-hidden="true" /> Historial de accesos</h3>
      {accesos.length === 0 ? <p className="aa-vacio">Soporte aún no ha entrado a tu panel.</p> : (
        <ul className="aa-linea">
          {accesos.map((a) => {
            const color = COLOR_ESTADO[a.estado] || 'gris';
            const creados = a.cambios ? a.cambios.totalCreados : a.resumen.productosCreados;
            const precios = a.cambios ? a.cambios.precios.length : a.resumen.preciosActualizados;
            const abiertoAqui = abierto === a.id;
            return (
              <li key={a.id} className={color}>
                <span className="aa-linea-punto" aria-hidden="true" />
                <div className="aa-linea-tarjeta">
                  <button type="button" className="aa-linea-cabecera" onClick={() => setAbierto(abiertoAqui ? null : a.id)} aria-expanded={abiertoAqui}>
                    <span className="aa-linea-copia">
                      <span className={`aa-etiqueta ${color}`}>{TEXTO_ESTADO[a.estado]}</span>
                      <strong>{fechaHora(a.creadoEn)}</strong>
                      <small>
                        {tituloNivel(a.nivel || a.nivelSolicitado)}{a.duracionHoras ? ` · ${etiquetaDuracion(a.duracionHoras)}` : ''}
                        {a.operadorNombre ? ` · ${a.operadorNombre}` : ''}
                      </small>
                    </span>
                    <span className="aa-linea-cifras">
                      <span className="aa-etiqueta azul">{creados} {creados === 1 ? 'repuesto' : 'repuestos'}</span>
                      <span className="aa-etiqueta violeta">{precios} {precios === 1 ? 'precio' : 'precios'}</span>
                      <span className="aa-ver">{abiertoAqui ? 'Ocultar' : 'Ver cambios'} <ChevronDown size={16} className={abiertoAqui ? 'girado' : ''} aria-hidden="true" /></span>
                    </span>
                  </button>
                  {abiertoAqui && (
                    <div className="aa-linea-detalle">
                      {a.comentarioRechazo && <p className="aa-motivo"><strong>Tu comentario:</strong> {a.comentarioRechazo}</p>}
                      <CambiosAcceso acceso={a} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
