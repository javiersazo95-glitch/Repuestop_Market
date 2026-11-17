import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Headset, Loader2, ShieldCheck } from 'lucide-react';
import { autorizarPorEnlaceApi, getConsentimientoAccesoApi, rechazarPorEnlaceApi } from '../services/api';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import { DURACIONES, etiquetaDuracion, fechaHora, nivelesHasta, tituloNivel } from '../components/acceso-asistido/accesoAsistido';
import { COMENTARIO_MAX } from '../components/acceso-asistido/AccesoAsistidoPanel';
import '../components/acceso-asistido/AccesoAsistido.css';

const NO_PUEDE = [
  'Editar, eliminar ni pausar ninguno de tus repuestos.',
  'Ver ni tocar tus pedidos, tu monedero, tus retiros ni tus datos bancarios.',
  'Cambiar tu contraseña, tu contrato ni los datos de tu cuenta.',
];

const MENSAJE_FINAL = {
  RECHAZADO: 'No autorizaste el acceso. Soporte no entrará a tu panel.',
  CANCELADO: 'Soporte canceló esta solicitud. No hace falta que hagas nada.',
  EXPIRADO: 'Esta solicitud venció sin respuesta. Si aún necesitas ayuda, pídela desde tu perfil o espera un nuevo correo.',
  REVOCADO: 'Este acceso ya fue cortado.',
  FINALIZADO: 'Soporte ya terminó de cargar y salió de tu panel.',
};

/**
 * Pagina del enlace del correo de acceso asistido (17-nov). El vendedor llega SIN iniciar sesion: el token firmado y
 * de un solo uso es la autorizacion. Abrir el enlace no autoriza nada: hace falta elegir el tiempo y hacer clic.
 */
