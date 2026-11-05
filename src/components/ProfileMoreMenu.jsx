import React, { useState } from 'react';
import CapturerContactCard from './CapturerContactCard';
import {
  Calendar, ChevronRight, Clipboard, Cog, Compass, FileText, Flag, Hammer, Headphones, Heart, HelpCircle, LifeBuoy, LogOut,
  MessageCircle, MessageSquare, MessagesSquare, PackageCheck, Activity, Search, Settings, ShieldCheck, Store, Tags, Telescope,
  Trash2, Lock, Wallet, X, Users, Inbox, Wrench, QrCode, Building2, Share2, FolderOpen, Truck, CreditCard, CarFront,
} from 'lucide-react';
import EngineIcon from './EngineIcon';
import { ROUTES } from '../routes/paths';

/**
 * Menú de la pestaña "Más" de la intranet del celular: es `app/(buyer)/account.tsx`, `app/(seller)/mas.tsx` y
 * `app/(workshop)/mas.tsx` de la app. Una tarjeta de perfil con sus contadores y, debajo, secciones con cabecera de color y
 * una grilla de accesos de 4 por fila (el mismo icono y color en los tres perfiles).
 * `tab` abre esa sección de la cuenta; `to` sale a la página pública equivalente; `action` es feedback o los textos legales.
 */
const COLORS = {
  catalog: '#0066ff', faults: '#EA580C', search: '#4F46E5', stores: '#0D9488', workshops: '#D97706', calendar: '#7C3AED',
  quotes: '#0284C7', orders: '#16A34A', questions: '#0891B2', heart: '#E11D48', flag: '#DC2626', support: '#0066ff',
  help: '#0EA5E9', docs: '#475569', privacy: '#059669', person: '#9333EA', location: '#DB2777', lock: '#64748B', feedback: '#F59E0B',
};

const SECTIONS_META = {
  Explorar: { icon: Compass, color: '#0066ff', subtitle: 'Repuestos, talleres, fallas y encargos' },
  'Mi actividad': { icon: Activity, color: '#7C3AED', subtitle: 'Lo que tienes en curso' },
  'Gestión del taller': { icon: Hammer, color: '#EA580C', subtitle: 'Tu taller, tus compras y tus citas' },
  Configuración: { icon: Settings, color: '#0D9488', subtitle: 'Tu tienda y tu cuenta' },
  'Información y ayuda': { icon: LifeBuoy, color: '#0891B2', subtitle: 'Soporte, ayuda y políticas' },
};

const t = (label, icon, color, target) => ({ label, icon, color, ...target });
const HELP_SECTION = [
  t('Preguntas a soporte', Headphones, COLORS.support, { tab: 'consultas' }),
  t('Centro de ayuda', HelpCircle, COLORS.help, { to: ROUTES.support }),
  t('Danos tu opinión', MessageCircle, COLORS.questions, { action: 'feedback' }),
  t('Términos y condiciones', FileText, COLORS.docs, { to: ROUTES.terms }),
  t('Política de privacidad', ShieldCheck, COLORS.privacy, { to: ROUTES.privacy }),
];

