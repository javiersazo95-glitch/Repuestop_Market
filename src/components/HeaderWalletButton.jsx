import React, { useState } from 'react';
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
export default function HeaderWalletButton({ variant = 'header' }) {
  const { isLoggedIn, user, role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const balance = useTokensBalance(isLoggedIn);

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

      {isOpen && <WalletModal balance={balance} isSeller={isSeller} onClose={() => setIsOpen(false)} />}
    </>
  );
}
