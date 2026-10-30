import React, { useEffect, useState } from 'react';
import { CalendarDays, Gavel, History, PackageCheck, Star, TrendingUp } from 'lucide-react';
import { getAuctionBuyerProfile, rateAuctionBuyer } from '../services/auctionApi';
import AuctionBuyerReviewsModal from './AuctionBuyerReviewsModal';
import { Stars, formatSeniority } from './AuctionStars';
import AuctionAvatar from './AuctionAvatar';
import AuctionInfoTip from './AuctionInfoTip';
import '../styles/auction-social.css';

function RateBuyerForm({ auctionId, onRated }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!stars) { setError('Elige de 1 a 5 estrellas.'); return; }
    setSaving(true);
    setError('');
    try {
      await rateAuctionBuyer(auctionId, { estrellas: stars, comentario: comment.trim() || undefined });
      onRated();
    } catch (err) {
      setError(err?.message || 'No pudimos guardar la calificación.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="as-rate-form" onSubmit={submit}>
      <strong>Califica a este comprador</strong>
      <div className="as-rate-stars" role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} estrellas`} onClick={() => setStars(n)}>
            <Star size={22} className={n <= stars ? 'is-on' : ''} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Comentario opcional: pago, trato, retiro…"
      />
      {error && <p className="as-error" role="alert">{error}</p>}
      <button type="submit" className="as-btn-primary" disabled={saving}>
        {saving ? 'Guardando…' : 'Enviar calificación'}
      </button>
    </form>
  );
}

/** Tarjeta lateral con los datos públicos del comprador que publicó la búsqueda. */
export default function AuctionBuyerCard({ auctionId, vehicle, region }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);

  const load = async () => {
    try {
      setProfile(await getAuctionBuyerProfile(auctionId));
      setFailed(false);
    } catch (err) {
      console.error('Error cargando perfil del comprador:', err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [auctionId]);

  if (loading) {
    return <div className="as-card as-card-skeleton" aria-busy="true" />;
  }
  if (failed || !profile) {
    return (
      <section className="as-card">
        <h2 className="as-title">Datos del comprador</h2>
        <p className="as-muted">No pudimos cargar los datos del comprador.</p>
      </section>
    );
  }

  const rated = profile.totalCalificaciones > 0;

  return (
    <section className="as-card as-buyer-card" aria-label="Datos del comprador">
      <div className="as-buyer">
        <AuctionAvatar className="as-avatar" src={profile.fotoUrl} name={profile.nombre} />
        <div className="as-buyer-info">
          <strong>
            {profile.nombre}
            <AuctionInfoTip label="Sobre este comprador">
              {profile.nombre.split(' ')[0]} necesita este repuesto{vehicle ? ` para su ${vehicle}` : ' para su vehículo'}.
              {region ? ` Se encuentra en ${region} y busca` : ' Busca'} una solución confiable y rápida.
            </AuctionInfoTip>
          </strong>
          <span>Comprador · {formatSeniority(profile)}</span>
        </div>
      </div>

      <div className="as-rating-box">
        {rated ? (
          <>
            <div className="as-rating-score">
              <strong>{profile.calificacionPromedio.toFixed(1)}</strong>
              <Stars value={profile.calificacionPromedio} size={15} />
              <small>{profile.totalCalificaciones} {profile.totalCalificaciones === 1 ? 'calificación' : 'calificaciones'}</small>
            </div>
            <ul className="as-rating-bars" aria-label="Distribución de calificaciones">
              {(profile.distribucionEstrellas || []).map((count, index) => (
                <li key={index}>
                  <span>{5 - index}★</span>
                  <i><b style={{ width: `${profile.totalCalificaciones ? (count / profile.totalCalificaciones) * 100 : 0}%` }} /></i>
                  <small>{count}</small>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="as-muted">Calificación como comprador: aún sin calificaciones de tiendas.</p>
        )}
      </div>

      <dl className="as-stats">
        <div><dt><Gavel size={13} /> Búsquedas publicadas</dt><dd>{profile.totalSubastasPublicadas}</dd></div>
        <div><dt><PackageCheck size={13} /> Compras cerradas</dt><dd>{profile.totalSubastasCerradas}</dd></div>
        <div><dt><TrendingUp size={13} /> Tasa de adjudicación</dt><dd>{profile.tasaAdjudicacion != null ? `${profile.tasaAdjudicacion}%` : '—'}</dd></div>
        <div><dt><CalendarDays size={13} /> Miembro desde</dt><dd>{profile.miembroDesde ? new Date(profile.miembroDesde).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }) : '—'}</dd></div>
      </dl>

      <button type="button" className="as-btn-outline" onClick={() => setIsReviewsOpen(true)}>
        <History size={15} /> Ver historial de calificaciones y compras
      </button>

      {profile.puedoCalificar && <RateBuyerForm auctionId={auctionId} onRated={load} />}
      {profile.yaCalifique && <p className="as-muted as-rated-note">Ya calificaste a este comprador por esta búsqueda de repuestos.</p>}

      <AuctionBuyerReviewsModal
        isOpen={isReviewsOpen}
        onClose={() => setIsReviewsOpen(false)}
        auctionId={auctionId}
        buyerName={profile.nombre}
        average={profile.calificacionPromedio}
        total={profile.totalCalificaciones}
      />
    </section>
  );
}
