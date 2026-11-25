import React, { useMemo, useState } from 'react';
import { Car, CheckCircle2, FileText, Globe, Info, Ruler, Search, Wrench } from 'lucide-react';
import { CodigoCopiable, Filas, ImagenAmpliable, Plegable } from './fichaPartes';
import { FILAS_VISIBLES, gruposCompatibles, rangoAnios, vehiculosParaTaller } from './fichaModel';

export function PanelResumen({ ficha, descripcion, descripcionLarga, descripcionAbierta, onAlternarDescripcion, datosTienda }) {
  return (
    <>
      <div className={`pf-descripcion${descripcionLarga && !descripcionAbierta ? ' corta' : ''}`}><p>{descripcion}</p></div>
      {descripcionLarga && (
        <button type="button" className="pf-mas" onClick={onAlternarDescripcion}>
          {descripcionAbierta ? 'Ver menos' : 'Ver la descripción completa'}
        </button>
      )}
      <Filas filas={[...datosTienda, ...ficha.resumen]} visibles={10} columnas />
      {ficha.tecnicos.length > 0 && (
        <Plegable titulo="Ficha técnica completa" detalle={`${ficha.tecnicos.length} datos`}>
          <Filas filas={ficha.tecnicos} visibles={20} columnas />
        </Plegable>
      )}
    </>
  );
}

