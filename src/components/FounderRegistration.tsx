import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, Crown, Check, Eye, EyeOff, UploadCloud, FileText,
  UserRound, Store, ClipboardCheck, ShieldCheck, MailCheck, Sparkles, PartyPopper, X,
  RotateCcw, Search, KeyRound, AlertTriangle, Mail,
} from 'lucide-react';
import {
  registerSeller, verifyRegistrationCode, resendRegistrationCode,
  fetchPaises, fetchRegiones, fetchComunas,
  uploadVerificacion, renderGoogleButton, renderGoogleResumeButton, googleEnabled,
  isPendingVerification, ApiError,
  loginSeller, loginSellerByTaxId, loginSellerWithGoogle, lookupSellerByTaxId, fetchVerificacionStatus,
  sendSellerRecoverCode, verifySellerRecoverCode, resetSellerPassword, checkEmailAvailability,
  type UbicacionOption, type GoogleProfile, type SellerRegistrationPayload,
  type SellerSession, type SellerLookup, type VerificacionResponse,
} from './founderApi';
import { VENDEDOR_TERMS, PRIVACIDAD_POLICY } from './legalTexts';
import { LEGAL_VERSION_CODE } from '../data/legalTexts';

type LegalDoc = 'terms' | 'privacy';

const GIRO_OPTIONS = [
  'Venta al por menor de repuestos y accesorios',
  'Venta al por mayor de repuestos y accesorios',
  'Mantenimiento y reparación de vehículos motorizados',
  'Venta de vehículos motorizados',
];

const PANEL_VENDEDORES_URL = 'https://inventario.repuestop.cl/';

const PHASES = [
  { icon: <UserRound />, title: 'Registro', text: 'Crea tu cuenta de tienda fundadora.' },
  { icon: <Store />, title: 'Documentos', text: 'Sube los documentos de tu tienda.' },
  { icon: <ClipboardCheck />, title: 'Validación', text: 'Nuestro equipo revisa tu tienda.' },
  { icon: <PartyPopper />, title: 'Aprobación', text: 'Ingresas al panel de vendedores.' },
];

