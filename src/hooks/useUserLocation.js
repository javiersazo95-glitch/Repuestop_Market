import { useCallback, useEffect, useState } from 'react';

/**
 * Ubicación del navegador para "cerca de mí" (Mural de anuncios y directorio de casas de
 * repuestos), igual que el hook de la app. Se pide al tocar el ícono de ubicación, nunca al
 * cargar la página: el navegador muestra su propio aviso de permiso y pedirlo de entrada hace
 * que la gente lo rechace sin pensarlo. Si el permiso YA estaba concedido se lee sola al
 * entrar, para mostrar la distancia en cada tarjeta sin clics.
 *
 * Las coordenadas se guardan a nivel de módulo: al pasar del mural al directorio no se vuelve
 * a pedir la ubicación en la misma sesión.
 */
let sessionCoords = null;

export function useUserLocation() {
  const [status, setStatus] = useState(sessionCoords ? 'granted' : 'idle');
  const [coords, setCoords] = useState(sessionCoords);

  const requestLocation = useCallback(() => {
    if (sessionCoords) {
      setCoords(sessionCoords);
      setStatus('granted');
      return Promise.resolve(sessionCoords);
    }
    const geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geolocation) {
      setStatus('unavailable');
      return Promise.resolve(null);
    }
    setStatus('loading');
    return new Promise((resolve) => {
      geolocation.getCurrentPosition(
        (position) => {
          sessionCoords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          setCoords(sessionCoords);
          setStatus('granted');
          resolve(sessionCoords);
        },
        (error) => {
          setStatus(error?.code === 1 ? 'denied' : 'unavailable');
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
      );
    });
  }, []);

  // Permiso ya concedido antes: se lee en silencio (sin aviso del navegador).
  useEffect(() => {
    if (sessionCoords || typeof navigator === 'undefined' || !navigator.permissions?.query) return undefined;
    let active = true;
    navigator.permissions.query({ name: 'geolocation' })
      .then((result) => {
        if (active && result.state === 'granted') requestLocation();
      })
      .catch(() => {});
    return () => { active = false; };
  }, [requestLocation]);

  return { status, coords, requestLocation };
}