const MENUS = {
  buyer: [
    ['Explorar', [
      t('Marketplace de repuestos', Cog, COLORS.catalog, { tab: 'repuestos' }),
      t('Mis fallas', EngineIcon, COLORS.faults, { tab: 'mis_fallas' }),
      t('Encargar repuesto', Search, COLORS.search, { tab: 'subastas' }),
      t('Casas de repuestos', Store, COLORS.stores, { to: ROUTES.stores }),
      t('Talleres y servicios', Hammer, COLORS.workshops, { to: ROUTES.talleres }),
    ]],
    ['Mi actividad', [
      t('Cotización', Tags, COLORS.quotes, { tab: 'cotizaciones' }),
      t('Mis compras', PackageCheck, COLORS.orders, { tab: 'pedidos' }),
      t('Mis citas', Calendar, COLORS.calendar, { tab: 'mi_taller' }),
      t('Mis preguntas', MessageSquare, COLORS.questions, { tab: 'mis_preguntas' }),
      t('Favoritos', Heart, COLORS.heart, { tab: 'favoritos' }),
      t('Chats con vendedor', MessagesSquare, COLORS.questions, { tab: 'chats_vendedor' }),
      t('Reportes', Flag, COLORS.flag, { tab: 'consultas' }),
    ]],
    ['Información y ayuda', HELP_SECTION],
  ],
  seller: [
    ['Explorar', [
      t('Atender encargos', Telescope, COLORS.search, { tab: 'buscan' }),
      t('Favoritos', Heart, COLORS.heart, { tab: 'favoritos' }),
    ]],
    ['Mi actividad', [
      t('Cotizaciones', Clipboard, COLORS.quotes, { tab: 'cotizaciones' }),
      t('Pedidos recibidos', Inbox, COLORS.orders, { tab: 'pedidos' }),
      t('Preguntas de productos', MessageSquare, COLORS.questions, { tab: 'preguntas_productos' }),
      t('Retirar dinero', Wallet, COLORS.orders, { tab: 'retiros' }),
      t('Chats con compradores', MessagesSquare, COLORS.questions, { tab: 'chats_compradores' }),
      t('Reportes', Flag, COLORS.flag, { tab: 'consultas' }),
    ]],
    ['Configuración', [
      // Los 7 accesos de `app/(seller)/mas.tsx`, cada uno a su propia pantalla, con el mismo icono.
      t('Mi tienda y datos', Building2, COLORS.stores, { tab: 'tienda_datos' }),
      t('Redes sociales', Share2, COLORS.person, { tab: 'tienda_redes' }),
      t('Documentos', FolderOpen, COLORS.docs, { tab: 'tienda_documentos' }),
      t('Métodos de envío', Truck, COLORS.orders, { tab: 'tienda_envios' }),
      t('Datos bancarios', CreditCard, COLORS.quotes, { tab: 'tienda_bancarios' }),
      t('Marcas especialistas', CarFront, COLORS.workshops, { tab: 'tienda_marcas' }),
      t('Cambiar contraseña', Lock, COLORS.lock, { tab: 'cambiar_clave' }),
    ]],
    ['Información y ayuda', HELP_SECTION],
  ],
  workshop: [
    ['Explorar', [
      t('Marketplace de repuestos', Cog, COLORS.catalog, { tab: 'repuestos' }),
      t('Fallas automotrices', EngineIcon, COLORS.faults, { to: ROUTES.faults }),
      t('Encargar repuesto', Search, COLORS.search, { tab: 'subastas' }),
      t('Casas de repuestos', Store, COLORS.stores, { to: ROUTES.stores }),
    ]],
    ['Gestión del taller', [
      t('Cotización', Tags, COLORS.quotes, { tab: 'cotizaciones' }),
      t('Mis compras', PackageCheck, COLORS.orders, { tab: 'pedidos' }),
      t('Mis preguntas', MessageSquare, COLORS.questions, { tab: 'mis_preguntas' }),
      t('Chats con vendedor', MessagesSquare, COLORS.questions, { tab: 'chats_vendedor' }),
      // Mi taller lleva el icono de taller (llave), distinto del de «Casas de repuestos» (tienda).
      t('Mi taller', Wrench, COLORS.stores, { tab: 'mi_taller' }),
      t('Citas del taller', Calendar, COLORS.calendar, { tab: 'citas_taller' }),
      t('Invitar compradores', QrCode, COLORS.search, { tab: 'invitar_compradores' }),
      t('Favoritos', Heart, COLORS.heart, { tab: 'favoritos' }),
    ]],
    ['Información y ayuda', [
      HELP_SECTION[0],
      t('Reportes', Flag, COLORS.flag, { tab: 'consultas' }),
      ...HELP_SECTION.slice(1, 2),
      ...HELP_SECTION.slice(3),
    ]],
  ],
};

