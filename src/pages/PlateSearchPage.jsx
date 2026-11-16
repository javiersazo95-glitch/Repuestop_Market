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
 * buscar por patente". Arriba va EL MISMO buscador del inicio (mismo componente, misma logica);
 * debajo, una guia que no existia en ningun lado del sitio.
 *
 * Los textos describen solo lo que el sitio hace hoy. Ojo con prometer compatibilidad: la declara
 * cada tienda y los Terminos no la garantizan.
 */

const STEPS = [
  {
    title: 'Escribe tu patente',
    text: 'En el buscador de arriba. Sirve el formato nuevo (ABCD12) y el antiguo (BB·CL·12), con o sin guiones.',
  },
  {
    title: 'Identificamos tu vehículo',
    text: 'Con la patente obtenemos la marca, el modelo, el año y la versión de tu auto, sin que tengas que buscarlos en una lista.',
  },
  {
    title: 'Compara y compra',
    text: 'El catálogo muestra los repuestos que las tiendas publicaron para ese vehículo, más los universales. Comparas precio, tienda y envío, y pagas con Flow: el pago queda protegido hasta que recibes.',
  },
];

const PLATE_LOCATIONS = [
  'La placa delantera y trasera del vehículo.',
  'El padrón (certificado de inscripción).',
  'El permiso de circulación.',
  'El SOAP.',
];

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

export default function PlateSearchPage() {
  useDocumentTitle(seoTitleFor(ROUTES.plateSearch));
  const nav = useAppNavigation();
  const { activeVehicle, setActiveVehicle } = useMarketplace();

  return (
    <>
      <OfficialPatentHero
        heading={<>Repuestos<br /> por patente<br /> <span>en todo Chile</span></>}
        activeVehicle={activeVehicle}
        onSelectVehicle={setActiveVehicle}
        onOpenSellerModal={nav.goSellerRegister}
        onOpenCatalog={(filter, extra) => nav.goCatalog(filter, extra)}
        onOpenHelp={nav.goHelp}
        selectedCategory={null}
        onSelectCategory={(filter) => nav.goCatalog(filter)}
      />

      <section className="plate-guide" aria-labelledby="plate-guide-title">
        <div className="container plate-guide-sheet">
          <header className="plate-guide-head">
            <span className="plate-guide-label">Guía</span>
            <h2 id="plate-guide-title">Cómo funciona la búsqueda de repuestos por patente</h2>
            <p>
              Cada auto en Chile tiene una patente única. Con ella sabemos exactamente qué vehículo
              tienes y te mostramos los repuestos que las tiendas de RepuesTop publicaron para él, sin
              que necesites el código de la pieza.
            </p>
          </header>

          <ol className="plate-guide-steps">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="plate-guide-num">{String(index + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="plate-guide-pair">
            <div>
              <span className="plate-guide-label">Si no aparece</span>
              <h3>La patente no encontró tu auto</h3>
              <p>
                Cambia a «Búsqueda manual» y elige marca, modelo, año, versión y combustible: el
                resultado es el mismo catálogo filtrado para tu vehículo. Y si el repuesto no está
                publicado, <Link to={ROUTES.auctions}>encárgalo</Link> y las tiendas te envían sus ofertas.
              </p>
            </div>
            <div>
              <span className="plate-guide-label">Dónde está</span>
              <h3>Dónde encontrar tu patente</h3>
              <ul>
                {PLATE_LOCATIONS.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>

          <div className="plate-guide-faq">
            <span className="plate-guide-label">Preguntas frecuentes</span>
            {FAQS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>

          <nav className="plate-guide-more" aria-label="Sigue explorando">
            <span className="plate-guide-label">Sigue explorando</span>
            <Link to={ROUTES.catalog}>Catálogo de repuestos</Link>
            <Link to={ROUTES.stores}>Casas de repuestos verificadas</Link>
            <Link to={ROUTES.support}>Centro de ayuda</Link>
          </nav>
        </div>
      </section>
    </>
  );
}
