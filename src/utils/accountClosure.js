/**
 * Aviso de las Monedas que se pierden al cerrar la cuenta, o `null` si no le quedan.
 * `saldoMonedas` viene en el resumen de cierre; un backend que aún no lo envía cuenta como 0.
 * No bloquea el cierre: solo deja claro, antes de confirmar, que ese saldo no se devuelve.
 */
export function getAccountClosureCoinsWarning(summary) {
  const saldo = Math.trunc(Number(summary?.saldoMonedas ?? 0));
  if (!Number.isFinite(saldo) || saldo <= 0) return null;
  const monedas = `${saldo.toLocaleString('es-CL')} ${saldo === 1 ? 'Moneda' : 'Monedas'}`;
  return `Tienes ${monedas}. Si cierras tu cuenta, ese saldo se pierde y no se puede devolver ni transferir.`;
}
