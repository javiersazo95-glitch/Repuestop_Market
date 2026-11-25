import React, { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ContextualReportButton from '../ContextualReportButton';

// El primero es el que soporte filtra como "reportadas" en Fichas por código.
const MOTIVOS_ERROR_FICHA = ['Error en la ficha técnica del repuesto', 'Otro motivo'];
import { OrigenFicha, PanelCodigos, PanelCompatibilidad, PanelInstalacion, PanelMedidas, PanelResumen } from './fichaPaneles';
import '../../styles/product-ficha.css';

/**
 * Detalle del repuesto por pestañas, para los que tienen ficha de su código de fabricante. Reemplaza las tarjetas
 * Ficha técnica, Compatibilidad y Descripción; los demás repuestos se ven como siempre.
 *
 * Cada pestaña parte con lo que entiende cualquier comprador y deja plegado lo que busca un mecánico. La pestaña
 * viaja en la URL (`?tab=medidas`) para poder compartirla.
 */
export default function FichaTabs({
  pestanas, ficha, product, descripcion, descripcionLarga, descripcionAbierta, onAlternarDescripcion, datosTienda,
  filasCompatibles, universal, compatible, vehiculoActivo, onVerificarPatente,
}) {
  const [params, setParams] = useSearchParams();
  const barra = useRef(null);
  const inicio = useRef(null);
  const pedida = params.get('tab');
  const activa = pestanas.some((p) => p.id === pedida) ? pedida : 'resumen';

  const elegir = (id, enfocar = false) => {
    setParams((previos) => {
      const siguientes = new URLSearchParams(previos);
      if (id === 'resumen') siguientes.delete('tab');
      else siguientes.set('tab', id);
      return siguientes;
    }, { replace: true, preventScrollReset: true });
    const boton = barra.current?.querySelector(`[data-tab="${id}"]`);
    if (enfocar) boton?.focus();
    // Con la barra pegada arriba se está leyendo el medio de otra pestaña: la nueva parte desde su comienzo.
    const corrida = (barra.current?.getBoundingClientRect().top ?? 0) - (inicio.current?.getBoundingClientRect().top ?? 0);
    if (corrida > 1) window.scrollBy({ top: -corrida });
    // En el celular la barra se desliza: la elegida queda a la vista.
    if (boton && barra.current) barra.current.scrollTo({ left: boton.offsetLeft - 16, behavior: 'smooth' });
  };

  const alTeclado = (evento) => {
    const indice = pestanas.findIndex((p) => p.id === activa);
    const destino = { ArrowRight: indice + 1, ArrowLeft: indice - 1, Home: 0, End: pestanas.length - 1 }[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    elegir(pestanas[(destino + pestanas.length) % pestanas.length].id, true);
  };

  return (
    <section className="pf-ficha" aria-label="Información del repuesto">
      {ficha.destacados.length > 0 && (
        <dl className="pf-destacados">
          {ficha.destacados.map((d) => <div key={d.nombre}><dt>{d.nombre}</dt><dd>{d.valor}</dd></div>)}
        </dl>
      )}
      <div ref={inicio} aria-hidden="true" />
      <div className="pf-tabs" role="tablist" aria-label="Información del repuesto" ref={barra} onKeyDown={alTeclado}>
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`pf-tab-${p.id}`}
            data-tab={p.id}
            aria-selected={activa === p.id}
            aria-controls={`pf-panel-${p.id}`}
            tabIndex={activa === p.id ? 0 : -1}
            className={activa === p.id ? 'activa' : ''}
            onClick={() => elegir(p.id)}
          >
            {p.label}{p.cuenta ? <small>{p.cuenta}</small> : null}
          </button>
        ))}
      </div>
      <div className="pf-panel" role="tabpanel" id={`pf-panel-${activa}`} aria-labelledby={`pf-tab-${activa}`} key={activa}>
        {activa === 'resumen' && (
          <PanelResumen
            ficha={ficha}
            descripcion={descripcion}
            descripcionLarga={descripcionLarga}
            descripcionAbierta={descripcionAbierta}
            onAlternarDescripcion={onAlternarDescripcion}
            datosTienda={datosTienda}
          />
        )}
        {activa === 'compatibilidad' && (
          <PanelCompatibilidad
            ficha={ficha}
            filas={filasCompatibles}
            universal={universal}
            compatible={compatible}
            vehiculoActivo={vehiculoActivo}
            onVerificar={onVerificarPatente}
          />
        )}
        {activa === 'medidas' && <PanelMedidas ficha={ficha} />}
        {activa === 'instalacion' && <PanelInstalacion ficha={ficha} />}
        {activa === 'codigos' && <PanelCodigos ficha={ficha} />}
      </div>
      <OrigenFicha verificada={ficha.verificada}>
        <ContextualReportButton
          tipoObjeto="PRODUCTO"
          objetoId={product.id}
          objetoTitulo={product.titulo}
          className="pf-error"
          label="¿Ves un error?"
          motivos={MOTIVOS_ERROR_FICHA}
        />
      </OrigenFicha>
    </section>
  );
}
