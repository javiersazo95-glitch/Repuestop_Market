import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTokensBalance } from '../hooks/useTokensBalance';
import RepuestopCoin from './ads/RepuestopCoin';
import WalletModal from './ads/WalletModal';

/**
 * Indicador global del Monedero: la moneda con su contador de saldo, arriba a la
 * derecha. Al pulsarla se abre el modal del monedero. Equivalente web del botón
 * de saldo del `TopAppBar` de la app móvil.
 *
 * Solo se muestra con sesión iniciada (el saldo es de la cuenta). Se monta en la
 * cabecera del sitio (`Header`) y en la barra superior del perfil
 * (`ProfileDashboard`); `variant` solo ajusta el tamaño y el estilo.
 */
/**
 * El regreso de una recarga pagada lo reclama UNA sola instancia.
 *
 * `HeaderWalletButton` se monta dos veces en `/perfil` -- en la cabecera del sitio y en la barra
 * del panel --, asi que sin este candado ambas abririan su propio monedero al volver de Flow y el
 * usuario veria dos modales encima. El primero que corre su efecto se queda con la celebracion.
 */
let celebracionReclamada = false;

export default function HeaderWalletButton({ variant = 'header' }) {
  const { isLoggedIn, user, role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const balance = useTokensBalance(isLoggedIn);
  const [celebrar, setCelebrar] = useState(false);

  // Al volver de la pasarela, la pagina puente del backend aterriza en
  // `/perfil/anuncios?status=success`. Ahi se abre el monedero con la lluvia de monedas:
  // es el momento en que el usuario ve que su plata se convirtio en algo, y hasta ahora
  // volvia a una pantalla cualquiera sin ninguna senal de que la recarga habia entrado.
  useEffect(() => {
    if (!isLoggedIn || celebracionReclamada) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') !== 'success') return;
    celebracionReclamada = true;
    setCelebrar(true);
    setIsOpen(true);
    // Se limpia el parametro para que recargar la pagina no vuelva a celebrar.
    params.delete('status');
    const query = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
  }, [isLoggedIn]);

  if (!isLoggedIn) return null;

  // La guía de "Top Ventas" del modal es solo para vendedores con tienda.
  const isSeller = String(user?.role || role || '').toUpperCase() === 'SELLER' && Boolean(user?.sellerId);

  return (
    <>
      <button
        type="button"
        className={`wallet-trigger wallet-trigger--${variant}`}
        onClick={() => setIsOpen(true)}
        title="Monedas RepuesTop"
        aria-label={`Monedas RepuesTop, saldo ${balance}`}
      >
        <RepuestopCoin size={variant === 'topbar' ? 26 : 28} face="front" />
        <span className="wallet-trigger-count">{balance.toLocaleString('es-CL')}</span>
      </button>

      {isOpen && (
        <WalletModal
          balance={balance}
          isSeller={isSeller}
          celebrar={celebrar}
          onCelebracionLista={() => setCelebrar(false)}
          onClose={() => { setCelebrar(false); setIsOpen(false); }}
        />
      )}
    </>
  );
}