/** Deja solo dígitos + dígito verificador (k/K) y aplica puntos de miles + guion, igual que el mono-repo. */
function formatRut(value: string): string {
  const cleaned = value.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
  if (cleaned.length <= 1) return cleaned;
  const body = cleaned.slice(0, -1);
  const verifier = cleaned.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedBody}-${verifier}`;
}

type Session = { sellerId: string; token: string; storeName: string; founder: boolean };

/** Decide en qué fase de la línea de tiempo debe caer un vendedor que retoma su postulación. */
function phaseForVerification(v: VerificacionResponse | null): number {
  if (!v) return 1; // sin documentos subidos todavía
  const status = (v.reviewStatus || '').toUpperCase();
  if (status === 'APPROVED') return 3;
  if (status === 'REJECTED' || status === 'NEEDS_CORRECTION') return 1; // vuelve a subir documentos
  return 2; // PENDING (o vacío pero ya enviado) -> en validación
}

type FormState = {
  responsibleName: string; cargo: string; email: string; phone: string; password: string;
  storeName: string; taxId: string; giro: string; giroOtro: string;
  regionId: string; comunaId: string; address: string; codigoPostal: string;
  acceptsTerms: boolean;
};

const EMPTY_FORM: FormState = {
  responsibleName: '', cargo: '', email: '', phone: '', password: '',
  storeName: '', taxId: '', giro: '', giroOtro: '',
  regionId: '', comunaId: '', address: '', codigoPostal: '',
  acceptsTerms: false,
};

export default function FounderRegistration({ onBack }: { onBack: () => void }) {
  const [activePhase, setActivePhase] = useState(0);
  const [legal, setLegal] = useState<LegalDoc | null>(null);

  // Phase 0 — registro
  const [methodChosen, setMethodChosen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [authProvider, setAuthProvider] = useState<'EMAIL_PASSWORD' | 'GOOGLE'>('EMAIL_PASSWORD');
  const [google, setGoogle] = useState<GoogleProfile | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailTaken, setEmailTaken] = useState<string | null>(null);
  const [checkingTaxId, setCheckingTaxId] = useState(false);
  const [taxIdTaken, setTaxIdTaken] = useState<string | null>(null);

  // Verificación de correo
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resent, setResent] = useState(false);

  // Sesión creada
  const [session, setSession] = useState<Session | null>(null);
  const [phaseNotice, setPhaseNotice] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  // true solo cuando la verificación ya fue APPROVED de verdad (no la fase 3 informativa antes de aprobar).
  const [alreadyApproved, setAlreadyApproved] = useState(false);

  // Retomar postulación (correo/RUT ya registrados)
  const [showResume, setShowResume] = useState(false);
  const [resumePrefill, setResumePrefill] = useState<{ taxId: string; email: string; password: string }>({
    taxId: '', email: '', password: '',
  });

  // Geografía
  const [regiones, setRegiones] = useState<UbicacionOption[]>([]);
  const [comunas, setComunas] = useState<UbicacionOption[]>([]);
  const [geoError, setGeoError] = useState('');

  // Google button
  const googleRef = useRef<HTMLDivElement | null>(null);
  const [googleMsg, setGoogleMsg] = useState('');
  // Se incrementa al volver de un back/forward (bfcache) para forzar que React
  // remonte el contenedor del botón: el iframe de Google no sobrevive la restauración.
  const [googleRemountKey, setGoogleRemountKey] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Si el navegador restaura esta página desde el back/forward cache (ej. el usuario
  // vuelve atrás tras abrir el selector de cuenta de Google), el iframe de Google
  // queda vacío aunque el contenedor siga en el DOM. Forzamos un remount.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setGoogleRemountKey((k) => k + 1);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  // Deep-link desde el correo de "necesita corrección": ?rut=... abre directo el flujo de retomar postulación.
  useEffect(() => {
    const rut = new URLSearchParams(window.location.search).get('rut');
    if (!rut) return;
    setResumePrefill((prev) => ({ ...prev, taxId: formatRut(rut) }));
    setShowResume(true);
  }, []);

  // Cargar país (Chile) + regiones
  useEffect(() => {
    let alive = true;
    fetchPaises()
      .then((paises) => {
        if (!alive) return;
        const chile = paises.find((p) => /chile/i.test(p.nombre)) ?? paises[0];
        if (!chile) return;
        return fetchRegiones(chile.id).then((r) => alive && setRegiones(r));
      })
      .catch(() => alive && setGeoError('No pudimos cargar las regiones. Verifica tu conexión.'));
    return () => { alive = false; };
  }, []);

  // Cargar comunas al cambiar región
  useEffect(() => {
    if (!form.regionId) { setComunas([]); return; }
    let alive = true;
    fetchComunas(form.regionId)
      .then((c) => alive && setComunas(c))
      .catch(() => alive && setGeoError('No pudimos cargar las comunas.'));
    return () => { alive = false; };
  }, [form.regionId]);

  // Botón de Google (paso "elige método"): si ya existe una cuenta VENDEDORA con ese correo,
  // retomamos su postulación donde quedó (documentos, en revisión o ya aprobada) en vez de mostrar
  // el formulario de registro; si el correo existe pero es de comprador (sin tienda), no dejamos
  // continuar con ese correo -se avisa para que use otro-; solo si no existe cuenta se prellena
  // el formulario para crear una cuenta de vendedor nueva.
  useEffect(() => {
    if (activePhase !== 0 || pendingEmail || methodChosen || !googleEnabled || !googleRef.current) return;
    renderGoogleButton(googleRef.current, async (profile) => {
      setGoogleMsg('');
      try {
        const existingSession = await loginSellerWithGoogle(profile.idToken);
        if (existingSession.sellerId) {
          await resolveSellerSession(existingSession);
          return;
        }
        // El mismo correo puede pertenecer a una cuenta de comprador (app móvil) sin tienda
        // asociada; el backend igual responde 200 pero sin sellerId. No hay nada que retomar
        // ni podemos crear una cuenta de vendedor con un correo ya usado (rebotaría 409 igual).
        setGoogleMsg('Ese correo ya está registrado como comprador. Intenta con otro correo para postular como tienda fundadora.');
        return;
      } catch (err: any) {
        if (!(err instanceof ApiError) || err.status !== 404) {
          setGoogleMsg(err?.message || 'No pudimos verificar tu cuenta de Google.');
          return;
        }
        // 404: no hay cuenta de RepuesTop con este correo todavía -> seguimos como registro nuevo.
      }
      setGoogle(profile);
      setAuthProvider('GOOGLE');
      setForm((f) => ({
        ...f,
        email: profile.email || f.email,
        responsibleName: f.responsibleName || profile.name || '',
      }));
      setMethodChosen(true);
    }, (msg) => setGoogleMsg(msg));
  }, [activePhase, pendingEmail, methodChosen, googleRemountKey]);

  function chooseManual() {
    setGoogle(null);
    setAuthProvider('EMAIL_PASSWORD');
    setGoogleMsg('');
    setMethodChosen(true);
  }

  function changeMethod() {
    setMethodChosen(false);
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    if (key === 'email') setEmailTaken(null);
    if (key === 'taxId') setTaxIdTaken(null);
  };

  const emailLocked = authProvider === 'GOOGLE';

  /** Avisa de inmediato (sin esperar al envío del formulario) si el correo ya está registrado. */
  async function checkEmailNow(email: string) {
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return;
    setCheckingEmail(true);
    try {
      const result = await checkEmailAvailability(clean);
      if (result.exists) {
        const message = result.message || 'Este correo ya está registrado.';
        setEmailTaken(message);
        setErrors((e) => ({ ...e, email: message }));
      }
    } catch {
      /* si falla la verificación rápida, el envío del formulario igual detecta el duplicado */
    } finally {
      setCheckingEmail(false);
    }
  }

  /** Avisa de inmediato si ya existe una tienda con ese RUT, para no duplicar tiendas por RUT. */
  async function checkTaxIdNow(taxId: string) {
    const clean = taxId.trim();
    if (!/^[0-9.]+-[0-9kK]$/.test(clean)) return;
    setCheckingTaxId(true);
    try {
      const result = await lookupSellerByTaxId(clean);
      if (result.found) {
        const message = 'Este RUT ya está registrado en RepuesTop.';
        setTaxIdTaken(message);
        setErrors((e) => ({ ...e, taxId: message }));
      }
    } catch {
      /* si falla la verificación rápida, el envío del formulario igual detecta el duplicado */
    } finally {
      setCheckingTaxId(false);
    }
  }

  /** Toma una sesión recién autenticada (login normal, por RUT o Google) y la ubica en la fase correcta. */
  async function resolveSellerSession(sellerSession: SellerSession) {
    if (sellerSession.sellerBlocked) {
      setBlocked(sellerSession.sellerBlockReason || 'Tu cuenta está bloqueada. Escríbenos para revisar tu caso.');
      setShowResume(false);
      return;
    }
    const verification = await fetchVerificacionStatus(sellerSession.sellerId, sellerSession.token);
    setSession({
      sellerId: sellerSession.sellerId,
      token: sellerSession.token,
      storeName: sellerSession.storeName,
      founder: sellerSession.founder,
    });
    if (verification?.reviewNotes && ['REJECTED', 'NEEDS_CORRECTION'].includes((verification.reviewStatus || '').toUpperCase())) {
      setPhaseNotice(verification.reviewNotes);
    } else {
      setPhaseNotice(null);
    }
    setAlreadyApproved((verification?.reviewStatus || '').toUpperCase() === 'APPROVED');
    setActivePhase(phaseForVerification(verification));
    setShowResume(false);
    setPendingEmail(null);
  }

  /* ------------------------- validación ------------------------- */
  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.responsibleName.trim()) e.responsibleName = 'Ingresa el nombre del responsable';
    if (!form.cargo.trim()) e.cargo = 'Ingresa el cargo';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = 'Correo no válido';
    else if (emailTaken) e.email = emailTaken;
    if (!/^9\d{8}$/.test(form.phone)) e.phone = 'Teléfono chileno de 9 dígitos (empieza en 9)';
    if (authProvider === 'EMAIL_PASSWORD' && form.password.length < 8) e.password = 'Mínimo 8 caracteres';
    if (!form.storeName.trim()) e.storeName = 'Ingresa el nombre de tu tienda';
    if (!/^[0-9.]+-[0-9kK]$/.test(form.taxId.trim())) e.taxId = 'RUT con formato 12.345.678-9';
    else if (taxIdTaken) e.taxId = taxIdTaken;
    if (!form.giro) e.giro = 'Selecciona un giro';
    if (form.giro === 'other' && !form.giroOtro.trim()) e.giroOtro = 'Especifica el giro';
    if (!form.regionId) e.regionId = 'Selecciona una región';
    if (!form.comunaId) e.comunaId = 'Selecciona una comuna';
    if (!form.address.trim()) e.address = 'Ingresa la dirección';
    if (!form.acceptsTerms) e.acceptsTerms = 'Debes aceptar los términos';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* ------------------------- submit registro ------------------------- */
  async function handleSubmit() {
    setFormError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload: SellerRegistrationPayload = {
        responsibleName: form.responsibleName.trim(),
        cargo: form.cargo.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone,
        authProvider,
        storeName: form.storeName.trim(),
        taxId: form.taxId.trim(),
        giro: form.giro === 'other' ? form.giroOtro.trim() : form.giro,
        direccion: {
          comunaId: Number(form.comunaId),
          calleYNumero: form.address.trim(),
          codigoPostal: form.codigoPostal.trim() || undefined,
        },
        acceptsTerms: true,
        termsVersion: LEGAL_VERSION_CODE,
        origin: 'SITIO_WEB',
      };
      if (authProvider === 'GOOGLE' && google) {
        payload.idToken = google.idToken;
        payload.userProfileUrl = google.picture;
      } else {
        payload.password = form.password;
      }

      const result = await registerSeller(payload);
      if (isPendingVerification(result)) {
        setPendingEmail(result.email);
      } else {
        setSession({
          sellerId: result.sellerId,
          token: result.token,
          storeName: result.storeName,
          founder: result.founder,
        });
        setAlreadyApproved(false);
        setActivePhase(1);
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        // Ya existe una postulación con este correo o RUT: ofrecemos retomarla con los mismos datos que acaba de escribir.
        setResumePrefill({ taxId: form.taxId.trim(), email: form.email.trim().toLowerCase(), password: form.password });
        setShowResume(true);
        setFormError('');
      } else {
        setFormError(err?.message || 'No pudimos crear tu cuenta. Intenta nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    if (code.trim().length !== 6 || !pendingEmail) return;
    setVerifying(true);
    setFormError('');
    try {
      const result = await verifyRegistrationCode(pendingEmail, code.trim());
      setSession({
        sellerId: result.sellerId,
        token: result.token,
        storeName: result.storeName,
        founder: result.founder,
      });
      setPendingEmail(null);
      setAlreadyApproved(false);
      setActivePhase(1);
    } catch (err: any) {
      setFormError(err?.message || 'El código no es válido o expiró.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (!pendingEmail) return;
    try {
      await resendRegistrationCode(pendingEmail);
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch { /* noop */ }
  }

  /* ================================================================= */
  return (
    <div className="founder-reg">
      <header className="founder-reg-topbar">
        <button className="founder-reg-back" onClick={onBack}>
          <ArrowLeft size={18} /> Volver al inicio
        </button>
        <button type="button" className="founder-reg-brand" aria-label="RepuesTop, inicio" onClick={onBack}>
          <img src="/about-assets/repuestop-icon.jpg" alt="" /><span>Repues<span>Top</span></span>
        </button>
      </header>

      <div className="founder-reg-shell">
        {/* ---------------- columna izquierda: contexto + timeline ---------------- */}
        <aside className="founder-reg-aside">
          <span className="founder-reg-ribbon"><Sparkles size={13} /> Postulación tienda fundadora</span>
          <h1>Únete como <em>tienda fundadora</em> de RepuesTop</h1>
          <p className="founder-reg-lead">
            Completa tu registro y sigue las 4 fases para activar tu tienda con beneficios de fundador:
            5% de comisión fija, distintivo oficial y mayor visibilidad.
          </p>
          <Timeline activePhase={activePhase} />

          {activePhase === 0 && !blocked && (
            <button type="button" className="founder-reg-resume-link" onClick={() => setShowResume(true)}>
              <span className="founder-reg-resume-link-icon"><RotateCcw size={16} /></span>
              <span className="founder-reg-resume-link-text">
                <strong>¿Ya iniciaste tu postulación?</strong>
                <span>Continuar donde quedé</span>
              </span>
            </button>
          )}
        </aside>

        {/* ---------------- columna derecha: contenido por fase ---------------- */}
        <section className="founder-reg-main">
          {blocked ? (
            <BlockedInfo reason={blocked} />
          ) : showResume ? (
            <ResumeCard
              prefill={resumePrefill}
              onResolved={resolveSellerSession}
              onClose={() => setShowResume(false)}
            />
          ) : (
            <>
              {activePhase === 0 && !pendingEmail && !methodChosen && (
                <MethodChooser googleRef={googleRef} googleMsg={googleMsg} onManual={chooseManual} remountKey={googleRemountKey} />
              )}

              {activePhase === 0 && !pendingEmail && methodChosen && (
                <RegistrationForm
                  form={form} errors={errors} update={update}
                  authProvider={authProvider} emailLocked={emailLocked}
                  google={google} onChangeMethod={changeMethod}
                  showPassword={showPassword} setShowPassword={setShowPassword}
                  regiones={regiones} comunas={comunas} geoError={geoError}
                  onRegionChange={(regionId) => setForm((f) => ({ ...f, regionId, comunaId: '' }))}
                  submitting={submitting} formError={formError}
                  onSubmit={handleSubmit}
                  onOpenLegal={setLegal}
                  onEmailBlur={checkEmailNow} checkingEmail={checkingEmail}
                  onTaxIdBlur={checkTaxIdNow} checkingTaxId={checkingTaxId}
                />
              )}

              {activePhase === 0 && pendingEmail && (
                <VerifyCode
                  email={pendingEmail} code={code} setCode={setCode}
                  verifying={verifying} formError={formError} resent={resent}
                  onVerify={handleVerify} onResend={handleResend}
                  onBack={() => { setPendingEmail(null); setCode(''); setFormError(''); }}
                />
              )}

              {activePhase === 1 && session && (
                <DocumentsUpload
                  session={session}
                  notice={phaseNotice}
                  onDone={() => { setPhaseNotice(null); setActivePhase(2); }}
                />
              )}

              {activePhase === 2 && (
                <ReviewInfo storeName={session?.storeName} onFinish={() => setActivePhase(3)} />
              )}

              {activePhase === 3 && (
                <ApprovedInfo approved={alreadyApproved} onHome={onBack} />
              )}
            </>
          )}
        </section>
      </div>

      <LegalModal
        open={legal !== null}
        title={legal === 'privacy' ? 'Política de privacidad' : 'Términos y condiciones'}
        text={legal === 'privacy' ? PRIVACIDAD_POLICY : VENDEDOR_TERMS}
        onClose={() => setLegal(null)}
      />
    </div>
  );
}

/* ==================================================================== *
 * Timeline
 * ==================================================================== */
function Timeline({ activePhase }: { activePhase: number }) {
  return (
    <ol className="founder-timeline">
      {PHASES.map((phase, i) => {
        const state = i < activePhase ? 'done' : i === activePhase ? 'active' : 'todo';
        return (
          <li key={phase.title} className={`founder-timeline-step is-${state}`}>
            <span className="founder-timeline-marker">
              {state === 'done' ? <Check size={16} /> : phase.icon}
            </span>
            <div className="founder-timeline-body">
              <strong>Fase {i + 1} · {phase.title}</strong>
              <span>{phase.text}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ==================================================================== *
 * Fase 1a — Elegir método de creación de cuenta
 * ==================================================================== */
function GoogleGIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.9 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 12.9 4.5 4 13.4 4 24.5S12.9 44.5 24 44.5c11 0 20.5-8 20.5-20.5 0-1.4-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5c-7.6 0-14.1 4.3-17.4 10.2z" />
      <path fill="#4CAF50" d="M24 44.5c5.4 0 10.3-1.8 14-4.9l-6.5-5.5C29.6 35.9 26.9 37 24 37c-5.4 0-9.9-3.1-11.4-7.5l-6.6 5.1C9.8 40.2 16.3 44.5 24 44.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.7-6.7 6.6l6.5 5.5C37.9 38.2 40.5 32 40.5 24.5c0-1.4-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function MethodChooser({ googleRef, googleMsg, onManual, remountKey }: {
  googleRef: React.RefObject<HTMLDivElement>; googleMsg: string; onManual: () => void; remountKey: number;
}) {
  return (
    <div className="founder-reg-card">
      <div className="founder-reg-head">
        <h2>Crea tu cuenta de tienda fundadora</h2>
        <p>Elige cómo quieres crearla. La usarás para ingresar al panel de vendedores y, cuando esté disponible, a la app de RepuesTop.</p>
      </div>

      <div className="founder-reg-method-grid">
        <div className="founder-reg-method-card">
          <span className="founder-reg-method-icon"><GoogleGIcon /></span>
          <h3>Crear con Google</h3>
          <p>Inicias sesión con tu cuenta de Google cada vez. Tu correo queda verificado al instante, sin contraseñas.</p>
          {googleEnabled ? (
            <>
              <div key={remountKey} ref={googleRef} className="founder-reg-google-btn" />
              {googleMsg && <p className="founder-reg-hint-error">{googleMsg}</p>}
            </>
          ) : (
            <>
              <button type="button" className="button button-outline founder-reg-method-btn" disabled>Continuar con Google</button>
              <small className="founder-reg-hint">Disponible al configurar el acceso con Google.</small>
            </>
          )}
        </div>

        <div className="founder-reg-method-card">
          <span className="founder-reg-method-icon founder-reg-method-icon-manual"><Mail size={22} /></span>
          <h3>Crear manualmente</h3>
          <p>Te registras con tu correo y una contraseña. Inicias sesión con ambos cada vez que vuelvas.</p>
          <button type="button" className="button button-outline founder-reg-method-btn" onClick={onManual}>
            Registro manual <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className="founder-reg-method-note">
        <ShieldCheck size={15} />
        <span>Con esta cuenta ingresarás al <strong>panel de vendedores</strong> y, cuando esté disponible, a la <strong>app de RepuesTop</strong>.</span>
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Fase 1b — Formulario de registro
 * ==================================================================== */
type RegFormProps = {
  form: FormState; errors: Partial<Record<keyof FormState, string>>;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  authProvider: 'EMAIL_PASSWORD' | 'GOOGLE'; emailLocked: boolean;
  google: GoogleProfile | null; onChangeMethod: () => void;
  showPassword: boolean; setShowPassword: (v: boolean) => void;
  regiones: UbicacionOption[]; comunas: UbicacionOption[]; geoError: string;
  onRegionChange: (regionId: string) => void;
  submitting: boolean; formError: string; onSubmit: () => void;
  onOpenLegal: (doc: LegalDoc) => void;
  onEmailBlur: (email: string) => void; checkingEmail: boolean;
  onTaxIdBlur: (taxId: string) => void; checkingTaxId: boolean;
};

function RegistrationForm(p: RegFormProps) {
  const { form, errors, update } = p;
  return (
    <div className="founder-reg-card">
      <div className="founder-reg-head">
        <h2>Crea tu cuenta de tienda fundadora</h2>
        <p>Ingresa los datos del responsable y de tu tienda. Podrás subir los documentos en el siguiente paso.</p>
      </div>

      <div className="founder-reg-method-pill">
        {p.authProvider === 'GOOGLE' && p.google ? (
          <>
            <GoogleGIcon />
            <div><strong>{p.google.email}</strong><span>Cuenta con Google · iniciarás sesión con Google</span></div>
          </>
        ) : (
          <>
            <Mail size={20} />
            <div><strong>Registro manual</strong><span>Iniciarás sesión con tu correo y contraseña</span></div>
          </>
        )}
        <button type="button" className="founder-reg-method-change" onClick={p.onChangeMethod}>Cambiar método</button>
      </div>

      <div className="founder-reg-grid">
        <Field label="Nombre del responsable" required error={errors.responsibleName}>
          <input value={form.responsibleName} placeholder="Nombre completo"
            onChange={(e) => update('responsibleName', e.target.value)} />
        </Field>
        <Field label="Cargo" required error={errors.cargo}>
          <input value={form.cargo} placeholder="Ej: Gerente, Administrador"
            onChange={(e) => update('cargo', e.target.value)} />
        </Field>

        <Field label="Correo electrónico" required error={errors.email}
          hint={p.emailLocked ? 'Verificado con tu cuenta de Google' : p.checkingEmail ? 'Verificando disponibilidad...' : undefined}>
          <input type="email" value={form.email} placeholder="ejemplo@correo.com" disabled={p.emailLocked}
            onChange={(e) => update('email', e.target.value)}
            onBlur={(e) => { if (!p.emailLocked) p.onEmailBlur(e.target.value); }} />
        </Field>
        <Field label="Teléfono" required error={errors.phone}>
          <div className="founder-reg-phone">
            <span>🇨🇱 +56</span>
            <input type="tel" value={form.phone} placeholder="9 1234 5678" maxLength={9}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, '');
                if (v.length && v[0] !== '9') v = '9' + v;
                update('phone', v.slice(0, 9));
              }} />
          </div>
        </Field>

        {p.authProvider === 'EMAIL_PASSWORD' && (
          <Field label="Contraseña" required error={errors.password} className="founder-reg-col-full">
            <div className="founder-reg-password">
              <input type={p.showPassword ? 'text' : 'password'} value={form.password}
                placeholder="Mínimo 8 caracteres"
                onChange={(e) => update('password', e.target.value)} />
              <button type="button" onClick={() => p.setShowPassword(!p.showPassword)} aria-label="Ver contraseña">
                {p.showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
        )}

        <div className="founder-reg-divider founder-reg-col-full"><Store size={15} /> Datos de la tienda</div>

        <Field label="Nombre de la tienda" required error={errors.storeName}>
          <input value={form.storeName} placeholder="Nombre de tu tienda o negocio"
            onChange={(e) => update('storeName', e.target.value)} />
        </Field>
        <Field label="RUT de la empresa" required error={errors.taxId}
          hint={p.checkingTaxId ? 'Verificando disponibilidad...' : undefined}>
          <input value={form.taxId} placeholder="12.345.678-9" inputMode="text" maxLength={12}
            onChange={(e) => update('taxId', formatRut(e.target.value))}
            onBlur={(e) => p.onTaxIdBlur(e.target.value)} />
        </Field>

        <Field label="Giro comercial" required error={errors.giro} className="founder-reg-col-full">
          <select value={form.giro} onChange={(e) => update('giro', e.target.value)}>
            <option value="">Selecciona el giro de tu tienda</option>
            {GIRO_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            <option value="other">Otro</option>
          </select>
        </Field>
        {form.giro === 'other' && (
          <Field label="Especificar giro" required error={errors.giroOtro} className="founder-reg-col-full">
            <input value={form.giroOtro} placeholder="Escribe tu giro comercial"
              onChange={(e) => update('giroOtro', e.target.value)} />
          </Field>
        )}

        <Field label="Región" required error={errors.regionId}>
          <select value={form.regionId} onChange={(e) => p.onRegionChange(e.target.value)}>
            <option value="">{p.regiones.length ? 'Selecciona una región' : 'Cargando...'}</option>
            {p.regiones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </Field>
        <Field label="Comuna" required error={errors.comunaId}>
          <select value={form.comunaId} disabled={!form.regionId}
            onChange={(e) => update('comunaId', e.target.value)}>
            <option value="">{form.regionId ? 'Selecciona una comuna' : 'Elige región primero'}</option>
            {p.comunas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Field>

        <Field label="Dirección" required error={errors.address}>
          <input value={form.address} placeholder="Av. Principal 123"
            onChange={(e) => update('address', e.target.value)} />
        </Field>
        <Field label="Código postal" hint="Opcional">
          <input value={form.codigoPostal} placeholder="Opcional"
            onChange={(e) => update('codigoPostal', e.target.value)} />
        </Field>
      </div>

      {p.geoError && <p className="founder-reg-hint-error">{p.geoError}</p>}

      <div className="founder-reg-terms">
        <input id="acceptsTerms" type="checkbox" checked={form.acceptsTerms}
          onChange={(e) => update('acceptsTerms', e.target.checked)} />
        <label htmlFor="acceptsTerms">
          Acepto los{' '}
          <button type="button" className="founder-reg-link" onClick={() => p.onOpenLegal('terms')}>términos y condiciones</button>
          {' '}y la{' '}
          <button type="button" className="founder-reg-link" onClick={() => p.onOpenLegal('privacy')}>política de privacidad</button>
          {' '}de RepuesTop.
        </label>
      </div>
      {errors.acceptsTerms && <p className="founder-reg-hint-error">{errors.acceptsTerms}</p>}

      {p.formError && <div className="founder-reg-alert">{p.formError}</div>}

      <button className="button founder-reg-submit" onClick={p.onSubmit} disabled={p.submitting}>
        {p.submitting ? 'Creando cuenta...' : <>Crear cuenta y continuar <ArrowRight size={18} /></>}
      </button>
    </div>
  );
}

/* ==================================================================== *
 * Verificación de correo
 * ==================================================================== */
function VerifyCode(p: {
  email: string; code: string; setCode: (v: string) => void;
  verifying: boolean; formError: string; resent: boolean;
  onVerify: () => void; onResend: () => void; onBack: () => void;
}) {
  return (
    <div className="founder-reg-card founder-reg-centered">
      <div className="founder-reg-icon-badge"><MailCheck size={28} /></div>
      <h2>Verifica tu correo</h2>
      <p>Te enviamos un código de 6 dígitos a <strong>{p.email}</strong>. Ingrésalo para activar tu cuenta.</p>
      <input className="founder-reg-code" inputMode="numeric" maxLength={6} placeholder="000000"
        value={p.code} onChange={(e) => p.setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
      {p.formError && <div className="founder-reg-alert">{p.formError}</div>}
      {p.resent && <p className="founder-reg-hint-ok">Código reenviado con éxito.</p>}
      <button className="button founder-reg-submit" onClick={p.onVerify}
        disabled={p.verifying || p.code.length !== 6}>
        {p.verifying ? 'Verificando...' : 'Verificar código'}
      </button>
      <div className="founder-reg-verify-actions">
        <button onClick={p.onResend}>Reenviar código</button>
        <button onClick={p.onBack}>Corregir datos</button>
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Retomar postulación (correo/RUT ya registrados)
 * ==================================================================== */
type ResumePrefill = { taxId: string; email: string; password: string };

function ResumeCard({ prefill, onResolved, onClose }: {
  prefill: ResumePrefill;
  onResolved: (session: SellerSession) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'rut' | 'email'>('rut');

  // Búsqueda por RUT
  const [taxId, setTaxId] = useState(prefill.taxId);
  const [lookup, setLookup] = useState<SellerLookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Login (RUT+contraseña o correo+contraseña)
  const [email, setEmail] = useState(prefill.email);
  const [password, setPassword] = useState(prefill.password);
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Olvidé mi contraseña (solo disponible vía RUT, igual que el backend)
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStage, setForgotStage] = useState<'send' | 'code' | 'newpass'>('send');
  const [forgotEmail, setForgotEmail] = useState<string | null>(null);
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Google
  const googleRef = useRef<HTMLDivElement | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [googleRemountKey, setGoogleRemountKey] = useState(0);

  // Si llegamos con un RUT precargado (ej. desde el link del correo de corrección), busca de una vez.
  useEffect(() => {
    if (prefill.taxId && /^[0-9.]+-[0-9kK]$/.test(prefill.taxId)) {
      handleLookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El iframe de Google no sobrevive un back/forward restaurado desde bfcache; forzamos remount.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setGoogleRemountKey((k) => k + 1);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  useEffect(() => {
    if (mode !== 'rut' || !lookup?.found || lookup.authProvider !== 'GOOGLE' || !googleRef.current) return;
    renderGoogleResumeButton(googleRef.current, async (session) => {
      setGoogleBusy(true);
      setGoogleError('');
      try {
        await onResolved(session);
      } catch (e: any) {
        setGoogleError(e?.message || 'No pudimos continuar tu postulación.');
      } finally {
        setGoogleBusy(false);
      }
    }, setGoogleError);
  }, [mode, lookup, googleRemountKey]);

  async function handleLookup() {
    if (looking) return;
    setLookupError('');
    setLookup(null);
    if (!/^[0-9.]+-[0-9kK]$/.test(taxId.trim())) { setLookupError('Ingresa un RUT con formato 12.345.678-9'); return; }
    setLooking(true);
    try {
      const result = await lookupSellerByTaxId(taxId.trim());
      if (!result.found) setLookupError('No encontramos ninguna tienda con ese RUT.');
      setLookup(result);
    } catch (e: any) {
      setLookupError(e?.message || 'No pudimos buscar ese RUT. Intenta nuevamente.');
    } finally {
      setLooking(false);
    }
  }

  async function handleLoginByTaxId() {
    setLoginError('');
    if (!password) { setLoginError('Ingresa tu contraseña'); return; }
    setLoggingIn(true);
    try {
      const session = await loginSellerByTaxId(taxId.trim(), password);
      await onResolved(session);
    } catch (e: any) {
      setLoginError(e?.message || 'No pudimos iniciar sesión.');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLoginByEmail() {
    setLoginError('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setLoginError('Ingresa un correo válido'); return; }
    if (!password) { setLoginError('Ingresa tu contraseña'); return; }
    setLoggingIn(true);
    try {
      const session = await loginSeller(email.trim().toLowerCase(), password);
      await onResolved(session);
    } catch (e: any) {
      setLoginError(e?.message || 'No pudimos iniciar sesión.');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleSendForgot() {
    setForgotError('');
    if (!/^[0-9.]+-[0-9kK]$/.test(taxId.trim())) { setForgotError('Ingresa el RUT de tu tienda con formato 12.345.678-9'); return; }
    setForgotBusy(true);
    try {
      const res = await sendSellerRecoverCode(taxId.trim());
      setForgotEmail(res.email);
      setForgotStage('code');
    } catch (e: any) {
      setForgotError(e?.message || 'No pudimos enviar el código.');
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleVerifyForgot() {
    setForgotError('');
    if (!forgotEmail || forgotCode.length !== 6) return;
    setForgotBusy(true);
    try {
      await verifySellerRecoverCode(forgotEmail, forgotCode);
      setForgotStage('newpass');
    } catch (e: any) {
      setForgotError(e?.message || 'El código no es válido o expiró.');
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleResetForgot() {
    setForgotError('');
    if (!forgotEmail) return;
    if (forgotNewPassword.length < 8) { setForgotError('Mínimo 8 caracteres'); return; }
    setForgotBusy(true);
    try {
      await resetSellerPassword(forgotEmail, forgotCode, forgotNewPassword);
      const session = await loginSellerByTaxId(taxId.trim(), forgotNewPassword);
      await onResolved(session);
    } catch (e: any) {
      setForgotError(e?.message || 'No pudimos restablecer tu contraseña.');
    } finally {
      setForgotBusy(false);
    }
  }

  return (
    <div className="founder-reg-card">
      <div className="founder-reg-resume-head">
        <div>
          <h2>Retomar postulación</h2>
          <p>Si ya empezaste a postular, continúa exactamente donde quedaste.</p>
        </div>
        <button type="button" className="founder-reg-resume-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
      </div>

      <div className="founder-reg-resume-tabs">
        <button type="button" className={mode === 'rut' ? 'is-active' : ''} onClick={() => { setMode('rut'); setLoginError(''); }}>RUT de mi tienda</button>
        <button type="button" className={mode === 'email' ? 'is-active' : ''} onClick={() => { setMode('email'); setLoginError(''); }}>Correo electrónico</button>
      </div>

      {mode === 'rut' && !forgotOpen && (
        <div className="founder-reg-resume-body">
          <Field label="RUT de la empresa" error={lookupError}>
            <div className="founder-reg-resume-search">
              <input value={taxId} placeholder="12.345.678-9" maxLength={12}
                onChange={(e) => { setTaxId(formatRut(e.target.value)); setLookup(null); }} />
              <button type="button" className="button" onClick={handleLookup} disabled={looking}>
                {looking ? 'Buscando...' : <><Search size={16} /> Buscar</>}
              </button>
            </div>
          </Field>

          {lookup?.found && lookup.authProvider === 'EMAIL_PASSWORD' && (
            <>
              <p className="founder-reg-hint-ok">Encontramos tu tienda · {lookup.maskedEmail}</p>
              <Field label="Contraseña" error={loginError}>
                <div className="founder-reg-password">
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    placeholder="Tu contraseña" onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Ver contraseña">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
              <button className="button founder-reg-submit" onClick={handleLoginByTaxId} disabled={loggingIn}>
                {loggingIn ? 'Ingresando...' : 'Continuar postulación'}
              </button>
              <button type="button" className="founder-reg-link founder-reg-forgot"
                onClick={() => { setForgotOpen(true); setForgotStage('send'); setForgotError(''); }}>
                <KeyRound size={13} /> Olvidé mi contraseña
              </button>
            </>
          )}

          {lookup?.found && lookup.authProvider === 'GOOGLE' && (
            <>
              <p className="founder-reg-hint-ok">Encontramos tu tienda · {lookup.maskedEmail} · registrada con Google</p>
              <div key={googleRemountKey} ref={googleRef} className="founder-reg-google-btn" />
              {googleBusy && <p className="founder-reg-hint-ok">Ingresando...</p>}
              {googleError && <p className="founder-reg-hint-error">{googleError}</p>}
            </>
          )}
        </div>
      )}

      {mode === 'rut' && forgotOpen && (
        <div className="founder-reg-resume-body">
          {forgotStage === 'send' && (
            <>
              <p>Enviaremos un código de recuperación al correo asociado al RUT <strong>{taxId}</strong>.</p>
              {forgotError && <p className="founder-reg-hint-error">{forgotError}</p>}
              <button className="button founder-reg-submit" onClick={handleSendForgot} disabled={forgotBusy}>
                {forgotBusy ? 'Enviando...' : 'Enviar código'}
              </button>
            </>
          )}
          {forgotStage === 'code' && (
            <>
              <p>Te enviamos un código de 6 dígitos a <strong>{forgotEmail}</strong>.</p>
              <input className="founder-reg-code" inputMode="numeric" maxLength={6} placeholder="000000"
                value={forgotCode} onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              {forgotError && <p className="founder-reg-hint-error">{forgotError}</p>}
              <button className="button founder-reg-submit" onClick={handleVerifyForgot} disabled={forgotBusy || forgotCode.length !== 6}>
                {forgotBusy ? 'Verificando...' : 'Verificar código'}
              </button>
            </>
          )}
          {forgotStage === 'newpass' && (
            <>
              <Field label="Nueva contraseña" error={forgotError}>
                <input type="password" value={forgotNewPassword} placeholder="Mínimo 8 caracteres"
                  onChange={(e) => setForgotNewPassword(e.target.value)} />
              </Field>
              <button className="button founder-reg-submit" onClick={handleResetForgot} disabled={forgotBusy}>
                {forgotBusy ? 'Guardando...' : 'Restablecer y continuar'}
              </button>
            </>
          )}
          <button type="button" className="founder-reg-link founder-reg-forgot" onClick={() => setForgotOpen(false)}>Volver</button>
        </div>
      )}

      {mode === 'email' && (
        <div className="founder-reg-resume-body">
          <Field label="Correo electrónico">
            <input type="email" value={email} placeholder="ejemplo@correo.com" onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Contraseña" error={loginError}>
            <div className="founder-reg-password">
              <input type={showPassword ? 'text' : 'password'} value={password}
                placeholder="Tu contraseña" onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Ver contraseña">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <button className="button founder-reg-submit" onClick={handleLoginByEmail} disabled={loggingIn}>
            {loggingIn ? 'Ingresando...' : 'Continuar postulación'}
          </button>
          <p className="founder-reg-hint">
            ¿Olvidaste tu contraseña?{' '}
            <button type="button" className="founder-reg-link" onClick={() => setMode('rut')}>Usa el RUT de tu tienda</button> para recuperarla.
          </p>
        </div>
      )}
    </div>
  );
}

function BlockedInfo({ reason }: { reason: string }) {
  return (
    <div className="founder-reg-card founder-reg-centered">
      <div className="founder-reg-icon-badge founder-reg-icon-blocked"><AlertTriangle size={28} /></div>
      <h2>Tu cuenta está bloqueada</h2>
      <p>{reason}</p>
      <p>Escríbenos a <strong>contacto@repuestop.cl</strong> para revisar tu caso.</p>
    </div>
  );
}

/* ==================================================================== *
 * Fase 2 — Subida de documentos
 * ==================================================================== */
type DocKey = 'representativeDocument' | 'inicioActividadesDoc' | 'patenteDoc' | 'boletaFacturaDoc';
const DOC_FIELDS: { key: DocKey; label: string; hint: string; required: boolean }[] = [
  { key: 'representativeDocument', label: 'Cédula del representante', hint: 'Foto o PDF de la cédula por ambos lados.', required: true },
  { key: 'inicioActividadesDoc', label: 'Inicio de actividades (SII)', hint: 'Documento de inicio de actividades.', required: true },
  { key: 'patenteDoc', label: 'Patente comercial', hint: 'Patente municipal vigente.', required: true },
  { key: 'boletaFacturaDoc', label: 'Boleta o factura', hint: 'Ejemplo de boleta o factura de tu tienda.', required: false },
];

const COMMENT_MAX = 100;

/**
 * Sanea y valida una URL de sitio web o red social.
 * Antepone https:// si carece de esquema y rechaza esquemas peligrosos como javascript: o data:.
 */
function sanitizeWebsiteUrl(rawUrl: string): string | undefined {
  const clean = rawUrl.trim();
  if (!clean) return undefined;
  if (/^(javascript|data|vbscript):/i.test(clean)) {
    return undefined;
  }
  if (!/^https?:\/\//i.test(clean)) {
    return `https://${clean}`;
  }
  return clean;
}