export default function AccesoSoportePage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [horas, setHoras] = useState(() => {
    const pedida = Number(params.get('d'));
    return DURACIONES.some((d) => d.horas === pedida) ? pedida : 8;
  });
  const [nivel, setNivel] = useState('');
  const [rechazando, setRechazando] = useState(params.get('rechazar') === '1');
  const [comentario, setComentario] = useState('');
  useDocumentTitle('Acceso de soporte a tu panel');

  useEffect(() => {
    let activo = true;
    getConsentimientoAccesoApi(token)
      .then((respuesta) => { if (activo) { setDatos(respuesta); setNivel(respuesta.nivelSolicitado); } })
      .catch((err) => { if (activo) setError(err?.message || 'No pudimos abrir este enlace.'); });
    return () => { activo = false; };
  }, [token]);

  const ejecutar = async (tarea) => {
    setOcupado(true);
    setError('');
    try {
      setResultado(await tarea());
    } catch (err) {
      setError(err?.message || 'No se pudo completar la acción.');
    } finally {
      setOcupado(false);
    }
  };

  if (error && !datos) {
    return (
      <main className="acceso-soporte-pagina">
        <section className="acceso-soporte-tarjeta" role="alert">
          <AlertCircle size={28} aria-hidden="true" />
          <h1>Este enlace ya no sirve</h1>
          <p>{error}</p>
          <p>Si necesitas ayuda con la carga, puedes pedirla desde tu perfil en <strong>Ayuda con la carga</strong>.</p>
        </section>
      </main>
    );
  }
  if (!datos) {
    return <main className="acceso-soporte-pagina"><section className="acceso-soporte-tarjeta"><Loader2 className="spin" size={24} /> Abriendo…</section></main>;
  }

  const vista = resultado || datos;
  if (vista.estado === 'ACTIVO') {
    return (
      <main className="acceso-soporte-pagina">
        <section className="acceso-soporte-tarjeta" role="status">
          <CheckCircle2 size={28} aria-hidden="true" />
          <h1>Acceso autorizado</h1>
          <p>Soporte puede cargar tus repuestos ({tituloNivel(vista.nivel)}) hasta el <strong>{fechaHora(vista.expiraEn).replace(/\.$/, '')}</strong>.</p>
          <p>Puedes cortarlo cuando quieras desde tu perfil, en <strong>Ayuda con la carga</strong>. Al terminar te enviaremos un resumen de lo que se cargó.</p>
        </section>
      </main>
    );
  }
  if (vista.estado !== 'PENDIENTE_VENDEDOR') {
    return (
      <main className="acceso-soporte-pagina">
        <section className="acceso-soporte-tarjeta" role="status">
          <ShieldCheck size={28} aria-hidden="true" />
          <h1>{vista.estado === 'RECHAZADO' ? 'Respuesta registrada' : 'Esta solicitud ya no está disponible'}</h1>
          <p>{MENSAJE_FINAL[vista.estado] || 'Esta solicitud ya no está pendiente.'}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="acceso-soporte-pagina">
      <section className="acceso-soporte-tarjeta">
        <div className="acceso-soporte-titulo">
          <span className="acceso-asistido-resumen-icono"><Headset size={20} aria-hidden="true" /></span>
          <h1>Soporte pide ayudarte a cargar repuestos</h1>
        </div>
        <p>El equipo de Mediación y Confianza de RepuesTop pide entrar al panel de <strong>{datos.tiendaNombre}</strong>.
          <strong> No entra nadie hasta que tú lo autorices.</strong></p>

        <div className="acceso-soporte-bloque">
          <h2>Por qué te lo piden</h2>
          <p>{datos.motivo}</p>
        </div>
        <div className="acceso-soporte-bloque">
          <h2>Qué podrían hacer: {tituloNivel(datos.nivelSolicitado)}</h2>
          <ul>
            <li>Ver tu inventario, solo para consultar.</li>
            <li>Crear repuestos nuevos con el formulario, uno a uno.</li>
            {datos.nivelSolicitado !== 'BASICO' && <li>Ajustar el precio de los repuestos que carguen en este acceso (no tocan el stock ni lo que ya tenías).</li>}
            {datos.nivelSolicitado === 'COMPLETO' && <li>Subir repuestos nuevos con un archivo Excel.</li>}
          </ul>
        </div>
        <div className="acceso-soporte-bloque acceso-soporte-no">
          <h2>Qué NO podrían hacer</h2>
          <ul>{NO_PUEDE.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <p className="acceso-asistido-nota"><ShieldCheck size={16} aria-hidden="true" /> Entran como invitados, sin tu contraseña. Cada ingreso y cada repuesto cargado queda registrado con fecha y nombre del operador, y puedes cortar el acceso cuando quieras.</p>

        {error && <p className="acceso-asistido-mensaje" role="alert">{error}</p>}

        {rechazando ? (
          <div className="acceso-asistido-decision">
            <label>
              Comentario para soporte (opcional)
              <input type="text" value={comentario} maxLength={COMENTARIO_MAX} onChange={(e) => setComentario(e.target.value)} disabled={ocupado} />
            </label>
            <div className="acceso-asistido-acciones">
              <button type="button" className="aa-btn aa-btn-primary" disabled={ocupado} onClick={() => ejecutar(() => rechazarPorEnlaceApi(token, comentario.trim()))}>Confirmar: no autorizar</button>
              <button type="button" className="aa-btn aa-btn-secondary" disabled={ocupado} onClick={() => setRechazando(false)}>Volver</button>
            </div>
          </div>
        ) : (
          <div className="acceso-asistido-decision">
            <div className="acceso-soporte-campo">
              <span className="acceso-soporte-etiqueta">¿Por cuánto tiempo das el acceso?</span>
              <div className="aa-chips" role="radiogroup" aria-label="Duración del acceso">
                {DURACIONES.map((d) => (
                  <button key={d.horas} type="button" role="radio" aria-checked={horas === d.horas}
                    className={`aa-chip ${horas === d.horas ? 'activo' : ''}`} disabled={ocupado} onClick={() => setHoras(d.horas)}>
                    {d.etiqueta}
                  </button>
                ))}
              </div>
            </div>
            {nivelesHasta(datos.nivelSolicitado).length > 1 && (
              <div className="acceso-soporte-campo">
                <span className="acceso-soporte-etiqueta">¿Qué les permites? (puedes dar menos de lo pedido)</span>
                <div className="aa-chips" role="radiogroup" aria-label="Permiso que concedes">
                  {nivelesHasta(datos.nivelSolicitado).map((n) => (
                    <button key={n.valor} type="button" role="radio" aria-checked={nivel === n.valor}
                      className={`aa-chip ${nivel === n.valor ? 'activo' : ''}`} disabled={ocupado} onClick={() => setNivel(n.valor)}>
                      {n.titulo}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="acceso-asistido-acciones acceso-soporte-botones">
              <button type="button" className="aa-btn aa-btn-primary" disabled={ocupado} onClick={() => ejecutar(() => autorizarPorEnlaceApi(token, { duracionHoras: horas, nivel }))}>
                Autorizar por {etiquetaDuracion(horas)}
              </button>
              <button type="button" className="aa-btn aa-btn-secondary" disabled={ocupado} onClick={() => setRechazando(true)}>No autorizar</button>
            </div>
          </div>
        )}
        <p className="acceso-asistido-nota">Esta solicitud vence el {String(fechaHora(datos.solicitudExpiraEn) || '').replace(/\.$/, '')}.</p>
      </section>
    </main>
  );
}
