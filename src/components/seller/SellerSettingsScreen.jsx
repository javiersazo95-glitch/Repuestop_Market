import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, Building2, CarFront, CheckCircle2, Copy, CreditCard, ExternalLink, FileText, FolderOpen, Landmark, Link2, ListOrdered,
  Loader2, Lock, Mail, MessageCircle, MessagesSquare, PencilLine, Plus, Send, Share2, Truck, User,
} from 'lucide-react';
import SocialIcon, { SOCIAL_COLORS } from '../SocialIcon';
import ShippingMethodsPicker from '../ShippingMethodsPicker';
import SpecialistBrandsManager from '../SpecialistBrandsManager';
import SellerVerificationCard from '../SellerVerificationCard';
import CertificadoCumplimientoCard from '../CertificadoCumplimientoCard';
import ChangePasswordCard from '../ChangePasswordCard';
import { BankAccountModal, isCompleteBankAccount } from '../SellerWithdrawalsPanel';
import {
  getSellerBankAccountApi, updateSellerShippingMethodsApi, updateStoreSocialLinksApi,
} from '../../services/api';
import { qk } from '../../services/queryKeys';
import { SOCIAL_NETWORKS, socialLinksFromVerification, socialLinksPayload, validateSocialLinks } from '../../utils/socialLinks';
import { absoluteUrl, shareLink } from '../../utils/shareLink';
import { storePath } from '../../routes/paths';
import { buildShippingMethodsString, getShippingMethodDefs, parseShippingSelections } from '../../data/shippingMethods';
import { SELLER_SETTINGS } from '../../data/sellerSettings';
import '../../styles/store-profile-mobile.css';
import '../../styles/seller-settings.css';

/**
 * Pantallas de «Configuración» del vendedor, una por acceso del menú Más, igual que la app
 * (`app/(seller)/tienda-redes.tsx`, `tienda-documentos`, `tienda-envios`, `tienda-bancarios`, `tienda-marcas` y
 * `change-password`): título, bajada y solo lo de esa sección, que se guarda ahí mismo.
 */

