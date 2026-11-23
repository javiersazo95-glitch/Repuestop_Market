import React from 'react';
import { Info, RefreshCw, ShieldCheck, Sparkles, History } from 'lucide-react';
import { conditionLabel, preOwnedNotice, toProductCondition } from '../data/productConditions';
import '../styles/product-condition.css';

const ICONS = { ORIGINAL: ShieldCheck, ALTERNATIVO: Sparkles, USADO: History, REACONDICIONADO: RefreshCw };

/** Etiqueta con la condición del repuesto, sobre la foto (ficha y tarjetas). */
export function ConditionBadge({ condition, compact = false, className = '' }) {
  const value = toProductCondition(condition);
  const Icon = ICONS[value] || ShieldCheck;
  return (
    <span className={`pcond-badge is-${(value || 'nuevo').toLowerCase()}${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}>
      <Icon size={compact ? 11 : 14} aria-hidden="true" /> {conditionLabel(condition)}
    </span>
  );
}

/** Aviso informativo de la ficha: quién responde por un repuesto usado o reacondicionado. */
export function PreOwnedNotice({ condition, storeName }) {
  const notice = preOwnedNotice(condition, storeName);
  if (!notice) return null;
  return (
    <div className="pcond-notice" role="note">
      <Info size={17} aria-hidden="true" />
      <span><strong>{notice.title}.</strong> {notice.text}</span>
    </div>
  );
}
