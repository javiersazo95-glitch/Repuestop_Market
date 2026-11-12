import React, { useRef, useState } from 'react';
import { Calendar, Camera, ChevronRight, Home, Images, Leaf, Loader2, MapPin, Megaphone, PlusCircle, Send, X, Zap } from 'lucide-react';
import AddressAutocompleteInput from '../AddressAutocompleteInput';
import { createAddressApi } from '../../services/api';
import { resolverUbicacionPorNombre } from '../../services/geoLookup';
import { MAX_ORDER_PHOTOS, URGENCY_OPTIONS, addressLabel, parseQuantity } from '../../utils/partAssistant';
import { FactIcon } from './AssistantBits';

/**
 * Piezas del encargo conversado (`components/assistant/order/OrderParts.tsx` de la app): respuestas rápidas,
 * cantidad, texto libre, fotos, dirección, urgencia y el resumen antes de publicar.
 */

export function SendRound({ onClick, disabled, label = 'Enviar' }) {
  return (
    <button type="button" className="ra-send" onClick={onClick} disabled={disabled} aria-label={label}>
      <Send size={18} />
    </button>
  );
}

export function QuickReplies({ options, onPick }) {
  return (
    <div className="ra-replies">
      {options.map((option) => (
        <button key={option.key} type="button" className="ra-reply" onClick={() => onPick(option.key)}>
          {option.icon === 'megaphone' && <Megaphone size={14} />}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/** "¿Cuántas unidades?": 1, 2 o 4 de un toque, o el número que escriba. */
export function QuantityChooser({ onSubmit }) {
  const [text, setText] = useState('');
  const value = parseQuantity(text);
  return (
    <>
      <QuickReplies options={[1, 2, 4].map((n) => ({ key: String(n), label: n === 1 ? '1 unidad' : `${n} unidades` }))} onPick={(key) => onSubmit(Number(key))} />
      <form className="ra-composer" onSubmit={(event) => { event.preventDefault(); if (value) onSubmit(value); }}>
        <input
          className="ra-input"
          inputMode="numeric"
          placeholder="Otra cantidad (ej: 6)"
          value={text}
          onChange={(event) => setText(event.target.value.replace(/\D/g, '').slice(0, 3))}
          aria-label="Cantidad de unidades"
        />
        <SendRound onClick={() => value && onSubmit(value)} disabled={!value} />
      </form>
    </>
  );
}

/** Texto libre con enviar y, si es opcional, "Omitir". */
export function TextAnswer({ placeholder, onSubmit, onSkip, skipLabel = 'Omitir', numeric = false, maxLength = 200, ariaLabel, format }) {
  const [text, setText] = useState('');
  const clean = text.trim();
  return (
    <>
      <form className="ra-composer" onSubmit={(event) => { event.preventDefault(); if (clean) onSubmit(clean); }}>
        <input
          className="ra-input"
          placeholder={placeholder}
          value={text}
          inputMode={numeric ? 'numeric' : undefined}
          maxLength={maxLength}
          onChange={(event) => setText(format ? format(event.target.value) : event.target.value)}
          aria-label={ariaLabel}
          autoFocus
        />
        <SendRound onClick={() => clean && onSubmit(clean)} disabled={!clean} />
      </form>
      {onSkip && <button type="button" className="ra-btn ra-btn-ghost ra-btn-block" onClick={onSkip}>{skipLabel}</button>}
    </>
  );
}

/** Fotos del encargo: cámara o galería, hasta 5, con vista previa y para quitar. */
export function PhotoTray({ photos, uploading, onFiles, onRemove, onDone }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const full = photos.length >= MAX_ORDER_PHOTOS;
  const pick = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length) onFiles(files);
  };
  return (
    <>
      {(photos.length > 0 || uploading) && (
        <div className="ra-thumbs" aria-label={`${photos.length} de ${MAX_ORDER_PHOTOS} fotos`}>
          {photos.map((photo, index) => (
            <div key={photo.url} className="ra-thumb-wrap">
              <img className="ra-thumb" src={photo.local} alt="" />
              <button type="button" className="ra-thumb-remove" onClick={() => onRemove(index)} aria-label={`Quitar foto ${index + 1}`}><X size={12} /></button>
            </div>
          ))}
          {uploading && <div className="ra-thumb is-loading"><Loader2 size={20} className="ra-spin" /></div>}
        </div>
      )}
      {!full ? (
        <div className="ra-two-cols">
          <button type="button" className="ra-btn ra-btn-outline" onClick={() => cameraRef.current?.click()} disabled={uploading}><Camera size={18} /> Tomar foto</button>
          <button type="button" className="ra-btn ra-btn-outline" onClick={() => galleryRef.current?.click()} disabled={uploading}><Images size={18} /> Galería</button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
          <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={pick} />
        </div>
      ) : (
        <p className="ra-caption ra-center">Llegaste al máximo de {MAX_ORDER_PHOTOS} fotos.</p>
      )}
      <button type="button" className={`ra-btn ra-btn-block ${photos.length > 0 ? 'ra-btn-primary' : 'ra-btn-ghost'}`} onClick={onDone} disabled={uploading}>
        {photos.length > 0 ? 'Listo, seguir' : 'No tengo fotos, seguir'}
      </button>
    </>
  );
}

/** Dirección: las guardadas de un toque (la principal primero) o una nueva con autocompletado, que queda guardada. */
export function AddressChooser({ userId, addresses, loading, onSelect }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [place, setPlace] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const showForm = adding || (!loading && addresses.length === 0);

  const pickSuggestion = async ({ comuna, region }) => {
    try {
      const resolved = await resolverUbicacionPorNombre({ comuna, region });
      setPlace(resolved?.comunaId ? { comunaId: resolved.comunaId, comunaNombre: comuna, regionNombre: region || '' } : null);
      if (!resolved?.comunaId) setError('No pude ubicar la comuna de esa dirección. Elige otra sugerencia.');
      else setError('');
    } catch {
      setPlace(null);
    }
  };

  const save = async () => {
    if (!userId) return;
    if (!text.trim() || !place?.comunaId) {
      setError('Escribe la dirección y elige una de las sugerencias para ubicar la comuna.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await createAddressApi(userId, {
        comunaId: Number(place.comunaId),
        comunaNombre: place.comunaNombre,
        regionNombre: place.regionNombre,
        calleYNumero: text.trim(),
        tipoDireccion: 'PERSONAL',
      });
      onSelect({ ...created, calleYNumero: created?.calleYNumero || text.trim(), comunaNombre: created?.comunaNombre || place.comunaNombre, regionNombre: created?.regionNombre || place.regionNombre });
    } catch (err) {
      setError(err?.message || 'No pudimos guardar la dirección.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="ra-loader"><Loader2 size={22} className="ra-spin" /></div>;
  if (!showForm) {
    return (
      <div className="ra-option-list">
        {addresses.map((address) => (
          <button key={address.id} type="button" className="ra-option" onClick={() => onSelect(address)} aria-label={`Usar ${addressLabel(address)}`}>
            {address.esPrincipal ? <Home size={18} /> : <MapPin size={18} />}
            <span className="ra-option-copy">
              <strong>{address.calleYNumero}</strong>
              <small>{[address.comunaNombre, address.regionNombre].filter(Boolean).join(', ')}{address.esPrincipal ? ' · principal' : ''}</small>
            </span>
            <ChevronRight size={16} className="ra-muted" />
          </button>
        ))}
        <button type="button" className="ra-link" onClick={() => setAdding(true)}><PlusCircle size={16} /> Usar otra dirección</button>
      </div>
    );
  }
  return (
    <div className="ra-address-form">
      <label className="ra-label" htmlFor="ra-address">Dirección</label>
      <AddressAutocompleteInput
        id="ra-address"
        value={text}
        onChange={(value) => { setText(value); setPlace(null); }}
        onSelectLocation={pickSuggestion}
        requireComuna={false}
        maxLength={160}
        placeholder="Calle y número, comuna (Ej: Av. Italia 1234, Ñuñoa)"
      />
      <small className={error ? 'ra-error-text' : 'ra-caption'}>
        {error || (place ? `Comuna: ${[place.comunaNombre, place.regionNombre].filter(Boolean).join(', ')}` : 'Elige una sugerencia para ubicar la comuna.')}
      </small>
      <button type="button" className="ra-btn ra-btn-primary ra-btn-block" onClick={save} disabled={saving}>
        {saving ? <Loader2 size={16} className="ra-spin" /> : null} Guardar y usar esta dirección
      </button>
      {addresses.length > 0 && <button type="button" className="ra-btn ra-btn-ghost ra-btn-block" onClick={() => setAdding(false)}>Elegir una guardada</button>}
    </div>
  );
}

const URGENCY_ICON = { URGENTE: Zap, SEMANA: Calendar, SIN_APURO: Leaf };

export function UrgencyChooser({ onPick }) {
  return (
    <div className="ra-option-list">
      {URGENCY_OPTIONS.map((option) => {
        const Icon = URGENCY_ICON[option.key];
        return (
          <button key={option.key} type="button" className="ra-option" onClick={() => onPick(option.key)} aria-label={`${option.label}. ${option.hint}`}>
            <Icon size={18} />
            <span className="ra-option-copy"><strong>{option.label}</strong><small>{option.hint}</small></span>
          </button>
        );
      })}
    </div>
  );
}

/** Resumen del encargo antes de publicarlo, como tarjeta dentro del chat. */
export function OrderReviewCard({ rows, photos }) {
  return (
    <div className="ra-review">
      <div className="ra-review-head"><Megaphone size={18} /><strong>Tu encargo</strong></div>
      {rows.map((row) => (
        <div key={row.label} className="ra-review-row" aria-label={`${row.label}: ${row.value}`}>
          <FactIcon name={row.icon} size={16} />
          <div><em>{row.label}</em><span>{row.value}</span></div>
        </div>
      ))}
      {photos.length > 0 && (
        <div className="ra-thumbs">
          {photos.map((photo) => <img key={photo.url} className="ra-thumb is-small" src={photo.local} alt="" />)}
        </div>
      )}
    </div>
  );
}
