// Etiquetas de EstadoMediacion, el enum real del backend
// (backend/.../model/enums/EstadoMediacion.java). Vive en su propio archivo
// porque lo leen tanto la bandeja de casos como el expediente de disputa, y
// tenerlo en un componente obligaba a que esos dos se importaran entre sí.
export const MEDIATION_STATUS_LABELS = {
  ESPERANDO_VENDEDOR: 'Esperando al vendedor',
  ESCALADO: 'Escalado a mediador',
  EN_MEDIACION: 'En mediación',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
};

// Tono del sello de estado del expediente. Se mantiene aparte de la etiqueta
// porque el mismo estado puede mostrarse en la bandeja sin sello.
export const MEDIATION_STATUS_TONES = {
  ESPERANDO_VENDEDOR: 'wait',
  ESCALADO: 'alert',
  EN_MEDIACION: 'alert',
  RESUELTA: 'done',
  CERRADA: 'done',
};
