import { BRAND_LOGOS } from './data';

/** Los logos son decorativos (`alt=""`): leer 28 nombres de marca seguidos es
 *  ruido puro. El significado lo aporta el titulo de la seccion. */
function Track({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul className="rt-brands__track" aria-hidden={duplicate || undefined}>
      {BRAND_LOGOS.map((brand) => (
        <li key={brand}>
          <img src={`/brand-logos/${brand}.svg`} alt="" width={40} height={40} loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  );
}

export default function BrandStrip() {
  return (
    <section className="rt-brands rt-band--muted" aria-labelledby="rt-brands-title">
      <div className="rt-shell">
        <h2 id="rt-brands-title" className="rt-brands__title">
          Repuestos y marcas que ya conoces
        </h2>
      </div>

      <div className="rt-brands__viewport">
        <Track />
        <Track duplicate />
      </div>

      <div className="rt-shell">
        <p className="rt-brands__note">
          Marcas referenciales de repuestos disponibles en el catálogo de RepuesTop.
        </p>
      </div>
    </section>
  );
}
