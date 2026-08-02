import React from 'react';

/**
 * Official RepuesTop Logo Component
 * Renders the exact original logo image uploaded by the user.
 */
export default function RepuesTopLogo({ height = 96, className = '', variant = 'default' }) {
  // Footer keeps the original combined lockup on its white pill background.
  if (variant === 'footer') {
    return (
      <div
        className={`official-brand-logo-container ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          userSelect: 'none'
        }}
      >
        <img
          src="/repuestop_horizontal_logo.png"
          alt="RepuesTop Chile Logo Oficial"
          style={{
            height: `${height}px`,
            width: 'auto',
            maxWidth: '100%',
            objectFit: 'contain',
            display: 'block',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            padding: '6px 14px'
          }}
        />
      </div>
    );
  }

  // Default header lockup: the vehicle icon is sized independently from the
  // wordmark so it can carry more visual presence without growing the row.
  const iconHeight = Math.round(height * 0.8);
  const wordmarkHeight = Math.round(height * 0.5);

  return (
    <div
      className={`official-brand-logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.round(height * 0.08)}px`,
        userSelect: 'none'
      }}
    >
      <img
        src="/repuestop_icon.png"
        alt=""
        aria-hidden="true"
        style={{
          height: `${iconHeight}px`,
          width: 'auto',
          objectFit: 'contain',
          display: 'block'
        }}
      />
      <img
        src="/repuestop_wordmark.png"
        alt="RepuesTop Chile"
        style={{
          height: `${wordmarkHeight}px`,
          width: 'auto',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    </div>
  );
}
