import React from 'react';

/** Contador de caracteres: el limite se ve desde el inicio y pasa a ambar al acercarse al tope. */
export default function CharCount({ value, max }) {
  const length = value.length;
  return <small className={`ft-count ${length >= max * 0.9 ? 'is-near' : ''}`} aria-live="off">{length}/{max}</small>;
}
