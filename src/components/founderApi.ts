import { API_URL, GOOGLE_CLIENT_ID } from './founderConfig';

/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

export type UbicacionOption = { id: string; nombre: string };

export type DireccionPayload = {
  comunaId: number;
  calleYNumero: string;
  codigoPostal?: string;
};

export type SellerRegistrationPayload = {
  responsibleName: string;
  cargo: string;
  email: string;
  phone: string;
  password?: string;
  authProvider: 'EMAIL_PASSWORD' | 'GOOGLE';
  idToken?: string;
  userProfileUrl?: string;
  storeName: string;
  taxId: string;
  giro: string;
  direccion: DireccionPayload;
  hours?: string;
  shippingMethods?: string;
  acceptsTerms: boolean;
  /** Le dice al backend que esta tienda se postuló desde la web, para enrutar bien el correo de resultado de verificación. */
  origin: 'SITIO_WEB';
};

export type EmailVerificationPending = {
  pendingEmailVerification: true;
  email: string;
  message: string;
};

export type RegistrationResponse = {
  token: string;
  tokenType: string;
  sellerId: string;
  responsibleName: string;
  storeName: string;
  founder: boolean;
  status: string;
  [key: string]: unknown;
};

export type RegistrationResult = EmailVerificationPending | RegistrationResponse;

export function isPendingVerification(r: RegistrationResult): r is EmailVerificationPending {
  return (r as EmailVerificationPending).pendingEmailVerification === true;
}

export type VerificacionResponse = {
  verificationId: string;
  proveedorId: string;
  representativeDocument: string | null;
  inicioActividadesDoc: string | null;
  patenteDoc: string | null;
  boletaFacturaDoc: string | null;
  websiteOrSocialUrl: string | null;
  reviewStatus: string | null;
  reviewNotes: string | null;
  submittedAt: string | null;
};

/* ------------------------------------------------------------------ *
 * HTTP helper
 * ------------------------------------------------------------------ */

/** Error de API con status HTTP + código (`ApiErrorDTO.error`, ej. "DUPLICATE_RESOURCE") para poder ramificar sin parsear texto. */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message =
      (data && (data.message || data.detail)) ||
      (typeof data === 'string' && data) ||
      'No pudimos completar la solicitud. Intenta nuevamente.';
    throw new ApiError(message, res.status, data?.error);
  }
  return data as T;
}

/* ------------------------------------------------------------------ *
 * Registro
 * ------------------------------------------------------------------ */