function Notice({ notice }) {
  if (!notice) return null;
  const Icon = notice.type === 'success' ? CheckCircle2 : AlertCircle;
  return <p className={`sst-notice is-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}><Icon size={16} /> {notice.message}</p>;
}

const SHARE_CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp', color: '#25D366', icon: MessageCircle, url: (_link, message) => `https://wa.me/?text=${encodeURIComponent(message)}` },
  { key: 'facebook', label: 'Facebook', color: '#1877F2', network: 'facebookUrl', url: (link) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
  { key: 'messenger', label: 'Messenger', color: '#0084FF', icon: MessagesSquare, url: (link) => `fb-messenger://share?link=${encodeURIComponent(link)}` },
  { key: 'telegram', label: 'Telegram', color: '#26A5E4', icon: Send, url: (link, message) => `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}` },
  { key: 'email', label: 'Correo', color: '#EA4335', icon: Mail, url: (_link, message) => `mailto:?subject=${encodeURIComponent('Mi tienda en RepuesTop')}&body=${encodeURIComponent(message)}` },
];

/** Igual que `SocialLinksManager.tsx` de la app: compartir el enlace de la tienda y sus redes, editadas en una ventana. */
function SocialSection({ sellerId, storeInfo, onSaved }) {
  const [links, setLinks] = useState(() => socialLinksFromVerification(storeInfo));
  const [draft, setDraft] = useState(links);
  const [modalOpen, setModalOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setLinks(socialLinksFromVerification(storeInfo)); }, [storeInfo]);

  const storeName = storeInfo?.storeName || '';
  const storeUrl = sellerId ? absoluteUrl(storePath({ id: sellerId, nombre: storeName })) : '';
  const shareMessage = `Mira mi tienda${storeName ? ` ${storeName}` : ''} en RepuesTop: ${storeUrl}`.trim();
  const registered = SOCIAL_NETWORKS.filter((network) => links[network.key]);

  const copyLink = async () => {
    if (!storeUrl) return;
    try { await navigator.clipboard.writeText(storeUrl); } catch { /* sin portapapeles: el enlace queda a la vista */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  const share = async () => {
    const result = await shareLink({ url: storeUrl, title: storeName || 'Mi tienda en RepuesTop', text: shareMessage });
    if (result === 'copied') { setCopied(true); setTimeout(() => setCopied(false), 2500); }
  };
  const openModal = () => { setDraft({ ...links }); setErrors({}); setFormError(''); setModalOpen(true); };
  const save = async () => {
    const nextErrors = validateSocialLinks(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setFormError('');
    try {
      const payload = socialLinksPayload(draft);
      await updateStoreSocialLinksApi(sellerId, payload);
      setLinks({ ...payload, enabled: Object.values(payload).some(Boolean) });
      setModalOpen(false);
      onSaved();
    } catch (err) {
      setFormError(err?.message || 'No se pudieron guardar tus redes sociales.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sst-social">
      <div className="sst-share">
        <div className="sst-share-head">
          <span className="sst-share-icon"><Share2 size={22} /></span>
          <span><strong>Comparte tu tienda</strong><small>Este es el enlace público de tu perfil en RepuesTop.</small></span>
        </div>
        <div className="sst-share-pill"><Link2 size={17} /><span>{storeUrl ? storeUrl.replace(/^https?:\/\//, '') : 'Tu enlace aparecerá al completar tu registro'}</span></div>
        <div className="sst-share-actions">
          <button type="button" className="is-ghost" onClick={copyLink} disabled={!storeUrl} aria-label="Copiar enlace de mi tienda"><Copy size={17} /> {copied ? 'Copiado' : 'Copiar'}</button>
          <button type="button" className="is-solid" onClick={share} disabled={!storeUrl} aria-label="Compartir mi tienda"><Send size={17} /> Compartir</button>
        </div>
      </div>

      <div className="sst-channels" aria-label="Compartir en redes sociales">
        {SHARE_CHANNELS.map((channel) => {
          const Icon = channel.icon;
          return (
            <a key={channel.key} href={storeUrl ? channel.url(storeUrl, shareMessage) : undefined} target="_blank" rel="noopener noreferrer" aria-label={`Compartir en ${channel.label}`} className={storeUrl ? '' : 'is-disabled'}>
              <span style={{ background: channel.color }}>{channel.network ? <SocialIcon network={channel.network} size={24} colored={false} /> : <Icon size={24} />}</span>
              <small>{channel.label}</small>
            </a>
          );
        })}
      </div>

      <section className="spm-group">
        <h3>Redes de tu tienda</h3>
        <div className="spm-card">
          {SOCIAL_NETWORKS.map((network) => {
            const url = links[network.key] ? String(links[network.key]) : '';
            return (
              <div key={network.key} className="sst-network">
                <button type="button" className="sst-network-main" onClick={openModal} aria-label={url ? `${network.label}: ${url}. Editar` : `Agregar ${network.label}`}>
                  <span className="sst-network-tile" style={{ background: SOCIAL_COLORS[network.key] }}><SocialIcon network={network.key} size={22} colored={false} /></span>
                  <span className="sst-network-copy"><strong>{network.label}</strong><small>{url ? url.replace(/^https?:\/\//, '') : 'Sin enlace'}</small></span>
                  {!url && <span className="sst-add-chip"><Plus size={14} /> Agregar</span>}
                </button>
                {url && <a className="sst-open" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${network.label}`}><ExternalLink size={17} /></a>}
              </div>
            );
          })}
        </div>
      </section>

      <button type="button" className="sst-outline" onClick={openModal}><PencilLine size={18} /> {registered.length > 0 ? 'Editar mis redes' : 'Agregar mis redes'}</button>

      {modalOpen && createPortal(
        <div className="sst-modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <div className="sst-modal" role="dialog" aria-modal="true" aria-label="Redes sociales">
            <div className="sst-modal-head">
              <span><strong>Redes sociales</strong><small>Se muestran como iconos en el perfil de tu tienda.</small></span>
              <label className="sst-switch"><input type="checkbox" checked={Boolean(draft.enabled)} aria-label="Mostrar redes sociales" onChange={(event) => { setDraft((current) => ({ ...current, enabled: event.target.checked })); setErrors({}); }} /><i /></label>
            </div>
            {draft.enabled ? (
              <div className="sst-modal-form">
                {SOCIAL_NETWORKS.map((network) => (
                  <label key={network.key} className="sst-field">
                    <span>{network.label}</span>
                    <input value={draft[network.key] || ''} placeholder={network.placeholder} inputMode="url" autoCapitalize="none" onChange={(event) => { const value = event.target.value; setDraft((current) => ({ ...current, [network.key]: value })); setErrors((current) => ({ ...current, [network.key]: undefined })); }} />
                    {errors[network.key] && <small className="sst-field-error">{errors[network.key]}</small>}
                  </label>
                ))}
              </div>
            ) : (
              <p className="sst-help">Activa el interruptor para mostrar tus redes en el perfil de tu tienda. Apagado, se quitan las que tengas.</p>
            )}
            {formError && <p className="sst-notice is-error" role="alert"><AlertCircle size={16} /> {formError}</p>}
            <div className="sst-modal-actions">
              <button type="button" className="sst-save" disabled={saving} onClick={save}>{saving ? <Loader2 size={16} className="spin-icon" /> : null} Guardar</button>
              <button type="button" className="sst-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ShippingSection({ sellerId, storeInfo, onSaved }) {
  const [selections, setSelections] = useState(() => parseShippingSelections(storeInfo?.shippingMethods));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  useEffect(() => { setSelections(parseShippingSelections(storeInfo?.shippingMethods)); }, [storeInfo?.shippingMethods]);

  const save = async () => {
    if (!getShippingMethodDefs().some((def) => selections[def.id]?.enabled)) {
      setNotice({ type: 'error', message: 'Selecciona al menos un método de envío.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await updateSellerShippingMethodsApi(sellerId, buildShippingMethodsString(selections));
      setNotice({ type: 'success', message: 'Tus métodos de envío se guardaron.' });
      onSaved();
    } catch (err) {
      setNotice({ type: 'error', message: err?.message || 'No pudimos guardar tus métodos de envío.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sst-card">
      {!storeInfo?.shippingMethods?.trim() && (
        <p className="sst-notice is-warning"><AlertCircle size={16} /> Registra al menos un método de envío para poder publicar repuestos.</p>
      )}
      <ShippingMethodsPicker selections={selections} onChange={setSelections} />
      <small className="sst-help">Elige los métodos que ofrece tu tienda. Deja el precio en blanco si es gratuito.</small>
      <Notice notice={notice} />
      <button type="button" className="sst-save" disabled={saving} onClick={save}>{saving ? <Loader2 size={16} className="spin-icon" /> : null} Guardar métodos de envío</button>
    </div>
  );
}

function BankSection({ sellerId, email }) {
  const queryClient = useQueryClient();
  const [account, setAccount] = useState(undefined);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    let active = true;
    getSellerBankAccountApi(sellerId).then((value) => { if (active) setAccount(value || null); }).catch(() => { if (active) setAccount(null); });
    return () => { active = false; };
  }, [sellerId]);

  if (account === undefined) return <div className="sst-card sst-muted"><Loader2 size={16} className="spin-icon" /> Cargando tu cuenta…</div>;
  const complete = isCompleteBankAccount(account);
  const rows = [
    { icon: User, title: 'Titular', value: account?.bankAccountHolderName },
    { icon: FileText, title: 'RUT del titular', value: account?.bankAccountRut },
    { icon: Building2, title: 'Banco', value: account?.bankName },
    { icon: ListOrdered, title: 'Tipo de cuenta', value: account?.bankAccountType },
    { icon: CreditCard, title: 'Número de cuenta', value: account?.bankAccountNumber },
  ];

  return (
    <>
      <div className={`sst-status ${complete ? 'is-ok' : 'is-warn'}`}>
        {complete ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
        <span><strong>{complete ? 'Cuenta registrada' : 'Falta registrar tu cuenta'}</strong>
          <small>{complete ? 'Aquí depositamos el dinero de tus ventas.' : 'Sin cuenta no podemos depositarte el dinero de tus ventas.'}</small></span>
      </div>
      <section className="spm-group">
        <h3>Titular y banco</h3>
        <div className="spm-card">
          {rows.map(({ icon: Icon, title, value }) => (
            <div key={title} className="spm-row"><div className="spm-row-main is-static">
              <span className="spm-row-icon"><Icon size={17} aria-hidden="true" /></span>
              <span className="spm-row-copy"><strong>{title}</strong><small>{value?.toString().trim() ? value : 'No registrado'}</small></span>
            </div></div>
          ))}
        </div>
      </section>
      <Notice notice={notice} />
      <button type="button" className="sst-save" onClick={() => setOpen(true)}><Landmark size={16} /> {complete ? 'Cambiar cuenta bancaria' : 'Registrar cuenta bancaria'}</button>
      {open && (
        <BankAccountModal
          sellerId={sellerId}
          fallbackEmail={email}
          initialAccount={account}
          onClose={() => setOpen(false)}
          onSaved={(saved) => {
            setAccount(saved);
            queryClient.invalidateQueries({ queryKey: qk.sellerBankAccount(sellerId) });
            setOpen(false);
            setNotice({ type: 'success', message: 'Tus datos bancarios se guardaron correctamente.' });
          }}
        />
      )}
    </>
  );
}

// El mismo icono de cada acceso del menú Más (cabecera de `SellerSectionScreen.tsx` de la app).
const SECTION_ICONS = { tienda_redes: Share2, tienda_documentos: FolderOpen, tienda_envios: Truck, tienda_bancarios: CreditCard, tienda_marcas: CarFront, cambiar_clave: Lock };

export default function SellerSettingsScreen({ section, user, storeInfo, sellerId }) {
  const queryClient = useQueryClient();
  const meta = SELLER_SETTINGS[section];
  if (!meta) return null;
  const HeaderIcon = SECTION_ICONS[section] || Building2;
  const refreshStore = () => queryClient.invalidateQueries({ queryKey: qk.sellerStore(sellerId) });

  return (
    <section className="profile-panel sst">
      <header className="sst-head">
        <span className="sst-head-icon"><HeaderIcon size={24} /></span>
        <span className="sst-head-copy">
          <h2 className="sst-title">{meta.title}</h2>
          <p>{meta.subtitle}</p>
        </span>
      </header>
      {section === 'tienda_redes' && <SocialSection sellerId={sellerId} storeInfo={storeInfo} onSaved={refreshStore} />}
      {section === 'tienda_envios' && <ShippingSection sellerId={sellerId} storeInfo={storeInfo} onSaved={refreshStore} />}
      {section === 'tienda_bancarios' && <BankSection sellerId={sellerId} email={user?.email} />}
      {section === 'tienda_marcas' && (
        <div className="sst-card">
          <SpecialistBrandsManager sellerId={sellerId} initialBrands={storeInfo?.marcasEspecialistas || []} onBrandsChange={refreshStore} />
        </div>
      )}
      {section === 'tienda_documentos' && (
        <>
          <SellerVerificationCard sellerId={sellerId} />
          <section className="spm-group sst-doc-group">
            <h3>Certificado de cumplimiento tributario</h3>
            <small className="sst-help">Se renueva dos veces al año, aparte de tus documentos.</small>
            <CertificadoCumplimientoCard sellerId={sellerId} />
          </section>
        </>
      )}
      {section === 'cambiar_clave' && <ChangePasswordCard user={{ ...user, taxId: storeInfo?.taxId || user?.taxId }} isSeller />}
    </section>
  );
}
