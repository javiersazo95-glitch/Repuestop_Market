import React, { useId } from 'react';

/**
 * La Moneda RepuesTop, dibujada y no como imagen.
 *
 * Port de `mobile/components/ads/RepuestopCoin.tsx` (monorepo `fae41ed`). Es el
 * MISMO objeto en las tres plataformas, asi que la geometria se replica tal cual:
 * si aca se corre un radio, la moneda de la web deja de ser la que el usuario ve
 * en la app.
 *
 * Se dibuja en SVG por tres motivos: escala sin pixelarse en cualquier tamaño,
 * permite mostrar cara y reverso por separado —la lluvia de la recarga gira la
 * moneda y necesita ambas— y evita cargar un PNG pesado en pantallas donde
 * aparece muchas veces a la vez.
 *
 * El relieve sale de los degradados, no de sombras: un barrido diagonal para el
 * metal del canto y un radial descentrado para el disco interior, que es lo que
 * da la sensacion de superficie abombada.
 */

/**
 * Leyendas grabadas en el troquel.
 *
 * Dicen "FICHA" a proposito, aunque toda la UI que rodea a la moneda diga
 * "Moneda": es el texto que ya esta grabado en la version del movil y prima que
 * la pieza sea identica en las dos plataformas. Si algun dia se cambia, se
 * cambia en las dos a la vez.
 *
 * En el movil se exportan porque sus tests las afirman (el texto dentro de un
 * <Svg> nativo no es consultable). Aca no hay suite, asi que quedan privadas: un
 * segundo export en el archivo rompe el fast refresh del componente.
 */
const COIN_LEGENDS = {
  frontArc: 'REPUESTOP',
  frontLabel: 'FICHA',
  backArc: 'MÁS VISIBILIDAD, MÁS CLIENTES',
  backLabel: 'FICHA OFICIAL'
};

/**
 * Radios del troquel, sobre un viewBox de 200x200 centrado en (100,100).
 *
 * El anillo de color ocupa la banda [RING_INNER, RING_OUTER] y las dos leyendas
 * se apoyan en arcos distintos a proposito: el texto de arriba crece hacia AFUERA
 * desde su linea base y el de abajo crece hacia ADENTRO, asi que para que ambos
 * queden dentro de la misma banda la linea base de arriba va en el borde interno
 * y la de abajo en el externo.
 */
const RIM = 100;
const RING_OUTER = 92;
const RING_INNER = 71;
const RING_MID = (RING_OUTER + RING_INNER) / 2;
const ARC_TOP = RING_INNER + 1;
const ARC_BOTTOM = RING_OUTER - 2;

/** Bajo este diametro el nombre de la marca no se lee: queda solo el emblema. */
const MIN_SIZE_FOR_WORDMARK = 64;

/** Muescas del canto: 96 marcas radiales, como el estriado de una moneda real. */
function Estriado({ radio }) {
  const marcas = [];
  const total = 96;
  for (let i = 0; i < total; i += 1) {
    const angulo = (Math.PI * 2 * i) / total;
    const x1 = 100 + (radio - 4) * Math.cos(angulo);
    const y1 = 100 + (radio - 4) * Math.sin(angulo);
    const x2 = 100 + radio * Math.cos(angulo);
    const y2 = 100 + radio * Math.sin(angulo);
    marcas.push(
      <path key={i} d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="#e6ecf3" strokeWidth="1.1" strokeLinecap="round" />
    );
  }
  return <g>{marcas}</g>;
}

/** Estrella de cinco puntas centrada en (cx, cy). */
function Estrella({ cx, cy, r, fill }) {
  const puntos = [];
  for (let i = 0; i < 10; i += 1) {
    const radio = i % 2 === 0 ? r : r * 0.45;
    const angulo = (Math.PI / 5) * i - Math.PI / 2;
    puntos.push(`${cx + radio * Math.cos(angulo)},${cy + radio * Math.sin(angulo)}`);
  }
  return <polygon points={puntos.join(' ')} fill={fill} />;
}

