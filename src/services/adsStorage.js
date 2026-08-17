// Servicio de almacenamiento y gestión de Anuncios y Monedero de Fichas RepuesTop
import { INITIAL_CLASSIFIED_ADS } from '../data/automotiveAdsData';

const ADS_STORAGE_KEY = 'repuestop_classified_ads';
const TOKENS_BALANCE_KEY = 'repuestop_fichas_balance';
const TOKENS_HISTORY_KEY = 'repuestop_fichas_transactions';

// Packs de recarga de Fichas RepuesTop
export const TOKEN_PACKS = [
  {
    id: 'pack-basico',
    name: 'Pack Básico',
    tokens: 100,
    bonus: 0,
    totalTokens: 100,
    priceClp: 4990,
    priceFormatted: '$4.990 CLP',
    tag: 'Inicial',
    highlight: false,
    description: 'Ideal para destacar 2 anuncios en el mural.',
    color: '#64748b'
  },
  {
    id: 'pack-medio',
    name: 'Pack Medio',
    tokens: 250,
    bonus: 25,
    totalTokens: 275,
    priceClp: 9990,
    priceFormatted: '$9.990 CLP',
    tag: 'Más Popular',
    highlight: true,
    description: 'Perfecto para clasificar en Plan Premium con WhatsApp directo.',
    color: '#7c3aed'
  },
  {
    id: 'pack-avanzado',
    name: 'Pack Avanzado',
    tokens: 600,
    bonus: 100,
    totalTokens: 700,
    priceClp: 19900,
    priceFormatted: '$19.990 CLP',
    tag: 'Empresarial',
    highlight: false,
    description: 'Accede a Plan Empresarial con agendamiento de citas en línea.',
    color: '#059669'
  },
  {
    id: 'pack-extra',
    name: 'Pack Extra Pro',
    tokens: 1500,
    bonus: 350,
    totalTokens: 1850,
    priceClp: 39990,
    priceFormatted: '$39.990 CLP',
    tag: 'Máximo Ahorro',
    highlight: false,
    description: 'Para talleres y redes automotrices con múltiples avisos permanentes.',
    color: '#d97706'
  }
];

// Costo en Fichas RepuesTop para mejorar de rango un anuncio
export const UPGRADE_TOKEN_COSTS = {
  basica: 0,
  destacada: 50,
  premium: 120,
  empresarial: 250
};

// -------------------------------------------------------------
// GESTIÓN DE ANUNCIOS EN STORAGE
// -------------------------------------------------------------

export function getStoredAds() {
  try {
    const raw = localStorage.getItem(ADS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ADS_STORAGE_KEY, JSON.stringify(INITIAL_CLASSIFIED_ADS));
      return INITIAL_CLASSIFIED_ADS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : INITIAL_CLASSIFIED_ADS;
  } catch {
    return INITIAL_CLASSIFIED_ADS;
  }
}

export function saveStoredAds(ads) {
  try {
    localStorage.setItem(ADS_STORAGE_KEY, JSON.stringify(ads));
    window.dispatchEvent(new CustomEvent('repuestop_ads_updated', { detail: ads }));
  } catch (err) {
    console.warn('Error al guardar anuncios en localStorage:', err);
  }
}

export function createAdInStorage(newAd) {
  const current = getStoredAds();
  const updated = [newAd, ...current];
  saveStoredAds(updated);
  return updated;
}

export function updateAdInStorage(adId, fields) {
  const current = getStoredAds();
  const updated = current.map((ad) => (ad.id === adId ? { ...ad, ...fields } : ad));
  saveStoredAds(updated);
  return updated;
}

export function deleteAdInStorage(adId) {
  const current = getStoredAds();
  const updated = current.filter((ad) => ad.id !== adId);
  saveStoredAds(updated);
  return updated;
}

// -------------------------------------------------------------
// GESTIÓN DE MONEDERO Y FICHAS REPUES-TOP
// -------------------------------------------------------------

export function getTokensBalance() {
  try {
    const raw = localStorage.getItem(TOKENS_BALANCE_KEY);
    if (raw === null) {
      // Saldo de bienvenida inicial (300 fichas para probar)
      const initialBalance = 300;
      localStorage.setItem(TOKENS_BALANCE_KEY, String(initialBalance));
      return initialBalance;
    }
    return Number(raw) || 0;
  } catch {
    return 300;
  }
}

export function setTokensBalance(amount) {
  try {
    const val = Math.max(0, Math.round(amount));
    localStorage.setItem(TOKENS_BALANCE_KEY, String(val));
    window.dispatchEvent(new CustomEvent('repuestop_tokens_updated', { detail: val }));
    return val;
  } catch {
    return amount;
  }
}

export function getTokenTransactions() {
  try {
    const raw = localStorage.getItem(TOKENS_HISTORY_KEY);
    if (!raw) {
      const initialHistory = [
        {
          id: 'tx-welcome',
          type: 'credit',
          amount: 300,
          description: 'Bono de bienvenida Monedero RepuesTop',
          date: new Date().toISOString()
        }
      ];
      localStorage.setItem(TOKENS_HISTORY_KEY, JSON.stringify(initialHistory));
      return initialHistory;
    }
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

export function addTokenTransaction(tx) {
  try {
    const current = getTokenTransactions();
    const updated = [
      {
        id: `tx-${Date.now()}`,
        date: new Date().toISOString(),
        ...tx
      },
      ...current
    ];
    localStorage.setItem(TOKENS_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

// Recargar saldo mediante un Pack de Fichas
export function rechargeTokensWithPack(pack, paymentMethod = 'Webpay Plus') {
  const currentBalance = getTokensBalance();
  const newBalance = currentBalance + pack.totalTokens;
  setTokensBalance(newBalance);

  addTokenTransaction({
    type: 'credit',
    amount: pack.totalTokens,
    description: `Recarga ${pack.name} (${pack.totalTokens} Fichas) - Pago con ${paymentMethod}`,
    priceClp: pack.priceClp
  });

  return newBalance;
}

// Descontar fichas al subir de rango un anuncio
export function spendTokensForAdUpgrade(adId, adTitle, targetTier) {
  const cost = UPGRADE_TOKEN_COSTS[targetTier] || 0;
  const currentBalance = getTokensBalance();

  if (cost > 0 && currentBalance < cost) {
    throw new Error(`Saldo insuficiente: tienes ${currentBalance} fichas y necesitas ${cost} fichas.`);
  }

  const newBalance = currentBalance - cost;
  setTokensBalance(newBalance);

  if (cost > 0) {
    addTokenTransaction({
      type: 'debit',
      amount: cost,
      description: `Upgrade de anuncio "${adTitle}" a rango ${targetTier.toUpperCase()}`,
      adId
    });
  }

  // Actualizar el anuncio en storage
  updateAdInStorage(adId, {
    tier: targetTier,
    hasOnlineBooking: targetTier === 'empresarial',
    upgradedAt: new Date().toISOString()
  });

  return newBalance;
}
