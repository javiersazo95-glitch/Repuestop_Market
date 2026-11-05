import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Building2, CheckCircle2, CreditCard, FileText, Landmark, ListOrdered, Loader2, User } from 'lucide-react';
import SocialLinksFields from '../SocialLinksFields';
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
import { socialLinksFromVerification, socialLinksPayload, validateSocialLinks } from '../../utils/socialLinks';
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

function SocialSection({ sellerId, storeInfo, onSaved }) {
  const [value, setValue] = useState(() => socialLinksFromVerification(storeInfo));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  useEffect(() => { setValue(socialLinksFromVerification(storeInfo)); }, [storeInfo]);

  const save = async () => {
    const nextErrors = validateSocialLinks(value);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setNotice({ type: 'error', message: 'Revisa los enlaces de tus redes sociales.' }); return; }
    setSaving(true);
    setNotice(null);
    try {
      await updateStoreSocialLinksApi(sellerId, socialLinksPayload(value));
      setNotice({ type: 'success', message: 'Tus redes sociales se guardaron.' });
      onSaved();
    } catch (err) {
      setNotice({ type: 'error', message: err?.message || 'No pudimos guardar tus redes sociales.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sst-card">
      <SocialLinksFields value={value} errors={errors} fieldClassName="form-group" onChange={(next) => { setValue(next); setErrors({}); }} />
      <Notice notice={notice} />
      <button type="button" className="sst-save" disabled={saving} onClick={save}>{saving ? <Loader2 size={16} className="spin-icon" /> : null} Guardar redes sociales</button>
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

export default function SellerSettingsScreen({ section, user, storeInfo, sellerId }) {
  const queryClient = useQueryClient();
  const meta = SELLER_SETTINGS[section];
  if (!meta) return null;
  const refreshStore = () => queryClient.invalidateQueries({ queryKey: qk.sellerStore(sellerId) });

  return (
    <section className="profile-panel sst">
      <header className="sst-head">
        <h2 className="profile-panel-title">{meta.title}</h2>
        <p>{meta.subtitle}</p>
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
