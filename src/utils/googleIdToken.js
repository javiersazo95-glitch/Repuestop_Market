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

/**
 * Traspaso del perfil de Google desde el modal de acceso a `/vender`.
 *
 * Con un correo nuevo, el modal pregunta si la cuenta es de comprador o de tienda (igual que la
 * pantalla "Tipo de cuenta" de la app). Si elige tienda, se guarda aca el idToken que Google ya
 * entrego y `/vender` lo toma para no volver a pedir la cuenta. sessionStorage: muere con la
 * pestana, y se borra apenas se lee.
 */
const CLAVE_GOOGLE_TIENDA = 'repuestop_google_pendiente_tienda';

export function guardarGoogleParaTienda(idToken) {
  try {
    sessionStorage.setItem(CLAVE_GOOGLE_TIENDA, idToken);
  } catch {
    /* sin almacenamiento: /vender pedira Google de nuevo */
  }
}

/**
 * El perfil guardado para `/vender`, o null. Se borra al leerlo.
 * @returns {{ idToken: string, email: string, name: string, picture: string } | null}
 */
export function tomarGoogleParaTienda() {
  try {
    const idToken = sessionStorage.getItem(CLAVE_GOOGLE_TIENDA);
    sessionStorage.removeItem(CLAVE_GOOGLE_TIENDA);
    const perfil = idToken ? decodeGoogleIdToken(idToken) : null;
    return perfil && idToken ? { idToken, email: perfil.email, name: perfil.nombre, picture: perfil.picture } : null;
  } catch {
    return null;
  }
}
