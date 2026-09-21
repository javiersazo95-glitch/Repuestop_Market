import { ArrowRight, Calculator, Crown, LockKeyhole, Package, Search, ShoppingBag, Store, Truck, Users, FileSpreadsheet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Reveal from './Reveal';
import { BrowserFrame } from './Frame';

interface Community {
  id: 'buyers' | 'sellers';
  media: { kind: 'crop'; crop: string; src: string; alt: string } | { kind: 'shot'; src: string; alt: string };
  Icon: LucideIcon;
  tag: string;
  founderTag?: string;
  title: string;
  line: string;
  perks: { Icon: LucideIcon; label: string }[];
  cta: { label: string; Icon: LucideIcon; primary: boolean };
}

const COMMUNITIES: Community[] = [
  {
    id: 'buyers',
    media: {
      kind: 'crop',
      crop: 'rt-crop--buyers',
      src: '/about-assets/nosotros.webp',
      alt: 'Dos clientas revisando repuestos en RepuesTop desde su celular',
    },
    Icon: ShoppingBag,
    tag: 'Para conductores y talleres',
    title: 'Compra sabiendo que calza',
    line: 'Buscas por patente, comparas tiendas verificadas y tienes 3 días para probar la pieza.',
    perks: [
      { Icon: Search, label: 'Patente exacta' },
      { Icon: LockKeyhole, label: 'Pago protegido' },
      { Icon: Truck, label: 'Retiro $0' },
    ],
    cta: { label: 'Explorar marketplace', Icon: ArrowRight, primary: false },
  },
  {
    id: 'sellers',
    media: {
      kind: 'shot',
      src: '/about-assets/shot-tiendas.webp',
      alt: 'Vitrina de casas de repuestos verificadas en RepuesTop',
    },
    Icon: Store,
    tag: 'Para casas de repuestos',
    founderTag: 'Tienda fundadora',
    title: 'Vende con comisión fija del 5%',
    line: 'Subes tu Excel, ves cuánto recibes antes de publicar y cobras puntual.',
    perks: [
      { Icon: FileSpreadsheet, label: 'Carga por Excel' },
      { Icon: Calculator, label: 'Ganancia clara' },
      { Icon: Package, label: 'Stock al día' },
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
  const actions: Record<Community['id'], () => void> = { buyers: onCatalog, sellers: onOpenSeller };

  return (
    <section className="rt-band" id="ecosistema" aria-labelledby="rt-communities-title">
      <div className="rt-shell">
        <Reveal className="rt-head">
          <span className="rt-eyebrow">
            <Users size={14} /> Una plataforma, dos comunidades
          </span>
          <h2 id="rt-communities-title">Hecha para quienes mantienen a Chile en movimiento</h2>
        </Reveal>

        <div className="rt-communities-grid">
          {COMMUNITIES.map((c, index) => {
            const CtaIcon = c.cta.Icon;
            return (
              <Reveal as="article" className="rt-community" key={c.id} delay={index * 90}>
                {c.media.kind === 'crop' ? (
                  <figure className={`rt-crop rt-community__photo ${c.media.crop}`}>
                    <img src={c.media.src} alt={c.media.alt} width={1672} height={941} loading="lazy" decoding="async" />
                  </figure>
                ) : (
                  <div className="rt-community__shot">
                    <BrowserFrame url="repuestop.cl/tiendas">
                      <img src={c.media.src} alt={c.media.alt} width={1440} height={900} loading="lazy" decoding="async" />
                    </BrowserFrame>
                  </div>
                )}

                <div className="rt-community__body">
                  <div className="rt-community__tags">
                    <span className="rt-tag"><c.Icon size={14} /> {c.tag}</span>
                    {c.founderTag && (
                      <span className="rt-tag rt-tag--founder"><Crown size={14} /> {c.founderTag}</span>
                    )}
                  </div>

                  <h3>{c.title}</h3>
                  <p>{c.line}</p>

                  <ul className="rt-perks">
                    {c.perks.map((p) => (
                      <li key={p.label}>
                        <span className="rt-perks__icon"><p.Icon size={18} /></span>
                        <span>{p.label}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className={`rt-btn ${c.cta.primary ? 'rt-btn--primary' : 'rt-btn--outline'}`}
                    onClick={actions[c.id]}
                  >
                    <CtaIcon size={18} />
                    <span>{c.cta.label}</span>
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
