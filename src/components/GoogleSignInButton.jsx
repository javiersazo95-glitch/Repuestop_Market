import React, { useEffect, useRef } from 'react';
import { GOOGLE_CLIENT_ID } from './founderConfig';

// Google Identity Services mantiene una única configuración global por página.
// React puede montar efectos dos veces en desarrollo y el modal puede abrirse muchas
// veces, por lo que initialize() no debe vivir dentro del ciclo de vida del botón.
const googleIdentityState = {
  initialized: false,
  activeCredentialHandler: null,
};

function initializeGoogleIdentity(onCredential) {
  if (!window.google?.accounts?.id) return false;

  googleIdentityState.activeCredentialHandler = onCredential;
  if (!googleIdentityState.initialized) {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (response?.credential) {
          googleIdentityState.activeCredentialHandler?.(response.credential);
        }
      },
    });
    googleIdentityState.initialized = true;
  }
  return true;
}

/** Boton «Continuar con Google»: entrega el idToken a `onCredential`. */
export default function GoogleSignInButton({ onCredential, disabled }) {
  const containerRef = useRef(null);
  const credentialHandlerRef = useRef(onCredential);

  useEffect(() => {
    credentialHandlerRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (disabled || !containerRef.current) return;

    let cancelled = false;
    const currentContainer = containerRef.current;
    const credentialHandler = (credential) => credentialHandlerRef.current?.(credential);

    const renderButton = () => {
      if (cancelled || !currentContainer.isConnected || !initializeGoogleIdentity(credentialHandler)) return;
      currentContainer.replaceChildren();
      window.google.accounts.id.renderButton(currentContainer, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: currentContainer.offsetWidth || 360,
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      // El script de Google Identity Services carga async; reintentamos hasta que esté listo.
      const intervalId = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(intervalId);
          renderButton();
        }
      }, 200);
      return () => {
        cancelled = true;
        clearInterval(intervalId);
        if (googleIdentityState.activeCredentialHandler === credentialHandler) {
          googleIdentityState.activeCredentialHandler = null;
        }
        currentContainer.replaceChildren();
      };
    }

    return () => {
      cancelled = true;
      if (googleIdentityState.activeCredentialHandler === credentialHandler) {
        googleIdentityState.activeCredentialHandler = null;
      }
      currentContainer.replaceChildren();
    };
  }, [disabled]);

  if (disabled) {
    return (
      <button type="button" className="btn-auth-google" disabled title="Conectando...">
        <span>Cargando Google Sign-In...</span>
      </button>
    );
  }

  return <div ref={containerRef} className="google-signin-container" />;
}
