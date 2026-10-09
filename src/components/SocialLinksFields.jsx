import React from 'react';
import SocialIcon from './SocialIcon';
import { SOCIAL_NETWORKS } from '../utils/socialLinks';
import '../styles/social-links.css';

/**
 * "Redes sociales (opcional)" del registro de la tienda: un interruptor que, encendido, muestra
 * un campo por red. Lo usan el registro de `/vender` y la tarjeta de verificación del panel.
 * `fieldClassName`/`labelClassName` toman el estilo de campo de cada formulario.
 */
export default function SocialLinksFields({ value, errors = {}, onChange, fieldClassName, labelClassName }) {
  const enabled = Boolean(value?.enabled);

  return (
    <div className="social-links-fields">
      <div className="social-links-toggle-row">
        <div className="social-links-toggle-copy">
          <strong>Redes sociales (opcional)</strong>
          <small>Actívalo para mostrar tus redes en el perfil de tu tienda.</small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Agregar redes sociales"
          className={`social-links-switch ${enabled ? 'is-on' : ''}`}
          onClick={() => onChange({ ...value, enabled: !enabled })}
        >
          <span className="social-links-switch-thumb" />
        </button>
      </div>

      {enabled && SOCIAL_NETWORKS.map((network) => (
        <label key={network.key} className={`${fieldClassName ?? ''} social-links-field ${errors[network.key] ? 'has-error' : ''}`}>
          <span className={`${labelClassName ?? ''} social-links-label`}>
            <SocialIcon network={network.key} size={14} /> {network.label}
          </span>
          <input
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={300}
            placeholder={network.placeholder}
            value={value?.[network.key] ?? ''}
            onChange={(e) => onChange({ ...value, [network.key]: e.target.value })}
          />
          {errors[network.key] && <span className="social-links-error">{errors[network.key]}</span>}
        </label>
      ))}
    </div>
  );
}
