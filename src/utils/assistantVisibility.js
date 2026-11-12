/**
 * "Que Repuestín te recomiende" (vista de la tienda): etiquetas, textos y cálculos sin vistas.
 * Copia de `mobile/utils/assistant-visibility.ts` de la app.
 */

export const PART_TYPE_LABELS = {
  ORIGINAL: 'Originales',
  ALTERNATIVO: 'Alternativos',
  USADO: 'Usados o de desarme',
};

/** "Repuestos originales y alternativos" (la misma etiqueta que arma el backend en el ranking). */
export function partTypesLabel(types) {
  const ordered = ['ORIGINAL', 'ALTERNATIVO', 'USADO'].filter((type) => types.includes(type));
  if (ordered.length === 0) return null;
  const names = ordered.map((type) => PART_TYPE_LABELS[type].toLowerCase());
  const text = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  return `Repuestos ${text}`;
}

function lowerFirst(text) {
  const clean = String(text || '').trim();
  if (clean.length > 1 && clean[1] === clean[1].toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(clean[1])) return clean;
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}

/** Las razones con que Repuestín presentaría hoy a la tienda (vista previa de su tarjeta). */
export function previewReasons({ specialties, brands, shipsOutside, isNew, answered, received, medianMinutes }) {
  const reasons = [];
  const firstPart = specialties.subcategorias[0]?.nombre;
  const firstCategory = specialties.categorias[0]?.nombre;
  if (firstPart || firstCategory) reasons.push(`Trabaja ${lowerFirst(firstPart ?? firstCategory ?? '')}`);
  if (brands.length > 0) reasons.push(`Es especialista en ${brands[0]}`);
  if (received >= 3 && answered / received >= 0.8 && medianMinutes != null && medianMinutes <= 120) {
    reasons.push(medianMinutes <= 30 ? 'Responde en minutos' : 'Responde en menos de 2 h');
  }
  if (specialties.consiguePorEncargo) {
    const days = specialties.diasEncargo;
    reasons.push(`Consigue repuestos por encargo${days ? ` (${days} ${days === 1 ? 'día' : 'días'})` : ''}`);
  }
  if (shipsOutside) reasons.push('Despacha a tu comuna');
  if (isNew && (firstPart || firstCategory)) reasons.push('Tienda nueva en RepuesTop');
  const types = partTypesLabel(specialties.tiposRepuesto);
  if (types) reasons.push(types);
  return reasons;
}

/** Afinidad que mostraría la tarjeta con lo declarado (aprox. a los umbrales del ranking del backend). */
export function previewAffinity(specialties, brands) {
  const score = (specialties.subcategorias.length > 0 ? 28 : specialties.categorias.length > 0 ? 12 : 0)
    + (brands.length > 0 ? 35 : 0)
    + (specialties.consiguePorEncargo ? 6 : 0);
  return score >= 70 ? 'ALTA' : score >= 40 ? 'MEDIA' : 'POSIBLE';
}

/** Color del % de respuesta: verde (≥80%), ámbar (≥50%), rojo; sin historial no se califica. */
export function responseRateTone(answered, received) {
  if (received < 3) return 'none';
  const rate = answered / received;
  return rate >= 0.8 ? 'good' : rate >= 0.5 ? 'fair' : 'poor';
}

/** Color del tiempo de respuesta: verde (≤2 h), ámbar (≤12 h), rojo. */
export function responseTimeTone(minutes) {
  if (minutes == null) return 'none';
  return minutes <= 120 ? 'good' : minutes <= 720 ? 'fair' : 'poor';
}

