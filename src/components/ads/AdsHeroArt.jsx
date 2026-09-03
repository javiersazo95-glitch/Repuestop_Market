import React from 'react';

/**
 * Ilustraciones duotono azul del hero del Mural, equivalentes a las fotos
 * tratadas del arte original: un vehículo al costado izquierdo y una escena de
 * taller (auto en elevador + carro de herramientas) al costado derecho.
 *
 * Van dentro de `.ads-hero-bg`, detrás del marco con el titular, así que son
 * decorativas: no llevan texto ni rol accesible.
 */

/** Auto 3/4 frontal mirando a la derecha. */
export function HeroCarArt({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 480 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="heroCarBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFE0F8" />
          <stop offset="1" stopColor="#9FBEEC" />
        </linearGradient>
        <linearGradient id="heroCarGlass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8FB2E8" />
          <stop offset="1" stopColor="#B9D0F3" />
        </linearGradient>
      </defs>

      {/* sombra en el suelo */}
      <ellipse cx="250" cy="266" rx="205" ry="11" fill="#9FBEEC" opacity="0.35" />

      {/* carrocería */}
      <path
        d="M40 236 L40 172 C40 154 50 143 70 139 L132 126 C152 96 180 82 218 80
           L308 80 C348 82 372 98 390 128 L420 140 C440 148 450 160 450 178
           L450 226 C450 233 445 238 438 238 L48 238 C43 238 40 236 40 236 Z"
        fill="url(#heroCarBody)"
        stroke="#7FA5E8"
        strokeWidth="2.5"
      />

      {/* cristales */}
      <path d="M154 124 C168 102 190 93 218 92 L244 92 L244 123 Z" fill="url(#heroCarGlass)" />
      <path d="M258 92 L304 92 C334 94 354 106 368 124 L258 124 Z" fill="url(#heroCarGlass)" />

      {/* línea de cintura y manilla */}
      <path d="M62 170 L446 170" stroke="#7FA5E8" strokeWidth="2" opacity="0.55" />
      <rect x="230" y="146" width="26" height="6" rx="3" fill="#7FA5E8" opacity="0.7" />

      {/* faro y parachoques delantero */}
      <path d="M404 152 L444 160 C449 161 450 165 450 170 L410 170 C405 170 402 166 402 160 Z" fill="#EAF2FE" stroke="#7FA5E8" strokeWidth="2" />
      <path d="M398 198 L450 198 L450 224 C450 231 445 236 438 236 L398 236 Z" fill="#B9D0F3" stroke="#7FA5E8" strokeWidth="2" />

      {/* ruedas */}
      <g stroke="#7FA5E8" strokeWidth="2.5">
        <circle cx="148" cy="234" r="46" fill="#B9D0F3" />
        <circle cx="148" cy="234" r="23" fill="#EAF2FE" />
        <circle cx="356" cy="234" r="46" fill="#B9D0F3" />
        <circle cx="356" cy="234" r="23" fill="#EAF2FE" />
      </g>
    </svg>
  );
}

/** Escena de taller: auto sobre elevador de dos postes y carro de herramientas. */
export function HeroWorkshopArt({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 480 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="heroShopBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFE0F8" />
          <stop offset="1" stopColor="#A3C0ED" />
        </linearGradient>
      </defs>

      {/* pared de fondo y suelo */}
      <path d="M0 246 L480 246" stroke="#7FA5E8" strokeWidth="2.5" opacity="0.55" />
      <g opacity="0.35" stroke="#7FA5E8" strokeWidth="2">
        <path d="M40 34 L440 34" />
        <path d="M150 34 L150 246" />
        <path d="M330 34 L330 246" />
      </g>

      {/* postes del elevador */}
      <g fill="#8FB2E8" opacity="0.9">
        <rect x="96" y="40" width="20" height="206" rx="4" />
        <rect x="364" y="40" width="20" height="206" rx="4" />
        <rect x="80" y="238" width="52" height="12" rx="4" />
        <rect x="348" y="238" width="52" height="12" rx="4" />
      </g>

      {/* brazos del elevador */}
      <g fill="#8FB2E8">
        <rect x="112" y="176" width="60" height="10" rx="5" />
        <rect x="308" y="176" width="60" height="10" rx="5" />
      </g>

      {/* auto elevado */}
      <g stroke="#7FA5E8" strokeWidth="2.5">
        <path
          d="M138 176 L138 138 C138 126 146 118 160 116 L196 110 C210 90 228 82 250 81
             L300 81 C322 82 338 92 350 112 L358 118 C346 118 342 118 342 118 L342 176 Z"
          fill="url(#heroShopBody)"
        />
        <path d="M206 110 C216 94 230 88 248 87 L266 87 L266 110 Z" fill="#8FB2E8" />
        <path d="M278 87 L298 87 C316 88 328 95 336 110 L278 110 Z" fill="#8FB2E8" />
        <circle cx="176" cy="176" r="20" fill="#B9D0F3" />
        <circle cx="316" cy="176" r="20" fill="#B9D0F3" />
      </g>

      {/* carro de herramientas */}
      <g stroke="#7FA5E8" strokeWidth="2.5">
        <rect x="404" y="150" width="66" height="90" rx="6" fill="#B9D0F3" />
        <path d="M404 176 L470 176 M404 202 L470 202" opacity="0.8" />
        <rect x="424" y="162" width="26" height="5" rx="2.5" fill="#7FA5E8" stroke="none" />
        <rect x="424" y="188" width="26" height="5" rx="2.5" fill="#7FA5E8" stroke="none" />
        <rect x="424" y="214" width="26" height="5" rx="2.5" fill="#7FA5E8" stroke="none" />
      </g>

      {/* lámpara de techo */}
      <g fill="#8FB2E8" opacity="0.75">
        <rect x="196" y="14" width="96" height="10" rx="5" />
        <path d="M232 24 L256 24 L250 34 L238 34 Z" />
      </g>
    </svg>
  );
}
