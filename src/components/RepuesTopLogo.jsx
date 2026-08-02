import React from 'react';

/**
 * Official RepuesTop Logo Component
 * Renders the exact original logo image uploaded by the user.
 */
export default function RepuesTopLogo({ height = 96, className = '', variant = 'default' }) {
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
          // In dark footer variant, render on a clean white pill background for maximum legibility
          backgroundColor: variant === 'footer' ? '#ffffff' : 'transparent',
          borderRadius: variant === 'footer' ? '10px' : '0',
          padding: variant === 'footer' ? '6px 14px' : '0'
        }} 
      />
    </div>
  );
}
