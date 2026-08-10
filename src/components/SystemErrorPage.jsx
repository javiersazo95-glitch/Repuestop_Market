import React from 'react';
import systemErrorArtwork from '../assets/system-error-page.png';
import './SystemErrorPage.css';

export default function SystemErrorPage() {
  const retry = () => window.location.reload();
  const goHome = () => window.location.assign(import.meta.env.BASE_URL || '/');

  return (
    <main className="system-error-page" aria-labelledby="system-error-title">
      <h1 id="system-error-title" className="system-error-sr-only">
        ¡Ups! Algo salió mal
      </h1>
      <p className="system-error-sr-only">
        Nuestro sistema tuvo un problema inesperado. Ya estamos trabajando para solucionarlo lo antes posible.
      </p>

      <div className="system-error-artwork">
        <img
          src={systemErrorArtwork}
          alt="Pantalla de error de RepuesTop: nuestro sistema tuvo un problema inesperado."
          draggable="false"
        />

        <button
          type="button"
          className="system-error-hotspot system-error-retry"
          onClick={retry}
          aria-label="Reintentar y recargar la aplicación"
          title="Reintentar"
        />
        <button
          type="button"
          className="system-error-hotspot system-error-home"
          onClick={goHome}
          aria-label="Volver al inicio de RepuesTop"
          title="Volver al inicio"
        />
      </div>
    </main>
  );
}
