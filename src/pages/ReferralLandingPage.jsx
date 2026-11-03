import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Copy, Download, Globe, Smartphone, UserPlus } from 'lucide-react';
import { validateReferral } from '../components/founderApi';
import { googlePlayUrlWithReferral } from '../config/mobileApp';
import { ROUTES } from '../routes/paths';
import { useDocumentTitle, useNoIndex } from '../routes/useDocumentTitle';
import { normalizeCaptadorCode, storeCaptadorReferral } from '../utils/captadorReferral';
import '../styles/referrals.css';

function detectDevice() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'desktop';
}

/**
 * Página a la que lleva el QR de un taller (`/r/TL-XXXXXX`): le da la bienvenida a quien lo escanea, muestra el código del
 * taller (para escribirlo a mano si hace falta) y lo lleva a crear su cuenta, con el código ya puesto, por la web o por la
 * app de Android. La web y la app de Google Play se ofrecen siempre (en dev también, para probar el flujo). 
 */
export default function ReferralLandingPage() {
  const { code: rawCode } = useParams();
  const code = useMemo(() => normalizeCaptadorCode(rawCode), [rawCode]);
  const [workshopName, setWorkshopName] = useState(null);
  const [status, setStatus] = useState('checking'); // checking | valid | invalid | error
  const [copied, setCopied] = useState(false);
  const device = useMemo(detectDevice, []);
  const playUrl = googlePlayUrlWithReferral(code);
  useDocumentTitle('Te invitaron a RepuesTop');
  useNoIndex();

  // El código se guarda al entrar: el registro (con correo o con Google) lo toma de ahí aunque la persona navegue antes.
  useEffect(() => { storeCaptadorReferral(code); }, [code]);

  useEffect(() => {
    let active = true;
    if (!code) { setStatus('invalid'); return undefined; }
    validateReferral(code)
      .then((result) => {
        if (!active) return;
        setStatus(result?.valido === true ? 'valid' : 'invalid');
        setWorkshopName(result?.valido === true ? result.captadorAlias ?? null : null);
      })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Sin portapapeles: el código está a la vista para anotarlo. */
    }
  };

  const registerHref = `${ROUTES.home}?ref=${encodeURIComponent(code)}`;
  const showAndroid = Boolean(playUrl);

  return (
    <div className="rl">
      <section className="rl-card" aria-labelledby="rl-title">
        <span className="rl-badge"><UserPlus size={22} aria-hidden="true" /></span>
        <h1 id="rl-title">
          {status === 'valid' && workshopName ? `${workshopName} te invita a RepuesTop` : 'Te invitaron a RepuesTop'}
        </h1>
        <p className="rl-lead">Crea tu cuenta de comprador: busca repuestos por patente, cotiza y sigue tus pedidos y citas de taller.</p>

        {status === 'invalid' ? (
          <p className="rl-warn" role="alert">Este código no existe o ya no está activo. Igual puedes crear tu cuenta sin él.</p>
        ) : (
          <div className="rl-code">
            <small>Código de invitación</small>
            <strong>{code}</strong>
            <button type="button" onClick={copy} aria-label="Copiar el código de invitación">
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar código'}
            </button>
          </div>
        )}

        <div className="rl-actions">
          {playUrl && (
            <a className={`rl-btn ${device === 'android' ? 'is-primary' : ''}`} href={playUrl} target="_blank" rel="noopener noreferrer"
              style={device === 'android' ? { order: -1 } : undefined}>
              <Smartphone size={18} aria-hidden="true" /> Descargar en Google Play
            </a>
          )}
          <Link className={`rl-btn ${device === 'android' && playUrl ? '' : 'is-primary'}`} to={registerHref}>
            <Globe size={18} aria-hidden="true" /> Crear mi cuenta en la web
          </Link>
        </div>

        <ul className="rl-notes">
          {showAndroid && (
            <li><Download size={15} aria-hidden="true" /> Si descargas la app, al crear tu cuenta escribe el código de arriba en «Código de invitación».</li>
          )}
          {device !== 'android' && <li><Smartphone size={15} aria-hidden="true" /> La app es para Android; en iPhone o computador crea tu cuenta desde la web.</li>}
          <li><Check size={15} aria-hidden="true" /> Puedes registrarte con tu correo o con Google. Tu código se completa solo en la web; si no, ingrésalo a mano.</li>
        </ul>
      </section>
    </div>
  );
}