function DocumentsUpload({ session, notice, onDone }: { session: Session; notice?: string | null; onDone: () => void }) {
  const [files, setFiles] = useState<Record<DocKey, File | null>>({
    representativeDocument: null, inicioActividadesDoc: null, patenteDoc: null, boletaFacturaDoc: null,
  });
  const [existing, setExisting] = useState<VerificacionResponse | null>(null);
  const [website, setWebsite] = useState('');
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchVerificacionStatus(session.sellerId, session.token)
      .then((v) => { if (!cancelled) { setExisting(v); if (v?.websiteOrSocialUrl) setWebsite(v.websiteOrSocialUrl); } })
      .catch(() => { /* si falla, tratamos como sin documentos previos */ });
    return () => { cancelled = true; };
  }, [session.sellerId, session.token]);

  // Un doc requerido está satisfecho si se eligió un archivo nuevo o ya existe uno guardado (ej. tras una corrección parcial).
  const requiredReady = DOC_FIELDS.filter((d) => d.required)
    .every((d) => files[d.key] || Boolean(existing?.[d.key]));

  async function submit() {
    setError('');
    if (!requiredReady) { setError('Adjunta los documentos obligatorios para continuar.'); return; }
    
    // Sanear URL antes de enviar (bloquea javascript: y antepone https://)
    const sanitizedUrl = website.trim() ? sanitizeWebsiteUrl(website) : undefined;
    if (website.trim() && !sanitizedUrl) {
      setError('Ingresa una URL válida (ej: https://instagram.com/tu-tienda).');
      return;
    }

    setUploading(true);
    try {
      await uploadVerificacion(session.sellerId, session.token, {
        ...files,
        websiteOrSocialUrl: sanitizedUrl,
        mensaje: comment.trim() || undefined,
      });
      onDone();
    } catch (err: any) {
      setError(err?.message || 'No pudimos subir los documentos. Intenta nuevamente.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="founder-reg-card">
      <div className="founder-reg-head">
        <div className="founder-reg-success-pill"><Check size={14} /> Cuenta creada{session.founder ? ' · Fundador' : ''}</div>
        <h2>Sube los documentos de tu tienda</h2>
        <p>Verificamos cada tienda antes de abrirla para proteger a compradores y proveedores. Al enviarlos recibirás un correo de confirmación.</p>
      </div>

      {notice && (
        <div className="founder-reg-notice">
          <AlertTriangle size={16} />
          <div><strong>El equipo pidió una corrección</strong><span>{notice}</span></div>
        </div>
      )}

      <div className="founder-reg-docs">
        {DOC_FIELDS.map((doc) => (
          <FileField key={doc.key} label={doc.label} hint={doc.hint} required={doc.required}
            file={files[doc.key]} existingUrl={existing?.[doc.key] ?? null}
            onChange={(f) => setFiles((prev) => ({ ...prev, [doc.key]: f }))} />
        ))}
      </div>

      <Field label="Sitio web o red social" hint="Opcional">
        <input value={website} placeholder="https://instagram.com/tu-tienda"
          onChange={(e) => setWebsite(e.target.value)} />
      </Field>

      {notice && (
        <Field label="Comentario para el equipo" hint={`${comment.length}/${COMMENT_MAX} · Opcional`}>
          <textarea value={comment} rows={2} maxLength={COMMENT_MAX}
            placeholder="Cuéntanos qué corregiste o agrega contexto para la revisión."
            onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))} />
        </Field>
      )}

      {error && <div className="founder-reg-alert">{error}</div>}

      <button className="button founder-reg-submit" onClick={submit} disabled={uploading || !requiredReady}>
        {uploading ? 'Enviando documentos...' : <>Enviar documentos <ArrowRight size={18} /></>}
      </button>
    </div>
  );
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB límite defensivo
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

