import React, { useState } from 'react';
import { createAddressApi } from '../services/api';
import { resolverUbicacionPorNombre } from '../services/geoLookup';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import '../styles/faults.css';
import '../styles/auction-vehicle.css';

/** Alta mínima de una dirección: un solo campo con sugerencias; la comuna y la región salen de la sugerencia elegida. */
export default function QuickAddressForm({ userId, onCreated }) {
  const [text, setText] = useState('');
  const [place, setPlace] = useState(null);   // { comunaId, comunaNombre, regionNombre } de la sugerencia elegida
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pickSuggestion = async ({ comuna, region }) => {
    const resolved = await resolverUbicacionPorNombre({ comuna, region });
    setPlace(resolved.comunaId ? { comunaId: resolved.comunaId, comunaNombre: comuna, regionNombre: region || '' } : null);
  };

  const save = async () => {
    if (!text.trim() || !place) {
      setError('Escribe la dirección y elige una de las sugerencias para ubicar la comuna.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createAddressApi(userId, {
        comunaId: Number(place.comunaId),
        comunaNombre: place.comunaNombre || '',
        regionNombre: place.regionNombre || '',
        calleYNumero: text.trim(),
        tipoDireccion: 'PERSONAL',
      });
      setText('');
      setPlace(null);
      await onCreated();
    } catch (err) {
      setError(err?.message || 'No pudimos guardar la dirección.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acv-quick-address">
      <AddressAutocompleteInput
        value={text}
        onChange={(value) => { setText(value); setPlace(null); }}
        onSelectLocation={pickSuggestion}
        requireComuna={false}
        placeholder="Calle y número, comuna (Ej: Av. Italia 1234, Ñuñoa)"
      />
      <button type="button" className="ft-btn ft-btn-primary" onClick={save} disabled={saving || !text.trim()}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      {place && <small className="acv-address-note">Comuna: <strong>{[place.comunaNombre, place.regionNombre].filter(Boolean).join(', ')}</strong></small>}
      {error && <small className="acv-address-error">{error}</small>}
    </div>
  );
}
