import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  AlertCircle, AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, ChevronUp, Clock,
  CreditCard, ExternalLink, Eye, EyeOff, History, Info, Landmark, Loader2, Mail,
  Package, ReceiptText, RotateCcw, Save, Search, ShieldCheck, User, Wallet, X,
} from 'lucide-react';
import {
  createSellerWithdrawalApi, getSellerBankAccountApi, getSellerPendingWithdrawalsApi,
  getSellerOrderByNumberApi, getSellerOrdersApi, getSellerWithdrawalDetailApi, getSellerWithdrawalsApi,
  updateSellerBankAccountApi,
} from '../services/api';
import { BANKS, findBankByCode } from '../data/banks';
import { orderDisplayCode, sellerCodeShort } from '../data/orderIdentity';
import { buildOrderPackages } from '../utils/orderPackages';
import { profileOrderPath } from '../routes/paths';
import { formatRut, isValidRut } from '../services/adapters';
import { qk } from '../services/queryKeys';
import InfoHint from './InfoHint';

const EMPTY_PENDING = { pedidos: [], totalARetirar: 0, retenidos: [], totalRetenido: 0, cargos: [], totalCargos: 0, fondosRetenidos: false, motivoRetencion: null };
const DISPLAY_LIMIT = 3;

// Toda la explicación que antes ocupaba la pantalla, ahora detrás de un ícono "i" (igual que la app).
const AYUDA_FONDOS = [
  'Aquí ves la plata de tus ventas: lo que puedes retirar ahora y lo que se libera más adelante.',
  'Retirar ahora: ventas finalizadas que ya pasaron el plazo de arrepentimiento del comprador. Puedes pedir su depósito hoy.',
  'Por liberar: ventas finalizadas que siguen en el plazo de arrepentimiento del comprador (10 días desde la entrega). Se liberan solas en la fecha indicada y pasan a "Retirar ahora".',
  'Los depósitos se hacen todos los jueves en la cuenta bancaria registrada de tu tienda.',
];
const AYUDA_LIBERAR = [
  'Retenemos el monto mientras el comprador puede arrepentirse de la compra: 10 días desde la entrega.',
  'No tienes que hacer nada: cada venta se libera sola en la fecha indicada y pasa a "Retirar ahora".',
];
const AYUDA_CARGOS = [
  'Un mediador de RepuesTop revisó estos casos de forma imparcial y resolvió a favor del comprador, porque la venta no cumplió lo ofrecido por la tienda (por ejemplo, el producto llegó con falla o no correspondía a lo publicado).',
  'Se le devolvió todo al comprador y la comisión de Flow, que no se recupera, la asume la tienda. El monto se descuenta de tu próximo retiro.',
];

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