function FileField({ label, hint, required, file, existingUrl, onChange }: {
  label: string; hint: string; required: boolean; file: File | null; existingUrl?: string | null; onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const hasFile = Boolean(file || existingUrl);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFileError(null);
    if (!selected) {
      onChange(null);
      return;
    }
    // Validar tamaño máximo (10 MB)
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`El archivo "${selected.name}" supera el límite de 10 MB.`);
      onChange(null);
      return;
    }
    // Validar extensión de archivo permitida
    const ext = selected.name.substring(selected.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFileError(`Formato no permitido para "${selected.name}". Usa PDF, PNG o JPG.`);
      onChange(null);
      return;
    }
    onChange(selected);
  };

  return (
    <div className={`founder-file ${hasFile ? 'has-file' : ''} ${fileError ? 'has-error' : ''}`}>
      <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" hidden
        onChange={handleFileChange} />
      <button type="button" className="founder-file-drop" onClick={() => inputRef.current?.click()}>
        <span className="founder-file-icon">{hasFile ? <FileText size={20} /> : <UploadCloud size={20} />}</span>
        <span className="founder-file-text">
          <strong>{label}{required && <i className="founder-req">*</i>}</strong>
          <small>{fileError ? <span className="founder-field-error">{fileError}</span> : file ? file.name : existingUrl ? 'Ya adjuntado · toca para reemplazar' : hint}</small>
        </span>
        {hasFile && !fileError && <span className="founder-file-check"><Check size={16} /></span>}
      </button>
    </div>
  );
}

