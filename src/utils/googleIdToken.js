/**
 * Lee los datos de perfil que vienen dentro de un idToken de Google.
 *
 * SOLO PARA MOSTRAR. La firma no se valida aca y no debe usarse para decidir
 * nada: el backend verifica el idToken contra Google y, en el registro con
 * Google, toma el correo de SU propia verificacion y no del formulario
 * (`resolverEmailVerificado()` en `AuthService`). Esto existe unicamente para
 * poder decirle a la persona con que cuenta esta a punto de registrarse, en vez
 * de pedirle que escriba de nuevo lo que Google ya entrego.
 */
export function decodeGoogleIdToken(idToken) {
  try {
    const payload = String(idToken || '').split('.')[1];
    if (!payload) return null;

    // Base64url -> base64, y el relleno que el JWT omite.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const relleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

    // `atob` devuelve bytes, no texto: sin este paso los nombres con tilde o con
    // ñ llegan partidos ("MartÃ­n").
    const bytes = Uint8Array.from(atob(relleno), (char) => char.charCodeAt(0));
    const json = JSON.parse(new TextDecoder('utf-8').decode(bytes));

    if (!json?.email) return null;
    return {
      email: json.email,
      nombre: json.name || [json.given_name, json.family_name].filter(Boolean).join(' '),
      firstName: json.given_name || String(json.name || '').split(/\s+/)[0] || '',
      lastName: json.family_name || String(json.name || '').split(/\s+/).slice(1).join(' ') || '',
      picture: json.picture || ''
    };
  } catch {
    return null;
  }
}