export function registerSeller(payload: SellerRegistrationPayload): Promise<RegistrationResult> {
  return request<RegistrationResult>('/auth/register/seller', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function verifyRegistrationCode(email: string, code: string): Promise<RegistrationResponse> {
  return request<RegistrationResponse>('/auth/register/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
}

export function resendRegistrationCode(email: string): Promise<{ message: string }> {
  return request('/auth/register/resend-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

/* ------------------------------------------------------------------ *
 * Geografía (público) — necesitamos comunaId real desde el backend
 * ------------------------------------------------------------------ */

export function fetchPaises(): Promise<UbicacionOption[]> {
  return request<UbicacionOption[]>('/geografia/paises');
}

export function fetchRegiones(paisId: string): Promise<UbicacionOption[]> {
  return request<UbicacionOption[]>(`/geografia/paises/${encodeURIComponent(paisId)}/regiones`);
}

export function fetchComunas(regionId: string): Promise<UbicacionOption[]> {
  return request<UbicacionOption[]>(`/geografia/regiones/${encodeURIComponent(regionId)}/comunas`);
}

/* ------------------------------------------------------------------ *
 * Verificación de tienda (documentos) — requiere Bearer
 * ------------------------------------------------------------------ */

export type VerificacionFiles = {
  representativeDocument?: File | null;
  inicioActividadesDoc?: File | null;
  patenteDoc?: File | null;
  boletaFacturaDoc?: File | null;
  websiteOrSocialUrl?: string;
  mensaje?: string;
};

export function uploadVerificacion(
  sellerId: string,
  token: string,
  files: VerificacionFiles,
): Promise<VerificacionResponse> {
  const form = new FormData();
  if (files.representativeDocument) form.append('representativeDocument', files.representativeDocument);
  if (files.inicioActividadesDoc) form.append('inicioActividadesDoc', files.inicioActividadesDoc);
  if (files.patenteDoc) form.append('patenteDoc', files.patenteDoc);
  if (files.boletaFacturaDoc) form.append('boletaFacturaDoc', files.boletaFacturaDoc);
  if (files.websiteOrSocialUrl) form.append('websiteOrSocialUrl', files.websiteOrSocialUrl);
  if (files.mensaje) form.append('mensaje', files.mensaje);

  return request<VerificacionResponse>(`/proveedores/${encodeURIComponent(sellerId)}/verificacion`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

/* ------------------------------------------------------------------ *
 * Retomar postulación (correo/RUT con solicitud en curso)
 * ------------------------------------------------------------------ */

export type SellerSession = {
  token: string;
  sellerId: string;
  storeName: string;
  founder: boolean;
  sellerBlocked: boolean;
  sellerBlockReason?: string | null;
};

function extractSellerSession(data: any): SellerSession {
  return {
    token: data.token,
    sellerId: data.sellerId,
    storeName: data.storeName,
    founder: Boolean(data.founder),
    sellerBlocked: Boolean(data.sellerBlocked),
    sellerBlockReason: data.sellerBlockReason ?? null,
  };
}

/** Login normal por correo. Falla con ApiError si la cuenta no existe, la clave es incorrecta o el correo no está verificado. */
export async function loginSeller(email: string, password: string): Promise<SellerSession> {
  const data = await request<any>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, authProvider: 'EMAIL_PASSWORD' }),
  });
  return extractSellerSession(data);
}

/** Login por el RUT de la tienda en vez del correo — para cuando el vendedor no recuerda con qué correo se registró. */
export async function loginSellerByTaxId(taxId: string, password: string): Promise<SellerSession> {
  const data = await request<any>('/auth/login-by-taxid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taxId, password }),
  });
  return extractSellerSession(data);
}

/** Login con Google: si ya existe una cuenta con ese correo, retorna la sesión directamente (sirve para retomar). */
export async function loginSellerWithGoogle(idToken: string): Promise<SellerSession> {
  const data = await request<any>('/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  return extractSellerSession(data);
}

export type SellerLookup = { found: boolean; maskedEmail?: string | null; authProvider?: string | null };

/** Búsqueda pública y de solo lectura por RUT: confirma si existe una tienda y con qué método se registró, sin exponer el correo completo. */
export function lookupSellerByTaxId(taxId: string): Promise<SellerLookup> {
  return request<SellerLookup>(`/auth/seller-lookup?taxId=${encodeURIComponent(taxId)}`);
}

export type EmailCheck = {
  exists: boolean;
  isApproved: boolean;
  status: string | null;
  role: string | null;
  message: string | null;
};

/** Verificación rápida de disponibilidad de correo (sin crear nada), para avisar de inmediato si ya está registrado. */
export function checkEmailAvailability(email: string): Promise<EmailCheck> {
  return request<EmailCheck>(`/auth/check-email?email=${encodeURIComponent(email)}`);
}

/** Estado de la verificación documental. `null` si el vendedor todavía no sube documentos (404 del backend). */
export async function fetchVerificacionStatus(sellerId: string, token: string): Promise<VerificacionResponse | null> {
  try {
    return await request<VerificacionResponse>(`/proveedores/${encodeURIComponent(sellerId)}/verificacion`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Envía un código de recuperación. Con rol PROVEEDOR, `identifier` debe ser el RUT de la tienda (así lo espera el backend). Retorna el correo real al que se envió. */
export function sendSellerRecoverCode(taxId: string): Promise<{ message: string; email: string }> {
  return request('/auth/recover-password/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: taxId, rol: 'PROVEEDOR' }),
  });
}

export function verifySellerRecoverCode(email: string, code: string): Promise<{ message: string }> {
  return request('/auth/recover-password/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, rol: 'PROVEEDOR', code }),
  });
}

export function resetSellerPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
  return request('/auth/recover-password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, rol: 'PROVEEDOR', code, newPassword }),
  });
}

/* ------------------------------------------------------------------ *
 * Google Identity Services
 * ------------------------------------------------------------------ */

export const googleEnabled = Boolean(GOOGLE_CLIENT_ID);

export type GoogleProfile = { idToken: string; email: string; name: string; picture?: string };

let gisPromise: Promise<void> | null = null;

function loadGoogleIdentity(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Sin ventana'));
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Sign-In'));
    document.head.appendChild(script);
  });
  return gisPromise;
}