/* ==================================================================== *
 * Fase 3 — En revisión
 * ==================================================================== */
function ReviewInfo({ storeName, onFinish }: { storeName?: string; onFinish: () => void }) {
  return (
    <div className="founder-reg-card founder-reg-centered">
      <div className="founder-reg-icon-badge founder-reg-icon-review"><ClipboardCheck size={28} /></div>
      <h2>¡Documentos recibidos!</h2>
      <p>
        {storeName ? <><strong>{storeName}</strong> quedó en revisión. </> : 'Tu tienda quedó en revisión. '}
        Nuestro equipo de Mediación y Confianza validará tu documentación. Te enviaremos un correo con el
        veredicto final apenas termine la revisión.
      </p>
      <ul className="founder-reg-checklist">
        <li><MailCheck size={16} /> Recibiste un correo confirmando la recepción de tus documentos.</li>
        <li><ShieldCheck size={16} /> El equipo revisa que todo esté correcto (normalmente en 24-48h).</li>
        <li><PartyPopper size={16} /> Cuando se apruebe, podrás ingresar al panel de vendedores.</li>
      </ul>
      <button className="button button-outline founder-reg-submit" onClick={onFinish}>
        Ver qué sigue <ArrowRight size={18} />
      </button>
    </div>
  );
}