export default function ProfileMoreMenu({
  profile, displayName, email, avatarUrl, initials, stats = [], availableTabs, activeTab, storeLink = null, hints = {},
  onTab, onTo, onFeedback, onProfile, onDeleteAccount, onLogout, onClose, capturer = null,
}) {
  // Botón «Mi reclutador» del encabezado del taller (como la app): abre los datos de quien lo captó.
  const [recruiterOpen, setRecruiterOpen] = useState(false);
  const sections = MENUS[profile]
    .map(([title, items]) => [title, items.filter((item) => !item.tab || availableTabs.has(item.tab))])
    .filter(([, items]) => items.length > 0);

  const open = (item) => {
    onClose();
    if (item.action === 'feedback') onFeedback();
    else if (item.to) onTo(item.to);
    else onTab(item.tab);
  };

  return (
    <div className="pmm" role="dialog" aria-modal="true" aria-label="Más opciones de mi cuenta">
      <div className="pmm-grip" aria-hidden="true" />
      <button type="button" className="pmm-close" aria-label="Cerrar" onClick={onClose}><X size={18} /></button>
      <div className="pmm-scroll">
        <section className="pmm-hero">
          <div className="pmm-hero-top">
            <span className="pmm-avatar">{avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : initials}</span>
            <button type="button" className="pmm-hero-text" onClick={() => { onClose(); onProfile(); }} aria-label="Ver mi perfil">
              <strong>{displayName}</strong>
              {email && <small>{email}</small>}
              <span className="pmm-hero-link">Ver mi perfil <ChevronRight size={14} /></span>
            </button>
            {profile === 'workshop' && (
              <button type="button" className="pmm-recruiter" aria-label="Ver mi reclutador de talleres" onClick={() => setRecruiterOpen(true)}><Users size={20} /></button>
            )}
          </div>
          {stats.length > 0 && (
            <div className="pmm-stats">
              {stats.map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <button key={stat.label} type="button" onClick={() => { onClose(); onTab(stat.tab); }} aria-label={`${stat.label}: ${stat.value}`}>
                    <span><StatIcon size={14} /> <b>{stat.value > 999 ? '999+' : stat.value}</b></span>
                    <small>{stat.label}</small>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {storeLink && (
          <a className="pmm-store-link" href={storeLink} target="_blank" rel="noopener noreferrer" onClick={onClose}>
            <Store size={17} /> <span>Visitar mi tienda</span> <ChevronRight size={15} />
          </a>
        )}

        {sections.map(([title, items]) => {
          const meta = SECTIONS_META[title];
          const SectionIcon = meta.icon;
          return (
            <section key={title} className="pmm-section" aria-label={`Sección ${title}`}>
              <header style={{ background: `${meta.color}12` }}>
                <i style={{ background: meta.color }} />
                <span className="pmm-section-icon" style={{ background: meta.color }}><SectionIcon size={16} /></span>
                <span className="pmm-section-copy"><strong>{title}</strong><small>{meta.subtitle}</small></span>
              </header>
              <div className="pmm-grid">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = item.tab && activeTab === item.tab;
                  return (
                    <button key={`${title}-${item.label}`} type="button" className={active ? 'is-active' : ''} onClick={() => open(item)} aria-label={item.tab && hints[item.tab] ? `${item.label} (${hints[item.tab]})` : item.label}>
                      <span className="pmm-tile-icon" style={{ background: `${item.color}1F`, color: item.color }}><Icon size={20} />
                        {item.tab && hints[item.tab] && <em className="pmm-tile-hint">{hints[item.tab]}</em>}
                      </span>
                      <span className="pmm-tile-label">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {recruiterOpen && (
          <div className="pmm-recruiter-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setRecruiterOpen(false); }}>
            <div className="pmm-recruiter-sheet" role="dialog" aria-modal="true" aria-label="Mi reclutador de talleres">
              <div className="pmm-recruiter-head"><strong>Mi reclutador</strong><button type="button" aria-label="Cerrar" onClick={() => setRecruiterOpen(false)}><X size={18} /></button></div>
              {capturer
                ? <CapturerContactCard capturer={capturer} context="ads" />
                : <p className="pmm-recruiter-empty">Aún no tienes un reclutador asignado. Si necesitas ayuda, escríbenos desde el Centro de ayuda.</p>}
            </div>
          </div>
        )}

        <div className="pmm-actions">
          <button type="button" className="pmm-logout" onClick={() => { onClose(); onLogout(); }}><LogOut size={18} /> Cerrar sesión</button>
          <button type="button" className="pmm-delete" onClick={() => { onClose(); onDeleteAccount(); }}><Trash2 size={15} /> Cerrar cuenta</button>
        </div>
      </div>
    </div>
  );
}
