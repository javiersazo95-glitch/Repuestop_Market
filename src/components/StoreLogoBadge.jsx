import React from 'react';

const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#0891b2', '#6366f1', '#a855f7', '#ec4899'];

function getInitials(name) {
  const words = name.replace(/^(Autopartes|Desarmaduría|Importadora)\s+/i, '').trim().split(/\s+/);
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/**
 * Colorful lettermark "logo" for a store/seller that has no real uploaded
 * logo (these are demo sellers) — a colored badge with its initials,
 * the same pattern Slack/Notion use for workspaces without an avatar.
 * `seed` picks a stable color from the palette (e.g. the store id or index).
 */
export default function StoreLogoBadge({ name, seed = 0, size = 56, className = '' }) {
  const index = typeof seed === 'number' ? seed : String(seed).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const color = PALETTE[index % PALETTE.length];

  return (
    <div
      className={`store-logo-badge ${className}`}
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
    >
      {getInitials(name)}
    </div>
  );
}