/* ==================================================================== *
 * Fase 4 — Aprobación (informativa)
 * ==================================================================== */
function ApprovedInfo({ approved, onHome }: { approved: boolean; onHome: () => void }) {
  if (approved) {
    return (
      <div className="founder-reg-card founder-reg-centered">
        <div className="founder-reg-icon-badge founder-reg-icon-approved"><Crown size={28} /></div>
        <h2>¡Tu tienda ya está aprobada!</h2>
        <p>
          Tu cuenta de tienda fundadora ya fue validada por nuestro equipo. Ingresa al <strong>panel de vendedores</strong> para
          cargar tu inventario y empezar a vender con 5% de comisión fija.
        </p>
        <a className="button founder-reg-submit" href={PANEL_VENDEDORES_URL}>
          Ir al panel de vendedores <ArrowRight size={18} />
        </a>
        <button type="button" className="button button-outline founder-reg-submit" onClick={onHome}>Volver al inicio</button>
      </div>
    );
  }
  return (
    <div className="founder-reg-card founder-reg-centered">
      <div className="founder-reg-icon-badge founder-reg-icon-approved"><Crown size={28} /></div>
      <h2>Último paso: aprobación e ingreso</h2>
      <p>
        Cuando el equipo apruebe tu tienda, recibirás un correo con el acceso al <strong>panel de vendedores</strong>,
        donde podrás cargar tu inventario y empezar a vender como tienda fundadora con 5% de comisión fija.
      </p>
      <ul className="founder-reg-checklist">
        <li><Check size={16} /> Distintivo oficial de Fundador en tus publicaciones.</li>
        <li><Check size={16} /> Mayor visibilidad en las búsquedas por patente.</li>
        <li><Check size={16} /> Acceso anticipado a la gestión de inventario.</li>
      </ul>
      <button className="button founder-reg-submit" onClick={onHome}>Volver al inicio</button>
    </div>
  );
}

/* ==================================================================== *
 * Modal legal (términos / privacidad)
 * ==================================================================== */
function LegalModal({ open, title, text, onClose }: {
  open: boolean; title: string; text: string; onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="founder-legal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="founder-legal" onClick={(e) => e.stopPropagation()}>
        <header className="founder-legal-head">
          <h3>{title}</h3>
          <button onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="founder-legal-body">
          {text.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Campo reutilizable
 * ==================================================================== */
function Field({ label, required, error, hint, className, children }: {
  label: string; required?: boolean; error?: string; hint?: string; className?: string; children: ReactNode;
}) {
  return (
    <label className={`founder-field ${className ?? ''} ${error ? 'has-error' : ''}`}>
      <span className="founder-field-label">{label}{required && <i className="founder-req">*</i>}</span>
      {children}
      {error ? <span className="founder-field-error">{error}</span>
        : hint ? <span className="founder-field-hint">{hint}</span> : null}
    </label>
  );
}
