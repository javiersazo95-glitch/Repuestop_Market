import React, { createContext, useEffect } from 'react';
import { remoteConfig } from './remoteConfig';
import { useRemoteConfig } from './hooks';

// El contexto solo expone el snapshot para quien quiera inspeccionarlo (devtools, depuracion);
// los hooks leen el store directo y no dependen de el.
const RemoteConfigContext = createContext(null);

/**
 * Arranca la descarga del bootstrap del mantenedor (cache local + `GET /config/bootstrap`,
 * refresco al volver a la pestana y cada 5 min). No espera a nada: los hijos se pintan en el
 * primer render con la cache o con los fallbacks, igual que antes de existir el mantenedor.
 */
export function RemoteConfigProvider({ children }) {
  const snapshot = useRemoteConfig();
  useEffect(() => remoteConfig.start(), []);
  return <RemoteConfigContext.Provider value={snapshot}>{children}</RemoteConfigContext.Provider>;
}

export default RemoteConfigProvider;
