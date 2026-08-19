import React from 'react';
import { useSearchParams } from 'react-router-dom';

/** Formulario de consulta o reclamo. Se migra desde SupportHelpPanel en la fase 4. */
export default function HelpContactView() {
  const [searchParams] = useSearchParams();

  return (
    <section className="help-view-placeholder">
      <h1>Contactar soporte</h1>
      <p>Tema preseleccionado: {searchParams.get('tema') || 'ninguno'}</p>
    </section>
  );
}
