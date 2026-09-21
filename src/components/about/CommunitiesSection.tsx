import { ArrowRight, Check, Crown, ShoppingBag, Store, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Reveal from './Reveal';

interface Community {
  id: string;
  crop: string;
  photoAlt: string;
  Icon: LucideIcon;
  tag: string;
  founderTag?: string;
  title: string;
  lead: string;
  checks: { label: string; text: string }[];
  steps: { title: string; text: string }[];
  cta: { label: string; Icon: LucideIcon; primary: boolean };
}

const COMMUNITIES: Community[] = [
  {
    id: 'buyers',
    crop: 'rt-crop--buyers',
    photoAlt: 'Dos clientas revisando repuestos en RepuesTop desde su celular',
    Icon: ShoppingBag,
    tag: 'Para conductores y talleres',
    title: 'Compra con la certeza de que el repuesto calza y tu dinero está a salvo',
    lead: 'Olvida las llamadas a ciegas y las transferencias a cuentas desconocidas. Buscas por la patente de tu vehículo, comparas precios entre casas de repuestos verificadas y tienes 3 días tras recibir la pieza para validar que funcione.',
    checks: [
      { label: 'Resumen de compras.', text: 'Pedidos, envíos en camino y cotizaciones activas en un solo lugar.' },
      { label: 'Cotizaciones formales.', text: 'Chat directo con la tienda y respuesta con precio y garantía.' },
      { label: 'Favoritos y repetición de compra.', text: 'Guarda repuestos para tu vehículo y vuelve a comprarlos fácil.' },
      { label: 'Factura para empresas.', text: 'Ingreso de RUT y razón social para crédito fiscal IVA.' },
    ],
    steps: [
      { title: 'Ingresa la patente', text: 'El sistema filtra el catálogo automáticamente según tu vehículo.' },
      { title: 'Cotiza o compra directo', text: 'Habla con la tienda por chat o paga en cuotas sin interés.' },
      { title: 'Recibe con respaldo', text: 'Retira con PIN $0 o recibe con courier. Fondos protegidos por 3 días.' },
    ],
    cta: { label: 'Explorar marketplace', Icon: ArrowRight, primary: false },
  },
  {
    id: 'sellers',
    crop: 'rt-crop--sellers',
    photoAlt: 'Vendedor de una casa de repuestos mostrando su panel de gestión en RepuesTop',
    Icon: Store,
    tag: 'Para casas de repuestos',
    founderTag: 'Campaña Tiendas Fundadoras',
    title: 'Vende a clientes con intención real y comisión fija del 5%',
    lead: 'Conecta con conductores y talleres que buscan repuestos específicos para su vehículo. Carga tu lista desde Excel, responde cotizaciones por chat, gestiona tus envíos y recibe tus pagos puntuales sin riesgos.',
    checks: [
      { label: 'Carga fácil desde Excel.', text: 'Sube tu catálogo completo de repuestos en minutos.' },
      { label: 'Comisión transparente.', text: 'Ves el monto exacto a recibir antes de publicar cada repuesto.' },
      { label: 'Compatibilidad por vehículo.', text: 'Asocia la pieza al modelo o márcala como universal.' },
      { label: 'Control de inventario.', text: 'Repuestos activos, stock disponible y ventas al día.' },
    ],
    steps: [
      { title: '5% de comisión de tienda fundadora', text: 'Comisión preferencial fija garantizada durante todo tu primer año.' },
      { title: 'Carga fácil desde Excel', text: 'Sube tu catálogo completo de repuestos en minutos sin ingresar uno por uno.' },
      { title: 'Calculadora de ganancia clara', text: 'Fija tus precios sabiendo exactamente cuánto vas a recibir por cada repuesto.' },
    ],
    cta: { label: 'Quiero ser tienda fundadora', Icon: Crown, primary: true },
  },
];

export default function CommunitiesSection({
  onCatalog,
  onOpenSeller,
}: {
  onCatalog: () => void;
  onOpenSeller: () => void;
}) {
  const actions: Record<string, () => void> = { buyers: onCatalog, sellers: onOpenSeller };

  return (
    <section className="rt-band" id="ecosistema" aria-labelledby="rt-communities-title">
      <div className="rt-shell">
        <Reveal className="rt-head">
          <span className="rt-eyebrow">
            <Users size={14} /> Una plataforma, dos comunidades
          </span>
          <h2 id="rt-communities-title">
            Hecha para quienes mantienen a Chile en movimiento
          </h2>
          <p>
            Cada perfil tiene su propio panel, con pedidos, cotizaciones y catálogo siempre al día.
            Nada de mockups: así se ve RepuesTop hoy mismo.
          </p>
        </Reveal>

        <div className="rt-communities-grid">
          {COMMUNITIES.map((community, index) => {
            const CtaIcon = community.cta.Icon;
            return (
              <Reveal as="article" className="rt-community" key={community.id} delay={index * 90}>
                <figure className={`rt-crop rt-community__photo ${community.crop}`}>
                  <img
                    src="/about-assets/nosotros.jpg"
                    alt={community.photoAlt}
                    width={1672}
                    height={941}
                    loading="lazy"
                    decoding="async"
                  />
                </figure>

                <div className="rt-community__body">
                  <div className="rt-community__tags">
                    <span className="rt-tag">
                      <community.Icon size={14} /> {community.tag}
                    </span>
                    {community.founderTag && (
                      <span className="rt-tag rt-tag--founder">
                        <Crown size={14} /> {community.founderTag}
                      </span>
                    )}
                  </div>

                  <h3>{community.title}</h3>
                  <p>{community.lead}</p>

                  <ul className="rt-checks">
                    {community.checks.map((check) => (
                      <li key={check.label}>
                        <Check size={16} />
                        <span>
                          <strong>{check.label}</strong> {check.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <ol className="rt-steps">
                    {community.steps.map((step, stepIndex) => (
                      <li key={step.title}>
                        <b>{stepIndex + 1}</b>
                        <span>
                          <strong>{step.title}.</strong> {step.text}
                        </span>
                      </li>
                    ))}
                  </ol>

                  <button
                    type="button"
                    className={`rt-btn ${community.cta.primary ? 'rt-btn--primary' : 'rt-btn--outline'}`}
                    onClick={actions[community.id]}
                  >
                    <CtaIcon size={18} />
                    <span>{community.cta.label}</span>
                  </button>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
