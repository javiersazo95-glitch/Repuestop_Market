/**
 * Clic que el navegador debe resolver solo (Ctrl/Cmd/Shift + clic, rueda del mouse): abrir
 * el enlace en otra pestana o ventana. Lo usan las tarjetas que son <a href> reales para
 * Google pero cuyo clic normal se intercepta para seguir pasando por su handler.
 */
export function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}
