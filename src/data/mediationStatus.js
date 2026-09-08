// Etiquetas de EstadoMediacion, el enum real del backend
// (backend/.../model/enums/EstadoMediacion.java). Vive en su propio archivo
// porque lo leen tanto la bandeja de casos como el expediente de disputa, y
// tenerlo en un componente obligaba a que esos dos se importaran entre sí.
export const MEDIATION_STATUS_LABELS = {
  // "En disputa" hasta que se pide un mediador -- mismo texto que el badge del pedido
  // (`OrderStatusBadge`), para que el usuario lea siempre el mismo nombre de etapa.
  ESPERANDO_VENDEDOR: 'En disputa',
  ESCALADO: 'En mediación',
  EN_MEDIACION: 'En mediación',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
};

// Tono del sello de estado del expediente. Se mantiene aparte de la etiqueta
// porque el mismo estado puede mostrarse en la bandeja sin sello.
//   wait      -> disputa entre las partes (ámbar)
//   mediation -> intervino un mediador de RepuesTop (violeta, igual que el badge del pedido)
//   done      -> caso cerrado (verde)
export const MEDIATION_STATUS_TONES = {
  ESPERANDO_VENDEDOR: 'wait',
  ESCALADO: 'mediation',
  EN_MEDIACION: 'mediation',
  RESUELTA: 'done',
  CERRADA: 'done',
};
