import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, MapPin } from 'lucide-react';
import { getDireccionSugerenciasApi } from '../services/api';

// Mismos valores que usa la app (`AddressAutocompleteField`): el backend además
// descarta por su cuenta las consultas de menos de 2 caracteres.
const MIN_CARACTERES = 2;
const DEBOUNCE_MS = 300;

/**
 * Campo de calle con sugerencias reales (catastro de direcciones del INE en el
 * backend, con TomTom y OpenStreetMap de respaldo). Al elegir una, avisa la comuna
 * y la región detectadas para que el formulario deje de pedirlas a mano.
 *
 * Si la calle existe pero el número escrito no está en el catastro, el backend
 * igual lo conserva y lo marca `numeroVerificado: false`: se muestra con una
 * leyenda para que la persona lo revise, nunca se le cambia lo que escribió.
 *
 * `onSelectLocation` recibe nombres, no ids: el mapeo contra el catálogo de
 * región/comuna lo hace quien use el componente, que es el que conoce sus listas.
 */
export default function AddressAutocompleteInput({
  value, onChange, onSelectLocation, comuna, region, placeholder, required, id, maxLength, onBlur,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  // Evita volver a buscar con el texto que la propia selección acaba de escribir.
  const justPickedRef = useRef('');

  useEffect(() => {
    const term = String(value || '').trim();
    if (term.length < MIN_CARACTERES || term === justPickedRef.current) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    setSearching(true);

    const timer = setTimeout(() => {
      getDireccionSugerenciasApi(term, { comuna, region, signal: controller.signal })
        .then((data) => {
          if (!active) return;
          setSuggestions(Array.isArray(data) ? data : []);
          setOpen(true);
        })
        .catch(() => { if (active) setSuggestions([]); })
        .finally(() => { if (active) setSearching(false); });
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [value, comuna, region]);

  const pick = (suggestion) => {
    justPickedRef.current = suggestion.direccion;
    onChange(suggestion.direccion);
    setSuggestions([]);
    setOpen(false);
    if (suggestion.comuna || suggestion.region) {
      onSelectLocation?.({ comuna: suggestion.comuna, region: suggestion.region });
    }
  };

  return (
    <div className="address-autocomplete">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        // El blur se retrasa para que el clic en una sugerencia alcance a registrarse.
        onBlur={(event) => {
          setTimeout(() => setOpen(false), 150);
          // Opcional: los formularios con validación al salir del campo lo usan.
          onBlur?.(event);
        }}
        placeholder={placeholder}
        required={required}
        // Opcional: solo lo aplica quien muestre un tope. Sin esto, un formulario
        // podia pintar un contador "/300" que el campo no hacia cumplir.
        maxLength={maxLength}
        autoComplete="off"
      />
      {searching && <Loader2 size={15} className="spin-icon address-autocomplete-spinner" />}

      {open && suggestions.length > 0 && (
        <ul className="address-autocomplete-list" role="listbox">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.direccion}-${index}`}>
              <button type="button" onMouseDown={() => pick(suggestion)}>
                <MapPin size={14} />
                <span>
                  <strong>{suggestion.direccion}</strong>
                  {(suggestion.comuna || suggestion.region) && (
                    <small>{[suggestion.comuna, suggestion.region].filter(Boolean).join(', ')}</small>
                  )}
                  {suggestion.numeroVerificado === false && (
                    <small className="address-unverified">
                      <AlertCircle size={11} /> Número no verificado en el catastro
                    </small>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