// Los cargos son negativos: "-$549", no "$-549".
function formatCLP(value) {
  const amount = Number(value || 0);
  const formatted = `$${Math.abs(amount).toLocaleString('es-CL')}`;
  return amount < 0 ? `-${formatted}` : formatted;
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

// Exportada: el checklist "Completa tu tienda" del Resumen usa la misma regla, para no marcar como
// pendiente una cuenta que este panel da por completa (pasaba: el Resumen buscaba campos que el
// backend no manda).
export function isCompleteBankAccount(account) {
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

function isRejected(withdrawal) {
  return String(withdrawal?.estado || '').toUpperCase() === 'RECHAZADO';
}

/**
 * Estado del retiro. Si fue rechazado, la etiqueta se puede tocar para ver por qué: el retiro
 * sigue siendo lo principal y el rechazo es un detalle que se consulta (igual que en la app).
 */
function WithdrawalStatusTag({ withdrawal, open, onToggle }) {
  if (!isRejected(withdrawal)) return <WithdrawalStatus status={withdrawal?.estado} />;
  return (
    <button
      type="button"
      className="withdrawal-status rejected withdrawal-status-toggle"
      aria-expanded={open}
      aria-label={open ? 'Ocultar detalle del rechazo' : 'Ver detalle del rechazo'}
      onClick={onToggle}
    >
      Rechazado {open ? <ChevronUp size={12} /> : <Info size={12} />}
    </button>
  );
}

function WithdrawalRejectedNotice({ motivo, rechazadoAt, reintentoCodigo }) {
  return (
    <div className="withdrawal-rejected-notice">
      <AlertTriangle size={15} />
      <div>
        <strong>El depósito no se pudo realizar{motivo ? `: ${motivo}` : '.'}</strong>
        {rechazadoAt && <span>Rechazado por el banco el {formatDate(rechazadoAt)}.</span>}
        {reintentoCodigo ? (
          <span className="withdrawal-rejected-resolved">Ya lo volviste a solicitar con {reintentoCodigo}.</span>
        ) : (
          <span>Tus pedidos volvieron a quedar disponibles. Revisa tus datos bancarios y solicita el retiro nuevamente.</span>
        )}
      </div>
    </div>
  );
}

// `isCharge` (U9): reembolso total por veredicto; se muestra como cargo, no como venta.
function PendingOrderRow({ order, isHeld = false, isInDetail = false, isCharge = false, onViewSale }) {
  const countdown = isHeld && !isCharge ? getRemainingDaysInfo(order.disponibleDesde) : null;
  const reembolso = Number(order.montoReembolsoMediacion || 0);

  return (
    <article className={`withdrawal-order-row ${isCharge ? 'is-charge' : isHeld ? 'is-held' : 'is-available'}`}>
      <div className="withdrawal-order-main">
        <strong title={order.nombrePedido || order.nombre}>
          {order.nombrePedido || order.nombre || 'Producto sin nombre'}
        </strong>
        <span className="withdrawal-order-meta">
          Pedido {order.numeroPedido || sellerCodeShort(order.codigoExterno) || '—'} · {formatDate(order.fecha, true)} · Cantidad vendida: {Number(order.cantidadVendida || 0)}
        </span>
        {isCharge ? (
          <div className="withdrawal-charge-badge">
            <RotateCcw size={13} />
            <span>Reembolso total al comprador</span>
          </div>
        ) : isHeld && countdown ? (
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
        {/* El monto ya viene neto del reembolso desde el backend (calcularMontoPagarVendedor);
            sin este aviso el vendedor veia un monto mas bajo que su venta sin ninguna
            explicacion y pensaba que el calculo estaba mal. */}
        {reembolso > 0 && (
          <span className="withdrawal-refund-note">
            {isCharge
              ? `Devuelto al comprador: ${formatCLP(reembolso)}. Comisión de Flow no recuperable.`
              : `Incluye descuento por reembolso de mediación: -${formatCLP(reembolso)}`}
          </span>
        )}
        {onViewSale && (
          <button type="button" className="withdrawal-sale-link" onClick={() => onViewSale(order)}>
            <Eye size={13} /> Ver detalle de la venta
          </button>
        )}
      </div>
      <div className="withdrawal-order-amount-box">
        <b>{formatCLP(order.valor)}</b>
        <small>{isCharge ? 'Cargo' : 'Monto neto'}</small>
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

const SALE_STATUS_LABEL = {
  PENDIENTE: 'Pendiente de pago', PAGADO: 'Por confirmar', EN_PREPARACION: 'En preparación', ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado', FINALIZADO: 'Finalizado', EN_MEDIACION: 'En mediación', CANCELADO: 'Cancelado',
};

/**
 * "Ver detalle de la venta" desde Retirar dinero (igual que la app): lo justo para que la tienda
 * reconozca a qué venta corresponde cada monto, sin salir de la pantalla. El detalle completo
 * queda a un clic.
 */
function SaleDetailModal({ sellerId, row, onClose }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const numero = String(row.numeroPedido || '').replace(/\s/g, '');
    const load = /^\d{10}$/.test(numero)
      ? getSellerOrderByNumberApi(sellerId, numero)
      : getSellerOrdersApi(sellerId).then((page) => (Array.isArray(page) ? page : page?.content || [])
        .find((entry) => String(entry.id) === String(row.pedidoId)) || null);
    load
      .then((result) => { if (active) setOrder(result || null); })
      .catch(() => { if (active) setOrder(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sellerId, row]);

  const items = (order?.items || []).filter((item) => !item.proveedorId || String(item.proveedorId) === String(sellerId));
  const pkg = order ? buildOrderPackages(order)[0] : null;
  const estado = String(order?.estado || order?.status || '').toUpperCase();
  const commission = Number(order?.comisionVendedor ?? order?.commissionSeller ?? 0);
  const reembolso = Number(row.montoReembolsoMediacion || 0);

  return (
    <ModalShell
      title="Detalle de la venta"
      subtitle={`Pedido ${order ? orderDisplayCode(order, 'seller') : row.numeroPedido || sellerCodeShort(row.codigoExterno) || '—'}`}
      icon={ReceiptText}
      onClose={onClose}
    >
      <div className="withdrawal-sale-detail">
        <div className={`withdrawal-sale-net ${Number(row.valor) < 0 ? 'is-charge' : ''}`}>
          <span>{Number(row.valor) < 0 ? 'Cargo a tu próximo retiro' : 'Lo que recibes por esta venta'}</span>
          <strong>{formatCLP(row.valor)}</strong>
        </div>
        {loading ? (
          <p className="withdrawal-sale-loading"><Loader2 size={15} className="spin-icon" /> Cargando la venta…</p>
        ) : order ? (
          <>
            <dl className="withdrawal-sale-rows">
              <div><dt><CalendarDays size={14} /> Fecha de compra</dt><dd>{formatDate(order.createdAt || order.fecha, true)}</dd></div>
              <div><dt><Info size={14} /> Estado</dt><dd>{SALE_STATUS_LABEL[estado] || estado || '—'}</dd></div>
              <div><dt><User size={14} /> Comprador</dt><dd>{[order.compradorNombre || order.buyerName, order.compradorTelefono || order.buyerPhone].filter(Boolean).join(' · ') || '—'}</dd></div>
              {pkg && <div><dt><Package size={14} /> Entrega</dt><dd>{[pkg.method, pkg.address].filter(Boolean).join(' · ')}</dd></div>}
            </dl>
            <h4>Productos</h4>
            <ul className="withdrawal-sale-items">
              {items.map((item, index) => {
                const qty = Number(item.cantidad ?? item.quantity ?? 1);
                const price = Number(item.precioUnitario ?? item.precio ?? item.unitPrice ?? 0);
                return (
                  <li key={item.id || index}>
                    <span className="qty">{qty}×</span>
                    <span className="name">{item.nombre || item.productName || 'Repuesto'}</span>
                    <b>{formatCLP(qty * price)}</b>
                  </li>
                );
              })}
            </ul>
            <h4>Cómo se calcula</h4>
            <ul className="withdrawal-sale-amounts">
              <li><span>Venta</span><b>{formatCLP(order.subtotal ?? 0)}</b></li>
              {commission > 0 && <li><span>Comisión RepuesTop</span><b className="neg">{formatCLP(-commission)}</b></li>}
              {reembolso > 0 && <li><span>Reembolso por mediación</span><b className="neg">{formatCLP(-reembolso)}</b></li>}
            </ul>
          </>
        ) : (
          <p className="withdrawal-sale-loading">No pudimos cargar el detalle. Puedes abrir la venta completa.</p>
        )}
        <Link className="btn-auth-secondary withdrawal-sale-open" onClick={onClose} to={profileOrderPath(order?.numeroPedido || row.numeroPedido?.replace(/\s/g, '') || row.pedidoId)}>
          <ExternalLink size={15} /> Abrir la venta completa
        </Link>
      </div>
    </ModalShell>
  );
}

function OrdersListModal({ modalData, onClose }) {
  const [query, setQuery] = useState('');
  const { title, subtitle, icon: Icon = Wallet, orders = [], type } = modalData;
  const isHeld = type === 'held';
  const isCharge = type === 'charge';

  const filtered = useMemo(() => {
    if (!query.trim()) return orders;
    const q = query.trim().toLowerCase();
    // O72: el numero publico se busca con o sin espacios ("4827 1936 05" / "4827193605").
    const qNumero = q.replace(/[\s-]/g, '');
    return orders.filter((order) => {
      const nombre = (order.nombrePedido || order.nombre || '').toLowerCase();
      const codigo = String(order.codigoExterno || '').toLowerCase();
      const numero = String(order.numeroPedido || '').replace(/[\s-]/g, '');
      return nombre.includes(q) || codigo.includes(q) || (qNumero && numero.includes(qNumero));
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
                key={`modal-${type}-${order.pedidoId}`}
                order={order}
                isHeld={isHeld}
                isCharge={isCharge}
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
    // H16: se limpian solo espacios, puntos y guiones. Antes `\D` borraba tambien las letras y
    // "12AB5678" se enviaba como "125678": otra cuenta. El backend valida lo mismo.
    const accountDigits = form.accountNumber.replace(/[\s.-]/g, '');
    const rutClean = form.rut.replace(/[^0-9kK]/g, '').toUpperCase();
    const nextErrors = {};
    if (!selectedBank) nextErrors.bankCode = 'Selecciona el banco de tu cuenta.';
    if (!form.holderName.trim()) nextErrors.holderName = 'Ingresa el nombre del titular.';
    if (!isValidRut(form.rut)) nextErrors.rut = 'Ingresa un RUT válido.';
    if (!form.accountType) nextErrors.accountType = 'Selecciona el tipo de cuenta.';
    if (!/^\d{6,20}$/.test(accountDigits)) nextErrors.accountNumber = 'El número de cuenta debe tener solo dígitos (6 a 20), sin letras.';
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
  // El historial ya no es una pestaña: se abre desde un ícono junto a "Datos bancarios", para que
  // la pantalla tenga una sola fila de pestañas (las de los fondos).
  const [showHistory, setShowHistory] = useState(() => new URLSearchParams(window.location.search).get('tab') === 'historial');
  const [saleDetail, setSaleDetail] = useState(null);
  const [pending, setPending] = useState(EMPTY_PENDING);
  const [history, setHistory] = useState([]);
  const [bankAccount, setBankAccount] = useState(null);
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [detail, setDetail] = useState(null);
  // Motivo del rechazo desplegado (se abre tocando la etiqueta "Rechazado").
  const [detailRejectionOpen, setDetailRejectionOpen] = useState(false);
  const [openRejections, setOpenRejections] = useState({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [revealAccountNumber, setRevealAccountNumber] = useState(false);
  const [ordersModal, setOrdersModal] = useState(null);
  // Primero lo que se puede retirar hoy; lo que espera el plazo del comprador va aparte.
  const [fundsTabChoice, setFundsTab] = useState('ahora');

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

      // U9: reembolsos totales por veredicto; se descuentan del proximo retiro.
      const cargos = (pendingData?.cargos || []).filter((p) => !p.retiroId && !p.solicitado);
      const totalCargos = cargos.reduce((acc, p) => acc + Number(p.valor || 0), 0);
      const totalARetirar = pedidosFiltrados.reduce((acc, p) => acc + Number(p.valor || 0), 0) + totalCargos;
      const totalRetenido = retenidosFiltrados.reduce((acc, p) => acc + Number(p.valor || 0), 0);

      setPending({
        pedidos: pedidosFiltrados,
        totalARetirar,
        retenidos: retenidosFiltrados,
        totalRetenido,
        cargos,
        totalCargos,
        // H59 fase 4: tienda suspendida. El backend rechaza el retiro y explica por que.
        fondosRetenidos: Boolean(pendingData?.fondosRetenidos),
        motivoRetencion: pendingData?.motivoRetencion || null,
      });
      setHistory(historyList);
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar la información de retiros.');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => { loadWithdrawals(); }, [loadWithdrawals]);

  // La alerta de retiro fallido del header llega con ?corregir=datos-bancarios: abre el formulario
  // de datos bancarios para que el vendedor los corrija antes de volver a pedir el retiro.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('corregir') !== 'datos-bancarios' || !sellerId) return;
    const next = new URLSearchParams(searchParams);
    next.delete('corregir');
    setSearchParams(next, { replace: true });
    setNotice({ type: 'warning', message: 'Tu último retiro no pudo depositarse. Corrige tus datos bancarios y vuelve a solicitarlo.' });
    // El formulario toma los datos actuales al montarse: hay que tenerlos antes de abrirlo.
    getSellerBankAccountApi(sellerId)
      .then(setBankAccount)
      .catch(() => setBankAccount(null))
      .finally(() => setShowBankModal(true));
  }, [searchParams, setSearchParams, sellerId]);

  const withdrawalInProgress = useMemo(
    () => history.find((withdrawal) => String(withdrawal.estado || '').toUpperCase() === 'SOLICITADO'),
    [history]
  );

  // Lo que se libera antes, primero.
  const heldByRelease = useMemo(
    () => [...pending.retenidos].sort((a, b) => String(a.disponibleDesde || '').localeCompare(String(b.disponibleDesde || ''))),
    [pending.retenidos]
  );
  const fundsTabs = [
    { key: 'ahora', label: 'Retirar ahora', amount: formatCLP(Math.max(0, pending.totalARetirar)), count: pending.pedidos.length, tone: 'green' },
    { key: 'liberar', label: 'Por liberar', amount: formatCLP(pending.totalRetenido), count: pending.retenidos.length, tone: 'blue' },
    ...(pending.cargos.length > 0
      ? [{ key: 'cargos', label: 'Cargos', amount: formatCLP(pending.totalCargos), count: pending.cargos.length, tone: 'red' }]
      : []),
  ];
  const fundsTab = fundsTabChoice === 'cargos' && pending.cargos.length === 0 ? 'ahora' : fundsTabChoice;

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
      // Un retiro nuevo despues de un rechazo apaga la alerta de retiro fallido del header.
      queryClient.invalidateQueries({ queryKey: qk.sellerWithdrawalAlert(sellerId) });
      await loadWithdrawals();
    } catch (submitError) {
      setError(submitError.message || 'No se pudo solicitar el retiro.');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (withdrawalId) => {
    setDetailRejectionOpen(false);
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
            <h2>Retirar dinero <InfoHint title="Cómo funcionan tus fondos" paragraphs={AYUDA_FONDOS} /></h2>
          </div>
        </div>
        <div className="withdrawal-heading-actions">
        <button
          type="button"
          className="withdrawal-icon-button"
          onClick={() => setShowHistory(true)}
          aria-label="Historial de retiros"
          title="Historial de retiros"
        >
          <History size={18} />
        </button>
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
      ) : (
        <div className="withdrawal-management">
          {pending.fondosRetenidos && (
            <div
              role="status"
              style={{
                marginBottom: 16, padding: '14px 16px', borderRadius: 12,
                background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 13.5, lineHeight: 1.45,
              }}
            >
              <strong style={{ display: 'block', marginBottom: 4 }}>Fondos retenidos</strong>
              {pending.motivoRetencion}
            </div>
          )}
          {withdrawalInProgress && (
            <div className="withdrawal-in-progress-card">
              <div className="withdrawal-in-progress-icon">
                <Clock size={20} />
              </div>
              <div className="withdrawal-in-progress-content">
                <strong>Retiro en proceso: {formatCLP(withdrawalInProgress.montoTotal)}</strong>
                <p>Depósito el <strong>{formatDate(withdrawalInProgress.fechaEfectiva)}</strong></p>
              </div>
              <InfoHint
                title="Retiro en proceso"
                tone="amber"
                paragraphs={[
                  `Solicitaste ${formatCLP(withdrawalInProgress.montoTotal)} (${withdrawalInProgress.cantidadPedidos} ${Number(withdrawalInProgress.cantidadPedidos) === 1 ? 'pedido' : 'pedidos'}). El depósito está programado para el ${formatDate(withdrawalInProgress.fechaEfectiva)}.`,
                  'Los pedidos de esa solicitud ya fueron procesados y no figuran en tus saldos pendientes. Podrás solicitar un nuevo retiro una vez que se efectúe ese pago.',
                ]}
              />
            </div>
          )}

          {/* Pestañas de fondos: lo que se puede retirar hoy primero; lo que espera el plazo del
              comprador y los cargos, aparte. Cada una con su monto para comparar de un vistazo. */}
          <div className="withdrawal-funds-tabs" role="tablist" aria-label="Fondos">
            {fundsTabs.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={fundsTab === entry.key}
                className={`withdrawal-funds-tab is-${entry.tone} ${fundsTab === entry.key ? 'is-active' : ''}`}
                onClick={() => setFundsTab(entry.key)}
              >
                <span>{entry.label}</span>
                <strong>{entry.amount}</strong>
                <small>{entry.count} {entry.count === 1 ? 'pedido' : 'pedidos'}</small>
              </button>
            ))}
          </div>

          {fundsTab === 'ahora' ? (
            <div className="withdrawal-content-grid">
              <section className="withdrawal-section-card withdrawal-available-card">
                <header className="withdrawal-section-header withdrawal-section-header-inline">
                  <CheckCircle2 size={18} />
                  <h3>Pedidos para retirar ahora</h3>
                </header>
                <div className="withdrawal-section-orders">
                  {pending.pedidos.length > 0 ? (
                    <>
                      {pending.pedidos.slice(0, DISPLAY_LIMIT).map((order) => (
                        <PendingOrderRow key={order.pedidoId} order={order} isHeld={false} onViewSale={setSaleDetail} />
                      ))}
                      {pending.pedidos.length > DISPLAY_LIMIT && (
                        <button
                          type="button"
                          className="withdrawal-view-more-btn"
                          onClick={() => setOrdersModal({
                            type: 'available',
                            title: 'Pedidos para retirar ahora',
                            subtitle: `${pending.pedidos.length} pedidos listos · Total ${formatCLP(pending.totalARetirar)}`,
                            icon: CheckCircle2,
                            orders: pending.pedidos,
                          })}
                        >
                          <Eye size={15} />
                          <span>Ver los {pending.pedidos.length} pedidos</span>
                          <ChevronRight size={15} />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="withdrawal-empty-inline">
                      <Wallet size={22} />
                      <div>
                        <strong>Nada para retirar por ahora</strong>
                        {pending.retenidos.length > 0 && (
                          <p>Tienes {pending.retenidos.length} {pending.retenidos.length === 1 ? 'venta' : 'ventas'} por liberar: revisa la pestaña «Por liberar».</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
              {/* La acción: a la derecha en escritorio y arriba en celular (order en el CSS). */}
              <aside className="withdrawal-total-card">
                <span>Total a retirar</span>
                <strong>{formatCLP(Math.max(0, pending.totalARetirar))}</strong>
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
                  disabled={!pending.pedidos.length || submitting || Boolean(withdrawalInProgress) || pending.fondosRetenidos}
                >
                  <Wallet size={17} />
                  {withdrawalInProgress ? 'Retiro en curso' : 'Solicitar retiro'}
                </button>
              </aside>
            </div>
          ) : fundsTab === 'liberar' ? (
            <section className="withdrawal-section-card withdrawal-held-card">
              <header className="withdrawal-section-header withdrawal-section-header-inline">
                <Clock size={18} />
                <h3>Se liberan solas</h3>
                <InfoHint title="Fondos por liberar" paragraphs={AYUDA_LIBERAR} />
              </header>
              <div className="withdrawal-section-orders">
                {heldByRelease.length > 0 ? (
                  <>
                    {heldByRelease.slice(0, DISPLAY_LIMIT).map((order) => (
                      <PendingOrderRow key={`retenido-${order.pedidoId}`} order={order} isHeld={true} onViewSale={setSaleDetail} />
                    ))}
                    {heldByRelease.length > DISPLAY_LIMIT && (
                      <button
                        type="button"
                        className="withdrawal-view-more-btn held-btn"
                        onClick={() => setOrdersModal({
                          type: 'held',
                          title: 'Pedidos por liberar',
                          subtitle: `${pending.retenidos.length} pedidos · Total ${formatCLP(pending.totalRetenido)}`,
                          icon: ShieldCheck,
                          orders: heldByRelease,
                        })}
                      >
                        <Eye size={15} />
                        <span>Ver los {heldByRelease.length} pedidos</span>
                        <ChevronRight size={15} />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="withdrawal-empty-inline">
                    <ShieldCheck size={22} />
                    <div><strong>No tienes ventas esperando el plazo del comprador.</strong></div>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="withdrawal-section-card withdrawal-charges-card">
              <header className="withdrawal-section-header withdrawal-section-header-inline">
                <RotateCcw size={18} />
                <h3>Se descuentan de tu próximo retiro</h3>
                <InfoHint title="Cargos por reembolsos" paragraphs={AYUDA_CARGOS} tone="red" />
              </header>
              <div className="withdrawal-section-orders">
                {pending.cargos.slice(0, DISPLAY_LIMIT).map((order) => (
                  <PendingOrderRow key={`cargo-${order.pedidoId}`} order={order} isCharge onViewSale={setSaleDetail} />
                ))}
                {pending.cargos.length > DISPLAY_LIMIT && (
                  <button
                    type="button"
                    className="withdrawal-view-more-btn charge-btn"
                    onClick={() => setOrdersModal({
                      type: 'charge',
                      title: 'Cargos por reembolsos',
                      subtitle: `${pending.cargos.length} pedidos · Total ${formatCLP(pending.totalCargos)}`,
                      icon: RotateCcw,
                      orders: pending.cargos,
                    })}
                  >
                    <Eye size={15} />
                    <span>Ver los {pending.cargos.length} pedidos</span>
                    <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Historial de retiros: en una hoja, abierta desde el ícono del encabezado. */}
      {showHistory && (
        <ModalShell
          title="Historial de retiros"
          icon={History}
          onClose={() => {
            setShowHistory(false);
            if (searchParams.get('tab') === 'historial') {
              const next = new URLSearchParams(searchParams);
              next.delete('tab');
              setSearchParams(next, { replace: true });
            }
          }}
          wide
        >
          <div className="withdrawal-history-modal-body">
            <div className="withdrawal-history-list">
              {history.length ? (
                history.map((withdrawal) => (
                  <article key={withdrawal.retiroId} className="withdrawal-history-card">
                    <div className="withdrawal-history-top">
                      <div>
                        <small>{withdrawal.codigoExterno || 'Retiro'}</small>
                        <span>Solicitado el {formatDate(withdrawal.fechaSolicitud, true)}</span>
                      </div>
                      <WithdrawalStatusTag
                        withdrawal={withdrawal}
                        open={Boolean(openRejections[withdrawal.retiroId])}
                        onToggle={() => setOpenRejections((current) => ({ ...current, [withdrawal.retiroId]: !current[withdrawal.retiroId] }))}
                      />
                    </div>
                    {isRejected(withdrawal) && openRejections[withdrawal.retiroId] && (
                      <WithdrawalRejectedNotice motivo={withdrawal.motivoRechazo} rechazadoAt={withdrawal.rechazadoAt} reintentoCodigo={withdrawal.reintentoCodigo} />
                    )}
                    <strong>{formatCLP(withdrawal.montoTotal)}</strong>
                    {Number(withdrawal.montoReembolsoMediacion || 0) > 0 && (
                      <span className="withdrawal-refund-note">
                        Este monto incluye un descuento por reembolso de mediación: -{formatCLP(withdrawal.montoReembolsoMediacion)}
                      </span>
                    )}
                    <div className="withdrawal-history-meta">
                      <span><Package size={15} /> {withdrawal.cantidadPedidos} {Number(withdrawal.cantidadPedidos) === 1 ? 'pedido' : 'pedidos'}</span>
                      <span><CalendarDays size={15} /> Pago estimado: {formatDate(withdrawal.fechaEfectiva)}</span>
                    </div>
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
          </div>
        </ModalShell>
      )}

      {saleDetail && <SaleDetailModal sellerId={sellerId} row={saleDetail} onClose={() => setSaleDetail(null)} />}

      {/* Modal para ver todos los pedidos (disponibles o en retencion) */}
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
            queryClient.invalidateQueries({ queryKey: qk.sellerBankAccount(sellerId) });
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
          subtitle={detail?.codigoExterno || (detail ? 'Retiro' : 'Cargando información...')}
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
                <WithdrawalStatusTag
                  withdrawal={detail}
                  open={detailRejectionOpen}
                  onToggle={() => setDetailRejectionOpen((value) => !value)}
                />
                <span><CalendarDays size={15} /> Solicitado el {formatDate(detail.fechaSolicitud, true)}</span>
                <span><CalendarDays size={15} /> Pago estimado: {formatDate(detail.fechaEfectiva)}</span>
              </div>
              {isRejected(detail) && detailRejectionOpen && (
                <WithdrawalRejectedNotice motivo={detail.motivoRechazo} rechazadoAt={detail.rechazadoAt} reintentoCodigo={detail.reintentoCodigo} />
              )}
              <div className="withdrawal-detail-orders">
                {(detail.pedidos || []).map((order) => (
                  <PendingOrderRow key={order.pedidoId} order={order} isInDetail={true} />
                ))}
              </div>
              {Number(detail.montoReembolsoMediacion || 0) > 0 && (
                <p className="withdrawal-refund-note">
                  Este retiro incluye un descuento por reembolso de mediación de {formatCLP(detail.montoReembolsoMediacion)}.
                </p>
              )}
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
