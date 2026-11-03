import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, QrCode, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getReferralsSummary, referralsInCycle, referralsProgress } from '../../services/workshopApi';
import { apiErrorMessage } from '../../services/walletStorage';
import { shareLink } from '../../utils/shareLink';
import '../../styles/referrals.css';

/** Cada cuánto se vuelve a pedir el avance: lo justo para ver subir la barra cuando alguien termina de registrarse. */
const REFRESH_MS = 5000;

/**
 * «Invitar compradores»: el QR y el código del taller. El comprador escanea el QR (página de bienvenida con la app de Android o
 * la web) y crea su cuenta con el código; cada 25 que lo hacen el taller gana 30 días de agendamiento gratis. Es el equivalente
 * web de `mobile/app/(workshop)/referidos.tsx`. El avance se refresca solo, únicamente con la pestaña visible.
 */
export default function WorkshopReferralsPanel() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareNote, setShareNote] = useState('');

  const load = useCallback(async () => {
    try {
      setSummary(await getReferralsSummary());
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'No pudimos cargar tus referidos.'));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const copy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.codigo);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Sin portapapeles: el código está a la vista. */
    }
  };

  const share = async () => {
    if (!summary) return;
    const result = await shareLink({
      url: summary.enlace,
      title: 'Crea tu cuenta en RepuesTop',
      text: `Crea tu cuenta en RepuesTop con el código de mi taller ${summary.codigo}`,
    });
    setShareNote(result === 'copied' ? 'Enlace copiado.' : result === 'failed' ? 'No se pudo compartir.' : '');
  };

  if (!summary) {
    return (
      <div className="profile-panel">
        <div className="ads-mgmt-state">
          {error ? <p>{error}</p> : <><Loader2 size={20} className="spin-icon" /><p>Cargando tus referidos…</p></>}
          {error && <button type="button" className="btn-post-ad" onClick={load}>Reintentar</button>}
        </div>
      </div>
    );
  }

  const done = referralsInCycle(summary);
  return (
    <div className="profile-panel wr">
      <header className="wr-head">
        <h2><span className="ads-mgmt-h2-ic"><QrCode size={20} /></span> Invitar compradores</h2>
        <p>
          Por cada {summary.porPremio} compradores que se registren con tu código, ganas {summary.diasPorPeriodo} días de agendamiento gratis.
        </p>
      </header>

      <section className="wr-card wr-qr" aria-label="Tu código QR">
        <div className="wr-qr-box"><QRCodeSVG value={summary.enlace} size={208} level="M" marginSize={1} /></div>
        <p className="wr-muted">El comprador escanea el QR y entra a la web o descarga la app para crear su cuenta.</p>
        <div className="wr-code">
          <small>Código de tu taller</small>
          <strong>{summary.codigo}</strong>
          <button type="button" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar código'}</button>
        </div>
        <button type="button" className="wr-share" onClick={share}><Share2 size={16} /> Compartir mi enlace</button>
        {shareNote && <small className="wr-muted" role="status">{shareNote}</small>}
      </section>

      <section className="wr-card" aria-label="Tu avance">
        <strong>Tu avance</strong>
        <div
          className="wr-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={summary.porPremio}
          aria-valuenow={done}
          aria-label={`${done} de ${summary.porPremio} compradores`}
        >
          <span style={{ width: `${Math.round(referralsProgress(summary) * 100)}%` }} />
        </div>
        <div className="wr-track-meta">
          <b>{`${done} de ${summary.porPremio} compradores`}</b>
          <span>{`Te faltan ${summary.paraProximo}`}</span>
        </div>
        <small className="wr-muted">
          {summary.periodosGanados > 0
            ? `Ya ganaste ${summary.periodosGanados} ${summary.periodosGanados === 1 ? 'periodo' : 'periodos'} de ${summary.diasPorPeriodo} días. `
            : ''}
          Cuenta quien crea su cuenta con tu código y verifica su correo (con Google es al instante).
        </small>
      </section>

      <section className="wr-card" aria-label="Cómo se registra el comprador">
        <strong>Cómo se registra el comprador</strong>
        <ol className="wr-steps">
          <li>Escanea tu QR con la cámara del celular.</li>
          <li>En Android descarga la app desde Play Store; en iPhone entra directo a la web.</li>
          <li>Crea su cuenta con correo o con Google. Tu código aparece ya escrito; si no, lo ingresa a mano (está bajo el QR).</li>
        </ol>
      </section>
    </div>
  );
}
