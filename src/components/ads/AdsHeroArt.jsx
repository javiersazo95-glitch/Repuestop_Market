import React from 'react';

/**
 * Ilustraciones duotono azul del hero del Mural. Son decorativas (van dentro de
 * `.ads-hero-bg`, detrás del marco con el titular) y quedan medio recortadas por
 * los costados, así que usan formas grandes y limpias que se leen bien a baja
 * opacidad: un sistema de frenos a la izquierda y herramientas de taller sobre
 * un engranaje a la derecha. Así el banner comunica servicios automotrices sin
 * repetir vehículos a ambos costados.
 */

const GEAR_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Engranaje reutilizable, centrado en (0,0). */
function Gear({ radius, tooth, fill }) {
  const toothH = tooth * 1.7;
  return (
    <g fill={fill}>
      {GEAR_ANGLES.map((a) => (
        <rect
          key={a}
          x={-tooth / 2}
          y={-(radius + toothH - 6)}
          width={tooth}
          height={toothH}
          rx={tooth * 0.28}
          transform={`rotate(${a})`}
        />
      ))}
      <circle r={radius} />
    </g>
  );
}

/** Costado izquierdo: disco, cáliper y llave para representar mantención. */
export function HeroBrakeServiceArt({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 420 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Disco ventilado */}
      <g transform="translate(138 150)" stroke="#7FA5E8" strokeWidth="3">
        <circle r="102" fill="#C7DBF6" />
        <circle r="75" fill="#EAF2FE" />
        <circle r="35" fill="#B7D0F2" />
        <circle r="16" fill="#EAF2FE" />
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <circle
            key={angle}
            cx="0"
            cy="-55"
            r="7"
            fill="#A7C4EC"
            stroke="none"
            transform={`rotate(${angle})`}
          />
        ))}
      </g>

      {/* Cáliper de freno */}
      <path
        d="M201 82 C234 91 253 114 257 145 L251 199 C247 217 234 228 215 232
           L191 223 C207 202 214 179 214 151 C214 124 207 102 191 88 Z"
        fill="#9DBBE9"
        stroke="#729DE0"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M216 116 L242 126 M216 187 L239 177" stroke="#EAF2FE" strokeWidth="7" strokeLinecap="round" />

      {/* Llave combinada: refuerza la idea de servicio y reparación */}
      <g transform="rotate(-35 285 152)" stroke="#729DE0" strokeWidth="3" strokeLinejoin="round">
        <circle cx="285" cy="55" r="24" fill="#CFE0F8" />
        <circle cx="285" cy="55" r="11" fill="#EAF2FE" />
        <rect x="274" y="75" width="22" height="144" rx="9" fill="#B7D0F2" />
        <path d="M262 223 L273 204 L297 204 L308 223 L294 242 L276 242 Z" fill="#CFE0F8" />
        <path d="M276 225 L294 225" stroke="#EAF2FE" strokeWidth="7" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Costado derecho: llave y destornillador cruzados sobre un engranaje. */
export function HeroWorkshopArt({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 420 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Engranaje central */}
      <g
        transform="translate(238 150)"
        stroke="#8FB2E8"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        <Gear radius={78} tooth={24} fill="#C4D8F5" />
        <circle r="32" fill="#EAF2FE" />
      </g>

      {/* Llave inglesa */}
      <g
        transform="rotate(40 210 150)"
        stroke="#7FA5E8"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        <path
          d="M96 138 a32 32 0 1 0 0 44 l0 -12 a20 20 0 1 1 0 -20 Z"
          fill="#BFD5F4"
        />
        <rect x="120" y="139" width="196" height="22" rx="6" fill="#CFE0F8" />
        <path d="M300 132 a24 24 0 1 1 0 36 Z" fill="#BFD5F4" />
      </g>

      {/* Destornillador cruzado */}
      <g
        transform="rotate(-42 210 150)"
        stroke="#7FA5E8"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        <path d="M118 142 L150 138 L150 162 L118 158 Z" fill="#BFD5F4" />
        <rect x="150" y="141" width="150" height="18" rx="4" fill="#CFE0F8" />
        <rect x="298" y="134" width="52" height="32" rx="10" fill="#A9C6F0" />
      </g>
    </svg>
  );
}
