import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle, CalendarDays, CheckCircle2, CreditCard, Eye, History, Info,
  Landmark, Loader2, Mail, Package, Save, User, Wallet, X,
} from 'lucide-react';
import {
  createSellerWithdrawalApi, getSellerBankAccountApi, getSellerPendingWithdrawalsApi,
  getSellerWithdrawalDetailApi, getSellerWithdrawalsApi, updateSellerBankAccountApi,
} from '../services/api';
import { BANKS, findBankByCode } from '../data/banks';

const EMPTY_PENDING = { pedidos: [], totalARetirar: 0 };
const ACCOUNT_TYPES = [
  { value: 'corriente', label: 'Cuenta corriente' },
  { value: 'ahorro', label: 'Cuenta de ahorro' },
  { value: 'vista', label: 'Cuenta vista' },
  { value: 'digital', label: 'Cuenta digital / Billetera' },
];

const STATUS_CONFIG = {
  SOLICITADO: { label: 'Solicitado', className: 'requested' },
  PAGADO: { label: 'Depositado', className: 'paid' },
  RECHAZADO: { label: 'Rechazado', className: 'rejected' },
};

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function formatDate(value, withTime = false) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Fecha no informada';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: withTime ? 'short' : 'long', year: withTime ? undefined : 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'America/Santiago',
  }).format(new Date(value));
}

function formatAccountType(value) {
  return ACCOUNT_TYPES.find((option) => option.value === value)?.label || value || 'No registrado';
}

function formatAccountNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? digits.replace(/(.{4})/g, '$1 ').trim() : 'No registrado';
}

function formatRut(value) {
  const clean = String(value || '').replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${body}-${clean.slice(-1)}`;
}

function isValidRut(value) {
  const clean = String(value || '').replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 8) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expectedValue = 11 - (sum % 11);
  const expected = expectedValue === 11 ? '0' : expectedValue === 10 ? 'K' : String(expectedValue);
  return dv === expected;
}

function isCompleteBankAccount(account) {
  const bank = findBankByCode(account?.bankCode);
  const basic = account?.bankAccountHolderName?.trim() && account?.bankAccountRut?.trim()
    && account?.bankName?.trim() && account?.bankAccountType?.trim() && account?.bankAccountNumber?.trim();
  return Boolean(basic && (!bank?.requiresAlias || (account?.bankAccountRegistrationType === 'ALIAS' && account?.bankAccountAliasValue?.trim())));
}

function WithdrawalStatus({ status }) {
  const config = STATUS_CONFIG[String(status || '').toUpperCase()] || { label: status || 'Sin estado', className: 'other' };
  return <span className={`withdrawal-status ${config.className}`}>{config.label}</span>;
}

function PendingOrderRow({ order }) {
  return (
    <article className="withdrawal-order-row">
      <div>
        <strong>{order.nombrePedido || order.nombre || 'Producto sin nombre'}</strong>
        <span>Pedido #{order.pedidoId} · {formatDate(order.fecha, true)} · Cantidad vendida: {Number(order.cantidadVendida || 0)}</span>
      </div>
      <b>{formatCLP(order.valor)}</b>
    </article>
  );
}

function ModalShell({ title, subtitle, icon: Icon = Wallet, onClose, children, wide = false }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  return createPortal(
    <div className="order-modal-backdrop withdrawal-modal-backdrop" onClick={onClose}>
      <section className={`withdrawal-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header>
          <span className="withdrawal-modal-icon"><Icon size={21} /></span>
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button type="button" aria-label="Cerrar" onClick={onClose}><X size={19} /></button>
        </header>
        {children}
      </section>
    </div>,
    document.body
  );
}

