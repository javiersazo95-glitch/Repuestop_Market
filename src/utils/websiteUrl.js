/**
 * Saneo de la URL de sitio web o red social que escribe el vendedor.
 *
 * Vive aparte porque la piden DOS formularios distintos que suben el mismo campo
 * (`websiteOrSocialUrl`) al mismo endpoint de verificación: el registro de `/vender`
 * (`FounderRegistration`) y la tarjeta de verificación del panel
 * (`SellerVerificationCard`). Estaba implementado solo en el primero, así que por el
 * segundo entraba texto sin revisar.
 *
 * Importa porque el valor no se muestra en este marketplace: lo lee el backoffice, donde
 * un operador lo abre como enlace. Un `javascript:...` guardado desde aquí sería código
 * ejecutándose en la consola de un operador con privilegios.
 *
 * Devuelve `undefined` cuando no hay nada utilizable, para que quien llama distinga
 * "no escribió nada" de "escribió algo que no sirve" mirando también el texto original.
 */
export function sanitizeWebsiteUrl(rawUrl) {
  const clean = String(rawUrl ?? '').trim();
  if (!clean) return undefined;

  // Lista negra de esquemas ejecutables. Se comprueba antes de anteponer https://
  // porque el objetivo es rechazar, no reescribir: convertir `javascript:alert(1)` en
  // `https://javascript:alert(1)` guardaría basura en vez de avisar del problema.
  if (/^(javascript|data|vbscript|file|blob):/i.test(clean)) return undefined;

  // Sin esquema se asume https. Un vendedor escribe "instagram.com/mi-tienda", no la URL
  // completa, y rechazarlo por eso sería fricción sin ganancia de seguridad.
  if (!/^https?:\/\//i.test(clean)) return `https://${clean}`;

  return clean;
}
