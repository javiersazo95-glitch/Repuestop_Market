import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Car, Check, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Clock, Eye, Flag, Gauge, Loader2, Lock, MessagesSquare,
  Package, PlusCircle, Rocket, Sparkles, Store, Tags, Trophy, Wrench, Zap, CheckCheck, ChartNoAxesColumn,
} from 'lucide-react';
import { loadAssistantVisibility, loadWeeklyRanking, saveStoreSpecialties } from '../../../services/assistantApi';
import { syncAssistantReminder } from '../../../utils/assistantReminder';
import {
  PART_TYPE_LABELS, STEP_META, STEP_ORDER, formatMinutes, groupLostSearches, missingStepsLabel, partTypesLabel, previewAffinity,
  previewReasons, responseRateTone, responseTimeTone, responseTip, weekLabel,
} from '../../../utils/assistantVisibility';
import { RepuestinAvatar } from '../AssistantBits';
import RecommendedStoreCard from '../RecommendedStoreCard';
import { Chip, LostSearchesCard, PartsPicker, ProgressRing, RankingSuggestions, RecommendationPodium } from './VisibilityParts';
import WeeklyRankingSheet from './WeeklyRankingSheet';
import { STEP_ICONS } from './AssistantReminder';
import '../../../styles/assistant.css';
import '../../../styles/assistant-visibility.css';

const ENCARGO_DIAS = [2, 5, 7, 15];
const AFFINITY = {
  ALTA: { label: 'Muy probable', place: 1 },
  MEDIA: { label: 'Probable', place: 2 },
  POSIBLE: { label: 'Posible', place: 3 },
};

/** Qué mira Repuestín para armar su podio, de más a menos peso (igual que RankingTiendasRepuesto del backend). */
const FACTORS = [
  { Icon: Tags, label: 'Lo que publicas', detail: 'Repuestos activos de lo que buscan', weight: 1 },
  { Icon: Wrench, label: 'Lo que declaras aquí', detail: 'Rubros y repuestos que trabajas', weight: 0.85 },
  { Icon: Car, label: 'Marca especialista', detail: 'El auto del comprador es de tu marca', weight: 0.85 },
  { Icon: Zap, label: 'Respondes rápido', detail: 'Contestas sus consultas en menos de 2 h', weight: 0.4 },
  { Icon: Package, label: 'Encargos y despacho', detail: 'Consigues lo que falta y llegas a su comuna', weight: 0.3 },
];

const TONE_CLASS = { good: 'is-good', fair: 'is-fair', poor: 'is-poor', none: 'is-none' };