export default function RepuestopCoin({
  size = 120,
  face = 'front',
  serial = 'RT-00001',
  className = ''
}) {
  const esFrente = face === 'front';

  // Los ids de <defs> son globales dentro del documento: sin un sufijo propio,
  // varias monedas en pantalla (el popup muestra dos, la lluvia doce) se pisan
  // los degradados entre si y todas quedan pintadas como la ultima montada.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (nombre) => `${nombre}-${uid}`;

  const muestraWordmark = size >= MIN_SIZE_FOR_WORDMARK;
  // En 14–32 px las leyendas del aro se reducen a trazos ilegibles y compiten
  // con el emblema. Se conserva el metal y el aro azul, pero se simplifica el
  // troquel para que siga reconociéndose claramente como Moneda RepuesTop.
  const isCompact = size < 40;
  const logoWidth = size * (muestraWordmark ? 0.4 : isCompact ? 0.58 : 0.46);

  const etiqueta = esFrente
    ? `Moneda RepuesTop, cara frontal: ${COIN_LEGENDS.frontArc} ${COIN_LEGENDS.frontLabel}`
    : `Moneda RepuesTop, reverso: ${COIN_LEGENDS.backArc}. ${COIN_LEGENDS.backLabel} ${serial}`;

  return (
    <span
      className={`rt-coin ${className}`.trim()}
      style={{ width: size, height: size }}
      role="img"
      aria-label={etiqueta}
    >
      <svg width={size} height={size} viewBox="0 0 200 200" focusable="false">
        <defs>
          <linearGradient id={id('canto')} x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.28" stopColor="#cbd5e1" />
            <stop offset="0.52" stopColor="#8fa0b3" />
            <stop offset="0.76" stopColor="#cbd5e1" />
            <stop offset="1" stopColor="#f1f5f9" />
          </linearGradient>
          <linearGradient id={id('aroAzul')} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#2f6fd0" />
            <stop offset="0.45" stopColor="#0f4aa8" />
            <stop offset="1" stopColor="#1d5fc4" />
          </linearGradient>
          <linearGradient id={id('aroPlata')} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#f8fafc" />
            <stop offset="0.45" stopColor="#c3ced9" />
            <stop offset="1" stopColor="#e8edf3" />
          </linearGradient>
          <radialGradient id={id('disco')} cx="0.38" cy="0.3" r="0.85">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#f2f5f9" />
            <stop offset="1" stopColor="#d3dbe4" />
          </radialGradient>

          {/* Linea base del texto de arriba: semicircunferencia que pasa por el
              punto mas alto, recorrida de izquierda a derecha. */}
          <path
            id={id('arcoSuperior')}
            d={`M ${100 - ARC_TOP} 100 A ${ARC_TOP} ${ARC_TOP} 0 0 1 ${100 + ARC_TOP} 100`}
            fill="none"
          />
          {/* La de abajo va tambien de izquierda a derecha pero por el punto mas
              bajo (barrido 0): asi el texto queda derecho y crece hacia adentro.
              Con el barrido invertido salia de cabeza y fuera del anillo. */}
          <path
            id={id('arcoInferior')}
            d={`M ${100 - ARC_BOTTOM} 100 A ${ARC_BOTTOM} ${ARC_BOTTOM} 0 0 0 ${100 + ARC_BOTTOM} 100`}
            fill="none"
          />
        </defs>

        {/* Canto estriado */}
        <circle cx="100" cy="100" r={RIM} fill="#7f8c9b" />
        <Estriado radio={RIM} />
        <circle cx="100" cy="100" r={RIM - 4} fill={`url(#${id('canto')})`} />

        {/* Anillo de la leyenda */}
        <circle
          cx="100"
          cy="100"
          r={RING_OUTER}
          fill={esFrente ? `url(#${id('aroAzul')})` : `url(#${id('aroPlata')})`}
        />
        <circle
          cx="100"
          cy="100"
          r={RING_OUTER - 1}
          fill="none"
          stroke={esFrente ? 'rgba(255,255,255,0.35)' : '#b7c2ce'}
          strokeWidth="1.2"
        />

        {/* Arco fino decorativo dentro del anillo, como el troquelado real */}
        <path
          d={`M ${100 - RING_MID} 100 A ${RING_MID} ${RING_MID} 0 0 1 ${100 + RING_MID} 100`}
          fill="none"
          stroke={esFrente ? 'rgba(255,255,255,0.18)' : 'rgba(100,116,139,0.22)'}
          strokeWidth="0.8"
        />

        {/* Disco interior */}
        <circle cx="100" cy="100" r={RING_INNER} fill={`url(#${id('disco')})`} />
        <circle
          cx="100"
          cy="100"
          r={RING_INNER}
          fill="none"
          stroke={esFrente ? '#e8eef6' : '#c8d2dd'}
          strokeWidth="2.5"
        />
        <circle cx="100" cy="100" r={RING_INNER - 4} fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="0.8" />

        {esFrente ? (
          <>
            {!isCompact && <>
              <text fill="#ffffff" fontSize="17" fontWeight="bold" letterSpacing="4.2" textAnchor="middle">
                <textPath href={`#${id('arcoSuperior')}`} startOffset="50%">
                  {COIN_LEGENDS.frontArc}
                </textPath>
              </text>

              <text fill="#dbe4ef" fontSize="16" fontWeight="bold" letterSpacing="6" textAnchor="middle">
                <textPath href={`#${id('arcoInferior')}`} startOffset="50%">
                  {COIN_LEGENDS.frontLabel}
                </textPath>
              </text>

              <Estrella cx={100 - RING_MID} cy={100} r={7} fill="#eef2f7" />
              <Estrella cx={100 + RING_MID} cy={100} r={7} fill="#eef2f7" />
            </>}
          </>
        ) : (
          <>
            <text fill="#5b6a7d" fontSize="9.5" fontWeight="bold" letterSpacing="0.35" textAnchor="middle">
              <textPath href={`#${id('arcoSuperior')}`} startOffset="50%">
                {COIN_LEGENDS.backArc}
              </textPath>
            </text>

            <g>
              <Estrella cx={84} cy={134} r={3.4} fill="#9aa8b8" />
              <Estrella cx={100} cy={134} r={3.4} fill="#9aa8b8" />
              <Estrella cx={116} cy={134} r={3.4} fill="#9aa8b8" />
            </g>

            <text x="100" y="153" fill="#41505f" fontSize="13" fontWeight="bold" letterSpacing="1" textAnchor="middle">
              {COIN_LEGENDS.backLabel}
            </text>

            <rect x="60" y="160" width="80" height="15" rx="7.5" fill="#12377e" />
            <text x="100" y="170.5" fill="#ffffff" fontSize="8" fontWeight="bold" letterSpacing="0.9" textAnchor="middle">
              {`★ ${serial} ★`}
            </text>
          </>
        )}
      </svg>

      {/* Emblema y nombre de la marca, como en el troquel: el dibujo arriba y
          "RepuesTop" debajo. Van en HTML y no dentro del <svg> para que el
          wordmark sea texto real y el emblema use el PNG oficial de la marca.
          En el reverso van atenuados, imitando el relieve grabado en el metal
          en vez de una impresion a color. */}
      <span
        className="rt-coin-center"
        style={{
          opacity: esFrente ? 1 : 0.5,
          marginTop: esFrente ? 0 : -size * 0.09
        }}
      >
        <img
          src="/repuestop_icon.png"
          alt=""
          aria-hidden="true"
          style={{ width: logoWidth, height: logoWidth * 0.55 }}
        />
        {muestraWordmark && (
          <span
            className={`rt-coin-wordmark ${esFrente ? '' : 'is-grabado'}`.trim()}
            style={{ fontSize: size * 0.108, lineHeight: `${size * 0.128}px` }}
          >
            Repues<span className="rt-coin-wordmark-accent">Top</span>
          </span>
        )}
      </span>
    </span>
  );
}