/** "15 min", "2 h", "1 día". */
export function formatMinutes(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return '—';
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'día' : 'días'}`;
}

/** Consejo de Repuestín según cómo responde la tienda. */
export function responseTip(answered, received, minutes) {
  if (received < 3) return 'Responde rápido tus primeras consultas: Repuestín premia a las tiendas que contestan.';
  const rateTone = responseRateTone(answered, received);
  if (rateTone === 'poor') return 'Estás dejando consultas sin responder. Aunque no lo tengas, toca «No lo tengo»: también cuenta.';
  if (rateTone === 'fair') return 'Vas bien. Responde todas las consultas para subir en las recomendaciones.';
  if (responseTimeTone(minutes) !== 'good') return 'Respondes casi todo. Si contestas en menos de 2 h, Repuestín te sube aún más.';
  return '¡Excelente! Respondes rápido y Repuestín te recomienda primero.';
}

export function missingStepsLabel(missing) {
  return missing === 1 ? 'Te falta 1 paso' : `Te faltan ${missing} pasos`;
}

export const STEP_ORDER = ['REPUESTOS', 'MARCAS', 'CONSIGUE', 'ENVIOS'];

/** Cada paso con su color propio (`components/assistant/visibility/visibility-theme.ts`). */
export const STEP_META = {
  REPUESTOS: {
    title: '¿Qué repuestos trabajas?',
    benefit: 'Repuestín te recomienda cuando buscan justo eso, aunque no lo tengas publicado.',
    main: '#0066ff', text: '#0052cc', soft: '#eaf2ff', border: '#bfd6f7',
  },
  MARCAS: {
    title: '¿Para qué marcas?',
    benefit: 'Apareces primero cuando el comprador tiene un auto de tu marca.',
    main: '#6B4EFF', text: '#5B3AD6', soft: '#F3F0FF', border: '#DDD6FE',
  },
  CONSIGUE: {
    title: '¿Cómo los consigues?',
    benefit: 'Si consigues por encargo, te llegan también las búsquedas de lo que no tienes en stock.',
    main: '#F59E0B', text: '#9a5a00', soft: '#fff7e6', border: '#fde3a7',
  },
  ENVIOS: {
    title: '¿Cómo entregas?',
    benefit: 'Si despachas, Repuestín te muestra también a compradores de otras comunas.',
    main: '#18A957', text: '#0e7038', soft: '#eafbf1', border: '#bbf7d0',
  },
};

export const STEP_SHORT = { REPUESTOS: 'Repuestos', MARCAS: 'Marcas', CONSIGUE: 'Encargos', ENVIOS: 'Envíos' };

/** Agrupa las búsquedas perdidas por rubro: primero lo que le falta registrar (más buscado arriba). */
export function groupLostSearches(visibility, categories, parts) {
  const groups = new Map();
  for (const rubro of visibility.rubrosPerdidos || []) {
    groups.set(rubro.categoriaId, { categoriaId: rubro.categoriaId, nombre: rubro.nombre, cantidad: rubro.cantidad, repuestos: [], added: false });
  }
  for (const part of visibility.repuestosPerdidos ?? []) {
    let group = groups.get(part.categoriaId);
    if (!group) {
      group = { categoriaId: part.categoriaId, nombre: part.categoriaNombre, cantidad: 0, repuestos: [], added: false };
      groups.set(part.categoriaId, group);
    }
    group.repuestos.push({ id: part.subcategoriaId, nombre: part.nombre, cantidad: part.cantidad, added: false });
  }
  const list = [...groups.values()].map((group) => {
    const whole = categories.has(group.categoriaId);
    const repuestos = group.repuestos
      .map((r) => ({ ...r, added: whole || parts.has(r.id) }))
      .sort((a, b) => Number(a.added) - Number(b.added) || b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));
    const cantidad = group.cantidad || Math.max(0, ...repuestos.map((r) => r.cantidad));
    const added = whole || (repuestos.length > 0 && repuestos.every((r) => r.added));
    return { ...group, cantidad, repuestos, added };
  });
  return list.sort((a, b) => Number(a.added) - Number(b.added) || b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));
}

const normalize = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function matchesLostSearch(group, query) {
  const q = normalize(query);
  if (!q) return true;
  return normalize(group.nombre).includes(q) || group.repuestos.some((r) => normalize(r.nombre).includes(q));
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2 nov" desde "2026-11-02", sin pasar por zonas horarias. */
export function shortDate(iso) {
  const [, month, day] = String(iso || '').split('-').map(Number);
  return month && day ? `${day} ${MONTHS[month - 1]}` : iso;
}

/** "Lun 2 nov – dom 8 nov". */
export function weekLabel(ranking) {
  return `Lun ${shortDate(ranking.semanaDesde)} – dom ${shortDate(ranking.semanaHasta)}`;
}

/** "nov 2025" desde "2025-11". */
export function sinceLabel(value) {
  if (!value) return null;
  const [year, month] = String(value).split('-').map(Number);
  return year && month ? `${MONTHS[month - 1]} ${year}` : null;
}

function shortDelivery(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('retiro')) return 'Retiro en tienda';
  if (l.includes('fuera')) return 'Despacho a otras comunas';
  if (l.includes('dentro')) return 'Despacho en su comuna';
  return label;
}

/** Lo registrado por la tienda, de lo que más ayuda a decidir a lo que menos; solo lo que tiene. */
export function storeFacts(ficha) {
  const facts = [];
  if (ficha.especialidades?.length > 0) {
    const shown = ficha.especialidades.slice(0, 3);
    const rest = ficha.especialidades.length - shown.length;
    facts.push({ key: 'trabaja', icon: 'wrench', label: 'Trabaja', text: `${shown.join(', ')}${rest > 0 ? ` y ${rest} más` : ''}` });
  }
  if (ficha.marcas?.length > 0) facts.push({ key: 'marcas', icon: 'car', label: 'Especialista en', text: ficha.marcas.join(', ') });
  if (ficha.tasaRespuesta != null) {
    facts.push({
      key: 'responde', icon: 'zap', label: 'Responde',
      text: `${ficha.tasaRespuesta}% de las consultas${ficha.minutosRespuesta != null ? ` · en ${formatMinutes(ficha.minutosRespuesta)}` : ''}`,
    });
  }
  if (ficha.entregas?.length > 0) facts.push({ key: 'entrega', icon: 'bike', label: 'Entrega', text: ficha.entregas.map(shortDelivery).join(' · ') });
  if (ficha.consiguePorEncargo) {
    const days = ficha.diasEncargo;
    facts.push({ key: 'encargo', icon: 'package', label: 'Por encargo', text: days ? `Lo consigue en ~${days} ${days === 1 ? 'día' : 'días'}` : 'Consigue lo que no tiene en stock' });
  }
  if (ficha.tiposRepuesto) facts.push({ key: 'tipos', icon: 'ribbon', label: 'Vende', text: String(ficha.tiposRepuesto).replace(/^Repuestos /, '') });
  if (ficha.repuestosPublicados > 0) {
    facts.push({ key: 'catalogo', icon: 'tags', label: 'Catálogo', text: `${ficha.repuestosPublicados} ${ficha.repuestosPublicados === 1 ? 'repuesto publicado' : 'repuestos publicados'}` });
  }
  if (ficha.horario) facts.push({ key: 'horario', icon: 'clock', label: 'Atiende', text: ficha.horario });
  return facts;
}

/** "Registrado para que Repuestín te recomiende" = declaró al menos un rubro o repuesto. */
export function isRegisteredForAssistant(visibility) {
  return (visibility?.pasos || []).some((step) => step.clave === 'REPUESTOS' && step.completo);
}
