import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle, AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Clock,
  CreditCard, Eye, EyeOff, History, Info, Landmark, Loader2, Mail,
  Package, Save, Search, ShieldCheck, User, Wallet, X,
} from 'lucide-react';
import {
  createSellerWithdrawalApi, getSellerBankAccountApi, getSellerPendingWithdrawalsApi,
  getSellerWithdrawalDetailApi, getSellerWithdrawalsApi, updateSellerBankAccountApi,
} from '../services/api';
import { BANKS, findBankByCode } from '../data/banks';
import { sellerCodeShort } from '../data/orderIdentity';
import { formatRut, isValidRut } from '../services/adapters';

const EMPTY_PENDING = { pedidos: [], totalARetirar: 0, retenidos: [], totalRetenido: 0 };
const DISPLAY_LIMIT = 3;

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

function maskAccountNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return 'No registrado';
  return `•••• •••• ${digits.slice(-4)}`;
}

function isCompleteBankAccount(account) {
  const bank = findBankByCode(account?.bankCode);
  const basic = account?.bankAccountHolderName?.trim() && account?.bankAccountRut?.trim()
    && account?.bankName?.trim() && account?.bankAccountType?.trim() && account?.bankAccountNumber?.trim();
  return Boolean(basic && (!bank?.requiresAlias || (account?.bankAccountRegistrationType === 'ALIAS' && account?.bankAccountAliasValue?.trim())));
}

function getNextThursdayFormatted() {
  const now = new Date();
  const day = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 4 = Jueves
  let daysUntilThursday = (4 - day + 7) % 7;
  if (daysUntilThursday === 0) daysUntilThursday = 7;
  const nextThursday = new Date(now);
  nextThursday.setDate(now.getDate() + daysUntilThursday);
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Santiago',
  }).format(nextThursday);
}

function getRemainingDaysInfo(targetDate) {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();

  // Comparar al inicio del día para evitar diferencias menores por horas
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = targetDay.getTime() - nowDay.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const formattedDate = new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Santiago',
  }).format(target);

  if (diffDays > 1) {
    return {
      label: `Disponible en ${diffDays} días (${formattedDate})`,
      className: 'pending-days',
      days: diffDays,
    };
  }
  if (diffDays === 1) {
    return {
      label: `Disponible mañana (${formattedDate})`,
      className: 'tomorrow',
      days: 1,
    };
  }
  if (diffDays === 0) {
    return {
      label: `Disponible hoy al cierre (${formattedDate})`,
      className: 'today',
      days: 0,
    };
  }
  return {
    label: `Plazo de garantía cumplido · Próximo a liberarse`,
    className: 'ready',
    days: diffDays,
  };
}

function WithdrawalStatus({ status }) {
  const config = STATUS_CONFIG[String(status || '').toUpperCase()] || { label: status || 'Sin estado', className: 'other' };
  return <span className={`withdrawal-status ${config.className}`}>{config.label}</span>;
}

function WithdrawalRejectedNotice({ motivo }) {
  return (
    <div className="withdrawal-rejected-notice">
      <AlertTriangle size={15} />
      <div>
        <strong>El depósito no se pudo realizar{motivo ? `: ${motivo}` : '.'}</strong>
        <span>Tus pedidos volvieron a quedar disponibles. Revisa tus datos bancarios y solicita el retiro nuevamente.</span>
      </div>
    </div>
  );
}