function Metric({ label, value, tone, Icon }) {
  return (
    <div className={`rv-metric ${TONE_CLASS[tone]}`}>
      <Icon size={16} />
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function StepSummary({ stepKey, data, specialties }) {
  let text;
  if (stepKey === 'REPUESTOS') {
    const names = [...specialties.categorias.map((c) => c.nombre), ...specialties.subcategorias.map((s) => s.nombre)];
    text = names.length > 0 ? `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` y ${names.length - 3} más` : ''}` : 'Toca para elegir tus rubros';
  } else if (stepKey === 'MARCAS') {
    text = data.marcas.length > 0 ? data.marcas.slice(0, 3).join(', ') + (data.marcas.length > 3 ? ` y ${data.marcas.length - 3} más` : '') : 'Toca para elegir tus marcas';
  } else if (stepKey === 'CONSIGUE') {
    const parts = [specialties.consiguePorEncargo ? 'Por encargo' : null, ...specialties.tiposRepuesto.map((t) => PART_TYPE_LABELS[t])].filter(Boolean);
    text = parts.length > 0 ? parts.join(' · ') : 'Toca para contarnos cómo los consigues';
  } else {
    text = data.pasos.find((s) => s.clave === 'ENVIOS')?.completo ? 'Métodos de envío configurados' : 'Toca para configurar tus envíos';
  }
  return <small className="rv-step-summary">{text}</small>;
}

/**
 * "Que Repuestín te recomiende" (`app/(seller)/tienda-asistente.tsx`): la tienda cuenta qué repuestos trabaja, para
 * qué marcas, cómo los consigue y cómo entrega. Repuestín recomienda solo 3 casas por búsqueda (su podio) y lo
 * declarado aquí suma desde que se guarda. Si sale con cambios sin guardar, se guardan solos.
 * Celular: la misma pantalla de la app. Escritorio: dos columnas (ruta al podio a la izquierda, vista previa y
 * desempeño a la derecha).
 */
export default function AssistantVisibilityScreen({ sellerId, storeName, storePhoto, isMobile, welcome = false, onOpenTab, onOpenFiltered, onLater }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ranking, setRanking] = useState(null);
  const [rankingOpen, setRankingOpen] = useState(false);

  const [categories, setCategories] = useState(new Map());
  const [parts, setParts] = useState(new Map());
  const [onDemand, setOnDemand] = useState(false);
  const [days, setDays] = useState(null);
  const [types, setTypes] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [openStep, setOpenStep] = useState(null);
  const [focus, setFocus] = useState(null);
  const hydrated = useRef(false);
  const stepRefs = useRef(new Map());

  const reload = useCallback(async () => {
    if (!sellerId) { setLoading(false); return; }
    try {
      const next = await loadAssistantVisibility(sellerId);
      syncAssistantReminder(sellerId, next);
      setData(next);
      setError('');
    } catch (err) {
      setError(err?.message || 'No pudimos cargar tu perfil para Repuestín.');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  const reloadRanking = useCallback(async () => {
    if (!sellerId) return;
    try { setRanking(await loadWeeklyRanking(sellerId)); } catch { /* el ranking es un extra */ }
  }, [sellerId]);

  useEffect(() => { void reload(); void reloadRanking(); }, [reload, reloadRanking]);

  useEffect(() => {
    if (!data || (hydrated.current && dirty)) return;
    const s = data.especialidades || { categorias: [], subcategorias: [], consiguePorEncargo: false, tiposRepuesto: [] };
    setCategories(new Map((s.categorias || []).map((c) => [c.id, c.nombre])));
    setParts(new Map((s.subcategorias || []).map((p) => [p.id, { id: p.id, nombre: p.nombre, categoriaId: p.categoriaId ?? 0 }])));
    setOnDemand(Boolean(s.consiguePorEncargo));
    setDays(s.diasEncargo ?? null);
    setTypes(s.tiposRepuesto || []);
    if (!hydrated.current) {
      hydrated.current = true;
      setOpenStep(data.pasos.find((step) => !step.completo)?.clave ?? null);
    }
  }, [data, dirty]);

  useEffect(() => {
    if (!savedAt) return undefined;
    const timer = setTimeout(() => setSavedAt(null), 4000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const specialties = useMemo(() => ({
    categorias: [...categories].map(([id, nombre]) => ({ id, nombre })),
    subcategorias: [...parts.values()].map((p) => ({ id: p.id, nombre: p.nombre, categoriaId: p.categoriaId })),
    consiguePorEncargo: onDemand,
    diasEncargo: onDemand ? days : null,
    tiposRepuesto: types,
  }), [categories, parts, onDemand, days, types]);

  const input = useMemo(() => ({
    categoriaIds: [...categories.keys()],
    subcategoriaIds: [...parts.keys()],
    consiguePorEncargo: onDemand,
    diasEncargo: onDemand ? days : null,
    tiposRepuesto: types,
  }), [categories, parts, onDemand, days, types]);

  // Al salir con cambios sin guardar, se guardan solos (como al perder el foco en la app).
  const pending = useRef({ dirty, input, sellerId });
  pending.current = { dirty, input, sellerId };
  useEffect(() => () => {
    const { dirty: hasChanges, input: last, sellerId: id } = pending.current;
    if (!hasChanges || !id) return;
    saveStoreSpecialties(id, last).then((saved) => syncAssistantReminder(id, saved)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const liveDone = useMemo(() => {
    const done = new Set(data?.pasos.filter((s) => s.completo).map((s) => s.clave) ?? []);
    if (categories.size > 0 || parts.size > 0) done.add('REPUESTOS'); else done.delete('REPUESTOS');
    if (types.length > 0) done.add('CONSIGUE'); else done.delete('CONSIGUE');
    return done;
  }, [data, categories, parts, types]);
  const progress = Math.round((liveDone.size / STEP_ORDER.length) * 100);
  const missing = STEP_ORDER.length - liveDone.size;
  const complete = missing === 0;
  const registered = liveDone.has('REPUESTOS');

  const markDirty = () => setDirty(true);
  const toggleCategory = (category) => {
    setCategories((current) => {
      const next = new Map(current);
      if (next.has(category.id)) next.delete(category.id); else next.set(category.id, category.nombre);
      return next;
    });
    markDirty();
  };
  const togglePart = (part) => {
    setParts((current) => {
      const next = new Map(current);
      if (next.has(part.id)) next.delete(part.id); else next.set(part.id, part);
      return next;
    });
    markDirty();
  };
  const toggleType = (type) => {
    setTypes((current) => (current.includes(type) ? current.filter((t) => t !== type) : [...current, type]));
    markDirty();
  };

  const nextPending = (after, done) => STEP_ORDER.slice(STEP_ORDER.indexOf(after) + 1).concat(STEP_ORDER).find((key) => !done.has(key)) ?? null;

  const save = async (from) => {
    if (!sellerId) return;
    setSaving(true);
    setSaveError('');
    try {
      const saved = await saveStoreSpecialties(sellerId, input);
      setDirty(false);
      setData(saved);
      syncAssistantReminder(sellerId, saved);
      setSavedAt(Date.now());
      void reloadRanking();
      if (from) {
        const done = new Set(saved.pasos.filter((s) => s.completo).map((s) => s.clave));
        setOpenStep(nextPending(from, done));
      }
    } catch (err) {
      setSaveError(err?.message || 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const focusLostCategory = (categoryId) => {
    setOpenStep('REPUESTOS');
    setFocus({ categoryId, nonce: Date.now() });
  };
  const goToStep = (key) => {
    setOpenStep(key);
    setTimeout(() => stepRefs.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  };

  // Cada sugerencia de Repuestín lleva directo a completarla.
  const onSuggestion = (suggestion) => {
    setRankingOpen(false);
    switch (suggestion.accion) {
      case 'CATEGORIA':
        if (suggestion.categoriaId) focusLostCategory(suggestion.categoriaId); else goToStep('REPUESTOS');
        break;
      case 'REPUESTOS':
      case 'CONSIGUE':
        goToStep(suggestion.accion);
        break;
      case 'MARCAS': onOpenTab('tienda_marcas'); break;
      case 'ENVIOS': onOpenTab('tienda_envios'); break;
      case 'MENSAJES': onOpenFiltered('cotizaciones', 'pending'); break;
      case 'PRODUCTOS': onOpenTab('productos'); break;
      default: break;
    }
  };

  const lostGroups = useMemo(() => (data ? groupLostSearches(data, categories, parts) : []), [data, categories, parts]);
  const demand = useMemo(() => ({
    byCategory: new Map((data?.rubrosPerdidos ?? []).map((r) => [r.categoriaId, r.cantidad])),
    byPart: new Map((data?.repuestosPerdidos ?? []).map((r) => [r.subcategoriaId, r.cantidad])),
  }), [data]);

  if (loading && !data) {
    return <div className="rv-screen rv-center-screen"><Loader2 size={32} className="ra-spin rv-primary" /></div>;
  }
  if (!data) {
    return (
      <div className="rv-screen rv-center-screen">
        <RepuestinAvatar size={56} />
        <strong>{error || 'No pudimos cargar tu perfil para Repuestín.'}</strong>
        <button type="button" className="ra-btn ra-btn-primary" onClick={() => { setLoading(true); void reload(); }}>Reintentar</button>
      </div>
    );
  }

  const reasons = previewReasons({
    specialties, brands: data.marcas, shipsOutside: data.despachaFueraDeComuna, isNew: data.tiendaNueva,
    answered: data.metricas.respondidas, received: data.metricas.recibidas, medianMinutes: data.metricas.minutosMediana,
  });
  const affinityKey = previewAffinity(specialties, data.marcas);
  const affinity = AFFINITY[affinityKey];
  const name = storeName || 'Tu tienda';
  const podiumPlace = registered ? affinity.place : null;
  const baseFicha = data.ficha ?? {
    especialidades: [], marcas: [], consiguePorEncargo: false, entregas: [], cantidadOpiniones: 0, repuestosPublicados: 0, tiendaNueva: data.tiendaNueva, fundadora: false,
  };
  const liveFicha = {
    ...baseFicha,
    especialidades: [...specialties.subcategorias.map((p) => p.nombre), ...specialties.categorias.map((c) => `Todo ${c.nombre.toLowerCase()}`)].slice(0, 6),
    marcas: data.marcas.slice(0, 4),
    tiposRepuesto: partTypesLabel(types),
    consiguePorEncargo: onDemand,
    diasEncargo: onDemand ? days : null,
  };
  const missingFicha = [
    liveFicha.especialidades.length === 0 ? { key: 'rep', label: 'Qué trabajas', onPress: () => goToStep('REPUESTOS') } : null,
    liveFicha.marcas.length === 0 ? { key: 'mar', label: 'Tus marcas', onPress: () => onOpenTab('tienda_marcas') } : null,
    liveFicha.entregas.length === 0 ? { key: 'env', label: 'Cómo entregas', onPress: () => onOpenTab('tienda_envios') } : null,
    !liveFicha.tiposRepuesto ? { key: 'tip', label: 'Qué tipo vendes', onPress: () => goToStep('CONSIGUE') } : null,
    !liveFicha.consiguePorEncargo ? { key: 'enc', label: 'Si consigues por encargo', onPress: () => goToStep('CONSIGUE') } : null,
    !liveFicha.horario ? { key: 'hor', label: 'Tu horario', onPress: () => onOpenTab('tienda_datos') } : null,
    liveFicha.repuestosPublicados === 0 ? { key: 'cat', label: 'Repuestos publicados', onPress: () => onOpenTab('productos') } : null,
  ].filter(Boolean);
  const myPosition = ranking?.miTienda?.posicion ?? null;

  const hero = (
    <section className="rv-hero">
      <div className="rv-hero-top">
        <div className="rv-hero-copy">
          <span className="rv-eyebrow"><RepuestinAvatar size={20} /> {welcome ? '¡Bienvenido a RepuesTop!' : 'Repuestín · Recomendaciones'}</span>
          <h1>Que Repuestín te recomiende</h1>
          <p>{complete ? 'Tu perfil está completo: Repuestín ya te considera para su podio.' : 'Cuando un comprador no encuentra un repuesto, Repuestín le recomienda solo 3 casas. Sube al podio.'}</p>
        </div>
        <ProgressRing value={progress} size={isMobile ? 92 : 104} stroke={9} caption={complete ? 'listo' : 'completo'} />
      </div>
      <div className="rv-podium-panel">
        <div className="rv-podium-head">
          <div>
            <strong>Podio de la semana</strong>
            {ranking && <small>{weekLabel(ranking)} · se reinicia el lunes</small>}
          </div>
          {ranking && <button type="button" className="rv-see-more" onClick={() => setRankingOpen(true)} aria-label="Ver más: ranking de la semana">Ver más <ChevronRight size={14} /></button>}
        </div>
        {ranking ? (
          <RecommendationPodium
            top={ranking.top.slice(0, 3).filter((row) => row.posicion && row.posicion <= 3).map((row) => ({ place: row.posicion, name: row.nombre, photo: row.foto, isMe: row.esMiTienda }))}
            storeName={name}
            storePhoto={storePhoto}
          />
        ) : <RecommendationPodium storePlace={podiumPlace} storeName={name} storePhoto={storePhoto} />}
        <div className="rv-my-place">
          {myPosition && myPosition <= 3 ? <Trophy size={13} /> : <Store size={13} />}
          <span>
            {!registered ? 'Sin registrar qué trabajas, Repuestín no puede elegirte.'
              : !ranking ? `Con lo que declaraste, Repuestín te ve como «${affinity.label.toLowerCase()}».`
                : myPosition
                  ? `Vas #${myPosition} de ${ranking.totalCasas ?? ranking.tiendasConDerivaciones} · ${ranking.miTienda.derivaciones > 0 ? `${ranking.miTienda.derivaciones} ${ranking.miTienda.derivaciones === 1 ? 'consulta' : 'consultas'} esta semana` : 'aún sin consultas esta semana'}`
                  : 'Tu tienda aún no aparece en el ranking: sigue las sugerencias de Repuestín.'}
          </span>
        </div>
      </div>
      <div className="rv-hero-pills">
        <span className="rv-hero-pill">{complete ? <CheckCircle2 size={14} /> : <Flag size={14} />}{complete ? 'Perfil completo' : `${missingStepsLabel(missing)} · menos de 2 min`}</span>
        {data.tiendaNueva && <span className="rv-hero-pill is-gold"><Rocket size={14} /> Impulso de tienda nueva: {data.diasImpulso} días</span>}
      </div>
    </section>
  );

  const route = (
    <section className="rv-route">
      <div className="rv-section-title"><h3>Tu ruta al podio</h3><small>{liveDone.size} de {STEP_ORDER.length} pasos</small></div>
      <div className="rv-timeline">
        {STEP_ORDER.map((key, index) => {
          const meta = STEP_META[key];
          const Icon = STEP_ICONS[key];
          const done = liveDone.has(key);
          const isOpen = openStep === key;
          const isLast = index === STEP_ORDER.length - 1;
          return (
            <div key={key} ref={(node) => { if (node) stepRefs.current.set(key, node); else stepRefs.current.delete(key); }} className="rv-timeline-row">
              <div className="rv-rail">
                <span className={`rv-node${isOpen ? ' is-open' : ''}`} style={{ background: done ? '#18A957' : meta.main }}>{done ? <Check size={16} /> : index + 1}</span>
                {!isLast && <span className={`rv-rail-line${done ? ' is-done' : ''}`} />}
              </div>
              <div className={`rv-step${isOpen ? ' is-open' : ''}`} style={{ borderColor: isOpen ? meta.main : done ? undefined : meta.border }}>
                <button type="button" className="rv-step-head" onClick={() => setOpenStep(isOpen ? null : key)} aria-expanded={isOpen} aria-label={`Paso ${index + 1}: ${meta.title}. ${done ? 'Listo' : 'Falta'}`}>
                  <span className="rv-step-icon" style={{ background: done ? '#eafbf1' : meta.soft, color: done ? '#18A957' : meta.main }}><Icon size={20} /></span>
                  <span className="rv-step-copy">
                    <strong>{meta.title}</strong>
                    {!isOpen && <StepSummary stepKey={key} data={data} specialties={specialties} />}
                  </span>
                  <span className="rv-status" style={done ? undefined : { background: meta.soft, color: meta.text }} data-done={done ? 'true' : undefined}>{done ? 'Listo' : 'Falta'}</span>
                  {isOpen ? <ChevronUp size={18} className="rv-muted" /> : <ChevronDown size={18} className="rv-muted" />}
                </button>
                {isOpen && (
                  <div className="rv-step-body">
                    <div className="rv-benefit" style={{ background: meta.soft, color: meta.text }}><Sparkles size={14} /><span>{meta.benefit}</span></div>
                    {key === 'REPUESTOS' && (
                      <>
                        <PartsPicker accent={meta} categories={categories} parts={parts} onToggleCategory={toggleCategory} onTogglePart={togglePart} focus={focus} demand={demand} />
                        <button type="button" className="ra-btn ra-btn-primary ra-btn-block" disabled={!dirty || saving} onClick={() => void save('REPUESTOS')}>{saving ? 'Guardando…' : 'Guardar y seguir'}</button>
                      </>
                    )}
                    {key === 'MARCAS' && (
                      <>
                        {data.marcas.length > 0 && (
                          <div className="rv-chips">
                            {data.marcas.map((brand) => <span key={brand} className="rv-tag" style={{ background: meta.soft, borderColor: meta.border, color: meta.text }}>{brand}</span>)}
                          </div>
                        )}
                        <button type="button" className={`ra-btn ra-btn-block ${data.marcas.length > 0 ? 'ra-btn-outline' : 'ra-btn-primary'}`} onClick={() => onOpenTab('tienda_marcas')}>
                          {data.marcas.length > 0 ? 'Cambiar marcas' : 'Elegir mis marcas'}
                        </button>
                      </>
                    )}
                    {key === 'CONSIGUE' && (
                      <>
                        <label className="rv-switch-row">
                          <span>
                            <strong>Consigo repuestos por encargo</strong>
                            <small>Aunque no lo tengas en stock, Repuestín te enviará la consulta.</small>
                          </span>
                          <input type="checkbox" className="rv-switch" style={{ '--rv-accent': meta.main }} checked={onDemand} onChange={(event) => { setOnDemand(event.target.checked); markDirty(); }} aria-label="Consigo repuestos por encargo" />
                        </label>
                        {onDemand && (
                          <div className="rv-sub-block">
                            <span className="rv-sub-label">¿En cuántos días sueles conseguirlos?</span>
                            <div className="rv-chips">
                              {ENCARGO_DIAS.map((value) => (
                                <Chip key={value} label={value === 2 ? '1–2 días' : value === 5 ? '3–5 días' : `${value} días`} selected={days === value} accent={meta} onPress={() => { setDays(days === value ? null : value); markDirty(); }} />
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="rv-sub-block">
                          <span className="rv-sub-label">¿Qué tipo de repuestos vendes?</span>
                          <div className="rv-chips">
                            {Object.keys(PART_TYPE_LABELS).map((type) => <Chip key={type} label={PART_TYPE_LABELS[type]} selected={types.includes(type)} accent={meta} onPress={() => toggleType(type)} />)}
                          </div>
                        </div>
                        <button type="button" className="ra-btn ra-btn-primary ra-btn-block" disabled={!dirty || saving} onClick={() => void save('CONSIGUE')}>{saving ? 'Guardando…' : 'Guardar y seguir'}</button>
                      </>
                    )}
                    {key === 'ENVIOS' && (
                      <button type="button" className={`ra-btn ra-btn-block ${done ? 'ra-btn-outline' : 'ra-btn-primary'}`} onClick={() => onOpenTab('tienda_envios')}>
                        {done ? 'Cambiar métodos de envío' : 'Configurar envíos'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const preview = (
    <section className="rv-card">
      <div className="rv-card-head">
        <span className="rv-card-icon"><Eye size={16} /></span>
        <div><h3>Así te ve el comprador</h3><small>La misma tarjeta que muestra Repuestín · en vivo</small></div>
      </div>
      <RecommendedStoreCard
        rank={myPosition && myPosition <= 3 ? myPosition : affinity.place}
        name={name}
        logoUrl={storePhoto}
        affinity={affinityKey}
        reasons={reasons}
        ficha={liveFicha}
      />
      {reasons.length === 0 && (
        <div className="rv-empty-preview"><Lock size={16} /><span>Aún no hay razones para recomendarte. Completa el paso 1 y mira cómo cambia esta tarjeta.</span></div>
      )}
      {missingFicha.length > 0 && (
        <div className="rv-missing-box">
          <span className="rv-sub-label">El comprador aún no sabe:</span>
          <div className="rv-chips">
            {missingFicha.map((item) => <button key={item.key} type="button" className="rv-missing-chip" onClick={item.onPress}><PlusCircle size={14} /> {item.label}</button>)}
          </div>
        </div>
      )}
    </section>
  );

  const factors = (
    <section className="rv-card">
      <div className="rv-card-head">
        <span className="rv-card-icon"><ChartNoAxesColumn size={16} /></span>
        <div><h3>Cómo elige Repuestín</h3><small>Lo que más pesa para quedar entre las 3</small></div>
      </div>
      {FACTORS.map(({ Icon, label, detail, weight }) => (
        <div key={label} className="rv-factor">
          <span className="rv-factor-icon"><Icon size={16} /></span>
          <div className="rv-factor-copy">
            <span className="rv-factor-head"><strong>{label}</strong><small>{weight >= 0.8 ? 'Alto' : weight >= 0.4 ? 'Medio' : 'Suma'}</small></span>
            <span className="rv-factor-track"><span style={{ width: `${Math.round(weight * 100)}%` }} /></span>
            <small>{detail}</small>
          </div>
        </div>
      ))}
    </section>
  );

  const metrics = (
    <section className="rv-card">
      <div className="rv-card-head">
        <span className="rv-card-icon"><Gauge size={16} /></span>
        <div><h3>Tus respuestas</h3><small>Consultas de Repuestín · últimos 60 días</small></div>
      </div>
      <div className="rv-metrics">
        <Metric label="Consultas" value={String(data.metricas.recibidas)} tone="none" Icon={MessagesSquare} />
        <Metric
          label="Respondidas"
          value={data.metricas.recibidas > 0 ? `${Math.round((data.metricas.respondidas / data.metricas.recibidas) * 100)}%` : '—'}
          tone={responseRateTone(data.metricas.respondidas, data.metricas.recibidas)}
          Icon={CheckCheck}
        />
        <Metric label="Responde en" value={formatMinutes(data.metricas.minutosMediana)} tone={responseTimeTone(data.metricas.minutosMediana)} Icon={Clock} />
      </div>
      <div className="rv-tip"><RepuestinAvatar size={28} /><span>{responseTip(data.metricas.respondidas, data.metricas.recibidas, data.metricas.minutosMediana)}</span></div>
    </section>
  );

  const celebrate = complete ? (
    <section className="rv-celebrate">
      <span className="rv-celebrate-icon"><Trophy size={32} /></span>
      <h2>¡Listo! Repuestín ya te recomienda</h2>
      <p>Mantén tus respuestas rápidas y tu catálogo al día para seguir en el podio.</p>
    </section>
  ) : null;

  const notices = (
    <>
      {welcome && !complete && onLater && <button type="button" className="rv-link rv-muted rv-later" onClick={onLater}>Hacerlo después</button>}
      {savedAt && (
        <div className="rv-saved" role="status">
          <span className="rv-saved-icon"><Check size={16} /></span>
          <div><strong>Guardado</strong><small>Repuestín ya usa estos datos en sus próximas recomendaciones.</small></div>
        </div>
      )}
      {saveError && <p className="rv-error" role="alert">{saveError}</p>}
      {data.busquedasPerdidas > 0 && <LostSearchesCard total={data.busquedasPerdidas} groups={lostGroups} onOpenCategory={focusLostCategory} />}
      {ranking && ranking.sugerencias.length > 0 && <RankingSuggestions suggestions={ranking.sugerencias} onPress={onSuggestion} position={myPosition} />}
    </>
  );

  return (
    <div className={`rv-screen${isMobile ? ' is-mobile' : ' is-desktop'}${dirty ? ' has-save-bar' : ''}`}>
      {hero}
      {isMobile ? (
        <div className="rv-stack">
          {notices}
          {route}
          {preview}
          {factors}
          {metrics}
          {celebrate}
        </div>
      ) : (
        <div className="rv-columns">
          <div className="rv-stack">
            {notices}
            {route}
            {celebrate}
          </div>
          <aside className="rv-stack rv-aside">
            {preview}
            {metrics}
            {factors}
          </aside>
        </div>
      )}

      <WeeklyRankingSheet open={rankingOpen && Boolean(ranking)} ranking={ranking} isMobile={isMobile} onClose={() => setRankingOpen(false)} onSuggestion={onSuggestion} />

      {/* Cambios sin guardar: barra fija con el botón a mano (al salir también se guardan solos). */}
      {dirty && (
        <div className="rv-save-bar" role="region" aria-label="Cambios sin guardar">
          <span className="rv-save-dot" />
          <div><strong>Cambios sin guardar</strong><small>Guárdalos para que Repuestín los use</small></div>
          <button type="button" className="ra-btn ra-btn-primary ra-btn-sm" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      )}
    </div>
  );
}
