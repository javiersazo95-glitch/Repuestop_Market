import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, LocateFixed, MapPin } from 'lucide-react';
import { getDireccionInversaApi, getDireccionSugerenciasApi } from '../services/api';

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
 * región/comuna lo hace quien use el componente, que es el que conoce sus listas. También
 * trae `latitud` y `longitud` cuando la sugerencia (o la geolocalización) las conoce.
 *
 * Con `locatable`, el campo lleva un ícono de ubicación: al tocarlo se pide la posición del
 * navegador, se convierte en dirección y se escribe en el campo (avisando por
 * `onSelectLocation`). Si no se puede, un aviso breve deja escribirla a mano.
 */
export default function AddressAutocompleteInput({
  value, onChange, onSelectLocation, comuna, region, placeholder, required, id, maxLength, onBlur,
  locatable = false,
  // Exige comuna antes de escribir (por defecto sí): con la comuna la búsqueda se acota a
  // esa zona; sin ella compite contra las calles homónimas de todo Chile ("Los Huertos 670"
  // sale en Curicó y no en Chillán). Solo se apaga donde la zona ya viene dada.
  requireComuna = true,
}) {
  const esperandoComuna = requireComuna && !comuna;
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  // Evita volver a buscar con el texto que la propia selección acaba de escribir.
  const justPickedRef = useRef('');
  // Solo se busca cuando la persona escribe (8-oct): con una dirección ya guardada, abrir el
  // formulario de edición desplegaba sola la lista de sugerencias sobre el campo.
  const typedRef = useRef(false);

  useEffect(() => {
    const term = String(value || '').trim();
    if (!typedRef.current || esperandoComuna || term.length < MIN_CARACTERES || term === justPickedRef.current) {
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
  }, [value, comuna, region, esperandoComuna]);

  const pick = (suggestion) => {
    justPickedRef.current = suggestion.direccion;
    onChange(suggestion.direccion);
    setSuggestions([]);
    setOpen(false);
    if (suggestion.comuna || suggestion.region || suggestion.latitud != null) {
      onSelectLocation?.({
        comuna: suggestion.comuna, region: suggestion.region,
        latitud: suggestion.latitud ?? null, longitud: suggestion.longitud ?? null,
      });
    }
  };

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');

  const locate = () => {
    if (locating) return;
    setLocateError('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError('Tu navegador no permite obtener la ubicación. Escribe la dirección.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const found = await getDireccionInversaApi(latitude, longitude);
          if (!found?.direccion) {
            setLocateError('No pudimos identificar la dirección de tu ubicación. Escríbela a mano.');
            return;
          }
          justPickedRef.current = found.direccion;
          onChange(found.direccion);
          setSuggestions([]);
          setOpen(false);
          onSelectLocation?.({ comuna: found.comuna, region: found.region, latitud: latitude, longitud: longitude });
        } catch {
          setLocateError('No pudimos identificar la dirección de tu ubicación. Escríbela a mano.');
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        setLocateError(error?.code === 1
          ? 'Permite el acceso a tu ubicación en el navegador o escribe la dirección.'
          : 'No pudimos obtener tu ubicación. Escribe la dirección.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60 * 1000 },
    );
  };

  return (
    <div className={`address-autocomplete ${locatable ? 'has-locate' : ''}`}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => {
          typedRef.current = true;
          onChange(event.target.value);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        // El blur se retrasa para que el clic en una sugerencia alcance a registrarse.
        onBlur={(event) => {
          setTimeout(() => setOpen(false), 150);
          // Opcional: los formularios con validación al salir del campo lo usan.
          onBlur?.(event);
        }}
        placeholder={esperandoComuna ? 'Primero elige la región y la comuna' : placeholder}
        disabled={esperandoComuna}
        title={esperandoComuna ? 'La dirección se busca dentro de la comuna elegida' : undefined}
        required={required}
        // Opcional: solo lo aplica quien muestre un tope. Sin esto, un formulario
        // podia pintar un contador "/300" que el campo no hacia cumplir.
        maxLength={maxLength}
        autoComplete="off"
      />
      {searching && !locating && <Loader2 size={15} className="spin-icon address-autocomplete-spinner" />}
      {locatable && (
        <button type="button" className="address-autocomplete-locate" onClick={locate} disabled={locating}
          aria-label="Usar mi ubicación actual" title="Usar mi ubicación actual">
          {locating ? <Loader2 size={17} className="spin-icon" /> : <LocateFixed size={17} />}
        </button>
      )}
      {locateError && <small className="address-autocomplete-error" role="alert">{locateError}</small>}

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