export function PanelCompatibilidad({ ficha, filas, universal, compatible, vehiculoActivo, onVerificar }) {
  const [texto, setTexto] = useState('');
  const [todos, setTodos] = useState(false);
  const grupos = useMemo(() => gruposCompatibles(filas), [filas]);
  if (universal) {
    return (
      <p className="pf-aviso azul">
        <Globe size={18} aria-hidden="true" />
        <span>Este repuesto es <strong>universal</strong>: la tienda lo publicó como compatible con cualquier vehículo.</span>
      </p>
    );
  }
  const buscado = texto.trim().toLocaleLowerCase('es');
  const hallados = grupos.filter((g) => !buscado || `${g.marca} ${g.modelo} ${g.motores.join(' ')}`.toLocaleLowerCase('es').includes(buscado));
  const visibles = todos || buscado ? hallados : hallados.slice(0, FILAS_VISIBLES);
  const taller = grupos.map((g) => ({ grupo: g, vehiculos: vehiculosParaTaller(g, ficha.vehiculos) })).filter((t) => t.vehiculos.length > 0);
  return (
    <>
      <div className={`pf-sirve${compatible ? ' si' : ''}`}>
        {compatible ? <CheckCircle2 size={22} aria-hidden="true" /> : <Car size={22} aria-hidden="true" />}
        <div>
          <strong>{compatible ? `Le sirve a tu ${vehiculoActivo.marca} ${vehiculoActivo.modelo}` : '¿Le sirve a tu auto?'}</strong>
          <span>{compatible ? 'Según los vehículos que publicó la tienda.' : 'Compruébalo con tu patente antes de comprar.'}</span>
        </div>
        <button type="button" onClick={onVerificar}>{compatible ? 'Probar otra patente' : 'Verificar con mi patente'}</button>
      </div>
      {grupos.length > FILAS_VISIBLES && (
        <label className="pf-buscar">
          <Search size={17} aria-hidden="true" />
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Busca por marca o modelo" aria-label="Buscar por marca o modelo" />
        </label>
      )}
      <ul className="pf-autos">
        {visibles.map((g) => (
          <li key={g.clave}>
            <strong>{[g.marca, g.modelo].filter(Boolean).join(' ')}</strong>
            <ul className="pf-tramos">
              {g.tramos.map((t) => (
                <li key={t.motor}>
                  <span className="pf-anios">{t.anios || 'Consulta los años'}</span>
                  {t.motor && <span className="pf-motores">motor {t.motor}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {hallados.length === 0 && <p className="pf-vacio">Ningún vehículo de la lista calza con “{texto}”.</p>}
      {!buscado && hallados.length > FILAS_VISIBLES && (
        <button type="button" className="pf-mas" onClick={() => setTodos((v) => !v)}>
          {todos ? 'Ver menos' : `Ver los ${hallados.length} modelos`}
        </button>
      )}
      {taller.length > 0 && (
        <Plegable titulo="Datos para taller" detalle="motor, potencia y restricciones">
          <TablaTaller taller={taller} />
        </Plegable>
      )}
    </>
  );
}

const FILAS_TALLER = 40;

function TablaTaller({ taller }) {
  const [todas, setTodas] = useState(false);
  const filas = taller.flatMap(({ grupo, vehiculos }) => vehiculos.map((v) => ({ grupo, v })));
  const visibles = todas ? filas : filas.slice(0, FILAS_TALLER);
  return (
    <>
      <div className="pf-tabla">
        <table>
          <thead><tr><th scope="col">Vehículo</th><th scope="col">Motor</th><th scope="col">Años del fabricante</th><th scope="col">Potencia</th></tr></thead>
          <tbody>
            {visibles.map(({ grupo, v }, i) => (
              <tr key={`${grupo.clave}-${i}`}>
                <td>{grupo.marca} {grupo.modelo}{v.restricciones?.length > 0 && <small>{v.restricciones.join(' · ')}</small>}</td>
                <td>{[v.motor, v.codigosMotor].filter(Boolean).join(' · ') || '—'}</td>
                <td>{v.anioDesde ? rangoAnios(v.anioDesde, v.anioHasta || 'hoy') : '—'}</td>
                <td>{v.potencia || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filas.length > FILAS_TALLER && (
        <button type="button" className="pf-mas" onClick={() => setTodas((x) => !x)}>{todas ? 'Ver menos' : `Ver las ${filas.length} filas`}</button>
      )}
    </>
  );
}

export function PanelMedidas({ ficha }) {
  const { medidas, plano } = ficha;
  return (
    <>
      <div className={`pf-dos${plano ? '' : ' una'}`}>
        {plano && <ImagenAmpliable src={plano.url} alt="Plano de medidas del repuesto" />}
        {medidas.length > 0 && (
          <dl className="pf-medidas">
            {medidas.map((m) => (
              <div key={`${m.nombre}-${m.valor}`}>
                <dt>{m.letra && <b>{m.letra}</b>}{m.nombre}</dt>
                <dd>{m.valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <p className="pf-nota"><Ruler size={16} aria-hidden="true" /> Compara estas medidas con la pieza que vas a reemplazar.</p>
    </>
  );
}

export function PanelInstalacion({ ficha }) {
  const { diagrama, puntos, piezas, documentos, accesorios } = ficha.instalacion;
  const [elegida, setElegida] = useState(null);
  const [sinImagen, setSinImagen] = useState(false);
  const alternar = (numero) => setElegida((actual) => (actual === numero ? null : numero));
  const conDiagrama = diagrama && !sinImagen;
  return (
    <>
      {(conDiagrama || piezas.length > 0) && (
        <div className={`pf-dos${conDiagrama && piezas.length > 0 ? '' : ' una'}`}>
          {conDiagrama && (
            <ImagenAmpliable src={diagrama.url} alt="Diagrama del repuesto" onFalla={() => setSinImagen(true)}>
              {puntos.map((p) => (
                <button
                  key={`${p.numero}-${p.x}-${p.y}`}
                  type="button"
                  className={`pf-punto${elegida === p.numero ? ' activo' : ''}`}
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                  onClick={() => alternar(p.numero)}
                  aria-pressed={elegida === p.numero}
                  aria-label={`Pieza ${p.numero}: ${piezas.find((x) => x.numero === p.numero)?.nombre || ''}`}
                >
                  {p.numero}
                </button>
              ))}
            </ImagenAmpliable>
          )}
          {piezas.length > 0 && (
            <div>
              <h3 className="pf-subtitulo">Qué trae</h3>
              <ul className="pf-piezas">
                {piezas.map((p, i) => (
                  <li key={`${p.numero}-${p.codigo}-${i}`} className={p.numero && elegida === p.numero ? 'activa' : ''}>
                    <button type="button" disabled={!conDiagrama || !p.numero} onClick={() => alternar(p.numero)}>
                      {p.numero && <b>{p.numero}</b>}
                      <span>{p.nombre || p.codigo}{p.nombre && p.codigo && <small>{p.codigo}</small>}</span>
                      {p.cantidad && <em>×{p.cantidad}</em>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {documentos.length > 0 && (
        <div className="pf-documentos">
          {documentos.map((d) => (
            <a key={d.url} href={d.url} target="_blank" rel="noopener noreferrer"><FileText size={18} aria-hidden="true" /> {d.descripcion || 'Documento del fabricante'} <small>PDF</small></a>
          ))}
        </div>
      )}
      {accesorios.length > 0 && (
        <>
          <h3 className="pf-subtitulo">Podrías necesitar <small>se venden aparte</small></h3>
          <Filas filas={accesorios.map((a) => ({ nombre: a.nombre || a.codigo, valor: [a.marca, a.nombre ? a.codigo : null].filter(Boolean).join(' · ') || '—' }))} visibles={6} />
        </>
      )}
      <p className="pf-nota"><Wrench size={16} aria-hidden="true" /> Muestra las piezas, no los pasos. Si no tienes experiencia, instálalo con un taller.</p>
    </>
  );
}

function GrupoCodigos({ grupos, visibles }) {
  const [todos, setTodos] = useState(false);
  const mostrados = todos ? grupos : grupos.slice(0, visibles);
  return (
    <>
      <div className="pf-codigos">
        {mostrados.map((g) => (
          <div key={g.marca}>
            <span>{g.marca}</span>
            <div>{g.codigos.map((c) => <CodigoCopiable key={c} codigo={c} />)}</div>
          </div>
        ))}
      </div>
      {grupos.length > visibles && (
        <button type="button" className="pf-mas" onClick={() => setTodos((v) => !v)}>{todos ? 'Ver menos' : `Ver ${grupos.length - visibles} marcas más`}</button>
      )}
    </>
  );
}

export function PanelCodigos({ ficha }) {
  const { fabricante, originales, codigosBarras, equivalentes } = ficha.codigos;
  const total = equivalentes.reduce((n, g) => n + g.codigos.length, 0);
  return (
    <>
      <p className="pf-intro">Sirven para comprobar que es la misma pieza que necesitas.</p>
      <div className="pf-codigos">
        {fabricante && <div><span>Código en la caja</span><div><CodigoCopiable codigo={fabricante} /></div></div>}
        {codigosBarras.length > 0 && <div><span>Código de barras</span><div>{codigosBarras.map((c) => <CodigoCopiable key={c} codigo={c} />)}</div></div>}
      </div>
      {originales.length > 0 && (
        <>
          <h3 className="pf-subtitulo">Números originales que reemplaza</h3>
          <GrupoCodigos grupos={originales} visibles={6} />
        </>
      )}
      {total > 0 && (
        <Plegable titulo="Equivalentes de otras marcas" detalle={`${total} códigos`}>
          <p className="pf-vacio">Son referencias del catálogo. Pueden tener diferencias: confirma antes de cambiar una por otra.</p>
          <GrupoCodigos grupos={equivalentes} visibles={8} />
        </Plegable>
      )}
    </>
  );
}

export function OrigenFicha({ verificada, children }) {
  return (
    <div className="pf-origen">
      <Info size={15} aria-hidden="true" />
      <span>{verificada ? 'Datos del catálogo del fabricante, revisados por RepuesTop.' : 'Datos del catálogo del fabricante. Si tienes dudas, confirma con la tienda.'}</span>
      {children}
    </div>
  );
}