function BankAccountModal({ sellerId, initialAccount, fallbackEmail, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    bankCode: initialAccount?.bankCode ? String(initialAccount.bankCode) : '',
    holderName: initialAccount?.bankAccountHolderName || '',
    rut: formatRut(initialAccount?.bankAccountRut || ''),
    accountType: initialAccount?.bankAccountType || '',
    accountNumber: formatAccountNumber(initialAccount?.bankAccountNumber || '').replace('No registrado', ''),
    notificationEmail: initialAccount?.bankAccountNotificationEmail || fallbackEmail || '',
    aliasType: initialAccount?.bankAccountRegistrationType === 'ALIAS' ? 'RUT' : '',
    aliasValue: initialAccount?.bankAccountAliasValue || '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const selectedBank = findBankByCode(form.bankCode);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const accountDigits = form.accountNumber.replace(/\D/g, '');
    const rutClean = form.rut.replace(/[^0-9kK]/g, '').toUpperCase();
    const nextErrors = {};
    if (!selectedBank) nextErrors.bankCode = 'Selecciona el banco de tu cuenta.';
    if (!form.holderName.trim()) nextErrors.holderName = 'Ingresa el nombre del titular.';
    if (!isValidRut(form.rut)) nextErrors.rut = 'Ingresa un RUT válido.';
    if (!form.accountType) nextErrors.accountType = 'Selecciona el tipo de cuenta.';
    if (accountDigits.length < 6) nextErrors.accountNumber = 'Ingresa un número de cuenta válido.';
    if (form.notificationEmail && !/^\S+@\S+\.\S+$/.test(form.notificationEmail.trim())) nextErrors.notificationEmail = 'Ingresa un email válido.';
    if (selectedBank?.requiresAlias && (!form.aliasType || !form.aliasValue.trim())) nextErrors.aliasValue = `${selectedBank.label} requiere un alias registrado.`;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !selectedBank) return;

    const payload = {
      bankName: selectedBank.label,
      bankCode: selectedBank.code,
      bankAccountHolderName: form.holderName.trim(),
      bankAccountRut: formatRut(form.rut),
      bankAccountRutNumero: rutClean.slice(0, -1),
      bankAccountRutDv: rutClean.slice(-1),
      bankAccountType: form.accountType,
      bankAccountNumber: accountDigits,
      bankAccountRegistrationType: selectedBank.requiresAlias ? 'ALIAS' : 'CUENTA_BANCARIA',
      bankAccountAliasValue: selectedBank.requiresAlias ? form.aliasValue.trim() : null,
      bankAccountNotificationEmail: form.notificationEmail.trim() || null,
    };
    setSaving(true);
    try {
      await updateSellerBankAccountApi(sellerId, payload);
      onSaved(payload);
    } catch (error) {
      setErrors({ submit: error.message || 'No se pudieron guardar los datos bancarios.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Datos bancarios" subtitle="Estos datos se usan para procesar tus retiros de dinero." icon={Landmark} onClose={onClose} wide>
      <form className="withdrawal-bank-form" onSubmit={handleSubmit}>
        {errors.submit && <div className="withdrawal-alert error"><AlertCircle size={17} /><span>{errors.submit}</span></div>}
        <label className="wide-field"><span>Banco</span><select value={form.bankCode} onChange={(event) => update('bankCode', event.target.value)}><option value="">Selecciona tu banco</option>{BANKS.map((bank) => <option key={bank.code} value={bank.code}>{bank.label}</option>)}</select>{errors.bankCode && <small>{errors.bankCode}</small>}</label>
        <label><span><User size={14} /> Nombre del titular</span><input value={form.holderName} onChange={(event) => update('holderName', event.target.value)} placeholder="Nombre del titular" />{errors.holderName && <small>{errors.holderName}</small>}</label>
        <label><span>RUT</span><input value={form.rut} onChange={(event) => update('rut', formatRut(event.target.value))} placeholder="12.345.678-9" />{errors.rut && <small>{errors.rut}</small>}</label>
        <label><span>Tipo de cuenta</span><select value={form.accountType} onChange={(event) => update('accountType', event.target.value)}><option value="">Selecciona el tipo</option>{ACCOUNT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>{errors.accountType && <small>{errors.accountType}</small>}</label>
        <label><span><CreditCard size={14} /> Número de cuenta bancaria</span><input inputMode="numeric" value={form.accountNumber} onChange={(event) => update('accountNumber', formatAccountNumber(event.target.value).replace('No registrado', ''))} placeholder="1234567890" />{errors.accountNumber && <small>{errors.accountNumber}</small>}</label>
        <label className="wide-field"><span><Mail size={14} /> Email para notificar el pago (opcional)</span><input type="email" value={form.notificationEmail} onChange={(event) => update('notificationEmail', event.target.value)} placeholder="correo@ejemplo.com" />{errors.notificationEmail && <small>{errors.notificationEmail}</small>}</label>
        {selectedBank?.requiresAlias && <><label><span>¿Cómo tienes inscrita tu cuenta?</span><select value={form.aliasType} onChange={(event) => update('aliasType', event.target.value)}><option value="">Selecciona una opción</option><option value="RUT">RUT</option><option value="EMAIL">Email</option><option value="TELEFONO">Teléfono</option></select></label><label><span>Valor del alias</span><input value={form.aliasValue} onChange={(event) => update('aliasValue', event.target.value)} placeholder="RUT, email o teléfono registrado" />{errors.aliasValue && <small>{errors.aliasValue}</small>}</label></>}
        <footer className="wide-field"><button type="button" className="btn-auth-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="btn-auth-primary" disabled={saving}><Save size={16} />{saving ? 'Guardando...' : 'Guardar cambios'}</button></footer>
      </form>
    </ModalShell>
  );
}

export default function SellerWithdrawalsPanel({ sellerId, sellerEmail }) {
  const [activeTab, setActiveTab] = useState('management');
  const [pending, setPending] = useState(EMPTY_PENDING);
  const [history, setHistory] = useState([]);
  const [bankAccount, setBankAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadWithdrawals = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    setError('');
    try {
      const [pendingData, historyData] = await Promise.all([
        getSellerPendingWithdrawalsApi(sellerId),
        getSellerWithdrawalsApi(sellerId),
      ]);
      setPending({ pedidos: pendingData?.pedidos || [], totalARetirar: Number(pendingData?.totalARetirar || 0) });
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar la información de retiros.');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => { loadWithdrawals(); }, [loadWithdrawals]);

  const withdrawalInProgress = useMemo(
    () => history.find((withdrawal) => String(withdrawal.estado || '').toUpperCase() === 'SOLICITADO'),
    [history]
  );

  const startWithdrawal = async () => {
    setError('');
    try {
      const account = await getSellerBankAccountApi(sellerId);
      setBankAccount(account);
      if (!isCompleteBankAccount(account)) {
        setNotice({ type: 'warning', message: 'Debes completar tus datos bancarios antes de solicitar un retiro.' });
        setShowBankModal(true);
        return;
      }
      setShowConfirmation(true);
    } catch (accountError) {
      setError(accountError.message || 'No se pudieron verificar tus datos bancarios.');
    }
  };

  const submitWithdrawal = async () => {
    setSubmitting(true);
    setError('');
    try {
      const withdrawal = await createSellerWithdrawalApi(sellerId);
      setShowConfirmation(false);
      setNotice({ type: 'success', message: `Solicitud registrada por ${formatCLP(withdrawal.montoTotal)}. El depósito se hará efectivo el ${formatDate(withdrawal.fechaEfectiva)}.` });
      await loadWithdrawals();
    } catch (submitError) {
      setError(submitError.message || 'No se pudo solicitar el retiro.');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (withdrawalId) => {
    setDetailLoading(true);
    setError('');
    try {
      setDetail(await getSellerWithdrawalDetailApi(sellerId, withdrawalId));
    } catch (detailError) {
      setError(detailError.message || 'No se pudo cargar el detalle del retiro.');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="profile-panel seller-withdrawals-panel">
      <div className="withdrawal-heading">
        <div><span className="withdrawal-heading-icon"><Wallet size={23} /></span><div><h2>Retirar dinero</h2><p>Solicita el depósito de tus ventas finalizadas.</p></div></div>
        <button type="button" className="withdrawal-bank-button" onClick={async () => { try { const account = await getSellerBankAccountApi(sellerId); setBankAccount(account); } catch { setBankAccount(null); } setShowBankModal(true); }}><Landmark size={17} /> Datos bancarios</button>
      </div>

      <div className="withdrawal-tabs" role="tablist" aria-label="Retiros">
        <button type="button" role="tab" aria-selected={activeTab === 'management'} className={activeTab === 'management' ? 'active' : ''} onClick={() => setActiveTab('management')}><Wallet size={16} /> Gestión retiro</button>
        <button type="button" role="tab" aria-selected={activeTab === 'history'} className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}><History size={16} /> Historial de retiros</button>
      </div>

      {error && <div className="withdrawal-alert error"><AlertCircle size={18} /><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Cerrar"><X size={15} /></button></div>}
      {notice && <div className={`withdrawal-alert ${notice.type}`}><CheckCircle2 size={18} /><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Cerrar"><X size={15} /></button></div>}

      {loading ? <div className="withdrawal-loading"><Loader2 size={20} className="spin-icon" /> Cargando retiros...</div> : activeTab === 'management' ? (
        <div className="withdrawal-management">
          <div className="withdrawal-info-banner"><Info size={19} /><span>El depósito de los fondos se hace todos los jueves. Aquí aparecen tus pedidos finalizados que aún no has retirado.</span></div>
          {withdrawalInProgress && <div className="withdrawal-alert warning"><AlertCircle size={18} /><span>Tienes una solicitud en curso por {formatCLP(withdrawalInProgress.montoTotal)}, programada para el {formatDate(withdrawalInProgress.fechaEfectiva)}. Podrás solicitar otra cuando se efectúe el pago.</span></div>}
          <div className="withdrawal-content-grid">
            <section className="withdrawal-pending-list"><h3>Pedidos pendientes <span>{pending.pedidos.length}</span></h3>{pending.pedidos.length ? pending.pedidos.map((order) => <PendingOrderRow key={order.pedidoId} order={order} />) : <div className="withdrawal-empty"><span><Wallet size={25} /></span><strong>No tienes pedidos pendientes de retiro</strong><p>Cuando tengas pedidos finalizados, aparecerán aquí.</p></div>}</section>
            <aside className="withdrawal-total-card"><span>Total a retirar</span><strong>{formatCLP(pending.totalARetirar)}</strong><small>{pending.pedidos.length} {pending.pedidos.length === 1 ? 'pedido disponible' : 'pedidos disponibles'}</small><button type="button" onClick={startWithdrawal} disabled={!pending.pedidos.length || submitting || Boolean(withdrawalInProgress)}><Wallet size={17} />{withdrawalInProgress ? 'Retiro en curso' : 'Solicitar retiro'}</button><p>Se depositará en la cuenta bancaria registrada.</p></aside>
          </div>
        </div>
      ) : (
        <div className="withdrawal-history-list">
          {history.length ? history.map((withdrawal) => <article key={withdrawal.retiroId} className="withdrawal-history-card"><div className="withdrawal-history-top"><div><small>{withdrawal.codigoExterno || `RET-${String(withdrawal.retiroId).padStart(6, '0')}`}</small><span>Solicitado el {formatDate(withdrawal.fechaSolicitud, true)}</span></div><WithdrawalStatus status={withdrawal.estado} /></div><strong>{formatCLP(withdrawal.montoTotal)}</strong><div className="withdrawal-history-meta"><span><Package size={15} /> {withdrawal.cantidadPedidos} {Number(withdrawal.cantidadPedidos) === 1 ? 'pedido' : 'pedidos'}</span><span><CalendarDays size={15} /> Pago estimado: {formatDate(withdrawal.fechaEfectiva)}</span></div><button type="button" onClick={() => openDetail(withdrawal.retiroId)} disabled={detailLoading}><Eye size={16} /> Ver detalle del retiro</button></article>) : <div className="withdrawal-empty history"><span><History size={25} /></span><strong>Aún no tienes retiros solicitados</strong><p>Cuando solicites un retiro, aparecerá aquí.</p></div>}
        </div>
      )}

      {showBankModal && <BankAccountModal sellerId={sellerId} fallbackEmail={sellerEmail} initialAccount={bankAccount} onClose={() => setShowBankModal(false)} onSaved={(account) => { setBankAccount(account); setShowBankModal(false); setNotice({ type: 'success', message: 'Tus datos bancarios se guardaron correctamente.' }); }} />}

      {showConfirmation && bankAccount && <ModalShell title="Confirmar retiro" subtitle="Revisa la cuenta antes de enviar la solicitud." icon={Wallet} onClose={() => !submitting && setShowConfirmation(false)}><div className="withdrawal-confirm-body"><div className="withdrawal-confirm-amount"><span>Monto a solicitar</span><strong>{formatCLP(pending.totalARetirar)}</strong></div><dl><div><dt>Nombre</dt><dd>{bankAccount.bankAccountHolderName}</dd></div><div><dt>RUT</dt><dd>{bankAccount.bankAccountRut}</dd></div><div><dt>Banco</dt><dd>{bankAccount.bankName}</dd></div><div><dt>Tipo de cuenta</dt><dd>{formatAccountType(bankAccount.bankAccountType)}</dd></div><div><dt>Número de cuenta</dt><dd>{formatAccountNumber(bankAccount.bankAccountNumber)}</dd></div></dl><p><Info size={16} /> Confirma que estos datos son correctos. La solicitud no podrá modificarse después de enviarla.</p><footer><button type="button" className="btn-auth-secondary" onClick={() => setShowConfirmation(false)} disabled={submitting}>Cancelar</button><button type="button" className="btn-auth-primary" onClick={submitWithdrawal} disabled={submitting}>{submitting ? <Loader2 size={16} className="spin-icon" /> : <CheckCircle2 size={16} />}{submitting ? 'Solicitando...' : 'Confirmar solicitud'}</button></footer></div></ModalShell>}

      {(detail || detailLoading) && <ModalShell title="Detalle del retiro" subtitle={detail?.codigoExterno || (detail ? `RET-${String(detail.retiroId).padStart(6, '0')}` : 'Cargando información...')} icon={History} onClose={() => !detailLoading && setDetail(null)} wide>{detailLoading ? <div className="withdrawal-loading"><Loader2 size={20} className="spin-icon" /> Cargando detalle...</div> : <div className="withdrawal-detail-body"><div className="withdrawal-detail-summary"><WithdrawalStatus status={detail.estado} /><span><CalendarDays size={15} /> Pago estimado: {formatDate(detail.fechaEfectiva)}</span></div><div className="withdrawal-detail-orders">{(detail.pedidos || []).map((order) => <PendingOrderRow key={order.pedidoId} order={order} />)}</div><div className="withdrawal-detail-total"><span>Total</span><strong>{formatCLP(detail.montoTotal)}</strong></div></div>}</ModalShell>}
    </div>
  );
}
