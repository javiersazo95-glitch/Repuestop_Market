import React from 'react';
import { Disc3, Cog, ArrowUpDown, Lightbulb, Droplets, Zap, CarFront, CircleDot, Package, Wind, ThermometerSun, KeyRound, Fuel, Gauge, CircleGauge, Recycle, GitFork, Layers, Filter, Cable, Snowflake, Radar, Box } from 'lucide-react';

const ICONS = { Disc3, Cog, ArrowUpDown, Lightbulb, Droplets, Zap, CarFront, CircleDot, Wind, ThermometerSun, KeyRound, Fuel, Gauge, CircleGauge, Recycle, GitFork, Layers, Filter, Cable, Snowflake, Radar, Box };

// Darkens a #rrggbb hex color by a given amount (0-1), used for the flat
// gradient fallback when no reference photo is available for a category.
function darken(hex, amount = 0.35) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((num >> 16) & 255) * (1 - amount));
  const g = Math.round(((num >> 8) & 255) * (1 - amount));
  const b = Math.round((num & 255) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Visual for a category/product/part: a real reference photo (via `image`
 * from src/data/categories.js) with a small colored badge carrying that
 * category's icon in the corner, so the tile stays instantly scannable and
 * colorful even when the photo itself is dark. Falls back to a flat colored
 * gradient + centered icon when no photo is available for that category.
 */
export default function CategoryIconTile({ iconName, color = '#0066ff', image, size = 32, className = '' }) {
  const Icon = ICONS[iconName] || Package;

  if (image) {
    return (
      <div className={`category-icon-tile has-photo ${className}`}>
        <img src={image} alt="" className="category-tile-photo" loading="lazy" />
        <span className="category-tile-badge" style={{ background: color }}>
          <Icon size={Math.round(size * 0.55)} strokeWidth={1.8} />
        </span>
      </div>
    );
  }

  return (
    <div
      className={`category-icon-tile ${className}`}
      style={{ background: `linear-gradient(135deg, ${color} 0%, ${darken(color)} 100%)` }}
    >
      <Icon size={size} strokeWidth={1.6} />
    </div>
  );
}
