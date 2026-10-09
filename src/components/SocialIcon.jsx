import React from 'react';

/**
 * Logos de redes sociales en trazo, al estilo de lucide (que desde la 1.x ya no trae logos
 * de marcas). Van con el color de su marca.
 */
const PATHS = {
  instagramUrl: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </>
  ),
  facebookUrl: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  tiktokUrl: <path d="M9 12a4 4 0 1 0 4 4V2c0 2.8 2.2 5 5 5" />,
};

/** Colores de marca: los iconos se pintan con su red para que resalten. */
export const SOCIAL_COLORS = {
  instagramUrl: '#E4405F',
  facebookUrl: '#1877F2',
  tiktokUrl: '#111111',
};

export default function SocialIcon({ network, size = 16, colored = true }) {
  return (
    <svg
      className="social-icon"
      style={colored ? { color: SOCIAL_COLORS[network] } : undefined}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[network]}
    </svg>
  );
}
