// Etiquetas de EstadoMediacion, el enum real del backend
// (backend/.../model/enums/EstadoMediacion.java). Ya no existe la etapa "En
// disputa": una Mediacion solo se crea cuando alguien solicita un mediador, así
// que todas nacen en EN_MEDIACION. El chat previo comprador-vendedor es solo una
// conversación, sin fila de mediación.
export const MEDIATION_STATUS_LABELS = {
  EN_MEDIACION: 'En mediación',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
};

// Tono del sello de estado del expediente.
//   mediation -> intervino un mediador de RepuesTop (violeta, igual que el badge del pedido)
//   done      -> caso cerrado (verde)
export const MEDIATION_STATUS_TONES = {
  EN_MEDIACION: 'mediation',
  RESUELTA: 'done',
  CERRADA: 'done',
};