/**
 * Decodifica de forma defensiva la carga útil (payload) de un token JWT sin usar la función obsoleta escape().
 * Retorna un objeto vacío si el token no es válido o contiene formato incorrecto.
 */
function decodeJwt(token: string): Record<string, any> {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const jsonPayload = decodeURIComponent(
      atob(paddedBase64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return {};
  }
}

/** Monta el botón oficial de Google en `container` e invoca `onCredential` con el id_token crudo cada vez que el usuario elige una cuenta. */
async function mountGoogleButton(
  container: HTMLElement,
  onCredential: (idToken: string) => void,
  onError?: (message: string) => void,
  buttonText: 'continue_with' | 'signin_with' = 'continue_with',
): Promise<void> {
  if (!googleEnabled) return;
  try {
    await loadGoogleIdentity();
    const google = (window as any).google;
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp: { credential: string }) => onCredential(resp.credential),
    });
    container.innerHTML = '';
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: buttonText,
      shape: 'pill',
      logo_alignment: 'center',
      width: container.clientWidth || 360,
      locale: 'es',
    });
  } catch (e: any) {
    onError?.(e?.message || 'No se pudo iniciar Google Sign-In');
  }
}

/**
 * Renderiza el botón oficial de Google dentro de `container` para prellenar el formulario de registro.
 * `onProfile` recibe el id_token + datos decodificados (no autentica todavía; eso ocurre al enviar el registro).
 */
export function renderGoogleButton(
  container: HTMLElement,
  onProfile: (profile: GoogleProfile) => void,
  onError?: (message: string) => void,
): Promise<void> {
  return mountGoogleButton(container, (idToken) => {
    try {
      const claims = decodeJwt(idToken);
      onProfile({
        idToken,
        email: claims.email,
        name: claims.name || `${claims.given_name ?? ''} ${claims.family_name ?? ''}`.trim(),
        picture: claims.picture,
      });
    } catch {
      onError?.('No pudimos leer tu cuenta de Google.');
    }
  }, onError);
}

/**
 * Renderiza el botón de Google para RETOMAR una postulación: autentica de inmediato contra
 * `/auth/google`. Si no existe una cuenta RepuesTop con ese correo, informa un error claro
 * en vez de crear una cuenta nueva silenciosamente.
 */
export function renderGoogleResumeButton(
  container: HTMLElement,
  onSession: (session: SellerSession) => void,
  onError: (message: string) => void,
): Promise<void> {
  return mountGoogleButton(container, (idToken) => {
    loginSellerWithGoogle(idToken)
      .then(onSession)
      .catch((e: any) => {
        if (e instanceof ApiError && e.status === 404) {
          onError('No encontramos una tienda RepuesTop asociada a esa cuenta de Google.');
        } else {
          onError(e?.message || 'No pudimos iniciar sesión con Google.');
        }
      });
  }, onError, 'signin_with');
}
