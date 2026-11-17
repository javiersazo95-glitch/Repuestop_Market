import React, { useState } from 'react';
import { Activity, FileSpreadsheet, PackagePlus, Tag } from 'lucide-react';
import { TEXTO_EVENTO, fechaHora, pesos } from './accesoAsistido';

function detalleEvento(detalle) {
  if (!detalle) return '';
  try {
    const d = JSON.parse(detalle);
    if (d.nombre) return ` — ${d.nombre}${d.sku ? ` (${d.sku})` : ''}`;
    if (d.sku) return ` — SKU ${d.sku}${d.precioAntes != null ? ` · ${pesos(d.precioAntes)} → ${pesos(d.precioDespues)}` : ''}`;
    if (d.cargados != null) return ` — ${d.archivo ? `${d.archivo}: ` : ''}${d.cargados} de ${d.filas} filas`;
  } catch { /* detalle ilegible: se omite */ }
  return '';
}

/** Cifras de lo que hizo soporte en un acceso: repuestos, precios y cargas de Excel. */
export function CifrasAcceso({ acceso }) {
  const cambios = acceso.cambios;
  const creados = cambios ? cambios.totalCreados : acceso.resumen?.productosCreados ?? 0;
  const precios = cambios ? cambios.precios.length : acceso.resumen?.preciosActualizados ?? 0;
  const cargas = cambios ? cambios.cargas.length : acceso.resumen?.cargasExcel ?? 0;
  return (
    <div className="aa-cifras">
      <div className="aa-cifra azul"><PackagePlus size={18} aria-hidden="true" /><strong>{creados}</strong><span>{creados === 1 ? 'repuesto creado' : 'repuestos creados'}</span></div>
      <div className="aa-cifra violeta"><Tag size={18} aria-hidden="true" /><strong>{precios}</strong><span>{precios === 1 ? 'precio cambiado' : 'precios cambiados'}</span></div>
      <div className="aa-cifra verde"><FileSpreadsheet size={18} aria-hidden="true" /><strong>{cargas}</strong><span>{cargas === 1 ? 'Excel cargado' : 'Excel cargados'}</span></div>
    </div>
  );
}

/**
 * Todo lo que cambió soporte en un acceso, por pestañas: repuestos creados (formulario o Excel), precios cambiados
 * (antes y después), cargas de Excel y la actividad completa. Así el vendedor revisa en detalle qué se hizo en su panel.
 */
export default function CambiosAcceso({ acceso }) {
  const cambios = acceso.cambios || { creados: [], totalCreados: 0, precios: [], cargas: [] };
  const pestanas = [
    { id: 'creados', titulo: 'Repuestos creados', cantidad: cambios.totalCreados, Icono: PackagePlus },
    { id: 'precios', titulo: 'Precios cambiados', cantidad: cambios.precios.length, Icono: Tag },
    { id: 'cargas', titulo: 'Cargas Excel', cantidad: cambios.cargas.length, Icono: FileSpreadsheet },
    { id: 'actividad', titulo: 'Actividad', cantidad: (acceso.eventos || []).length, Icono: Activity },
  ];
  const inicial = pestanas.find((p) => p.cantidad > 0 && p.id !== 'actividad')?.id || 'actividad';
  const [pestana, setPestana] = useState(inicial);

  return (
    <div className="aa-cambios">
      <div className="aa-cambios-pestanas" role="tablist" aria-label="Cambios de soporte">
        {pestanas.map(({ id, titulo, cantidad, Icono }) => (
          <button key={id} type="button" role="tab" aria-selected={pestana === id} className={pestana === id ? 'activa' : ''} onClick={() => setPestana(id)}>
            <Icono size={15} aria-hidden="true" /> {titulo} <span className="aa-cuenta">{cantidad}</span>
          </button>
        ))}
      </div>

      {pestana === 'creados' && (cambios.creados.length === 0
        ? <p className="aa-vacio">Soporte no creó repuestos en este acceso.</p>
        : (
          <>
            <ul className="aa-lista">
              {cambios.creados.map((c, i) => (
                <li key={`${c.productoId ?? 'x'}-${i}`} className={c.eliminado ? 'eliminado' : ''}>
                  <div className="aa-lista-principal">
                    <strong>{c.nombre || 'Repuesto sin nombre'}</strong>
                    <small>{c.sku ? `SKU ${c.sku}` : 'Sin SKU'} · {fechaHora(c.creadoEn)}</small>
                  </div>
                  <div className="aa-lista-lado">
                    <span className="aa-precio">{pesos(c.precio)}</span>
                    <span className={`aa-etiqueta ${c.desdeExcel ? 'verde' : 'azul'}`}>{c.desdeExcel ? 'Excel' : 'Formulario'}</span>
                    {c.eliminado && <span className="aa-etiqueta gris">Lo eliminaste</span>}
                  </div>
                </li>
              ))}
            </ul>
            {cambios.totalCreados > cambios.creados.length && (
              <p className="aa-vacio">Mostramos los {cambios.creados.length} más recientes de {cambios.totalCreados}.</p>
            )}
          </>
        ))}

      {pestana === 'precios' && (cambios.precios.length === 0
        ? <p className="aa-vacio">Soporte no cambió precios en este acceso.</p>
        : (
          <ul className="aa-lista">
            {cambios.precios.map((p, i) => (
              <li key={`${p.productoId ?? 'x'}-${i}`}>
                <div className="aa-lista-principal">
                  <strong>{p.nombre || (p.sku ? `SKU ${p.sku}` : 'Repuesto')}</strong>
                  <small>{p.sku ? `SKU ${p.sku} · ` : ''}{fechaHora(p.cambiadoEn)}</small>
                </div>
                <div className="aa-lista-lado">
                  <span className="aa-precio-antes">{pesos(p.precioAntes)}</span>
                  <span aria-hidden="true">→</span>
                  <span className="aa-precio">{pesos(p.precioDespues)}</span>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {pestana === 'cargas' && (cambios.cargas.length === 0
        ? <p className="aa-vacio">Soporte no cargó archivos Excel en este acceso.</p>
        : (
          <ul className="aa-lista">
            {cambios.cargas.map((c, i) => (
              <li key={`${c.cargaId ?? 'x'}-${i}`}>
                <div className="aa-lista-principal">
                  <strong>{c.archivo || 'Archivo Excel'}</strong>
                  <small>{fechaHora(c.cargadoEn)} · {c.filas} {c.filas === 1 ? 'fila' : 'filas'}</small>
                </div>
                <div className="aa-lista-lado">
                  <span className="aa-etiqueta verde">{c.cargados} cargados</span>
                  {c.conError > 0 && <span className="aa-etiqueta rojo">{c.conError} con error</span>}
                </div>
              </li>
            ))}
          </ul>
        ))}

      {pestana === 'actividad' && ((acceso.eventos || []).length === 0
        ? <p className="aa-vacio">Sin actividad registrada.</p>
        : (
          <ol className="aa-actividad">
            {acceso.eventos.map((e) => (
              <li key={e.id}>
                <time>{fechaHora(e.creadoEn)}</time>
                <span>{TEXTO_EVENTO[e.tipo] || e.tipo}{e.actorNombre ? ` · ${e.actorNombre}` : ''}{detalleEvento(e.detalle)}</span>
              </li>
            ))}
          </ol>
        ))}
    </div>
  );
}
