import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight, Compass, Disc3, FileText, Filter, Headphones,
  Lock, Megaphone, MessageSquare, PackageSearch, Search, ShieldCheck, Store, Tag,
  Truck, Users
} from 'lucide-react';
import {
  ROUTES, buyerProfilePath, catalogPath, helpCategoryPath, helpContactPath,
} from '../routes/paths';
import { useAuth } from '../context/AuthContext';

/**
 * Los enlaces del footer son `<a>` reales (`Link`), no botones: así se indexan,
 * se pueden abrir en una pestaña nueva y el navegador muestra el destino. Solo
 * "Buscar por patente" queda como botón, porque es una acción de scroll y no
 * tiene URL propia.
 *
 * Ojo con las categorías: el `id` tiene que existir en `HEADER_CATEGORIES`
 * (`src/data/categories.js`). `PartsCatalogView` traduce ese id a un id real del
 * backend comparando NOMBRES, y si no calza no falla: la consulta sale sin
 * filtro y el catálogo se ve completo con un chip que promete una categoría.
 * Por eso "Filtros y Aceites" apunta a `filtros` y no a `aceites`, que solo
 * existe en la grilla decorativa del home.
 */
const EXPLORE_LINKS = [
  ['Catálogo de repuestos', PackageSearch, ROUTES.catalog],
  ['Tiendas Verificadas', Store, ROUTES.stores],
  ['Mural de Anuncios', Megaphone, ROUTES.adsWall],
];

const CATEGORY_LINKS = [
  ['Frenos y Discos', Disc3, catalogPath({ category: 'frenos' })],
  ['Motor y Distribución', PackageSearch, catalogPath({ category: 'motor' })],
  ['Suspensión y Dirección', Tag, catalogPath({ category: 'suspension' })],
  ['Filtros y Aceites', Filter, catalogPath({ category: 'filtros' })],
];

// `/vender` es directamente el formulario de registro, así que no hay una segunda
// URL "de beneficios" a la que apuntar. El tercer enlace usa el tema `info`, que
// es válido para un invitado y ya trae el asunto "Quiero vender en RepuesTop".
const SELLER_LINKS = [
  ['Vende tus repuestos', Store, ROUTES.sellerRegister],
  ['Publica en el Mural', Megaphone, ROUTES.adsWall],
  ['¿Quieres vender? Escríbenos', MessageSquare, helpContactPath('info')],
];

// El acceso a las compras está detrás de `RequireAuth`: a un invitado lo devuelve al
// home con el login abierto. El candado lo avisa antes de que parezca roto.
const SUPPORT_LINKS = [
  ['Centro de Ayuda', Headphones, ROUTES.support, false],
  ['Preguntas frecuentes', MessageSquare, ROUTES.helpAllFaqs, false],
  ['Contactar soporte', Headphones, helpContactPath(), false],
  ['Quiénes somos', Users, ROUTES.about, false],
];

export default function Footer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const buyerPurchasesLabel = String(user?.role || user?.rol || '').toUpperCase() === 'SELLER'
    ? 'Mis compras'
    : 'Mis pedidos';
  const supportLinks = [
    ...SUPPORT_LINKS.slice(0, 2),
    [buyerPurchasesLabel, PackageSearch, buyerProfilePath(user, 'purchases'), true],
    ...SUPPORT_LINKS.slice(2),
  ];

  // Enlazar a la ruta en la que ya estamos no navega a ningún lado y deja al
  // usuario mirando la misma pantalla sin moverse: en ese caso se sube al inicio.
  const handleSameRoute = (to) => (event) => {
    if (to.split('?')[0] !== location.pathname) return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goPatentSearch = () => {
    if (location.pathname !== ROUTES.home) {
      navigate(ROUTES.home);
      return;
    }
    const hero = document.getElementById('patent-search-hero');
    if (!hero) return;
    // `scrollIntoView` no mueve nada en algunos navegadores embebidos; el scroll
    // calculado sobre la ventana funciona igual en todos.
    window.scrollTo({ top: hero.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
  };

  const renderLink = (label, Icon, to, requiresAuth = false) => (
    <li key={`${label}-${to}`}>
      <Link to={to} onClick={handleSameRoute(to)}>
        <Icon />
        <span>{label}</span>
        {requiresAuth
          ? <Lock className="footer-link-chevron" aria-label="Requiere iniciar sesión" />
          : <ChevronRight className="footer-link-chevron" />}
      </Link>
    </li>
  );

  return (
    <footer className="modern-footer-section reference-footer">
      <div className="container reference-footer-grid">
        <section className="reference-footer-brand">
          <div className="reference-footer-logo">
            <img src="/repuestop_icon.png" alt="" />
            <span>Repues<b>Top</b></span>
          </div>
          <p>El marketplace automotriz para encontrar repuestos nuevos, comparar opciones y comprar con seguridad.</p>

          <div className="footer-trust-points">
            <div><Truck /><span><strong>Envíos a todo Chile</strong>Entregas rápidas y seguras donde estés.</span></div>
            <div className="footer-flow-point">
              <b>flow</b>
              <span><strong>Pagos procesados por Flow</strong>Crédito y débito</span>
            </div>
          </div>
        </section>

        <section className="reference-footer-column">
          <h2><Compass /> Explorar Repuestos</h2>
          <ul>
            {EXPLORE_LINKS.map(([label, Icon, to]) => renderLink(label, Icon, to))}
            <li>
              <button type="button" onClick={goPatentSearch}>
                <Search /> <span>Buscar por patente</span> <ChevronRight className="footer-link-chevron" />
              </button>
            </li>
          </ul>
        </section>

        <section className="reference-footer-column">
          <h2><Tag /> Categorías Populares</h2>
          <ul>
            {CATEGORY_LINKS.map(([label, Icon, to]) => renderLink(label, Icon, to))}
          </ul>
        </section>

        <section className="reference-footer-column">
          <h2><Store /> Vende en RepuesTop</h2>
          <ul>
            {SELLER_LINKS.map(([label, Icon, to]) => renderLink(label, Icon, to))}
          </ul>
        </section>

        <section className="reference-footer-column">
          <h2><Headphones /> Ayuda y Confianza</h2>
          <ul>
            {supportLinks.map(([label, Icon, to, requiresAuth]) => renderLink(label, Icon, to, requiresAuth))}
          </ul>
        </section>
      </div>

      <div className="container reference-footer-bottom">
        <p>© 2026 Corebit SpA Chile.<br />Todos los derechos reservados.</p>
        <nav>
          <Link to={ROUTES.terms} onClick={handleSameRoute(ROUTES.terms)}><FileText size={13} /> Términos y Condiciones</Link>
          <Link to={ROUTES.privacy} onClick={handleSameRoute(ROUTES.privacy)}><ShieldCheck size={13} /> Política de Privacidad</Link>
          <Link to={helpCategoryPath('politicas')} onClick={handleSameRoute(helpCategoryPath('politicas'))}>
            <FileText size={13} /> Políticas de cookies
          </Link>
        </nav>
        <span className="reference-footer-security">
          <ShieldCheck size={14} /> Compra protegida
        </span>
      </div>

    </footer>
  );
}
