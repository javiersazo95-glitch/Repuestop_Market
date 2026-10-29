import React, { useEffect, useMemo, useRef } from 'react';
import RepuestopCoin from './RepuestopCoin';

/**
 * Lluvia de Monedas RepuesTop para confirmar que la recarga quedo acreditada.
 *
 * Port de `mobile/components/ads/CoinDropAnimation.tsx` (monorepo `fae41ed`).
 *
 * Cada moneda cae con su propio retardo, velocidad y deriva lateral, y gira sobre
 * su eje vertical: el giro alterna cara y reverso, que es lo que hace que se lea
 * como una moneda real y no como una calcomania bajando. El truco del giro es
 * montar las dos caras superpuestas, rotar el reverso 180 grados y esconder con
 * `backface-visibility` la que queda de espaldas.
 *
 * En la web la animacion es CSS y no JS: el navegador la corre en el compositor,
 * asi que la caida no compite con el render de React ni se traba mientras el
 * modal se esta acomodando. La unica parte en JS es el temporizador que avisa
 * cuando termino, porque la fase siguiente depende de eso.
 *
 * Es puramente decorativa: no recibe clics (`pointer-events: none`).
 */

const DEFAULT_DURATION = 3000;

/**
 * Pseudo-aleatorio estable por indice: sin esto cada re-render repartiria las
 * monedas de nuevo y la lluvia saltaria a mitad de camino.
 */
function aleatorio(indice, semilla) {
  const x = Math.sin((indice + 1) * semilla) * 10000;
  return x - Math.floor(x);
}

export default function CoinDropAnimation({
  active,
  count = 9,
  minSize = 66,
  maxSize = 118,
  totalDuration = DEFAULT_DURATION,
  onFinish
}) {
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const monedas = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      key: `moneda-${i}`,
      // Se reparten en carriles para que no se amontonen en una franja.
      left: ((i + aleatorio(i, 12.9898) * 0.8) / count) * 100,
      size: minSize + aleatorio(i, 78.233) * (maxSize - minSize),
      delay: aleatorio(i, 43.512) * totalDuration * 0.35,
      duration: totalDuration * (0.5 + aleatorio(i, 93.717) * 0.3),
      giros: 2 + Math.floor(aleatorio(i, 27.611) * 3),
      deriva: (aleatorio(i, 55.301) - 0.5) * 90,
      balanceo: (aleatorio(i, 31.42) - 0.5) * 34
    })),
    [count, maxSize, minSize, totalDuration]
  );

  useEffect(() => {
    if (!active) return undefined;
    const id = setTimeout(() => onFinishRef.current?.(), totalDuration);
    return () => clearTimeout(id);
  }, [active, totalDuration]);

  if (!active) return null;

  return (
    <div className="coin-rain" aria-hidden="true">
      {monedas.map((moneda) => (
        <span
          key={moneda.key}
          className="coin-rain-item"
          style={{
            left: `${moneda.left}%`,
            '--coin-size': `${moneda.size}px`,
            '--coin-delay': `${moneda.delay}ms`,
            '--coin-dur': `${moneda.duration}ms`,
            '--coin-giro': `${moneda.giros * 360}deg`,
            '--coin-deriva': `${moneda.deriva}px`,
            '--coin-balanceo': `${moneda.balanceo}deg`
          }}
        >
          <span className="coin-rain-flip">
            <span className="coin-rain-face">
              <RepuestopCoin size={moneda.size} face="front" />
            </span>
            <span className="coin-rain-face is-back">
              <RepuestopCoin size={moneda.size} face="back" />
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
