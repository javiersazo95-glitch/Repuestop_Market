import { useLista } from '../remoteConfig/hooks';
import { remoteConfig } from '../remoteConfig/remoteConfig';

// Nómina "Banco Destino" usada por el backend de pagos BCI. Los códigos deben
// mantenerse sincronizados con CodigoBanco y con el flujo móvil de retiros.
//
// Mantenedor comun (2026-10-20): la lista vigente es `BANCO` (lista de sistema: el dueno solo
// renombra, ordena u oculta). El codigo numerico sale de `metadata.codigoBci` ("001" -> 1), que
// es lo que guarda la cuenta del vendedor. Esto queda como respaldo.
export const BANKS_FALLBACK = [
  { code: 1, label: 'Banco de Chile / A. Edwards / Citibank N.A.' },
  { code: 9, label: 'Banco Internacional' },
  { code: 11, label: 'Dresdner Bank Leteinamerika' },
  { code: 12, label: 'Banco del Estado de Chile (BancoEstado)' },
  { code: 14, label: 'Scotiabank' },
  { code: 16, label: 'Banco Credito e Inversiones (BCI)' },
  { code: 17, label: 'Banco Do Brasil S.A.' },
  { code: 27, label: 'Corpbanca' },
  { code: 28, label: 'Banco Bice' },
  { code: 31, label: 'HSBC Bank Chile' },
  { code: 37, label: 'Banco Santander - Santiago' },
  { code: 39, label: 'Banco Itaú', requiresAlias: true },
  { code: 41, label: 'JP Morgan Chase Bank' },
  { code: 43, label: 'Banco de la Nación Argentina' },
  { code: 45, label: 'The Bank of Tokyo – Mitsubishi' },
  { code: 46, label: 'Abn Amro Bank (Chile)' },
  { code: 49, label: 'Banco Security' },
  { code: 51, label: 'Banco Falabella' },
  { code: 52, label: 'Deutsche Bank (Chile)' },
  { code: 53, label: 'Banco Ripley' },
  { code: 54, label: 'HNS Banco' },
  { code: 55, label: 'Banco Consorcio' },
  { code: 116, label: 'Cuentas Mach', requiresAlias: true },
  { code: 504, label: 'BBVA Banco Bhif' },
  { code: 507, label: 'Banco del Desarrollo' },
  { code: 672, label: 'Copeeuch' },
  { code: 697, label: 'La Polar', requiresAlias: true },
  { code: 729, label: 'Tarjetas Los Héroes S.A.', requiresAlias: true },
  { code: 730, label: 'Tenpo Prepago S.A.', requiresAlias: true },
  { code: 732, label: 'Los Andes Tarjetas de Prepago', requiresAlias: true },
  { code: 734, label: 'Banco Conosur' },
  { code: 738, label: 'Global 66', requiresAlias: true },
  { code: 741, label: 'Copec Pay', requiresAlias: true },
  { code: 875, label: 'Mercado Pago', requiresAlias: true },
];

const FALLBACK_BY_CODE = new Map(BANKS_FALLBACK.map((bank) => [bank.code, bank]));

/** Opciones de `BANCO` -> `{code, label, requiresAlias}`. Sin codigo legible, la opcion se omite. */
function toBanks(opciones) {
  return opciones.map((opcion) => {
    const metadata = opcion?.metadata || {};
    const code = Number(metadata.codigoBci ?? opcion?.valor);
    if (!Number.isFinite(code)) return null;
    const fallback = FALLBACK_BY_CODE.get(code);
    const requiresAlias = typeof metadata.requiereAlias === 'boolean'
      ? metadata.requiereAlias
      : typeof metadata.requiresAlias === 'boolean' ? metadata.requiresAlias : Boolean(fallback?.requiresAlias);
    return { code, label: opcion.etiqueta || fallback?.label || String(opcion.valor), ...(requiresAlias ? { requiresAlias: true } : {}) };
  }).filter(Boolean);
}

/** Bancos que se ofrecen en el formulario de cuenta, al dia con el mantenedor. */
export function useBanks() {
  return useLista('BANCO', BANKS_FALLBACK, toBanks);
}

/**
 * Busca por codigo en la lista vigente y, si no esta (el dueno lo oculto), en el respaldo: una
 * cuenta ya registrada con ese banco tiene que seguir mostrando su nombre.
 */
export const findBankByCode = (code) => {
  const opciones = remoteConfig.lista('BANCO', null);
  const vigentes = opciones ? toBanks(opciones) : BANKS_FALLBACK;
  return vigentes.find((bank) => bank.code === Number(code)) || FALLBACK_BY_CODE.get(Number(code));
};