function PendingOrderRow({ order, isHeld = false, isInDetail = false }) {
  const countdown = isHeld ? getRemainingDaysInfo(order.disponibleDesde) : null;

  return (
    <article className={`withdrawal-order-row ${isHeld ? 'is-held' : 'is-available'}`}>
      <div className="withdrawal-order-main">
        <strong title={order.nombrePedido || order.nombre}>
          {order.nombrePedido || order.nombre || 'Producto sin nombre'}
        </strong>
        <span className="withdrawal-order-meta">
          Pedido {sellerCodeShort(order.codigoExterno) || `#${order.pedidoId}`} · {formatDate(order.fecha, true)} · Cantidad vendida: {Number(order.cantidadVendida || 0)}
        </span>
        {isHeld && countdown ? (
          <div className={`withdrawal-countdown-badge ${countdown.className}`}>
            <Clock size={13} />
            <span>{countdown.label}</span>
          </div>
        ) : !isHeld && !isInDetail ? (
          <div className="withdrawal-ready-badge">
            <CheckCircle2 size={13} />
            <span>Listo para retiro</span>
          </div>
        ) : null}
      </div>
      <div className="withdrawal-order-amount-box">
        <b>{formatCLP(order.valor)}</b>
        <small>Monto neto</small>
      </div>
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

function OrdersListModal({ modalData, onClose }) {
  const [query, setQuery] = useState('');
  const { title, subtitle, icon: Icon = Wallet, orders = [], type } = modalData;
  const isHeld = type === 'held';

  const filtered = useMemo(() => {
    if (!query.trim()) return orders;
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      const nombre = (order.nombrePedido || order.nombre || '').toLowerCase();
      const codigo = String(order.codigoExterno || '').toLowerCase();
      const id = String(order.pedidoId || '').toLowerCase();
      return nombre.includes(q) || codigo.includes(q) || id.includes(q);
    });
  }, [orders, query]);

  const totalFiltered = useMemo(
    () => filtered.reduce((acc, order) => acc + Number(order.valor || 0), 0),
    [filtered]
  );

  return (
    <ModalShell title={title} subtitle={subtitle} icon={Icon} onClose={onClose} wide>
      <div className="withdrawal-orders-modal-body">
        <div className="withdrawal-modal-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por código (#000019) o repuesto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              type="button"
              className="withdrawal-search-clear"
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="withdrawal-modal-meta-row">
          <span>
            Mostrando <strong>{filtered.length}</strong> de {orders.length} pedidos
          </span>
          <span>
            Total: <strong>{formatCLP(totalFiltered)}</strong>
          </span>
        </div>

        <div className="withdrawal-modal-orders-scroll">
          {filtered.length > 0 ? (
            filtered.map((order) => (
              <PendingOrderRow
                key={isHeld ? `modal-held-${order.pedidoId}` : `modal-avail-${order.pedidoId}`}
                order={order}
                isHeld={isHeld}
              />
            ))
          ) : (
            <div className="withdrawal-empty-search">
              <Search size={22} />
              <p>No se encontraron pedidos que coincidan con &quot;{query}&quot;.</p>
            </div>
          )}
        </div>

        <footer className="withdrawal-modal-footer">
          <button type="button" className="btn-auth-primary" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </ModalShell>
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
  const [revealAccountNumber, setRevealAccountNumber] = useState(false);
  const [ordersModal, setOrdersModal] = useState(null);

  const loadWithdrawals = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    setError('');
    try {
      const [pendingData, historyData] = await Promise.all([
        getSellerPendingWithdrawalsApi(sellerId),
        getSellerWithdrawalsApi(sellerId),
      ]);

      const historyList = Array.isArray(historyData) ? historyData : [];

      // Filtro de seguridad: excluir cualquier pedido que ya esté asociado a un retiro solicitado o pagado
      const pedidosFiltrados = (pendingData?.pedidos || []).filter((p) => {
        if (p.retiroId || p.solicitado) return false;
        const estadoUpper = String(p.estado || '').toUpperCase();
        return estadoUpper !== 'SOLICITADO' && estadoUpper !== 'PAGADO' && estadoUpper !== 'RETIRADO';
      });

      const retenidosFiltrados = (pendingData?.retenidos || []).filter((p) => {
        if (p.retiroId || p.solicitado) return false;
        const estadoUpper = String(p.estado || '').toUpperCase();
        return estadoUpper !== 'SOLICITADO' && estadoUpper !== 'PAGADO' && estadoUpper !== 'RETIRADO';
      });

      const totalARetirar = pedidosFiltrados.reduce((acc, p) => acc + Number(p.valor || 0), 0);
      const totalRetenido = retenidosFiltrados.reduce((acc, p) => acc + Number(p.valor || 0), 0);

      setPending({
        pedidos: pedidosFiltrados,
        totalARetirar,
        retenidos: retenidosFiltrados,
        totalRetenido,
      });
      setHistory(historyList);
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
      setRevealAccountNumber(false);
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
      setNotice({
        type: 'success',
        message: `Solicitud registrada por ${formatCLP(withdrawal.montoTotal)}. El depósito se efectuará el ${formatDate(withdrawal.fechaEfectiva)}.`,
      });
      // Limpiar pedidos disponibles localmente de inmediato para evitar cualquier desfase visual
      setPending((prev) => ({ ...prev, pedidos: [], totalARetirar: 0 }));
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
        <div>
          <span className="withdrawal-heading-icon"><Wallet size={23} /></span>
          <div>
            <h2>Retirar dinero</h2>
            <p>Solicita el depósito bancario de tus ventas finalizadas.</p>
          </div>
        </div>
        <button
          type="button"
          className="withdrawal-bank-button"
          onClick={async () => {
            try {
              const account = await getSellerBankAccountApi(sellerId);
              setBankAccount(account);
            } catch {
              setBankAccount(null);
            }
            setShowBankModal(true);
          }}
        >
          <Landmark size={17} /> Datos bancarios
        </button>
      </div>

      <div className="withdrawal-tabs" role="tablist" aria-label="Retiros">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'management'}
          className={activeTab === 'management' ? 'active' : ''}
          onClick={() => setActiveTab('management')}
        >
          <Wallet size={16} /> Gestión retiro
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          <History size={16} /> Historial de retiros
        </button>
      </div>

      {error && (
        <div className="withdrawal-alert error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Cerrar"><X size={15} /></button>
        </div>
      )}
      {notice && (
        <div className={`withdrawal-alert ${notice.type}`}>
          <CheckCircle2 size={18} />
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar"><X size={15} /></button>
        </div>
      )}

      {loading ? (
        <div className="withdrawal-loading">
          <Loader2 size={20} className="spin-icon" /> Cargando retiros...
        </div>
      ) : activeTab === 'management' ? (
        <div className="withdrawal-management">
          {/* Tarjetas KPI de resumen financiero */}
          <div className="withdrawal-kpis-bar">
            <div className="withdrawal-kpi-card kpi-available">
              <div className="withdrawal-kpi-icon">
                <CheckCircle2 size={20} />
              </div>
              <div className="withdrawal-kpi-info">
                <span>Disponible para retiro</span>
                <strong>{formatCLP(pending.totalARetirar)}</strong>
                <small>{pending.pedidos.length} {pending.pedidos.length === 1 ? 'pedido listo' : 'pedidos listos'}</small>
              </div>
            </div>

            <div className="withdrawal-kpi-card kpi-held">
              <div className="withdrawal-kpi-icon">
                <ShieldCheck size={20} />
              </div>
              <div className="withdrawal-kpi-info">
                <span>En custodia legal</span>
                <strong>{formatCLP(pending.totalRetenido)}</strong>
                <small>{pending.retenidos.length} {pending.retenidos.length === 1 ? 'pedido en garantía' : 'pedidos en garantía'}</small>
              </div>
            </div>

            <div className="withdrawal-kpi-card kpi-total">
              <div className="withdrawal-kpi-icon">
                <Wallet size={20} />
              </div>
              <div className="withdrawal-kpi-info">
                <span>Total acumulado</span>
                <strong>{formatCLP(pending.totalARetirar + pending.totalRetenido)}</strong>
                <small>{pending.pedidos.length + pending.retenidos.length} pedidos finalizados</small>
              </div>
            </div>
          </div>

          <div className="withdrawal-info-banner">
            <Info size={19} />
            <span>
              Los depósitos se transfieren todos los jueves a tu cuenta registrada. Aquí visualizas tus fondos disponibles para cobro inmediato y aquellos que se encuentran en custodia por garantía legal de retracto.
            </span>
          </div>

          {withdrawalInProgress && (
            <div className="withdrawal-in-progress-card">
              <div className="withdrawal-in-progress-icon">
                <Clock size={20} />
              </div>
              <div className="withdrawal-in-progress-content">
                <strong>Tienes una solicitud de retiro en proceso</strong>
                <p>
                  Monto solicitado: <strong>{formatCLP(withdrawalInProgress.montoTotal)}</strong> ({withdrawalInProgress.cantidadPedidos} {Number(withdrawalInProgress.cantidadPedidos) === 1 ? 'pedido' : 'pedidos'}). Depósito programado para el <strong>{formatDate(withdrawalInProgress.fechaEfectiva)}</strong>.
                </p>
                <small>Los pedidos de esa solicitud ya fueron procesados y no figuran en tus saldos pendientes.</small>
              </div>
            </div>
          )}

          <div className="withdrawal-content-grid">
            <div className="withdrawal-pending-columns">
              {/* Bloque 1: Pedidos Disponibles para Retiro */}
              <section className="withdrawal-section-card withdrawal-available-card">
                <header className="withdrawal-section-header">
                  <div className="withdrawal-section-title-wrap">
                    <span className="withdrawal-section-icon available-icon">
                      <CheckCircle2 size={19} />
                    </span>
                    <div>
                      <div className="withdrawal-section-title-row">
                        <h3>Fondos disponibles para retiro</h3>
                        <span className="withdrawal-section-badge available-badge">
                          {pending.pedidos.length} {pending.pedidos.length === 1 ? 'pedido' : 'pedidos'} · {formatCLP(pending.totalARetirar)}
                        </span>
                      </div>
                      <p>Ventas completadas con plazo de garantía legal cumplido. Listas para transferir a tu cuenta bancaria hoy.</p>
                    </div>
                  </div>
                </header>

                <div className="withdrawal-section-orders">
                  {pending.pedidos.length > 0 ? (
                    <>
                      {pending.pedidos.slice(0, DISPLAY_LIMIT).map((order) => (
                        <PendingOrderRow key={order.pedidoId} order={order} isHeld={false} />
                      ))}
                      {pending.pedidos.length > DISPLAY_LIMIT && (
                        <button
                          type="button"
                          className="withdrawal-view-more-btn"
                          onClick={() => setOrdersModal({
                            type: 'available',
                            title: 'Pedidos disponibles para retiro',
                            subtitle: `${pending.pedidos.length} pedidos listos · Total ${formatCLP(pending.totalARetirar)}`,
                            icon: CheckCircle2,
                            orders: pending.pedidos,
                          })}
                        >
                          <Eye size={15} />
                          <span>Ver los {pending.pedidos.length - DISPLAY_LIMIT} pedidos disponibles restantes</span>
                          <ChevronRight size={15} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="withdrawal-empty-inline">
                      <Wallet size={22} />
                      <div>
                        <strong>No tienes pedidos disponibles para retiro en este momento</strong>
                        <p>Cuando tus ventas completen el período legal de garantía, se transferirán automáticamente aquí.</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Bloque 2: Pedidos en Custodia Legal */}
              {pending.retenidos.length > 0 && (
                <section className="withdrawal-section-card withdrawal-held-card">
                  <header className="withdrawal-section-header">
                    <div className="withdrawal-section-title-wrap">
                      <span className="withdrawal-section-icon held-icon">
                        <ShieldCheck size={19} />
                      </span>
                      <div>
                        <div className="withdrawal-section-title-row">
                          <h3>Fondos en custodia legal (Garantía de retracto)</h3>
                          <span className="withdrawal-section-badge held-badge">
                            {pending.retenidos.length} {pending.retenidos.length === 1 ? 'pedido' : 'pedidos'} · {formatCLP(pending.totalRetenido)}
                          </span>
                        </div>
                        <p>
                          Por Ley del Consumidor (garantía de retracto de 10 días corridos desde la entrega), estos fondos se mantienen en custodia segura y se liberan automáticamente a tu saldo disponible en la fecha señalada.
                        </p>
                      </div>
                    </div>
                  </header>

                  <div className="withdrawal-section-orders">
                    {pending.retenidos.slice(0, DISPLAY_LIMIT).map((order) => (
                      <PendingOrderRow key={`retenido-${order.pedidoId}`} order={order} isHeld={true} />
                    ))}
                    {pending.retenidos.length > DISPLAY_LIMIT && (
                      <button
                        type="button"
                        className="withdrawal-view-more-btn held-btn"
                        onClick={() => setOrdersModal({
                          type: 'held',
                          title: 'Pedidos en custodia legal (Garantía de retracto)',
                          subtitle: `${pending.retenidos.length} pedidos en garantía · Total ${formatCLP(pending.totalRetenido)}`,
                          icon: ShieldCheck,
                          orders: pending.retenidos,
                        })}
                      >
                        <Eye size={15} />
                        <span>Ver los {pending.retenidos.length - DISPLAY_LIMIT} pedidos en custodia restantes</span>
                        <ChevronRight size={15} />
                      </button>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Tarjeta lateral de acción */}
            <aside className="withdrawal-total-card">
              <span>Total a retirar</span>
              <strong>{formatCLP(pending.totalARetirar)}</strong>
              <small>
                {pending.pedidos.length} {pending.pedidos.length === 1 ? 'pedido disponible' : 'pedidos disponibles'}
              </small>

              <div className="withdrawal-cycle-pill">
                <CalendarDays size={15} />
                <div>
                  <span>Próximo día de depósito:</span>
                  <strong>{getNextThursdayFormatted()}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={startWithdrawal}
                disabled={!pending.pedidos.length || submitting || Boolean(withdrawalInProgress)}
              >
                <Wallet size={17} />
                {withdrawalInProgress ? 'Retiro en curso' : 'Solicitar retiro'}
              </button>
              <p>Se depositará en tu cuenta bancaria registrada.</p>
            </aside>
          </div>
        </div>
      ) : (
        <div className="withdrawal-history-list">
          {history.length ? (
            history.map((withdrawal) => (
              <article key={withdrawal.retiroId} className="withdrawal-history-card">
                <div className="withdrawal-history-top">
                  <div>
                    <small>{withdrawal.codigoExterno || `RET-${String(withdrawal.retiroId).padStart(6, '0')}`}</small>
                    <span>Solicitado el {formatDate(withdrawal.fechaSolicitud, true)}</span>
                  </div>
                  <WithdrawalStatus status={withdrawal.estado} />
                </div>
                <strong>{formatCLP(withdrawal.montoTotal)}</strong>
                <div className="withdrawal-history-meta">
                  <span><Package size={15} /> {withdrawal.cantidadPedidos} {Number(withdrawal.cantidadPedidos) === 1 ? 'pedido' : 'pedidos'}</span>
                  <span><CalendarDays size={15} /> Pago estimado: {formatDate(withdrawal.fechaEfectiva)}</span>
                </div>
                {String(withdrawal.estado || '').toUpperCase() === 'RECHAZADO' && (
                  <WithdrawalRejectedNotice motivo={withdrawal.motivoRechazo} />
                )}
                <button type="button" onClick={() => openDetail(withdrawal.retiroId)} disabled={detailLoading}>
                  <Eye size={16} /> Ver detalle del retiro
                </button>
              </article>
            ))
          ) : (
            <div className="withdrawal-empty history">
              <span><History size={25} /></span>
              <strong>Aún no tienes retiros solicitados</strong>
              <p>Cuando solicites un retiro, aparecerá aquí.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal para ver todos los pedidos (disponibles o en custodia) */}
      {ordersModal && (
        <OrdersListModal
          modalData={ordersModal}
          onClose={() => setOrdersModal(null)}
        />
      )}

      {showBankModal && (
        <BankAccountModal
          sellerId={sellerId}
          fallbackEmail={sellerEmail}
          initialAccount={bankAccount}
          onClose={() => setShowBankModal(false)}
          onSaved={(account) => {
            setBankAccount(account);
            setShowBankModal(false);
            setNotice({ type: 'success', message: 'Tus datos bancarios se guardaron correctamente.' });
          }}
        />
      )}

      {showConfirmation && bankAccount && (
        <ModalShell
          title="Confirmar retiro"
          subtitle="Revisa la cuenta antes de enviar la solicitud."
          icon={Wallet}
          onClose={() => !submitting && setShowConfirmation(false)}
        >
          <div className="withdrawal-confirm-body">
            <div className="withdrawal-confirm-amount">
              <span>Monto a solicitar</span>
              <strong>{formatCLP(pending.totalARetirar)}</strong>
            </div>
            <dl>
              <div><dt>Nombre</dt><dd>{bankAccount.bankAccountHolderName}</dd></div>
              <div><dt>RUT</dt><dd>{bankAccount.bankAccountRut}</dd></div>
              <div><dt>Banco</dt><dd>{bankAccount.bankName}</dd></div>
              <div><dt>Tipo de cuenta</dt><dd>{formatAccountType(bankAccount.bankAccountType)}</dd></div>
              <div>
                <dt>Número de cuenta</dt>
                <dd className="withdrawal-confirm-account-number">
                  <span>{revealAccountNumber ? formatAccountNumber(bankAccount.bankAccountNumber) : maskAccountNumber(bankAccount.bankAccountNumber)}</span>
                  <button
                    type="button"
                    className="withdrawal-toggle-reveal"
                    onClick={() => setRevealAccountNumber((current) => !current)}
                    title={revealAccountNumber ? 'Ocultar número de cuenta' : 'Mostrar número de cuenta'}
                  >
                    {revealAccountNumber ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </dd>
              </div>
            </dl>
            <p>
              <Info size={16} /> Confirma que estos datos son correctos. La solicitud no podrá modificarse después de enviarla.
            </p>
            <footer>
              <button type="button" className="btn-auth-secondary" onClick={() => setShowConfirmation(false)} disabled={submitting}>
                Cancelar
              </button>
              <button type="submit" className="btn-auth-primary" onClick={submitWithdrawal} disabled={submitting}>
                {submitting ? <Loader2 size={16} className="spin-icon" /> : <CheckCircle2 size={16} />}
                {submitting ? 'Solicitando...' : 'Confirmar solicitud'}
              </button>
            </footer>
          </div>
        </ModalShell>
      )}

      {(detail || detailLoading) && (
        <ModalShell
          title="Detalle del retiro"
          subtitle={detail?.codigoExterno || (detail ? `RET-${String(detail.retiroId).padStart(6, '0')}` : 'Cargando información...')}
          icon={History}
          onClose={() => !detailLoading && setDetail(null)}
          wide
        >
          {detailLoading ? (
            <div className="withdrawal-loading">
              <Loader2 size={20} className="spin-icon" /> Cargando detalle...
            </div>
          ) : (
            <div className="withdrawal-detail-body">
              <div className="withdrawal-detail-summary">
                <WithdrawalStatus status={detail.estado} />
                <span><CalendarDays size={15} /> Pago estimado: {formatDate(detail.fechaEfectiva)}</span>
              </div>
              {String(detail.estado || '').toUpperCase() === 'RECHAZADO' && (
                <WithdrawalRejectedNotice motivo={detail.motivoRechazo} />
              )}
              <div className="withdrawal-detail-orders">
                {(detail.pedidos || []).map((order) => (
                  <PendingOrderRow key={order.pedidoId} order={order} isInDetail={true} />
                ))}
              </div>
              <div className="withdrawal-detail-total">
                <span>Total</span>
                <strong>{formatCLP(detail.montoTotal)}</strong>
              </div>
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
}
