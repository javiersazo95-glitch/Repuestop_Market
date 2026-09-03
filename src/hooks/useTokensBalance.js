import { useEffect, useState } from 'react';
import {
  getCachedTokensBalance, fetchTokensBalance, TOKENS_UPDATED_EVENT
} from '../services/adsStorage';

/**
 * Saldo del Monedero de Monedas RepuesTop, compartido entre el indicador global
 * de la cabecera y el modal del monedero.
 *
 * Arranca con la última copia local (`getCachedTokensBalance`) para no parpadear,
 * pide el saldo real al montar y se mantiene al día escuchando
 * `TOKENS_UPDATED_EVENT`, que `adsStorage` emite cada vez que el backend confirma
 * un saldo nuevo (recarga, cobro de publicación o de mejora de plan).
 *
 * OJO: la primera lectura de `fetchTokensBalance()` es también la que gatilla el
 * bono de bienvenida del backend, así que solo se llama con sesión iniciada.
 */
export function useTokensBalance(enabled = true) {
  const [balance, setBalance] = useState(() => getCachedTokensBalance());

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    fetchTokensBalance({ signal: controller.signal }).then(setBalance).catch(() => {});

    const handleUpdate = (event) => {
      if (typeof event.detail === 'number') setBalance(event.detail);
    };
    window.addEventListener(TOKENS_UPDATED_EVENT, handleUpdate);

    return () => {
      controller.abort();
      window.removeEventListener(TOKENS_UPDATED_EVENT, handleUpdate);
    };
  }, [enabled]);

  return balance;
}
