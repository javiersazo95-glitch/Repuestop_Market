import React from 'react';
import { Link } from 'react-router-dom';
import OfficialPatentHero from '../components/OfficialPatentHero';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAppNavigation } from '../routes/useAppNavigation';
import { useDocumentTitle } from '../routes/useDocumentTitle';
import { seoTitleFor } from '../routes/seoPages';
import { ROUTES } from '../routes/paths';
import '../styles/home-sections.css';

/**
 * /repuestos-por-patente (16-nov). Pagina de entrada desde Google para quien busca "repuestos por
 * patente": el inicio habla de todo a la vez y para Google era "un marketplace", no "el lugar para
 * buscar por patente". Arriba va EL MISMO buscador del inicio (mismo componente, misma logica).
 *
 * Diseño: los pasos se cuentan con los objetos reales del tramite -la placa, la ficha del auto y la
 * lista de repuestos-, dibujados en CSS, en vez de recuadros numerados (el usuario los rechazo por
 * parecer generados). La secuencia la da el recorrido de izquierda a derecha y el <ol>.
 *
 * Los textos describen solo lo que el sitio hace hoy. Ojo con prometer compatibilidad: la declara
 * cada tienda y los Terminos no la garantizan. Los datos de la ficha y la lista son ilustrativos.
 */

const FAQS = [
  {
    q: '¿Buscar por patente tiene costo?',
    a: 'No. Buscar y comparar es gratis: solo pagas el repuesto y su envío.',
  },
  {
    q: '¿Necesito una cuenta para buscar?',
    a: 'No. Puedes buscar, ver precios y armar tu carrito sin cuenta; la necesitas solo para pagar.',
  },
  {
    q: '¿La compatibilidad está garantizada?',
    a: 'Cada tienda declara con qué vehículos es compatible su repuesto. Antes de comprar, revisa «Ver compatibilidad» en la ficha o pregúntale a la tienda desde ahí. Si tienes el código OEM de la pieza, compáralo.',
  },
  {
    q: '¿Puedo buscar por código OEM o por el nombre del repuesto?',
    a: 'Sí, desde la barra de búsqueda de la parte superior de la página.',
  },
];

/** Placa patente chilena dibujada (formato nuevo: cuatro letras y dos numeros). */
function ChilePlate({ small = false }) {
  return (
    <span className={`cl-plate ${small ? 'is-small' : ''}`} aria-hidden="true">
      <span className="cl-plate-country">CHILE</span>
      <span className="cl-plate-chars">KH<i>·</i>TP<i>·</i>47</span>
    </span>
  );
}

function PlateRoute() {
  return (
    <div className="plate-route">
      <h2>Cómo funciona</h2>
      <ol>
        <li>
          <div className="plate-route-figure">
            <ChilePlate />
          </div>
          <h3>Escribe tu patente</h3>
          <p>Formato nuevo (ABCD12) o antiguo (BB·CL·12), con o sin guiones.</p>
        </li>
        <li>
          <div className="plate-route-figure">
            <dl className="plate-route-vehicle" aria-hidden="true">
              <div><dt>Marca</dt><dd>Toyota</dd></div>
              <div><dt>Modelo</dt><dd>Yaris</dd></div>
              <div><dt>Año</dt><dd>2019</dd></div>
              <div><dt>Versión</dt><dd>1.5 GLi</dd></div>
            </dl>
          </div>
          <h3>Reconocemos tu auto</h3>
          <p>Marca, modelo, año y versión, sin que tengas que buscarlos en una lista.</p>
        </li>
        <li>
          <div className="plate-route-figure">
            <ul className="plate-route-parts" aria-hidden="true">
              <li><span /><b>Pastillas freno</b><em>$18.900</em></li>
              <li><span /><b>Filtro aceite</b><em>$6.490</em></li>
              <li><span /><b>Correa</b><em>$14.200</em></li>
            </ul>
          </div>
          <h3>Compara y compra</h3>
          <p>Lo publicado para tu auto y los universales. Pagas con Flow, protegido hasta que recibes.</p>
        </li>
      </ol>
    </div>
  );
}

function PlateHelp() {
  return (
    <div className="plate-tips">
      <section>
        <h3>¿La patente no encontró tu auto?</h3>
        <p>
          Cambia a «Búsqueda manual» y elige marca, modelo, año, versión y combustible: llegas al mismo
          catálogo filtrado para tu vehículo. Si el repuesto no está publicado,{' '}
          <Link to={ROUTES.auctions}>encárgalo</Link> y las tiendas te envían sus ofertas.
        </p>
      </section>
      <section>
        <h3>Dónde encontrar tu patente</h3>
        <ul className="plate-docs">
          <li><span className="plate-doc is-plate"><ChilePlate small /></span>En la placa del auto</li>
          <li>
            <span className="plate-doc is-padron" aria-hidden="true"><b>Padrón</b><i /><i /><i /></span>
            En el padrón
          </li>
          <li>
            <span className="plate-doc is-permiso" aria-hidden="true"><b>Permiso</b><strong>2026</strong></span>
            En el permiso de circulación
          </li>
          <li>
            <span className="plate-doc is-soap" aria-hidden="true"><strong>SOAP</strong><i /><i /></span>
            En el SOAP
          </li>
        </ul>
      </section>
    </div>
  );
}

export default function PlateSearchPage() {
  useDocumentTitle(seoTitleFor(ROUTES.plateSearch));
  const nav = useAppNavigation();
  const { activeVehicle, setActiveVehicle } = useMarketplace();

  return (
    <>
      {/* Hero compacto: a la izquierda el titulo y el recorrido; a la derecha el buscador y las
          ayudas. Con el hero completo del inicio la explicacion quedaba muy abajo. */}
      <OfficialPatentHero
        compact
        heading={<>Repuestos<br /> por patente<br /> <span>en todo Chile</span></>}
        intro={(
          <p className="plate-hero-lead">
            Cada auto en Chile tiene una patente única. Con ella sabemos qué vehículo tienes y te
            mostramos los repuestos que las tiendas publicaron para él, sin que necesites el código
            de la pieza.
          </p>
        )}
        introExtra={(
          <>
            <PlateRoute />
            <PlateHelp />
          </>
        )}
        activeVehicle={activeVehicle}
        onSelectVehicle={setActiveVehicle}
        onOpenSellerModal={nav.goSellerRegister}
        onOpenCatalog={(filter, extra) => nav.goCatalog(filter, extra)}
        onOpenHelp={nav.goHelp}
        selectedCategory={null}
        onSelectCategory={(filter) => nav.goCatalog(filter)}
      />

      <section className="plate-guide" aria-labelledby="plate-faq-title">
        <div className="container plate-guide-sheet">
          <h2 id="plate-faq-title">Preguntas frecuentes</h2>
          <div className="plate-guide-faq">
            {FAQS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>

          <nav className="plate-guide-more" aria-label="Sigue explorando">
            <Link to={ROUTES.catalog}>Ver el catálogo de repuestos</Link>
            <Link to={ROUTES.stores}>Conocer las casas de repuestos</Link>
            <Link to={ROUTES.support}>Ir al centro de ayuda</Link>
          </nav>
        </div>
      </section>
    </>
  );
}
